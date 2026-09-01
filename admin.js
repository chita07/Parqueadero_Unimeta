const planNombres = { hora: 'Por Hora', diario: 'Día', semanal: 'Semana', mensual: 'Mes' };
const planNombresAdmin = { hora: 'Por Hora', diario: 'Diario', semanal: 'Semanal', mensual: 'Mensual' };

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

// Buscar espacio libre validando contra check-ins activos

// Cargar registros de hoy
async function cargarRegistros() {
    // Intentar primero con todas las columnas (incluye obj. 3: estado_verificacion, usuario_id)
    let { data, error } = await db
        .from('pagos')
        .select('*')
        .order('fecha_inicio', { ascending: false });

    // Si falla por schema cache (columnas nuevas no aplicadas aún), reintentar con columnas base
    if (error && (error.message.includes('schema cache') || error.message.includes('estado_verificacion') || error.message.includes('usuario_id'))) {
        console.warn('Schema cache desactualizado. Cargando columnas base...');
        ({ data, error } = await db
            .from('pagos')
            .select('id, placa, nombre, cedula, telefono, tipo_servicio, precio, metodo_pago, referencia, fecha_inicio, fecha_fin, estado, jornada, horas_estimadas')
            .order('fecha_inicio', { ascending: false }));
    }

    if (error) {
        console.error('Error cargando registros:', error);
        const tbody = document.getElementById('tabla-registros');
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;color:#E30614;">⚠️ Error al cargar registros: ${error.message}</td></tr>`;
        return;
    }

    mostrarRegistros(data || []);
    actualizarEstadisticas(data || []);
}
// Mostrar registros en la tabla
function mostrarRegistros(registros) {
    const tbody = document.getElementById('tabla-registros');
    if (registros.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:#888;">No hay registros</td></tr>';
        return;
    }
    tbody.innerHTML = registros.map((r, i) => {
        const estado = calcularEstado(r.fecha_fin);
        const verif = r.estado_verificacion || 'verificado';
        return `
        <tr>
            <td>${i + 1}</td>
            <td><span class="plate-badge-colombia">${r.placa}</span></td>
            <td><span class="vehicle-type"><span class="icon">🏍️</span> Moto</span></td>
            <td><strong>${planNombres[r.tipo_servicio] || r.tipo_servicio}</strong></td>
            <td>${formatHora(r.fecha_inicio)}</td>
            <td>${badgeEstado(estado)}</td>
            <td>
                <select class="status-select-verif" onchange="cambiarVerificacion(${r.id}, this.value)" style="padding:5px 10px;border-radius:8px;border:1px solid #CBD5E1;font-size:12px;background:${verif==='verificado'?'#ECFDF5':verif==='pendiente'?'#FFFBEB':'#FEF2F2'};color:${verif==='verificado'?'#047857':verif==='pendiente'?'#B45309':'#B91C1C'};font-weight:700;cursor:pointer;">
                    <option value="verificado" ${verif==='verificado'?'selected':''}>✅ Verificado</option>
                    <option value="pendiente" ${verif==='pendiente'?'selected':''}>⏳ Pendiente</option>
                    <option value="rechazado" ${verif==='rechazado'?'selected':''}>❌ Rechazado</option>
                </select>
            </td>
            <td style="font-weight:700;color:#111827;">$${r.precio.toLocaleString('es-CO')}</td>
            <td><button class="btn-action btn-view" onclick="verDetalle('${r.placa}')">Ver</button></td>
        </tr>
    `}).join('');
}

async function cambiarVerificacion(id, nuevoEstado) {
    const { error } = await db
        .from('pagos')
        .update({ estado_verificacion: nuevoEstado })
        .eq('id', id);

    if (error) {
        await uiAlert('Error', 'No se pudo actualizar el estado: ' + error.message, '❌');
        cargarRegistros();
        return;
    }
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
        jornada: jornada,
        estado_verificacion: 'verificado'
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
    cargarTarifasAdmin();
    cargarUsuariosAdmin();
    cargarCesiones();
    cargarAlertasANPR();

    // Sincronización en tiempo real entre pestañas (BroadcastChannel y localStorage)
    if (window.BroadcastChannel) {
        const bc = new BroadcastChannel('unimeta_channel');
        bc.onmessage = (ev) => {
            if (ev.data && (ev.data.tipo === 'nuevo_pago' || ev.data.tipo === 'nueva_alerta')) {
                cargarRegistros();
                cargarMapaAdmin();
                cargarAlertasANPR();
            }
        };
    }
    window.addEventListener('storage', (e) => {
        if (e.key === 'unimeta_nuevo_pago') {
            cargarRegistros();
            cargarMapaAdmin();
        }
    });

    // Auto-refresco periódico cada 15 segundos para mantener el panel vivo
    setInterval(() => {
        cargarRegistros();
        cargarMapaAdmin();
        cargarAlertasANPR();
    }, 15000);
});

