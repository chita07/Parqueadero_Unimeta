const TOTAL_ESPACIOS = 33;
let estanciasMapa = {};
let miCheckin = null;
let tempInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
    await parkingDB.ready();
    if (parkingDB.isOnline()) await parkingDB.syncNow();
    actualizarIndicadorJornada();
    document.getElementById('checkin-placa')?.addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });
    document.getElementById('tooltip-cerrar')?.addEventListener('click', cerrarTooltip);
    await cargarDatos();
    const params = new URLSearchParams(location.search);
    const ticket = params.get('ticket');
    if (ticket) {
        const entry = (await parkingDB.all('estancias')).find(x => x.ticket_entrada === ticket);
        if (entry) { miCheckin = entry; mostrarPanelCheckin(entry); }
    }

    // Restaurar temporizador desde sessionStorage (sobrevive recarga)
    const savedTimer = sessionStorage.getItem('unimeta_timer_fin');
    const savedCheckinId = sessionStorage.getItem('unimeta_checkin_id');
    if (savedTimer && savedCheckinId) {
        const fechaFin = new Date(savedTimer);
        if (fechaFin > new Date()) {
            iniciarTemporizador(fechaFin);
            // Intentar restaurar el panel
            const { data: ci } = await db.from('checkins').select('*').eq('id', savedCheckinId).single();
            if (ci) {
                miCheckin = ci;
                const { data: pago } = await db.from('pagos').select('*').eq('id', ci.pago_id).single();
                if (pago) mostrarPanelCheckin(ci, pago);
                await cargarDatos();
            }
        } else {
            sessionStorage.removeItem('unimeta_timer_fin');
            sessionStorage.removeItem('unimeta_checkin_id');
        }
    }

    // Auto-refresh del estado del mapa cada 30 segundos
    setInterval(async () => {
        await limpiarCheckinsPasados();
        await cargarDatos();
    }, 30000);
});

function getJornadaActual() {
    const h = new Date().getHours();
    if (h >= 6 && h < 13) return 'diurna';
    if (h >= 18 && h < 22) return 'nocturna';
    return null;
}

function actualizarIndicadorJornada() {
    const jornada = getJornadaActual();
    document.getElementById('jornada-badge-label').textContent = jornada ? `Jornada ${jornada} activa` : 'Fuera de jornada';
    document.getElementById('jornada-badge-hora').textContent = jornada === 'diurna' ? '6 AM - 1 PM' : jornada === 'nocturna' ? '6 PM - 10 PM' : 'Operación continua';
}

async function cargarDatos() {
    const records = await parkingDB.all('estancias');
    estanciasMapa = {};
    records.filter(x => !x.salida_at).forEach(x => { estanciasMapa[x.espacio_numero] = x; });
    renderizarEspacios();
    actualizarContador();
}

function renderizarEspacios() {
    document.querySelectorAll('.espacio').forEach(el => {
        const numero = Number(el.dataset.numero);
        const entry = estanciasMapa[numero];
        el.classList.remove('libre', 'ocupado', 'mi-espacio', 'cedida', 'reservada');
        el.classList.add(entry ? (miCheckin && entry.id === miCheckin.id ? 'mi-espacio' : 'ocupado') : 'libre');
        const next = el.cloneNode(true);
        next.addEventListener('click', () => entry && mostrarTooltip(numero, entry));
        el.parentNode.replaceChild(next, el);
/* Legacy Supabase map renderer retained for reference during migration.
        const numero = parseInt(el.dataset.numero);
        const checkin  = checkinsMapa[numero];
        const cesion   = cesionesMapa[numero];
        const reserva  = reservasMapa[numero];

        el.classList.remove('libre', 'ocupado', 'mi-espacio', 'cedida', 'reservada', 'just-assigned');

        let esMio = false;
        if (checkin && miCheckin && checkin.id === miCheckin.id) esMio = true;

        if (esMio) {
            el.classList.add('mi-espacio');
            el.innerHTML = `<span class="moto-icon">🏍️</span><span class="slot-num">${numero}</span>`;
            setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
        } else if (checkin) {
            el.classList.add('ocupado');
            el.innerHTML = `<span class="moto-icon">🏍️</span><span class="slot-num">${numero}</span>`;
        } else if (cesion) {
            el.classList.add('cedida');
            el.innerHTML = `<span class="slot-num">${numero}</span>`;
        } else if (reserva) {
            el.classList.add('reservada');
            el.innerHTML = `<span class="slot-num">${numero}</span>`;
        } else {
            el.classList.add('libre');
            el.innerHTML = `<span class="slot-num">${numero}</span>`;
        }

        const nuevo = el.cloneNode(true);
        nuevo.addEventListener('click', () => handleClick(numero, checkin, cesion, reserva));
        el.parentNode.replaceChild(nuevo, el);
*/
    });
}

