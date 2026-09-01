let planSeleccionado = null;
let precioSeleccionado = 0;
let nombrePlan = '';

// Jornadas: horarios fijos
const JORNADAS = {
    diurna:   { label: '☀️ Diurna (6 AM – 1 PM)',   inicio: 6,  fin: 13 },
    nocturna: { label: '🌙 Nocturna (6 PM – 10 PM)', inicio: 18, fin: 22 }
};

// ===== Custom UI Dialogs =====
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

// Calcular fecha_fin según tipo de servicio
function calcularFechaFin(fechaInicio, tipoServicio) {
    const fin = new Date(fechaInicio);
    if (tipoServicio === 'diario')   fin.setDate(fin.getDate() + 1);
    else if (tipoServicio === 'semanal') fin.setDate(fin.getDate() + 7);
    else if (tipoServicio === 'mensual') fin.setMonth(fin.getMonth() + 1);
    return fin;
}

function seleccionarPlan(plan, precio, nombre) {
    planSeleccionado = plan;
    precioSeleccionado = precio;
    nombrePlan = nombre;

    document.querySelectorAll('.plan-card').forEach(card => card.classList.remove('selected'));
    document.querySelector(`[data-plan="${plan}"]`).classList.add('selected');

    document.getElementById('resumen-tipo').textContent = nombre;
    document.getElementById('resumen-servicio').textContent = 'Moto - Tarifa ' + nombre;
    document.getElementById('resumen-total').textContent = '$' + precio.toLocaleString('es-CO');

    document.getElementById('step-pago').classList.remove('hidden');
    document.getElementById('step-pago').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.getElementById('placa').addEventListener('input', function () {
    this.value = this.value.toUpperCase();
    document.getElementById('resumen-placa').textContent = this.value || '—';
});

// ===== Verificar capacidad disponible para esa jornada =====
const TOTAL_ESPACIOS = 33;

async function verificarCuposDisponibles(jornada) {
    const ahora = new Date().toISOString();
    // Contar pagos activos con esa jornada
    const { data, error } = await db
        .from('pagos')
        .select('id', { count: 'exact', head: true })
        .eq('jornada', jornada)
        .gt('fecha_fin', ahora);

    if (error) {
        console.warn('Error verificando cupos:', error.message);
        return true; // permitir si hay error para no bloquear
    }
    return (data?.length ?? 0) < TOTAL_ESPACIOS;
}

async function contarSuscripcionesJornada(jornada) {
    const ahora = new Date().toISOString();
    const { data, error } = await db
        .from('pagos')
        .select('id')
        .eq('jornada', jornada)
        .gt('fecha_fin', ahora);

    if (error) return 0;
    return (data || []).length;
}

async function confirmarPago() {
    const placa    = document.getElementById('placa').value.trim();
    const nombre   = document.getElementById('nombre').value.trim();
    const cedula   = document.getElementById('cedula').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const metodo   = document.querySelector('input[name="metodo"]:checked');
    const jornadaInput = document.querySelector('input[name="jornada"]:checked');

    if (!placa)   { await uiAlert('Falta Información', 'Por favor ingresa la placa del vehículo.', '⚠️'); return; }
    if (!nombre)  { await uiAlert('Falta Información', 'Por favor ingresa tu nombre completo.', '⚠️'); return; }
    if (!cedula)  { await uiAlert('Falta Información', 'Por favor ingresa tu número de cédula.', '⚠️'); return; }
    if (!metodo)  { await uiAlert('Falta Información', 'Por favor selecciona un método de pago.', '⚠️'); return; }
    if (!planSeleccionado) { await uiAlert('Falta Información', 'Por favor selecciona un plan primero.', '⚠️'); return; }

    const jornada = jornadaInput ? jornadaInput.value : 'diurna';

    // Deshabilitar botón
    const btnConfirmar = document.querySelector('.btn-confirmar');
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Verificando cupos...';

    // Verificar que queden cupos en la jornada elegida
    const totalActivos = await contarSuscripcionesJornada(jornada);
    if (totalActivos >= TOTAL_ESPACIOS) {
        await uiAlert('Sin Cupos', `⚠️ No hay cupos disponibles para la jornada ${JORNADAS[jornada].label}.\nPor favor elige otra jornada o intenta más tarde.`, '🚫');
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar Pago';
        return;
    }

    btnConfirmar.textContent = 'Procesando...';

    const metodoNombres = { nequi: 'Nequi', pse: 'PSE', tarjeta: 'Tarjeta de Crédito/Débito' };
    const ref        = 'PQ-' + Date.now().toString().slice(-8);
    const fechaInicio = new Date();
    const fechaFin   = calcularFechaFin(fechaInicio, planSeleccionado);

    const pagoData = {
        placa:          placa.toUpperCase(),
        nombre,
        cedula,
        telefono,
        tipo_servicio:  planSeleccionado,
        precio:         precioSeleccionado,
        metodo_pago:    metodo.value,
        referencia:     ref,
        fecha_inicio:   fechaInicio.toISOString(),
        fecha_fin:      fechaFin.toISOString(),
        estado:         'activo',
        jornada:        jornada
        // NO se asigna espacio_numero aquí — se asigna al hacer check-in en el mapa
    };

    const { data, error } = await db.from('pagos').insert([pagoData]).select();

    btnConfirmar.disabled = false;
    btnConfirmar.textContent = 'Confirmar Pago';

    if (error) {
        await uiAlert('Error del Sistema', 'Error al registrar el pago: ' + error.message, '❌');
        console.error('Supabase error:', error);
        return;
    }

    // Mostrar confirmación
    document.getElementById('conf-plan').textContent   = nombrePlan;
    document.getElementById('conf-placa').textContent  = placa.toUpperCase();
    document.getElementById('conf-nombre').textContent = nombre;
    document.getElementById('conf-total').textContent  = '$' + precioSeleccionado.toLocaleString('es-CO');
    document.getElementById('conf-metodo').textContent = metodoNombres[metodo.value];
    document.getElementById('conf-ref').textContent    = ref;
    document.getElementById('conf-jornada').textContent = JORNADAS[jornada].label;

    window._pagoRef = ref;

    document.getElementById('step-servicio').classList.add('hidden');
    document.getElementById('step-pago').classList.add('hidden');
    document.getElementById('step-confirmacion').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cambiarPlan() {
    document.getElementById('step-pago').classList.add('hidden');
    document.querySelectorAll('.plan-card').forEach(card => card.classList.remove('selected'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function verMiEspacio() {
    const ref = window._pagoRef;
    location.href = ref ? 'mapa.html?ref=' + encodeURIComponent(ref) : 'mapa.html';
}

// Auto-select plan desde URL
document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const plan   = params.get('plan');
    const precio = params.get('precio');
    const nombre = params.get('nombre');
    if (plan && precio && nombre) seleccionarPlan(plan, parseInt(precio), nombre);
});