// ===== OBJETIVO 5: CESIÓN TEMPORAL DE PLAZAS =====

function toggleFormCesion() {
    const box = document.getElementById('form-cesion-box');
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) {
        // Pre-rellenar fecha de hoy
        document.getElementById('ces-fecha').value = new Date().toISOString().slice(0, 10);
    }
}

async function guardarCesion() {
    const placa = document.getElementById('ces-placa').value.trim().toUpperCase();
    const fecha = document.getElementById('ces-fecha').value;
    const jornada = document.getElementById('ces-jornada').value;
    const beneficiario = document.getElementById('ces-beneficiario').value.trim().toUpperCase() || null;
    const observacion = document.getElementById('ces-observacion').value.trim() || null;

    if (!placa || !fecha) {
        await uiAlert('Campos Requeridos', 'Debes ingresar la placa del mensualista y la fecha de ausencia.', '⚠️');
        return;
    }

    // Verificar que la placa tiene una suscripción mensual activa
    const ahora = new Date().toISOString();
    const { data: pagos, error: errPago } = await db
        .from('pagos')
        .select('id, espacio_numero')
        .ilike('placa', placa)
        .eq('tipo_servicio', 'mensual')
        .gt('fecha_fin', ahora)
        .limit(1);

    if (errPago || !pagos || pagos.length === 0) {
        await uiAlert('Sin Suscripción Mensual', 'La placa ' + placa + ' no tiene una suscripción mensual activa.', '❌');
        return;
    }

    const pago = pagos[0];
    const { error } = await db.from('cesiones_plaza').insert([{
        pago_id: pago.id,
        placa_mensualista: placa,
        espacio_numero: pago.espacio_numero || null,
        fecha_ausencia: fecha,
        jornada: jornada,
        placa_beneficiario: beneficiario,
        estado: 'activa',
        observacion: observacion
    }]);

    if (error) {
        await uiAlert('Error', 'No se pudo registrar la cesión: ' + error.message, '❌');
        return;
    }

    await uiAlert('Cesión Registrada', 'La cesión temporal de la plaza de ' + placa + ' fue registrada exitosamente.', '✅');
    document.getElementById('form-cesion-box').classList.add('hidden');
    document.getElementById('ces-placa').value = '';
    document.getElementById('ces-beneficiario').value = '';
    document.getElementById('ces-observacion').value = '';
    cargarCesiones();
}