function actualizarContador() {
    const occupied = Object.keys(estanciasMapa).length;
    document.getElementById('espacios-libres').textContent = Math.max(0, TOTAL_ESPACIOS - occupied);
    document.getElementById('espacios-total').textContent = TOTAL_ESPACIOS;
}

async function realizarCheckin() {
    const placa = document.getElementById('checkin-placa').value.trim().toUpperCase().replace(/[- ]/g, '');
    const btn = document.getElementById('btn-checkin');
    if (!placa) { mostrarResultado('Ingresa la placa para consultar o registrar la entrada.', 'warning'); return; }
    btn.disabled = true;
    btn.textContent = 'Consultando...';
    try {
        const all = await parkingDB.all('estancias');
        const open = all.find(x => x.placa === placa && !x.salida_at);
        if (open) {
            miCheckin = open; await cargarDatos(); mostrarPanelCheckin(open);
            mostrarResultado(`Entrada abierta: espacio #${open.espacio_numero}.`, 'success');
            return;
        }
        const previous = all.filter(x => x.placa === placa).sort((a, b) => String(b.entrada_at).localeCompare(String(a.entrada_at)))[0];
        if (!previous) {
            location.href = `pago.html?placa=${encodeURIComponent(placa)}`;
            return;
        }
        const service = (await parkingDB.activeServices(placa))[0];
        if (!service) {
            location.href = `pago.html?placa=${encodeURIComponent(placa)}`;
            return;
        }
        const result = await parkingDB.createEntry({
            placa, nombre: previous.nombre, cedula: previous.cedula, telefono: previous.telefono,
            correo: previous.correo, tipo_usuario: previous.tipo_usuario,
            es_estudiante: previous.es_estudiante, programa_academico: previous.programa_academico,
            area_trabajo: previous.area_trabajo, cargo: previous.cargo, plan: service.tipo_plan
        });
        miCheckin = result.entry;
        await cargarDatos();
        mostrarPanelCheckin(result.entry);
        mostrarResultado(`Reingreso registrado. No se genera un nuevo cobro para el servicio vigente.`, 'success');
    } catch (error) {
        mostrarResultado(error.message || 'No fue posible registrar la entrada.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Ya llegué →';
/* Legacy online check-in flow retained for reference during migration.
    btn.textContent = 'Verificando...';

    const ahora = new Date().toISOString();
    const jornadaActual = getJornadaActual();

    // 1. Verificar que la placa tiene una suscripción/pago activo
    const { data: pagos, error: errPago } = await db
        .from('pagos')
        .select('*')
        .ilike('placa', placa)
        .gt('fecha_fin', ahora)
        .order('fecha_inicio', { ascending: false })
        .limit(1);

    if (errPago || !pagos || pagos.length === 0) {
        mostrarResultado('❌ No se encontró una suscripción activa para la placa <strong>' + placa + '</strong>. Por favor verifica o <a href="pago.html">realiza tu pago</a>.', 'error');
        btn.disabled = false; btn.textContent = 'Ya llegué →';
        return;
    }

    const pago = pagos[0];

    // 2. Verificar que no tenga ya un check-in activo hoy (sin salida)
    const { data: checkinExistente } = await db
        .from('checkins')
        .select('*')
        .ilike('placa', placa)
        .gt('auto_liberar_a', ahora)
        .is('fecha_salida', null)
        .limit(1);

    if (checkinExistente && checkinExistente.length > 0) {
        const ci = checkinExistente[0];
        miCheckin = ci;
        await cargarDatos();
        mostrarResultado(`✅ Ya tienes un check-in activo. Tu espacio es el <strong>#${ci.espacio_numero}</strong>. Se libera a las ${formatHoraSimple(ci.auto_liberar_a)}.`, 'success');
        mostrarPanelCheckin(ci, pago);
        btn.disabled = false; btn.textContent = 'Ya llegué →';
        return;
    }

    // 3. Determinar jornada: usar la jornada actual si está activa, o la del pago
    const jornada = jornadaActual || pago.jornada || 'diurna';

    // 4. Buscar espacio libre (no presente en check-ins activos)
    const espaciosOcupados = new Set(Object.keys(checkinsMapa).map(Number));
    let espacioLibre = null;
    for (let i = 1; i <= TOTAL_ESPACIOS; i++) {
        if (!espaciosOcupados.has(i)) { espacioLibre = i; break; }
    }

    if (!espacioLibre) {
        mostrarResultado('⚠️ El parqueadero está lleno en este momento. Por favor espera a que se libere un espacio.', 'warning');
        btn.disabled = false; btn.textContent = 'Ya llegué →';
        return;
    }

    // 5. Calcular hora de auto-liberación
    const autoLiberarA = getAutoLiberaA(jornada);

    // 6. Insertar check-in
    const { data: nuevoCheckin, error: errCheckin } = await db
        .from('checkins')
        .insert([{
            pago_id:        pago.id,
            placa:          placa,
            nombre:         pago.nombre,
            espacio_numero: espacioLibre,
            jornada:        jornada,
            auto_liberar_a: autoLiberarA.toISOString()
        }])
        .select()
        .single();

    if (errCheckin) {
        mostrarResultado('❌ Error al registrar tu llegada: ' + errCheckin.message, 'error');
        btn.disabled = false; btn.textContent = 'Ya llegué →';
        return;
    }

    miCheckin = nuevoCheckin;
    await cargarDatos();

    // Guardar en sessionStorage para persistir el temporizador tras recarga
    sessionStorage.setItem('unimeta_timer_fin', autoLiberarA.toISOString());
    sessionStorage.setItem('unimeta_checkin_id', nuevoCheckin.id);

    // Animación en el espacio asignado
    setTimeout(() => {
        const espacioEl = document.querySelector(`.espacio[data-numero="${espacioLibre}"]`);
        if (espacioEl) espacioEl.classList.add('just-assigned');
    }, 100);

    // Sonido suave de confirmación
    tocarSonidoExito();

    mostrarResultado(`🎉 ¡Bienvenido! Tu espacio asignado es el <strong>#${espacioLibre}</strong>. Se libera automáticamente a las ${formatHoraSimple(autoLiberarA.toISOString())}.`, 'success');
    mostrarPanelCheckin(nuevoCheckin, pago);

    btn.disabled = false;
    btn.textContent = 'Ya llegué →';
}

function mostrarResultado(html, tipo) {
    const el = document.getElementById('checkin-resultado');
    el.innerHTML = html;
    el.className = 'checkin-resultado checkin-resultado-' + tipo;
}

function formatHoraSimple(isoStr) {
    return new Date(isoStr).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ===== Panel de reserva (panel inferior) =====
function mostrarPanelCheckin(checkin, pago) {
    const panel = document.getElementById('panel-reserva');
    panel.classList.remove('hidden');

    document.getElementById('reserva-espacio').querySelector('.espacio-big').textContent = '#' + checkin.espacio_numero;
    document.getElementById('reserva-nombre').textContent  = pago.nombre || '—';
    document.getElementById('reserva-placa').textContent   = pago.placa  || '—';
    document.getElementById('reserva-plan').textContent    = planNombres[pago.tipo_servicio] || pago.tipo_servicio;
    document.getElementById('reserva-jornada').textContent = JORNADAS[checkin.jornada]?.label || checkin.jornada;
    document.getElementById('reserva-auto-libera').textContent = formatHoraSimple(checkin.auto_liberar_a);
    document.getElementById('reserva-ref').textContent     = pago.referencia || '—';

    // Reemplazar temporizador con cuenta regresiva a auto-liberación
    iniciarTemporizador(new Date(checkin.auto_liberar_a));
}

// ===== Temporizador =====
let tempInterval = null;
function iniciarTemporizador(fechaFin) {
    if (tempInterval) clearInterval(tempInterval);
    const el = document.getElementById('temp-valor');
    const textoEl = el ? el.previousElementSibling : null;
    if (textoEl) textoEl.textContent = 'Espacio libre en: ';
    function tick() {
        const diff = fechaFin - new Date();
        if (diff <= 0) {
            if (el) { el.textContent = 'Espacio liberado'; el.style.color = '#E30614'; }
            clearInterval(tempInterval);
            // Limpiar sessionStorage al expirar
            sessionStorage.removeItem('unimeta_timer_fin');
            sessionStorage.removeItem('unimeta_checkin_id');
            return;
        }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        if (el) el.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
*/
    }
}

function mostrarResultado(message, type) {
    const el = document.getElementById('checkin-resultado');
    el.innerHTML = message;
    el.className = `checkin-resultado checkin-resultado-${type}`;
}

function formatHour(iso) { return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }); }

