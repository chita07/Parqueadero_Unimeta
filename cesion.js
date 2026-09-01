// ===== Cesión Temporal de Plazas — Unimeta =====

document.addEventListener('DOMContentLoaded', () => {
    // Pre-seleccionar fecha de hoy en el formulario
    const hoyStr = new Date().toISOString().slice(0, 10);
    const fechaInput = document.getElementById('fecha-ausencia');
    if (fechaInput) {
        fechaInput.value = hoyStr;
        fechaInput.min = hoyStr;
    }

    // Convertir placas a mayúsculas automáticamente
    ['placa-mensual', 'placa-beneficiario', 'consulta-placa'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', function () {
                this.value = this.value.toUpperCase();
            });
        }
    });

    // Cargar cesiones disponibles para el día de hoy
    cargarPlazasHoy();
});

// ===== Registrar ausencia / cesión =====
async function confirmarAusencia() {
    const placaMensual   = document.getElementById('placa-mensual').value.trim().toUpperCase();
    const fechaAusencia  = document.getElementById('fecha-ausencia').value;
    const jornada        = document.querySelector('input[name="jornada-cesion"]:checked')?.value || 'diurna';
    const beneficiario   = document.getElementById('placa-beneficiario').value.trim().toUpperCase() || null;
    const observacion    = document.getElementById('observacion').value.trim() || null;

    if (!placaMensual || !fechaAusencia) {
        await uiAlert('Campos Incompletos', 'Por favor ingresa la placa de tu vehículo y la fecha de ausencia.', '⚠️');
        return;
    }

    const btnSubmit = document.getElementById('btn-submit-cesion');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Verificando mensualidad...';

    const ahoraIso = new Date().toISOString();

    // 1. Validar que la placa tenga una suscripción mensual activa
    const { data: pagos, error: errPago } = await db
        .from('pagos')
        .select('*')
        .ilike('placa', placaMensual)
        .eq('tipo_servicio', 'mensual')
        .gt('fecha_fin', ahoraIso)
        .order('fecha_inicio', { ascending: false })
        .limit(1);

    if (errPago || !pagos || pagos.length === 0) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = '🔄 Confirmar Cesión de Plaza';
        await uiAlert('Sin Suscripción Mensual Activa', 'La placa ' + placaMensual + ' no cuenta con un plan mensual vigente en el sistema.', '❌');
        return;
    }

    const pago = pagos[0];

    // 2. Registrar en la tabla de cesiones
    const { data, error } = await db
        .from('cesiones_plaza')
        .insert([{
            pago_id:            pago.id,
            placa_mensualista:  placaMensual,
            nombre_mensualista: pago.nombre,
            espacio_numero:     pago.espacio_numero || null,
            fecha_ausencia:     fechaAusencia,
            jornada:            jornada,
            placa_beneficiario: beneficiario,
            estado:             'activa',
            observacion:        observacion
        }])
        .select();

    btnSubmit.disabled = false;
    btnSubmit.textContent = '🔄 Confirmar Cesión de Plaza';

    if (error) {
        await uiAlert('Error al Registrar', 'Ocurrió un error: ' + error.message, '❌');
        return;
    }

    await uiAlert('Cesión Confirmada', `Tu ausencia para el ${fechaAusencia} fue registrada con éxito. ¡Gracias por liberar tu espacio para otro compañero!`, '🎉');

    // Limpiar campos secundarios
    document.getElementById('placa-beneficiario').value = '';
    document.getElementById('observacion').value = '';

    // Actualizar consultas
    document.getElementById('consulta-placa').value = placaMensual;
    cargarMisCesiones();
    cargarPlazasHoy();
}

// ===== Consultar cesiones de un mensualista =====
async function cargarMisCesiones() {
    const placa = document.getElementById('consulta-placa').value.trim().toUpperCase();
    const contenedor = document.getElementById('mis-cesiones-lista');

    if (!placa) {
        contenedor.innerHTML = '<p class="placeholder-text">Por favor ingresa tu placa arriba para consultar.</p>';
        return;
    }

    contenedor.innerHTML = '<div class="loading-spinner">Buscando cesiones...</div>';

    const hoy = new Date().toISOString().slice(0, 10);
    const { data, error } = await db
        .from('cesiones_plaza')
        .select('*')
        .ilike('placa_mensualista', placa)
        .gte('fecha_ausencia', hoy)
        .order('fecha_ausencia', { ascending: true });

    if (error || !data || data.length === 0) {
        contenedor.innerHTML = `<p class="placeholder-text">No tienes cesiones programadas a partir de hoy para la placa <strong>${placa}</strong>.</p>`;
        return;
    }

    contenedor.innerHTML = data.map(c => `
        <div class="cesion-item">
            <div class="cesion-item-info">
                <strong>📅 ${c.fecha_ausencia} (${c.jornada === 'diurna' ? '☀️ Diurna' : c.jornada === 'nocturna' ? '🌙 Nocturna' : '🕐 Ambas'})</strong>
                <p>Beneficiario: ${c.placa_beneficiario || 'Cualquiera'} • Estado: <span style="font-weight:600;color:${c.estado==='activa'?'#2E7D32':'#888'}">${c.estado}</span></p>
                ${c.observacion ? `<p style="font-style:italic;color:#888;">"${c.observacion}"</p>` : ''}
            </div>
            ${c.estado === 'activa' ? `
                <button class="btn-cancelar-cesion" onclick="cancelarCesion(${c.id})">Cancelar</button>
            ` : ''}
        </div>
    `).join('');
}

// ===== Cancelar una cesión =====
async function cancelarCesion(id) {
    const confirmar = await uiConfirm('Cancelar Cesión', '¿Deseas cancelar esta cesión? Tu plaza volverá a estar reservada para ti.', '⚠️');
    if (!confirmar) return;

    const { error } = await db
        .from('cesiones_plaza')
        .update({ estado: 'cancelada' })
        .eq('id', id);

    if (error) {
        await uiAlert('Error', 'No se pudo cancelar: ' + error.message, '❌');
        return;
    }

    await uiAlert('Cancelada', 'La cesión ha sido cancelada exitosamente.', '✅');
    cargarMisCesiones();
    cargarPlazasHoy();
}

// ===== Cargar plazas cedidas hoy para la comunidad =====
async function cargarPlazasHoy() {
    const contenedor = document.getElementById('plazas-hoy-lista');
    if (!contenedor) return;

    const hoy = new Date().toISOString().slice(0, 10);
    const { data, error } = await db
        .from('cesiones_plaza')
        .select('*')
        .eq('fecha_ausencia', hoy)
        .eq('estado', 'activa');

    if (error || !data || data.length === 0) {
        contenedor.innerHTML = '<p class="placeholder-text">No hay plazas cedidas reportadas para hoy.</p>';
        return;
    }

    contenedor.innerHTML = data.map(c => `
        <div class="cesion-item" style="border-left: 4px solid #8B5CF6;">
            <div class="cesion-item-info">
                <strong>🅿️ Espacio Cedido (${c.jornada === 'diurna' ? '☀️ Diurna' : c.jornada === 'nocturna' ? '🌙 Nocturna' : '🕐 Todo el día'})</strong>
                <p>Titular ausente: ${c.placa_mensualista.slice(0,3)}*** • Disponible para: <strong>${c.placa_beneficiario || 'Comunidad general'}</strong></p>
            </div>
        </div>
    `).join('');
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