async function cargarCesiones() {
    const hoy = new Date().toISOString().slice(0, 10);
    const { data, error } = await db
        .from('cesiones_plaza')
        .select('*')
        .gte('fecha_ausencia', hoy)
        .order('fecha_ausencia', { ascending: true });

    const tbody = document.getElementById('tabla-cesiones');
    if (error || !data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#888;">No hay cesiones registradas para hoy o fechas futuras.</td></tr>';
        return;
    }

    const estadoBadge = (e) => {
        if (e === 'activa') return '<span class="badge badge-active">🟢 Activa</span>';
        if (e === 'usada') return '<span class="badge" style="background:#DBEAFE;color:#1E40AF;">🔵 Usada</span>';
        return '<span class="badge badge-expired">❌ Cancelada</span>';
    };

    tbody.innerHTML = data.map((c, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><span class="plate-badge-colombia">${c.placa_mensualista}</span></td>
            <td><strong>${new Date(c.fecha_ausencia + 'T12:00:00').toLocaleDateString('es-CO')}</strong></td>
            <td>${c.jornada === 'diurna' ? '☀️ Diurna' : c.jornada === 'nocturna' ? '🌙 Nocturna' : '🕐 Ambas'}</td>
            <td>${c.placa_beneficiario ? `<span class="plate-badge-colombia" style="font-size:11px;padding:2px 6px;">${c.placa_beneficiario}</span>` : '<em style="color:#9CA3AF;">Cualquiera</em>'}</td>
            <td>${estadoBadge(c.estado)}</td>
            <td>
                ${c.estado === 'activa' ? `<button class="btn-action btn-view" style="background:#EF4444;color:white;border-color:#EF4444;" onclick="cancelarCesion(${c.id})">Cancelar</button>` : '—'}
            </td>
        </tr>
    `).join('');
}

async function cancelarCesion(id) {
    const ok = await uiConfirm('Cancelar Cesión', '¿Deseas cancelar esta cesión? El espacio volverá a ser del mensualista.', '⚠️');
    if (!ok) return;
    const { error } = await db.from('cesiones_plaza').update({ estado: 'cancelada' }).eq('id', id);
    if (error) { await uiAlert('Error', 'No se pudo cancelar: ' + error.message, '❌'); return; }
    cargarCesiones();
}

// ===== OBJETIVO 4: CONTROL DE ACCESO Y ALERTAS ANPR =====

async function cargarAlertasANPR() {
    const tbody = document.getElementById('tabla-alertas-anpr');
    if (!tbody) return;

    const { data, error } = await db
        .from('alertas_acceso')
        .select('*')
        .order('fecha_hora', { ascending: false })
        .limit(20);

    if (error || !data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#888;">No hay registros de escaneos ANPR.</td></tr>';
        document.getElementById('stat-alertas-sin-pago').textContent = '0';
        document.getElementById('stat-alertas-con-pago').textContent = '0';
        return;
    }

    const sinPago = data.filter(a => !a.tiene_pago).length;
    const conPago = data.filter(a => a.tiene_pago).length;

    const statSin = document.getElementById('stat-alertas-sin-pago');
    const statCon = document.getElementById('stat-alertas-con-pago');
    if (statSin) statSin.textContent = sinPago;
    if (statCon) statCon.textContent = conPago;

    tbody.innerHTML = data.map(item => {
        const hora = new Date(item.fecha_hora).toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        const fecha = new Date(item.fecha_hora).toLocaleDateString('es-CO');
        const placa = item.placa_corregida || item.placa_detectada;
        const estadoBadge = item.tiene_pago
            ? '<span class="badge badge-active">✅ Pagado</span>'
            : '<span class="badge badge-expired">⚠️ Sin pago</span>';
        const metodoIcon = item.metodo_captura === 'camara' ? '📹 Cámara' : '📁 Archivo';

        return `
            <tr>
                <td style="color:#64748B;font-size:13px;">${fecha} <span style="color:#0F172A;font-weight:600;">${hora}</span></td>
                <td><span class="plate-badge-colombia">${placa}</span></td>
                <td><span style="font-size:13px;color:#475569;">${metodoIcon}</span></td>
                <td>${estadoBadge}</td>
                <td>${item.nombre_usuario ? `<strong>${item.nombre_usuario}</strong> <small style="color:#64748B;">(${item.tipo_servicio || 'activo'})</small>` : '<em style="color:#94A3B8;">Sin registro previo</em>'}</td>
                <td><span style="font-weight:700;color:${parseInt(item.confianza_ocr || '0') >= 75 ? '#059669' : '#D97706'};">${item.confianza_ocr || '—'}</span></td>
                <td>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;">
                        <input type="checkbox" ${item.atendida ? 'checked' : ''} onchange="marcarAlertaAtendida(${item.id}, this.checked)">
                        ${item.atendida ? '<span style="color:#10B981;font-weight:700;">Atendida</span>' : '<span style="color:#E30614;font-weight:700;">Pendiente</span>'}
                    </label>
                </td>
            </tr>
        `;
    }).join('');
}

async function marcarAlertaAtendida(id, atendida) {
    const { error } = await db
        .from('alertas_acceso')
        .update({ atendida: atendida })
        .eq('id', id);

    if (error) {
        console.error('Error actualizando alerta:', error);
    }
    cargarAlertasANPR();
}

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

let mapaCesionesAdmin = {};
let mapaReservasAdmin = {};

async function cargarMapaAdmin() {
    const ahora = new Date().toISOString();
    const hoy = new Date().toISOString().slice(0, 10);
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

    // Cargar cesiones de hoy
    mapaCesionesAdmin = {};
    const { data: cesiones } = await db
        .from('cesiones_plaza')
        .select('*')
        .eq('fecha_ausencia', hoy)
        .eq('estado', 'activa');
    (cesiones || []).forEach(c => {
        if (c.espacio_numero) mapaCesionesAdmin[c.espacio_numero] = c;
    });

    // Cargar reservas de hoy
    mapaReservasAdmin = {};
    const { data: reservas } = await db
        .from('reservas')
        .select('*')
        .eq('fecha_reserva', hoy)
        .eq('estado', 'reservada');
    (reservas || []).forEach(r => {
        mapaReservasAdmin[r.espacio_numero] = r;
    });

    renderizarMapaAdmin();
    actualizarContadorAdmin();
}

function renderizarMapaAdmin() {
    document.querySelectorAll('.admin-espacio').forEach(el => {
        const numero = parseInt(el.dataset.num);
        const checkin = mapaAdmin[numero];
        const cesion = mapaCesionesAdmin[numero];
        const reserva = mapaReservasAdmin[numero];

        el.classList.remove('libre', 'ocupado', 'cedida', 'reservada');
        if (checkin) {
            el.classList.add('ocupado');
        } else if (cesion) {
            el.classList.add('cedida');
        } else if (reserva) {
            el.classList.add('reservada');
        } else {
            el.classList.add('libre');
        }

        // Reemplazar listener (clonar nodo para evitar duplicados)
        const nuevo = el.cloneNode(true);
        nuevo.addEventListener('click', () => abrirModalEspacio(numero, checkin || null, cesion || null, reserva || null));
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

function abrirModalEspacio(numero, checkin, cesion, reserva) {
    espacioSeleccionado = checkin ? { ...checkin, _numero: numero } : { _numero: numero };
    document.getElementById('modal-num').textContent = numero;
    document.getElementById('modal-asignar').classList.add('hidden');

    if (checkin) {
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
    } else if (cesion) {
        // Espacio CEDIDO
        document.getElementById('modal-estado').textContent = '🟣 Plaza Cedida Temporalmente';
        document.getElementById('modal-estado').style.color = '#8B5CF6';
        document.getElementById('modal-usuario').textContent = cesion.nombre_mensualista || cesion.placa_mensualista;
        document.getElementById('modal-placa').textContent = cesion.placa_mensualista;
        document.getElementById('modal-cedula').textContent = 'Beneficiario: ' + (cesion.placa_beneficiario || 'Cualquiera');
        document.getElementById('modal-telefono').textContent = 'Obs: ' + (cesion.observacion || 'Ninguna');
        document.getElementById('modal-plan-tipo').textContent = cesion.jornada === 'diurna' ? '☀️ Diurna' : cesion.jornada === 'nocturna' ? '🌙 Nocturna' : '🕐 Ambas';
        document.getElementById('modal-vence').textContent = 'Fecha: ' + cesion.fecha_ausencia;
        document.getElementById('modal-ref').textContent = 'Cesión #' + cesion.id;
        document.getElementById('btn-liberar').classList.add('hidden');
    } else if (reserva) {
        // Espacio RESERVADO
        document.getElementById('modal-estado').textContent = '🟠 Plaza Pre-Reservada';
        document.getElementById('modal-estado').style.color = '#F59E0B';
        document.getElementById('modal-usuario').textContent = 'Reserva';
        document.getElementById('modal-placa').textContent = reserva.placa;
        document.getElementById('modal-cedula').textContent = '—';
        document.getElementById('modal-telefono').textContent = '—';
        document.getElementById('modal-plan-tipo').textContent = reserva.jornada;
        document.getElementById('modal-vence').textContent = 'Fecha: ' + reserva.fecha_reserva;
        document.getElementById('modal-ref').textContent = 'Reserva #' + reserva.id;
        document.getElementById('btn-liberar').classList.add('hidden');
    } else {
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
    if (!(await uiConfirm('Liberar Espacio', '¿Deseas liberar este espacio? Se registrará la salida del vehículo de forma inmediata.', '🔓'))) return;

    const ahoraIso = new Date().toISOString();

    // Registrar fecha_salida en lugar de solo eliminar
    const { error } = await db
        .from('checkins')
        .update({ fecha_salida: ahoraIso })
        .eq('espacio_numero', espacioSeleccionado._numero)
        .gt('auto_liberar_a', ahoraIso)
        .is('fecha_salida', null);

    if (error) {
        await uiAlert('Error', 'Error al liberar espacio: ' + error.message, '❌');
        return;
    }

    await uiAlert('Éxito', `Espacio #${espacioSeleccionado._numero} liberado. Salida registrada.`, '✅');
    cerrarModal();
    cargarMapaAdmin();
    cargarRegistros();
}

// ===== CONFIGURACIÓN DE TARIFAS (Admin) =====
async function cargarTarifasAdmin() {
    try {
        const { data, error } = await db.from('tarifas').select('*');
        if (!error && data && data.length > 0) {
            data.forEach(t => {
                const el = document.getElementById(`cfg-tarifa-${t.tipo_servicio}`);
                if (el) el.value = t.precio;
                if (precios[t.tipo_servicio] !== undefined) precios[t.tipo_servicio] = t.precio;
            });
        }
    } catch (err) {
        console.warn('Error cargando tarifas en admin:', err);
    }
}

async function guardarTarifasAdmin() {
    const hora = parseInt(document.getElementById('cfg-tarifa-hora').value || '1500');
    const diario = parseInt(document.getElementById('cfg-tarifa-diario').value || '2000');
    const semanal = parseInt(document.getElementById('cfg-tarifa-semanal').value || '10000');
    const mensual = parseInt(document.getElementById('cfg-tarifa-mensual').value || '45000');

    const btn = document.getElementById('btn-guardar-tarifas');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const updates = [
        { tipo_servicio: 'hora', nombre_display: 'Por Hora', precio: hora, descripcion: 'Tarifa por hora de permanencia', activo: true },
        { tipo_servicio: 'diario', nombre_display: 'Diario', precio: diario, descripcion: 'Tarifa diaria', activo: true },
        { tipo_servicio: 'semanal', nombre_display: 'Semanal', precio: semanal, descripcion: 'Tarifa semanal', activo: true },
        { tipo_servicio: 'mensual', nombre_display: 'Mensual', precio: mensual, descripcion: 'Tarifa mensual', activo: true }
    ];

    const { error } = await db.from('tarifas').upsert(updates, { onConflict: 'tipo_servicio' });

    btn.disabled = false;
    btn.textContent = '💾 Guardar Cambios de Tarifas';

    if (error) {
        await uiAlert('Error', 'Error al guardar tarifas: ' + error.message, '❌');
        return;
    }

    precios.diario = diario;
    precios.semanal = semanal;
    precios.mensual = mensual;

    await uiAlert('Éxito', 'Tarifas del parqueadero actualizadas correctamente.', '✅');
}

// ===== GESTIÓN DE USUARIOS (Admin) =====
async function cargarUsuariosAdmin() {
    const tbody = document.getElementById('tabla-usuarios');
    if (!tbody) return;

    const { data: usuarios, error } = await db.from('usuarios').select('*').order('created_at', { ascending: false });
    if (error || !usuarios || usuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:15px;color:#888;">No hay usuarios registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = usuarios.map((u, i) => {
        const initials = u.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
        return `
        <tr>
            <td>${i + 1}</td>
            <td>
                <div class="user-avatar-cell">
                    <div class="user-avatar-circle">${initials}</div>
                    <strong>${u.nombre}</strong>
                </div>
            </td>
            <td><code style="background:#F1F5F9;padding:2px 6px;border-radius:4px;">${u.cedula}</code></td>
            <td>${u.email || '<em style="color:#94A3B8;">—</em>'}</td>
            <td>${u.telefono || '<em style="color:#94A3B8;">—</em>'}</td>
            <td><span class="${u.rol === 'admin' ? 'role-badge-admin' : 'role-badge-user'}">${u.rol === 'admin' ? '🛡️ ADMIN' : '🚗 CONDUCTOR'}</span></td>
            <td>${u.activo !== false ? '<span class="status-dot-active">Activo</span>' : '<span style="color:#EF4444;font-weight:700;">Inactivo</span>'}</td>
        </tr>
    `}).join('');
}

function toggleFormNuevoUsuario() {
    const box = document.getElementById('form-nuevo-usuario-box');
    box.classList.toggle('hidden');
}

async function guardarUsuarioAdmin() {
    const nombre = document.getElementById('usr-nombre').value.trim();
    const cedula = document.getElementById('usr-cedula').value.trim();
    const email = document.getElementById('usr-email').value.trim();
    const telefono = document.getElementById('usr-telefono').value.trim();
    const password = document.getElementById('usr-password').value.trim();
    const rol = document.getElementById('usr-rol').value;

    if (!nombre || !cedula || !password) {
        await uiAlert('Atención', 'Por favor ingresa al menos nombre, cédula y contraseña.', '⚠️');
        return;
    }

    const { error } = await db.from('usuarios').insert([{
        nombre, cedula, email, telefono, password, rol, activo: true
    }]);

    if (error) {
        await uiAlert('Error', 'Error al guardar usuario: ' + error.message, '❌');
        return;
    }

    await uiAlert('Éxito', 'Usuario creado correctamente.', '✅');
    document.getElementById('usr-nombre').value = '';
    document.getElementById('usr-cedula').value = '';
    document.getElementById('usr-email').value = '';
    document.getElementById('usr-telefono').value = '';
    document.getElementById('usr-password').value = '';
    toggleFormNuevoUsuario();
    cargarUsuariosAdmin();
}

// ===== MÓDULO DE REPORTES (Admin) =====
let datosUltimoReporte = [];

async function generarReporteAdmin() {
    const desde = document.getElementById('rep-fecha-desde').value;
    const hasta = document.getElementById('rep-fecha-hasta').value;
    const tarifaFiltro = document.getElementById('rep-filtro-tarifa').value;

    let query = db.from('pagos').select('*').order('fecha_inicio', { ascending: false });

    if (desde) {
        query = query.gte('fecha_inicio', new Date(desde + 'T00:00:00').toISOString());
    }
    if (hasta) {
        query = query.lte('fecha_inicio', new Date(hasta + 'T23:59:59').toISOString());
    }
    if (tarifaFiltro) {
        query = query.eq('tipo_servicio', tarifaFiltro);
    }

    const { data: pagos, error } = await query;

    if (error) {
        await uiAlert('Error', 'Error al generar reporte: ' + error.message, '❌');
        return;
    }

    datosUltimoReporte = pagos || [];

    const totalTransacciones = datosUltimoReporte.length;
    const totalRecaudado = datosUltimoReporte.reduce((sum, p) => sum + (p.precio || 0), 0);
    const promedioTicket = totalTransacciones > 0 ? Math.round(totalRecaudado / totalTransacciones) : 0;

    document.getElementById('rep-total-transacciones').textContent = totalTransacciones;
    document.getElementById('rep-total-recaudado').textContent = '$' + totalRecaudado.toLocaleString('es-CO');
    document.getElementById('rep-promedio-ticket').textContent = '$' + promedioTicket.toLocaleString('es-CO');

    const tbody = document.getElementById('tabla-reporte-body');
    if (datosUltimoReporte.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:15px;color:#888;">No se encontraron registros para el rango seleccionado.</td></tr>';
    } else {
        tbody.innerHTML = datosUltimoReporte.map(p => `
            <tr>
                <td><strong>${p.referencia || '—'}</strong></td>
                <td>${p.placa}</td>
                <td>${p.nombre}</td>
                <td>${planNombres[p.tipo_servicio] || p.tipo_servicio}</td>
                <td>${p.metodo_pago.toUpperCase()}</td>
                <td>${new Date(p.fecha_inicio).toLocaleDateString('es-CO')}</td>
                <td>${new Date(p.fecha_fin).toLocaleDateString('es-CO')}</td>
                <td>$${p.precio.toLocaleString('es-CO')}</td>
            </tr>
        `).join('');
    }

    document.getElementById('reporte-resultado-box').style.display = 'block';
}

function exportarReporteCSV() {
    if (!datosUltimoReporte || datosUltimoReporte.length === 0) {
        uiAlert('Atención', 'Primero genera un reporte con datos para exportar.', '⚠️');
        return;
    }

    const headers = ['Referencia', 'Placa', 'Cliente', 'Cedula', 'Telefono', 'Plan', 'Precio', 'Metodo Pago', 'Fecha Inicio', 'Fecha Fin', 'Jornada'];
    const rows = datosUltimoReporte.map(p => [
        p.referencia || '',
        p.placa || '',
        `"${(p.nombre || '').replace(/"/g, '""')}"`,
        p.cedula || '',
        p.telefono || '',
        p.tipo_servicio || '',
        p.precio || 0,
        p.metodo_pago || '',
        p.fecha_inicio || '',
        p.fecha_fin || '',
        p.jornada || ''
    ]);

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Reporte_Parqueadero_Unimeta_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
