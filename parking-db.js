/*
 * UNIPARKING - almacenamiento local y sincronización offline-first.
 *
 * La operación del parqueadero siempre consulta IndexedDB. Las escrituras se
 * guardan primero allí y quedan en una cola hasta que Supabase esté disponible.
 * Supabase sigue siendo la copia central, respaldo y fuente de recuperación.
 */
(function () {
    'use strict';

    const DB_NAME = 'uniparking_local_v2';
    const DB_VERSION = 1;
    const STORES = ['clientes', 'servicios', 'estancias', 'trabajadores', 'tarifas', 'outbox', 'meta'];
    const REMOTE_TABLES = {
        clientes: 'parqueadero_clientes',
        servicios: 'parqueadero_servicios',
        estancias: 'parqueadero_estancias',
        trabajadores: 'parqueadero_trabajadores',
        tarifas: 'tarifas'
    };
    const DEVICE_KEY = 'uniparking_device_id';
    const newId = () => window.crypto?.randomUUID ? window.crypto.randomUUID() : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const deviceId = localStorage.getItem(DEVICE_KEY) || newId();
    localStorage.setItem(DEVICE_KEY, deviceId);

    let dbPromise;
    let syncInProgress = false;

    function openDb() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const database = request.result;
                STORES.forEach(name => {
                    if (!database.objectStoreNames.contains(name)) {
                        const keyPath = name === 'outbox' ? 'id' : 'id';
                        database.createObjectStore(name, { keyPath });
                    }
                });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return dbPromise;
    }

    async function tx(storeName, mode, action) {
        const database = await openDb();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);
            let result;
            try { result = action(store); } catch (error) { reject(error); return; }
            transaction.oncomplete = () => resolve(result);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error || new Error('Transacción local abortada'));
        });
    }

    async function get(storeName, id) {
        const database = await openDb();
        return new Promise((resolve, reject) => {
            const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async function all(storeName) {
        const database = await openDb();
        return new Promise((resolve, reject) => {
            const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    function nowIso() { return new Date().toISOString(); }

    async function queue(table, operation, record) {
        await tx('outbox', 'readwrite', store => store.put({
            id: `${table}:${record.id}`,
            table,
            operation,
            record,
            created_at: nowIso(),
            device_id: deviceId
        }));
    }

    async function save(table, record, operation = 'upsert', sync = true) {
        const stamped = { ...record, updated_at: nowIso(), device_id: deviceId };
        await tx(table, 'readwrite', store => store.put(stamped));
        await queue(table, operation, stamped);
        if (sync && navigator.onLine) syncNow();
        return stamped;
    }

    async function pullTable(localName) {
        if (!navigator.onLine || !window.remoteDb) return;
        const remoteName = REMOTE_TABLES[localName];
        if (!remoteName) return;
        const { data, error } = await window.remoteDb.from(remoteName).select('*');
        if (error || !data) return;
        const pending = new Set((await all('outbox')).filter(x => x.table === localName).map(x => x.record.id));
        for (const row of data) {
            const localRow = localName === 'tarifas' ? { ...row, id: row.tipo_servicio } : row;
            if (!pending.has(localRow.id)) await tx(localName, 'readwrite', store => store.put(localRow));
        }
        await tx('meta', 'readwrite', store => store.put({ id: `last_pull_${localName}`, value: nowIso() }));
    }

    async function syncNow() {
        if (syncInProgress || !navigator.onLine || !window.remoteDb) return;
        syncInProgress = true;
        try {
            const pending = await all('outbox');
            const priority = { clientes: 1, trabajadores: 2, servicios: 3, estancias: 4, tarifas: 5 };
            pending.sort((a, b) => (priority[a.table] || 9) - (priority[b.table] || 9));
            for (const item of pending) {
                const remoteName = REMOTE_TABLES[item.table];
                if (!remoteName) continue;
                let response;
                if (item.operation === 'delete') response = await window.remoteDb.from(remoteName).delete().eq('id', item.record.id);
                else {
                    const payload = { ...item.record };
                    if (item.table === 'tarifas') delete payload.id;
                    response = await window.remoteDb.from(remoteName).upsert(payload, { onConflict: item.table === 'tarifas' ? 'tipo_servicio' : 'id' });
                }
                if (!response.error) await tx('outbox', 'readwrite', store => store.delete(item.id));
            }
            for (const table of Object.keys(REMOTE_TABLES)) await pullTable(table);
            window.dispatchEvent(new CustomEvent('parking-sync', { detail: { online: true } }));
        } catch (error) {
            console.warn('Sincronización pendiente:', error.message || error);
            window.dispatchEvent(new CustomEvent('parking-sync', { detail: { online: false, error } }));
        } finally {
            syncInProgress = false;
        }
    }

    function startSync() {
        openDb().then(() => syncNow());
        if ('serviceWorker' in navigator && location.protocol !== 'file:') {
            navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service Worker no disponible:', error.message));
        }
        window.addEventListener('online', syncNow);
        updateConnectionBadge();
        window.addEventListener('online', updateConnectionBadge);
        window.addEventListener('offline', updateConnectionBadge);
        setInterval(syncNow, 30000);
    }

    function updateConnectionBadge() {
        let badge = document.getElementById('parking-connection-status');
        if (!badge) {
            badge = document.createElement('div'); badge.id = 'parking-connection-status';
            badge.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9999;padding:7px 12px;border-radius:18px;color:white;font:600 12px Arial;box-shadow:0 2px 8px #0003;';
            document.body.appendChild(badge);
        }
        badge.textContent = navigator.onLine ? '● En línea · sincronizando' : '● Modo offline · guardado local';
        badge.style.background = navigator.onLine ? '#15803D' : '#B45309';
    }

    function dateEndOfDay(date = new Date()) {
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        return end.toISOString();
    }

    function addPlan(date, plan) {
        const end = new Date(date);
        if (plan === 'semanal') end.setDate(end.getDate() + 7);
        else if (plan === 'mensual') end.setMonth(end.getMonth() + 1);
        else return dateEndOfDay(date);
        return end.toISOString();
    }

    async function findWorker(cedula) {
        const list = await all('trabajadores');
        return list.find(x => String(x.cedula) === String(cedula) && x.activo !== false) || null;
    }

    async function findClient(cedula) {
        const list = await all('clientes');
        return list.find(x => String(x.cedula) === String(cedula)) || null;
    }

    async function findOpenByPlate(placa) {
        const list = await all('estancias');
        return list.find(x => x.placa === placa && !x.salida_at) || null;
    }

    async function latestByPlate(placa) {
        const list = await all('estancias');
        return list.filter(x => x.placa === String(placa).trim().toUpperCase())
            .sort((a, b) => String(b.entrada_at).localeCompare(String(a.entrada_at)))[0] || null;
    }

    async function activeServices(placa, at = new Date()) {
        const time = at.toISOString();
        const list = await all('servicios');
        return list.filter(x => x.placa === placa && x.estado === 'activo' && x.vigente_hasta > time)
            .sort((a, b) => String(b.creado_at).localeCompare(String(a.creado_at)));
    }

    async function getTariff(plan = 'diario') {
        const local = await get('tarifas', plan);
        if (local && Number(local.precio) > 0) return Number(local.precio);
        return plan === 'semanal' ? 10000 : plan === 'mensual' ? 45000 : 2000;
    }

    async function nextSpace() {
        const list = await all('estancias');
        const active = new Set(list.filter(x => !x.salida_at).map(x => Number(x.espacio_numero)));
        for (let number = 1; number <= 33; number++) if (!active.has(number)) return number;
        return null;
    }

    async function createEntry(input) {
        const placa = String(input.placa || '').trim().toUpperCase();
        const previous = placa ? await latestByPlate(placa) : null;
        const data = previous ? {
            ...previous, ...input,
            nombre: input.nombre || previous.nombre,
            cedula: input.cedula || previous.cedula,
            telefono: input.telefono || previous.telefono,
            correo: input.correo || previous.correo,
            tipo_usuario: input.tipo_usuario || previous.tipo_usuario,
            es_estudiante: input.es_estudiante ?? previous.es_estudiante,
            programa_academico: input.programa_academico || previous.programa_academico,
            codigo_laboral: input.codigo_laboral || previous.codigo_laboral,
            area_trabajo: input.area_trabajo || previous.area_trabajo,
            cargo: input.cargo || previous.cargo
        } : input;
        if (!placa || !data.nombre || !data.cedula) throw new Error('Placa, nombre y cédula son obligatorios.');

        const worker = data.tipo_usuario === 'trabajador_universidad' ? await findWorker(data.cedula) : null;
        if (data.tipo_usuario === 'trabajador_universidad' && !worker) {
            throw new Error('El trabajador no está autorizado en la lista local. Solicita validación administrativa.');
        }
        if (worker?.placa_autorizada && worker.placa_autorizada.replace(/[- ]/g, '').toUpperCase() !== placa) {
            throw new Error('La placa no coincide con la placa autorizada para este trabajador.');
        }
        if (worker?.codigo_laboral && data.codigo_laboral && String(worker.codigo_laboral) !== String(data.codigo_laboral)) {
            throw new Error('El código laboral no coincide con la autorización registrada.');
        }

        const existing = await findClient(data.cedula);
        const client = await save('clientes', {
            id: existing?.id || newId(),
            nombre: data.nombre.trim(), cedula: data.cedula.trim(), telefono: data.telefono || '',
            correo: data.correo || '', es_estudiante: Boolean(data.es_estudiante),
            programa_academico: data.programa_academico || '', tipo_usuario: data.tipo_usuario || 'particular',
            codigo_laboral: worker?.codigo_laboral || data.codigo_laboral || '',
            area_trabajo: worker?.area_trabajo || data.area_trabajo || '', cargo: worker?.cargo || data.cargo || ''
        });

        const open = await findOpenByPlate(placa);
        if (open) throw new Error(`La placa ya tiene una entrada abierta con el ticket ${open.ticket_entrada}.`);

        const active = await activeServices(placa);
        let service = active[0];
        const now = new Date();
        const exento = Boolean(worker);
        const plan = exento ? 'exento' : (data.plan || 'diario');
        if (!service || service.tipo_plan !== plan || exento !== Boolean(service.exento_cobro)) {
            service = await save('servicios', {
                id: newId(), cliente_id: client.id, placa, tipo_plan: plan,
                creado_at: now.toISOString(), vigente_desde: now.toISOString(),
                vigente_hasta: exento ? '9999-12-31T23:59:59.999Z' : addPlan(now, plan),
                exento_cobro: exento, cobro_generado: exento,
                estado: 'activo', valor_servicio: exento ? 0 : 0,
                motivo_exencion: exento ? 'Trabajador de la Universidad autorizado' : null
            });
        }

        const space = await nextSpace();
        if (!space) throw new Error('No hay espacios disponibles actualmente.');
        const ticket = `EN-${now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-${Math.floor(Math.random() * 900 + 100)}`;
        const entry = await save('estancias', {
            id: newId(), servicio_id: service.id, cliente_id: client.id,
            ticket_entrada: ticket, ticket_salida: null, placa, nombre: client.nombre,
            cedula: client.cedula, telefono: client.telefono, correo: client.correo,
            es_estudiante: client.es_estudiante, programa_academico: client.programa_academico,
            tipo_usuario: exento ? 'trabajador_universidad' : client.tipo_usuario,
            area_trabajo: client.area_trabajo, cargo: client.cargo, codigo_laboral: client.codigo_laboral || '', exento_cobro: exento,
            plan: service.tipo_plan, espacio_numero: space, entrada_at: now.toISOString(), salida_at: null,
            horas_uso: null, valor_cobrado: 0, estado: 'abierta', estado_pago: exento ? 'exento' : 'pendiente_salida',
            motivo_exencion: exento ? 'Trabajador de la Universidad autorizado' : null,
            metodo_pago: null, ticket_entrada_generado_at: now.toISOString(), ticket_salida_generado_at: null
        });
        return { entry, client, service, worker, online: navigator.onLine };
    }

    async function closeEntry(entryId, method = 'efectivo') {
        const entry = await get('estancias', entryId);
        if (!entry) throw new Error('No se encontró la entrada.');
        if (entry.salida_at) throw new Error('Esta estancia ya tiene registrada la salida.');
        const service = await get('servicios', entry.servicio_id);
        const exit = new Date();
        const hours = Math.max(0, Math.ceil((exit - new Date(entry.entrada_at)) / 3600000));
        const alreadyPaid = Boolean(service?.cobro_generado);
        const exempt = Boolean(entry.exento_cobro || service?.exento_cobro);
        const charge = exempt || alreadyPaid ? 0 : await getTariff('diario');
        const ticket = `SA-${exit.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-${Math.floor(Math.random() * 900 + 100)}`;
        const updated = await save('estancias', {
            ...entry, ticket_salida: ticket, salida_at: exit.toISOString(), horas_uso: hours,
            valor_cobrado: charge, estado: 'cerrada', estado_pago: exempt ? 'exento' : (charge ? 'pagado' : 'sin_cobro_reingreso'),
            motivo_exencion: exempt ? (entry.motivo_exencion || 'Trabajador autorizado') : null,
            metodo_pago: charge ? method : null, ticket_salida_generado_at: exit.toISOString()
        });
        if (service && !exempt && !alreadyPaid) {
            await save('servicios', { ...service, cobro_generado: true, valor_servicio: charge,
                pagado_at: exit.toISOString(), metodo_pago: method });
        }
        return { entry: updated, charge, hours, ticket, exempt, reentry: alreadyPaid };
    }

    async function records(from, to) {
        let list = await all('estancias');
        if (from) list = list.filter(x => x.entrada_at >= `${from}T00:00:00`);
        if (to) list = list.filter(x => x.entrada_at <= `${to}T23:59:59.999`);
        return list.sort((a, b) => String(b.entrada_at).localeCompare(String(a.entrada_at)));
    }

    async function workerRecords(from, to) {
        return (await records(from, to)).filter(x => x.tipo_usuario === 'trabajador_universidad' || x.exento_cobro);
    }

    async function saveWorker(worker) {
        return save('trabajadores', { ...worker, id: worker.id || newId(), activo: worker.activo !== false });
    }

    window.parkingDB = {
        deviceId, ready: openDb, syncNow, createEntry, closeEntry, records, workerRecords,
        saveWorker, findWorker, findOpenByPlate, latestByPlate, activeServices, all, get, save, getTariff,
        isOnline: () => navigator.onLine
    };

    startSync();
})();
