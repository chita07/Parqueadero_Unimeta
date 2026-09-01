let planSeleccionado = null;
let precioSeleccionado = 0;
let nombrePlan = '';
let precioHoraBase = 1500;
let tarifasBase = { hora: 1500, diario: 2000, semanal: 10000, mensual: 45000 };

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

// Cargar tarifas dinámicas desde Supabase
async function cargarTarifas() {
    try {
        const { data, error } = await db.from('tarifas').select('*').eq('activo', true);
        if (!error && data && data.length > 0) {
            data.forEach(t => {
                tarifasBase[t.tipo_servicio] = t.precio;
                const card = document.querySelector(`[data-plan="${t.tipo_servicio}"]`);
                if (card) {
                    card.dataset.precio = t.precio;
                    const priceEl = card.querySelector('.plan-price');
                    if (priceEl) {
                        const unit = t.tipo_servicio === 'hora' ? 'hora' : t.tipo_servicio === 'diario' ? 'día' : t.tipo_servicio === 'semanal' ? 'semana' : 'mes';
                        priceEl.innerHTML = `$${t.precio.toLocaleString('es-CO')} <span>/ ${unit}</span>`;
                    }
                }
            });
            precioHoraBase = tarifasBase.hora || 1500;
        }
    } catch (e) {
        console.warn('Usando tarifas por defecto:', e);
    }
}

// Calcular fecha_fin según tipo de servicio
function calcularFechaFin(fechaInicio, tipoServicio) {
    const fin = new Date(fechaInicio);
    if (tipoServicio === 'hora') {
        const horas = parseInt(document.getElementById('horas-permanencia')?.value || '2');
        fin.setHours(fin.getHours() + horas);
    }
    else if (tipoServicio === 'diario')   fin.setDate(fin.getDate() + 1);
    else if (tipoServicio === 'semanal') fin.setDate(fin.getDate() + 7);
    else if (tipoServicio === 'mensual') fin.setMonth(fin.getMonth() + 1);
    return fin;
}

function seleccionarPlan(plan, precio, nombre) {
    planSeleccionado = plan;
    const precioBase = tarifasBase[plan] || precio;
    nombrePlan = nombre;

    const groupHoras = document.getElementById('group-horas');
    if (plan === 'hora') {
        groupHoras.classList.remove('hidden');
        const horas = parseInt(document.getElementById('horas-permanencia').value || '2');
        precioSeleccionado = precioBase * horas;
    } else {
        groupHoras.classList.add('hidden');
        precioSeleccionado = precioBase;
    }

    document.querySelectorAll('.plan-card').forEach(card => card.classList.remove('selected'));
    const cardSelected = document.querySelector(`[data-plan="${plan}"]`);
    if (cardSelected) cardSelected.classList.add('selected');

    document.getElementById('resumen-tipo').textContent = nombre;
    document.getElementById('resumen-servicio').textContent = 'Moto - Tarifa ' + nombre;
    document.getElementById('resumen-total').textContent = '$' + precioSeleccionado.toLocaleString('es-CO');

    document.getElementById('step-pago').classList.remove('hidden');
    document.getElementById('step-pago').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cambiarHoras() {
    if (planSeleccionado === 'hora') {
        const horas = parseInt(document.getElementById('horas-permanencia').value || '1');
        const base = tarifasBase['hora'] || 1500;
        precioSeleccionado = base * horas;
        document.getElementById('resumen-total').textContent = '$' + precioSeleccionado.toLocaleString('es-CO');
    }
}

document.getElementById('placa').addEventListener('input', function () {
    this.value = this.value.toUpperCase();
    document.getElementById('resumen-placa').textContent = this.value || '—';
});

// ===== Verificar capacidad disponible para esa jornada =====
const TOTAL_ESPACIOS = 33;

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

    const metodoNombres = { nequi: 'Nequi', daviplata: 'Daviplata', pse: 'PSE', tarjeta: 'Tarjeta de Crédito/Débito' };
    const ref        = 'PQ-' + Date.now().toString().slice(-8);
    const fechaInicio = new Date();
    const fechaFin   = calcularFechaFin(fechaInicio, planSeleccionado);
    const horasEstimadas = planSeleccionado === 'hora' ? parseInt(document.getElementById('horas-permanencia').value || '2') : null;

    const session = JSON.parse(localStorage.getItem('unimeta_session') || 'null');

    // Datos base del pago (siempre compatibles con la estructura original)
    const pagoDataBase = {
        placa:           placa.toUpperCase(),
        nombre,
        cedula,
        telefono,
        tipo_servicio:   planSeleccionado,
        precio:          precioSeleccionado,
        metodo_pago:     metodo.value,
        referencia:      ref,
        fecha_inicio:    fechaInicio.toISOString(),
        fecha_fin:       fechaFin.toISOString(),
        estado:          'activo',
        jornada:         jornada,
        horas_estimadas: horasEstimadas
    };

    // Intentar primero con columnas de trazabilidad (Obj. 3)
    // Si falla por columna inexistente, reintentar sin ellas
    let data, error;

    const pagoDataCompleto = {
        ...pagoDataBase,
        usuario_id:          session ? session.id : null,
        estado_verificacion: 'verificado'
    };

    ({ data, error } = await db.from('pagos').insert([pagoDataCompleto]).select());

    // Fallback: si el error es por columna no encontrada, reintentar con datos base
    if (error && (error.message.includes('estado_verificacion') || error.message.includes('usuario_id') || error.message.includes('schema cache'))) {
        console.warn('Columnas de trazabilidad no disponibles aún. Insertando sin ellas...');
        ({ data, error } = await db.from('pagos').insert([pagoDataBase]).select());
    }

    btnConfirmar.disabled = false;
    btnConfirmar.textContent = 'Confirmar Pago';

    if (error) {
        await uiAlert('Error del Sistema', 'Error al registrar el pago: ' + error.message, '❌');
        console.error('Supabase error:', error);
        return;
    }

    // Mostrar confirmación
    const textoPlanDisplay = planSeleccionado === 'hora' ? `${nombrePlan} (${horasEstimadas}h)` : nombrePlan;
    document.getElementById('conf-plan').textContent   = textoPlanDisplay;
    document.getElementById('conf-placa').textContent  = placa.toUpperCase();
    document.getElementById('conf-nombre').textContent = nombre;
    document.getElementById('conf-total').textContent  = '$' + precioSeleccionado.toLocaleString('es-CO');
    document.getElementById('conf-metodo').textContent = metodoNombres[metodo.value] || metodo.value;
    document.getElementById('conf-ref').textContent    = ref;
    document.getElementById('conf-jornada').textContent = JORNADAS[jornada].label;

    window._pagoRef = ref;

  // Notificar a otras pestañas/ventanas (panel admin) del nuevo pago
  try {
    localStorage.setItem('unimeta_nuevo_pago', JSON.stringify({ ref, placa: placa.toUpperCase(), ts: Date.now() }));
    if (window.BroadcastChannel) {
      new BroadcastChannel('unimeta_channel').postMessage({ tipo: 'nuevo_pago', ref });
    }
  } catch(e) {}

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

// Auto-select plan desde URL y cargar tarifas
document.addEventListener('DOMContentLoaded', async () => {
    await cargarTarifas();
    const params = new URLSearchParams(window.location.search);
    const plan   = params.get('plan');
    const precio = params.get('precio');
    const nombre = params.get('nombre');
    if (plan && precio && nombre) seleccionarPlan(plan, parseInt(precio), nombre);
});
