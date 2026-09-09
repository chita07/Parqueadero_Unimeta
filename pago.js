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
    actualizarResumenVigencia();

    document.getElementById('step-pago').classList.remove('hidden');
    document.getElementById('step-pago').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cambiarHoras() {
    if (planSeleccionado === 'hora') {
        const horas = parseInt(document.getElementById('horas-permanencia').value || '1');
        const base = tarifasBase['hora'] || 1500;
        precioSeleccionado = base * horas;
        document.getElementById('resumen-total').textContent = '$' + precioSeleccionado.toLocaleString('es-CO');
        actualizarResumenVigencia();
    }
}

function actualizarResumenVigencia() {
    const el = document.getElementById('resumen-vigencia');
    if (!el || !planSeleccionado) return;
    const ahora = new Date();
    const fin = calcularFechaFin(ahora, planSeleccionado);
    if (planSeleccionado === 'hora') {
        const horas = parseInt(document.getElementById('horas-permanencia').value || '2');
        el.textContent = `${horas} hora(s) (hasta ${fin.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })})`;
    } else if (planSeleccionado === 'diario') {
        el.textContent = `Hasta hoy 11:59 PM`;
    } else if (planSeleccionado === 'semanal') {
        el.textContent = `7 días (hasta ${fin.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })})`;
    } else if (planSeleccionado === 'mensual') {
        el.textContent = `30 días (hasta ${fin.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })})`;
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

    const spinnerOverlay = document.getElementById('pago-spinner-overlay');
    const spinnerSub = document.getElementById('spinner-subtitulo');
    const progressFill = document.getElementById('pago-progress-fill');

    try {
        // Verificar que queden cupos en la jornada elegida
        const totalActivos = await contarSuscripcionesJornada(jornada);
        if (totalActivos >= TOTAL_ESPACIOS) {
            await uiAlert('Sin Cupos', `⚠️ No hay cupos disponibles para la jornada ${JORNADAS[jornada].label}.\nPor favor elige otra jornada o intenta más tarde.`, '🚫');
            return;
        }

        btnConfirmar.textContent = 'Procesando...';

        const metodoNombres = { nequi: 'Nequi', daviplata: 'Daviplata', pse: 'PSE', tarjeta: 'Tarjeta de Crédito/Débito' };
        const ref        = 'PQ-' + Date.now().toString().slice(-8);
        const fechaInicio = new Date();
        const fechaFin   = calcularFechaFin(fechaInicio, planSeleccionado);
        const horasEstimadas = planSeleccionado === 'hora' ? parseInt(document.getElementById('horas-permanencia').value || '2') : null;

        // Mostrar animación de procesamiento por etapas visible y fluida
        if (spinnerOverlay) {
            spinnerOverlay.classList.remove('hidden');
            if (progressFill) progressFill.style.width = '0%';
            if (spinnerSub) spinnerSub.textContent = `Conectando con ${metodoNombres[metodo.value] || 'pasarela'}...`;
            setTimeout(() => { if (progressFill) progressFill.style.width = '28%'; }, 20);
            await new Promise(res => setTimeout(res, 500));

            if (progressFill) progressFill.style.width = '70%';
            if (spinnerSub) spinnerSub.textContent = 'Validando transacción y credenciales...';
            await new Promise(res => setTimeout(res, 500));
        }

        // Datos del pago limpios y directos compatibles con la base de datos
        const pagoData = {
            placa:           placa.toUpperCase(),
            nombre,
            cedula,
            telefono:        telefono || null,
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

        const { data, error } = await db.from('pagos').insert([pagoData]).select();

        if (error) {
            console.error('Supabase error:', error);
            await uiAlert('Error del Sistema', 'Error al registrar el pago: ' + error.message, '❌');
            return;
        }

        if (spinnerOverlay) {
            if (progressFill) progressFill.style.width = '100%';
            if (spinnerSub) spinnerSub.textContent = '¡Pago aprobado con éxito!';
            await new Promise(res => setTimeout(res, 450));
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
    window._datosComprobante = {
        ref,
        placa: placa.toUpperCase(),
        nombre,
        cedula,
        servicio: textoPlanDisplay,
        total: precioSeleccionado,
        metodo: metodoNombres[metodo.value] || metodo.value,
        jornada: JORNADAS[jornada].label,
        fecha: new Date().toLocaleString('es-CO'),
        vigencia: document.getElementById('resumen-vigencia') ? document.getElementById('resumen-vigencia').textContent : 'Válido'
    };

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
    } catch (err) {
        console.error('Error al procesar el pago:', err);
        await uiAlert('Error', 'No se pudo completar el proceso de pago: ' + (err.message || err), '❌');
    } finally {
        if (spinnerOverlay) spinnerOverlay.classList.add('hidden');
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar Pago';
    }
}

// ===== Generación y Descarga de Comprobante Digital (Canvas PNG) =====
function descargarComprobante() {
    const c = window._datosComprobante;
    if (!c) {
        alert('No hay datos de comprobante para descargar.');
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 750;
    canvas.height = 920;
    const ctx = canvas.getContext('2d');

    // Fondo
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Borde exterior sutil
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

    // Encabezado Unimeta Rojo
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 160);
    grad.addColorStop(0, '#E30614');
    grad.addColorStop(1, '#b80510');
    ctx.fillStyle = grad;
    ctx.fillRect(15, 15, canvas.width - 30, 140);

    // Texto Encabezado
    ctx.fillStyle = '#FFCD1C';
    ctx.font = 'bold 26px Segoe UI, Arial, sans-serif';
    ctx.fillText('CORPORACIÓN UNIVERSITARIA DEL META', 40, 65);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Segoe UI, Arial, sans-serif';
    ctx.fillText('SISTEMA DE PARQUEADERO OFICIAL — COMPROBANTE DE PAGO', 40, 105);

    ctx.font = '14px Segoe UI, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('Documento digital no tributario con valor probatorio de acceso', 40, 130);

    // Badge de Aprobado
    ctx.fillStyle = '#dcfce7';
    ctx.beginPath();
    ctx.roundRect(40, 185, 230, 42, 8);
    ctx.fill();
    ctx.fillStyle = '#15803d';
    ctx.font = 'bold 16px Segoe UI, Arial, sans-serif';
    ctx.fillText('✅ PAGO CONFIRMADO', 58, 212);

    // Referencia a la derecha
    ctx.fillStyle = '#64748b';
    ctx.font = '14px Segoe UI, Arial, sans-serif';
    ctx.fillText('REFERENCIA OFICIAL:', 480, 198);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(c.ref, 480, 222);

    // Línea divisoria
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 250);
    ctx.lineTo(canvas.width - 40, 250);
    ctx.stroke();

    // Tabla de Detalles
    const detalles = [
        ['Placa del Vehículo:', c.placa],
        ['Nombre del Titular:', c.nombre],
        ['Cédula de Ciudadanía:', c.cedula || 'No especificada'],
        ['Tipo de Servicio:', c.servicio],
        ['Jornada Autorizada:', c.jornada],
        ['Método de Pago:', c.metodo],
        ['Fecha y Hora de Emisión:', c.fecha],
        ['Vigencia del Servicio:', c.vigencia]
    ];

    let y = 295;
    detalles.forEach(([lbl, val], idx) => {
        // Fondo alterno
        if (idx % 2 === 0) {
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(40, y - 24, canvas.width - 80, 36);
        }
        ctx.fillStyle = '#64748b';
        ctx.font = '15px Segoe UI, Arial, sans-serif';
        ctx.fillText(lbl, 55, y);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 16px Segoe UI, Arial, sans-serif';
        ctx.fillText(val, 290, y);
        y += 42;
    });

    // Cuadro Total Destacado
    ctx.fillStyle = '#fffbeb';
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(40, y + 10, canvas.width - 80, 70, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#92400e';
    ctx.font = 'bold 18px Segoe UI, Arial, sans-serif';
    ctx.fillText('TOTAL CANCELADO:', 60, y + 52);

    ctx.fillStyle = '#E30614';
    ctx.font = 'bold 30px Segoe UI, Arial, sans-serif';
    ctx.fillText('$' + Number(c.total).toLocaleString('es-CO') + ' COP', 380, y + 55);

    // Simulación de Código de Barras / Seguridad
    y += 110;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(40, y, canvas.width - 80, 60);

    // Barras
    ctx.fillStyle = '#0f172a';
    for (let x = 60; x < canvas.width - 60; x += 6) {
        const barW = ((x * 13) % 4) + 1;
        ctx.fillRect(x, y + 10, barW, 40);
    }

    // Pie de comprobante
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Código de Control ANPR: ${c.ref} • Sede Principal UNIMETA • Villavicencio, Meta`, canvas.width / 2, y + 85);
    ctx.fillText('Presenta este comprobante digital o escanea tu placa en la entrada.', canvas.width / 2, y + 105);
    ctx.textAlign = 'left';

    // Descarga directa
    const link = document.createElement('a');
    link.download = `Comprobante_UNIMETA_${c.ref}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
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
