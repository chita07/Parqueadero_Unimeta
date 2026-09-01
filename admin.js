const planNombres = { diario: 'Día', semanal: 'Semana', mensual: 'Mes' };

// Formatear hora
function formatHora(fecha) {
    return new Date(fecha).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Calcular estado en base a las fechas
function calcularEstado(fechaFin) {
    const ahora = new Date();
    const fin = new Date(fechaFin);
    return ahora <= fin ? 'activo' : 'no activo';
}

// Badge según estado
function badgeEstado(estado) {
    const clases = { 'activo': 'badge-active', 'no activo': 'badge-expired' };
    const clase = clases[estado] || 'badge-active';
    return `<span class="badge ${clase}">${estado.charAt(0).toUpperCase() + estado.slice(1)}</span>`;
}



// Cargar registros de hoy
async function cargarRegistros() {
    const { data, error } = await db
        .from('pagos')
        .select('*')
        .order('fecha_inicio', { ascending: false });

    if (error) {
        console.error('Error cargando registros:', error);
        return;
    }

    mostrarRegistros(data);
    actualizarEstadisticas(data);
}

// Mostrar registros en la tabla
function mostrarRegistros(registros) {
    const tbody = document.getElementById('tabla-registros');
    if (registros.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:#888;">No hay registros</td></tr>';
        return;
    }
    tbody.innerHTML = registros.map((r, i) => {
        const estado = calcularEstado(r.fecha_fin);
        return `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${r.placa}</strong></td>
            <td><span class="vehicle-type"><span class="icon">🏍️</span> Moto</span></td>
            <td>${planNombres[r.tipo_servicio] || r.tipo_servicio}</td>
            <td>${formatHora(r.fecha_inicio)}</td>
            <td>${badgeEstado(estado)}</td>
            <td>$${r.precio.toLocaleString('es-CO')}</td>
            <td><button class="btn-action btn-view" onclick="verDetalle('${r.placa}')">Ver</button></td>
        </tr>
    `}).join('');
}

// Actualizar estadísticas
function actualizarEstadisticas(registros) {
    const total = registros.length;
    const activos = registros.filter(r => calcularEstado(r.fecha_fin) === 'activo').length;
    const noActivos = registros.filter(r => calcularEstado(r.fecha_fin) === 'no activo').length;
    const ingresos = registros.reduce((sum, r) => sum + r.precio, 0);

    document.getElementById('stat-motos').textContent = total;
    document.getElementById('stat-ingresos').textContent = '$' + ingresos.toLocaleString('es-CO');
    document.getElementById('stat-activas').textContent = activos;

    document.getElementById('qs-registros').textContent = total;
    document.getElementById('qs-activos').textContent = activos;
    document.getElementById('qs-salieron').textContent = noActivos;
    document.getElementById('qs-total').textContent = '$' + ingresos.toLocaleString('es-CO');

    // Actualizar gráfico de distribución
    const diarios = registros.filter(r => r.tipo_servicio === 'diario').length;
    const semanales = registros.filter(r => r.tipo_servicio === 'semanal').length;
    const mensuales = registros.filter(r => r.tipo_servicio === 'mensual').length;

    document.getElementById('chart-total').textContent = total;
    document.getElementById('chart-diario').textContent = diarios + ' usuarios';
    document.getElementById('chart-semanal').textContent = semanales + ' usuarios';
    document.getElementById('chart-mensual').textContent = mensuales + ' usuarios';
    document.getElementById('chart-diario-pct').textContent = total ? (diarios / total * 100).toFixed(1) + '%' : '0%';
    document.getElementById('chart-semanal-pct').textContent = total ? (semanales / total * 100).toFixed(1) + '%' : '0%';
    document.getElementById('chart-mensual-pct').textContent = total ? (mensuales / total * 100).toFixed(1) + '%' : '0%';

    // Actualizar gráfico visual (conic-gradient proporcional)
    const pieChart = document.querySelector('.pie-chart');
    if (total > 0) {
        const pctDiario = (diarios / total) * 100;
        const pctSemanal = (semanales / total) * 100;
        const p1 = pctDiario;
        const p2 = pctDiario + pctSemanal;
        pieChart.style.background = `conic-gradient(
            #E30614 0% ${p1}%,
            #FFCD1C ${p1}% ${p2}%,
            #333333 ${p2}% 100%
        )`;
    } else {
        pieChart.style.background = '#e0e0e0';
    }
}

// Buscar en la tabla de servicios
document.querySelector('.btn-search').addEventListener('click', async function () {
    const placa = document.querySelector('.search-input').value.trim().toUpperCase();
    const tarifa = document.querySelector('.filter-select').value;

    let query = db.from('pagos').select('*')
        .order('fecha_inicio', { ascending: false });

    if (placa) query = query.ilike('placa', `%${placa}%`);
    if (tarifa) {
        const tarifaMap = { dia: 'diario', semana: 'semanal', mes: 'mensual' };
        query = query.eq('tipo_servicio', tarifaMap[tarifa] || tarifa);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Error buscando:', error);
        return;
    }
    mostrarRegistros(data);
});

// Consultar suscripción por placa
document.querySelector('.btn-lookup').addEventListener('click', async function () {
    const placa = document.getElementById('lookup-placa').value.trim().toUpperCase();
    if (!placa) {
        alert('Ingresa una placa para consultar.');
        return;
    }

    const { data, error } = await db
        .from('pagos')
        .select('*')
        .ilike('placa', placa)
        .order('fecha_inicio', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error consultando:', error);
        return;
    }

    const resultCard = document.querySelector('.result-card');
    const placeholder = document.querySelector('.result-placeholder');

    if (!data || data.length === 0) {
        resultCard.style.display = 'none';
        placeholder.style.display = 'flex';
        placeholder.querySelector('p').innerHTML = 'No se encontró ningún registro<br>para la placa <strong>' + placa + '</strong>';
        return;
    }

    const r = data[0];
    const estado = calcularEstado(r.fecha_fin);
    placeholder.style.display = 'none';
    resultCard.style.display = 'block';

    const rows = resultCard.querySelectorAll('.result-value');
    rows[0].textContent = r.placa;
    rows[1].textContent = r.nombre;
    rows[2].textContent = '🏍️ Moto';
    rows[3].textContent = planNombres[r.tipo_servicio] || r.tipo_servicio;
    rows[4].textContent = new Date(r.fecha_inicio).toLocaleDateString('es-CO');
    rows[5].textContent = new Date(r.fecha_fin).toLocaleDateString('es-CO');
    rows[6].innerHTML = badgeEstado(estado);
    rows[7].textContent = '$' + r.precio.toLocaleString('es-CO');
    rows[7].style.color = '#E30614';
    rows[7].style.fontWeight = '700';
});

// Ver detalle (rellena la consulta con la placa)
function verDetalle(placa) {
    document.getElementById('lookup-placa').value = placa;
    document.querySelector('.btn-lookup').click();
    document.querySelector('.two-columns').scrollIntoView({ behavior: 'smooth' });
}

// ===== Registro manual (efectivo) =====
const precios = { diario: 2000, semanal: 10000, mensual: 45000 };

function calcFechaFin(inicio, tipo) {
    const fin = new Date(inicio);
    if (tipo === 'diario') fin.setDate(fin.getDate() + 1);
    else if (tipo === 'semanal') fin.setDate(fin.getDate() + 7);
    else if (tipo === 'mensual') fin.setMonth(fin.getMonth() + 1);
    return fin;
}

document.getElementById('btn-registrar-manual').addEventListener('click', async function () {
    const placa = document.getElementById('reg-placa').value.trim();
    const nombre = document.getElementById('reg-nombre').value.trim();
    const cedula = document.getElementById('reg-cedula').value.trim();
    const telefono = document.getElementById('reg-telefono').value.trim();
    const plan = document.getElementById('reg-plan').value;
    const jornada = document.getElementById('reg-jornada').value;

    if (!placa || !nombre || !cedula) {
        await uiAlert('Campos Incompletos', 'Por favor completa al menos placa, nombre y cédula.', '⚠️');
        return;
    }

    const btn = this;
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    // Buscar espacio libre en check-ins activos
    const espacioNumero = await buscarEspacioLibreAdmin();

    const fechaInicio = new Date();
    const fechaFin = calcFechaFin(fechaInicio, plan);
    const ref = 'EF-' + Date.now().toString().slice(-8);

    const pagoData = {
        placa: placa.toUpperCase(),
        nombre: nombre,
        cedula: cedula,
        telefono: telefono,
        tipo_servicio: plan,
        precio: precios[plan],
        metodo_pago: 'efectivo',
        referencia: ref,
        fecha_inicio: fechaInicio.toISOString(),
        fecha_fin: fechaFin.toISOString(),
        estado: 'activo',
        jornada: jornada
    };

    const { data, error } = await db.from('pagos').insert([pagoData]).select();

    btn.disabled = false;
    btn.textContent = '💵 Registrar Pago en Efectivo';

    if (error) {
        await uiAlert('Error del Sistema', 'Error al registrar: ' + error.message, '❌');
        console.error('Supabase error:', error);
        return;
    }

    const pagoInsertado = data[0];

    // Crear check-in automático si hay espacio
    if (espacioNumero && pagoInsertado) {
        const autoLiberaA = getAutoLiberaAdmin(jornada);
        await db.from('checkins').insert([{
            pago_id: pagoInsertado.id,
            placa: placa.toUpperCase(),
            nombre: nombre,
            espacio_numero: espacioNumero,
            jornada: jornada,
            auto_liberar_a: autoLiberaA.toISOString()
        }]);
    }

    // Mostrar éxito
    document.getElementById('reg-ref').textContent = ref + (espacioNumero ? ' — Espacio #' + espacioNumero : ' — Sin espacio disponible');
    const exito = document.getElementById('registro-exito');
    exito.classList.remove('hidden');
    setTimeout(() => exito.classList.add('hidden'), 6000);

    // Limpiar formulario
    document.getElementById('reg-placa').value = '';
    document.getElementById('reg-nombre').value = '';
    document.getElementById('reg-cedula').value = '';
    document.getElementById('reg-telefono').value = '';
    document.getElementById('reg-plan').value = 'diario';

    // Recargar tabla, estadísticas y mapa
    cargarRegistros();
    cargarMapaAdmin();
});

// Cargar al iniciar
document.addEventListener('DOMContentLoaded', () => {
    cargarRegistros();
    cargarMapaAdmin();
    actualizarDashboard();
});

// ===== UI Dialogs (Alert / Confirm personalizados) =====
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
            <button class="custom-dialog-btn custom-dialog-btn-primary" id="btn-dialog-ok">Aceptar</button>
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

// ===== MAPA DEL PARQUEADERO (Admin) =====

const TOTAL_ESPACIOS_ADMIN = 33;
let mapaAdmin = {};          // { numero: pago }
let espacioSeleccionado = null;
const planNombresAdmin = { diario: 'Diario', semanal: 'Semanal', mensual: 'Mensual' };

// Lógica de jornadas (admin)
const JORNADAS_ADMIN = {
    diurna:   { inicio: 6,  fin: 13 },
    nocturna: { inicio: 18, fin: 22 }
};

function getAutoLiberaAdmin(jornada) {
    const ahora = new Date();
    const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    if (jornada === 'diurna')   d.setHours(13, 0, 0, 0);
    if (jornada === 'nocturna') d.setHours(22, 0, 0, 0);
    if (d < ahora) d.setDate(d.getDate() + 1);
    return d;
}

// Buscar espacio libre validando contra check-ins activos
async function buscarEspacioLibreAdmin() {
    const ahora = new Date().toISOString();
    const { data, error } = await db
        .from('checkins')
        .select('espacio_numero')
        .gt('auto_liberar_a', ahora);
    if (error) return null;
    const ocupados = new Set((data || []).map(c => c.espacio_numero));
    for (let i = 1; i <= TOTAL_ESPACIOS_ADMIN; i++) {
        if (!ocupados.has(i)) return i;
    }
    return null;
}

async function cargarMapaAdmin() {
    const ahora = new Date().toISOString();
    // Limpiar check-ins vencidos silenciosamente
    await db.from('checkins').delete().lt('auto_liberar_a', ahora);

    const { data, error } = await db
        .from('checkins')
        .select('*')
        .gt('auto_liberar_a', ahora);

    if (error) {
        console.warn('Error cargando mapa admin:', error.message);
        document.querySelectorAll('.admin-espacio').forEach(el => el.classList.add('libre'));
        document.getElementById('stat-espacios').textContent = '33/33';
        document.getElementById('admin-libres').textContent = '33';
        document.getElementById('admin-ocupados').textContent = '0';
        return;
    }

    mapaAdmin = {};
    (data || []).forEach(c => { mapaAdmin[c.espacio_numero] = c; });
    renderizarMapaAdmin();
    actualizarContadorAdmin();
}

function renderizarMapaAdmin() {
    document.querySelectorAll('.admin-espacio').forEach(el => {
        const numero = parseInt(el.dataset.num);
        const pago = mapaAdmin[numero];
        el.classList.remove('libre', 'ocupado');
        el.classList.add(pago ? 'ocupado' : 'libre');
        // Reemplazar listener (clonar nodo para evitar duplicados)
        const nuevo = el.cloneNode(true);
        nuevo.addEventListener('click', () => abrirModalEspacio(numero, pago || null));
        el.parentNode.replaceChild(nuevo, el);
    });
}

function actualizarContadorAdmin() {
    const ocupados = Object.keys(mapaAdmin).length;
    const libres = TOTAL_ESPACIOS_ADMIN - ocupados;
    document.getElementById('admin-libres').textContent = libres;
    document.getElementById('admin-ocupados').textContent = ocupados;
    document.getElementById('stat-espacios').textContent = libres + '/' + TOTAL_ESPACIOS_ADMIN;
}

function abrirModalEspacio(numero, checkin) {
    espacioSeleccionado = checkin ? { ...checkin, _numero: numero } : { _numero: numero };
    document.getElementById('modal-num').textContent = numero;
    document.getElementById('modal-asignar').classList.add('hidden');

    if (!checkin) {
        // Espacio LIBRE — mostrar datos vacíos y lista de usuarios para asignar
        document.getElementById('modal-estado').textContent = '🟢 Libre';
        document.getElementById('modal-estado').style.color = '#2eb85c';
        document.getElementById('modal-usuario').textContent = '—';
        document.getElementById('modal-placa').textContent = '—';
        document.getElementById('modal-cedula').textContent = '—';
        document.getElementById('modal-telefono').textContent = '—';
        document.getElementById('modal-plan-tipo').textContent = '—';
        document.getElementById('modal-vence').textContent = '—';
        document.getElementById('modal-ref').textContent = '—';
        document.getElementById('btn-liberar').classList.add('hidden');

        // Cargar lista de usuarios activos sin check-in
        document.getElementById('modal-asignar').classList.remove('hidden');
        cargarUsuariosSinCheckin(numero);
    } else {
        // Espacio OCUPADO — mostrar info del check-in
        const autoLibera = new Date(checkin.auto_liberar_a);
        const activo = new Date() <= autoLibera;
        document.getElementById('modal-estado').textContent = activo ? '🔴 Ocupado (Activo)' : '🟡 Vencido (liberar)';
        document.getElementById('modal-estado').style.color = activo ? '#E30614' : '#b8860b';
        document.getElementById('modal-usuario').textContent = checkin.nombre || '—';
        document.getElementById('modal-placa').textContent = checkin.placa || '—';
        document.getElementById('modal-cedula').textContent = '—';
        document.getElementById('modal-telefono').textContent = '—';
        document.getElementById('modal-plan-tipo').textContent = JORNADAS_ADMIN[checkin.jornada] ? (checkin.jornada === 'diurna' ? '☀️ Diurna' : '🌙 Nocturna') : checkin.jornada;
        document.getElementById('modal-vence').textContent = autoLibera.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
        document.getElementById('modal-ref').textContent = checkin.placa || '—';
        document.getElementById('btn-liberar').classList.remove('hidden');
    }

    document.getElementById('modal-espacio-overlay').classList.remove('hidden');
}

async function cargarUsuariosSinCheckin(numeroEspacio) {
    const lista = document.getElementById('modal-usuarios-lista');
    lista.innerHTML = '<div class="modal-cargando">Cargando usuarios...</div>';

    const ahora = new Date().toISOString();

    // Obtener pagos activos
    const { data: pagos, error: errPagos } = await db
        .from('pagos')
        .select('*')
        .gt('fecha_fin', ahora)
        .order('nombre', { ascending: true });

    if (errPagos || !pagos || pagos.length === 0) {
        lista.innerHTML = '<div class="modal-sin-usuarios">No hay suscriptores activos.</div>';
        return;
    }

    // Obtener check-ins activos (placas que ya tienen espacio hoy)
    const { data: checkins } = await db
        .from('checkins')
        .select('placa')
        .gt('auto_liberar_a', ahora);

    const placasConCheckin = new Set((checkins || []).map(c => c.placa.toUpperCase()));

    // Filtrar pagos que NO tienen check-in activo
    const sinCheckin = pagos.filter(p => !placasConCheckin.has((p.placa || '').toUpperCase()));

    if (sinCheckin.length === 0) {
        lista.innerHTML = '<div class="modal-sin-usuarios">✅ Todos los suscriptores activos ya tienen check-in hoy.</div>';
        return;
    }

    lista.innerHTML = sinCheckin.map(p => `
        <div class="modal-usuario-item" onclick="asignarUsuarioEspacio(${numeroEspacio}, '${p.placa}', '${p.nombre}', ${p.id}, '${p.jornada || 'diurna'}')">
            <div class="modal-usuario-info">
                <span class="modal-usuario-placa">🏍️ ${p.placa}</span>
                <span class="modal-usuario-nombre">${p.nombre}</span>
                <span class="modal-usuario-plan">${planNombresAdmin[p.tipo_servicio] || p.tipo_servicio} · ${p.jornada === 'nocturna' ? '🌙 Nocturna' : '☀️ Diurna'}</span>
            </div>
            <button class="btn-asignar-usuario">Asignar →</button>
        </div>
    `).join('');
}

async function asignarUsuarioEspacio(numeroEspacio, placa, nombre, pagoId, jornada) {
    if (!(await uiConfirm('Confirmar Asignación', `¿Asignar el espacio #${numeroEspacio} a ${nombre} (${placa})?`, '🚘'))) return;

    const autoLiberaA = getAutoLiberaAdmin(jornada);

    const { error } = await db.from('checkins').insert([{
        pago_id:        pagoId,
        placa:          placa.toUpperCase(),
        nombre:         nombre,
        espacio_numero: numeroEspacio,
        jornada:        jornada,
        auto_liberar_a: autoLiberaA.toISOString()
    }]);

    if (error) {
        await uiAlert('Error', 'Error al asignar: ' + error.message, '❌');
        return;
    }

    cerrarModal();
    cargarMapaAdmin();
    cargarRegistros();
}

function cerrarModal() {
    document.getElementById('modal-espacio-overlay').classList.add('hidden');
    espacioSeleccionado = null;
}

document.getElementById('modal-espacio-overlay').addEventListener('click', function (e) {
    if (e.target === this) cerrarModal();
});

async function liberarEspacio() {
    if (!espacioSeleccionado) return;
    if (!(await uiConfirm('Liberar Espacio', '¿Deseas liberar este espacio? Se eliminará el check-in activo de forma inmediata.', '🔓'))) return;

    // Eliminar el check-in asociado al espacio
    const { error } = await db
        .from('checkins')
        .delete()
        .eq('espacio_numero', espacioSeleccionado._numero)
        .gt('auto_liberar_a', new Date().toISOString());

    if (error) {
        await uiAlert('Error', 'Error al liberar: ' + error.message, '❌');
        return;
    }
    cerrarModal();
    cargarMapaAdmin();
}