function mostrarPanelCheckin(entry) {
    miCheckin = entry;
    document.getElementById('panel-reserva').classList.remove('hidden');
    document.getElementById('reserva-espacio').querySelector('.espacio-big').textContent = `#${entry.espacio_numero}`;
    document.getElementById('reserva-nombre').textContent = entry.nombre;
    document.getElementById('reserva-placa').textContent = entry.placa;
    document.getElementById('reserva-plan').textContent = entry.exento_cobro ? 'Trabajador exento' : entry.plan;
    document.getElementById('reserva-jornada').textContent = entry.tipo_usuario === 'trabajador_universidad' ? (entry.area_trabajo || 'Universidad') : entry.tipo_usuario;
    document.getElementById('reserva-auto-libera').textContent = `Entrada ${formatHour(entry.entrada_at)}`;
    document.getElementById('reserva-ref').textContent = entry.ticket_entrada;
    iniciarTemporizador(entry.entrada_at);
}

function iniciarTemporizador(start) {
    if (tempInterval) clearInterval(tempInterval);
    const el = document.getElementById('temp-valor');
    const tick = () => {
        const diff = Math.max(0, Date.now() - new Date(start).getTime());
        const h = Math.floor(diff / 3600000); const m = Math.floor((diff % 3600000) / 60000); const s = Math.floor((diff % 60000) / 1000);
        el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    tick(); tempInterval = setInterval(tick, 1000);
    const label = el.previousElementSibling; if (label) label.textContent = 'Tiempo de uso: ';
}

function mostrarTooltip(numero, entry) {
    document.getElementById('tooltip-num').textContent = numero;
    document.getElementById('tooltip-usuario').textContent = entry.nombre;
    document.getElementById('tooltip-placa').textContent = entry.placa;
    document.getElementById('tooltip-plan').textContent = entry.exento_cobro ? 'Trabajador exento' : entry.plan;
    document.getElementById('tooltip-estado').textContent = 'Ocupado';
    document.getElementById('tooltip-espacio').classList.remove('hidden');
    let overlay = document.querySelector('.tooltip-overlay');
    if (!overlay) { overlay = document.createElement('div'); overlay.className = 'tooltip-overlay'; overlay.onclick = cerrarTooltip; document.body.appendChild(overlay); }
    overlay.classList.remove('hidden');
}

function cerrarTooltip() {
    document.getElementById('tooltip-espacio')?.classList.add('hidden');
    document.querySelector('.tooltip-overlay')?.classList.add('hidden');
}

function renderExitTicket(result) {
    const entry = result.entry;
    const status = result.exempt ? 'EXENTO - TRABAJADOR UNIVERSIDAD' : result.reentry ? 'SIN COBRO - SERVICIO VIGENTE' : 'PAGADO';
    const html = `<div style="padding:16px;border:2px solid #E30614;border-radius:10px;background:#fff;margin-top:12px"><h3>Ticket de salida</h3><p><b>${result.ticket}</b></p><p>Placa: <b>${entry.placa}</b><br>Usuario: ${entry.nombre}<br>Entrada: ${new Date(entry.entrada_at).toLocaleString('es-CO')}<br>Salida: ${new Date(entry.salida_at).toLocaleString('es-CO')}<br>Tiempo de uso: <b>${entry.horas_uso} horas</b><br>Estado: <b>${status}</b><br>Valor: <b>$${Number(result.charge).toLocaleString('es-CO')}</b></p><button type="button" onclick="imprimirTicketSalida()">🖨️ Imprimir ticket de salida</button></div>`;
    const container = document.getElementById('checkin-resultado');
    container.innerHTML = html; container.className = 'checkin-resultado checkin-resultado-success';
    window.ultimoTicketSalida = result;
}

async function registrarSalidaMiEspacio() {
    if (!miCheckin) { mostrarResultado('No hay una entrada abierta para esta sesión.', 'warning'); return; }
    if (!confirm(`¿Confirmas la salida de ${miCheckin.placa}? El cobro se realizará ahora.`)) return;
    const method = prompt('Método de pago: efectivo, tarjeta, transferencia', 'efectivo') || 'efectivo';
    try {
        const result = await parkingDB.closeEntry(miCheckin.id, method.toLowerCase());
        renderExitTicket(result);
        miCheckin = null;
        document.getElementById('panel-reserva').classList.add('hidden');
        await cargarDatos();
    } catch (error) { mostrarResultado(error.message || 'No se pudo registrar la salida.', 'error'); }
}

function imprimirTicketSalida() {
    const result = window.ultimoTicketSalida;
    if (!result) return;
    const e = result.entry;
    const w = window.open('', '_blank', 'width=420,height=700');
    if (!w) return;
    w.document.write(`<html><head><title>${result.ticket}</title><style>body{font-family:Arial;padding:20px;max-width:360px}h2{text-align:center}.row{margin:8px 0}</style></head><body><h2>PARQUEADERO UNIMETA</h2><p style="text-align:center">TICKET DE SALIDA</p><hr><div class="row"><b>Ticket:</b> ${result.ticket}</div><div class="row"><b>Entrada:</b> ${new Date(e.entrada_at).toLocaleString('es-CO')}</div><div class="row"><b>Salida:</b> ${new Date(e.salida_at).toLocaleString('es-CO')}</div><div class="row"><b>Placa:</b> ${e.placa}</div><div class="row"><b>Usuario:</b> ${e.nombre}</div><div class="row"><b>Tiempo:</b> ${e.horas_uso} horas</div><div class="row"><b>Estado:</b> ${result.exempt ? 'EXENTO' : result.reentry ? 'SIN COBRO - SERVICIO VIGENTE' : 'PAGADO'}</div><div class="row"><b>Total:</b> $${Number(result.charge).toLocaleString('es-CO')}</div><hr><script>window.print();</script></body></html>`);
    w.document.close();
/* Legacy online exit flow retained for reference during migration.
    if (!miCheckin) {
        await uiAlert('Sin espacio activo', 'No tienes un espacio asignado activo.', 'ℹ️');
        return;
    }

    const confirmacion = await uiConfirm(
        'Confirmar Salida',
        `¿Confirmas la salida de tu vehículo (${miCheckin.placa}) del espacio #${miCheckin.espacio_numero}? El espacio quedará disponible para otros.`,
        '🚫'
    );
    if (!confirmacion) return;

    const ahoraIso = new Date().toISOString();
    const { error } = await db
        .from('checkins')
        .update({ fecha_salida: ahoraIso })
        .eq('id', miCheckin.id);

    if (error) {
        await uiAlert('Error', 'Error al registrar salida: ' + error.message, '❌');
        return;
    }

    await uiAlert('Salida Registrada', `¡Hasta pronto! El espacio #${miCheckin.espacio_numero} ha sido liberado exitosamente.`, '✅');

    // Limpiar sessionStorage
    sessionStorage.removeItem('unimeta_timer_fin');
    sessionStorage.removeItem('unimeta_checkin_id');

    miCheckin = null;
    document.getElementById('panel-reserva').classList.add('hidden');
    document.getElementById('checkin-resultado').classList.add('hidden');
    document.getElementById('checkin-placa').value = '';
    await cargarDatos();
*/
}

// ===== Sonido de confirmación (web audio API) =====
function tocarSonidoExito() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const notas = [523, 659, 784]; // Do, Mi, Sol
        notas.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            const t = ctx.currentTime + i * 0.12;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.25, t + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            osc.start(t);
            osc.stop(t + 0.25);
        });
    } catch(e) { /* AudioContext no disponible */ }
}

// ===== UI Dialogs personalizados =====
function uiAlert(titulo, mensaje, icono = '⚠️') {
    return new Promise((resolve) => {
        document.getElementById('custom-dialog-title').textContent = titulo;
        document.getElementById('custom-dialog-msg').textContent = mensaje;
        document.getElementById('custom-dialog-icon').textContent = icono;
        const actions = document.getElementById('custom-dialog-actions');
        actions.innerHTML = '<button class="custom-dialog-btn custom-dialog-btn-primary" id="btn-dialog-ok">Aceptar</button>';
        document.getElementById('custom-dialog-overlay').classList.remove('hidden');
        document.getElementById('btn-dialog-ok').onclick = () => {
            document.getElementById('custom-dialog-overlay').classList.add('hidden');
            resolve();
        };
    });
}

function uiConfirm(titulo, mensaje, icono = '❓') {
    return new Promise((resolve) => {
        document.getElementById('custom-dialog-title').textContent = titulo;
        document.getElementById('custom-dialog-msg').textContent = mensaje;
        document.getElementById('custom-dialog-icon').textContent = icono;
        const actions = document.getElementById('custom-dialog-actions');
        actions.innerHTML = `
            <button class="custom-dialog-btn custom-dialog-btn-secondary" id="btn-dialog-cancel">Cancelar</button>
            <button class="custom-dialog-btn custom-dialog-btn-primary" id="btn-dialog-ok">Confirmar</button>
        `;
        document.getElementById('custom-dialog-overlay').classList.remove('hidden');
        document.getElementById('btn-dialog-ok').onclick = () => {
            document.getElementById('custom-dialog-overlay').classList.add('hidden');
            resolve(true);
        };
        document.getElementById('btn-dialog-cancel').onclick = () => {
            document.getElementById('custom-dialog-overlay').classList.add('hidden');
            resolve(false);
        };
    });
}
