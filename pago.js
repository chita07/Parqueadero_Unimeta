let planSeleccionado = 'diario';
let nombrePlan = 'Diario';
let ultimaEntrada = null;
let registroRapido = false;
let lookupTimer = null;

function uiAlert(titulo, mensaje, icono = '⚠️') {
    return new Promise(resolve => {
        const overlay = document.getElementById('custom-dialog-overlay');
        if (!overlay) { window.alert(`${titulo}\n\n${mensaje}`); resolve(); return; }
        document.getElementById('custom-dialog-title').textContent = titulo;
        document.getElementById('custom-dialog-msg').textContent = mensaje;
        document.getElementById('custom-dialog-icon').textContent = icono;
        const actions = document.getElementById('custom-dialog-actions');
        actions.innerHTML = '<button class="custom-dialog-btn custom-dialog-btn-primary" id="btn-dialog-ok">Aceptar</button>';
        overlay.classList.remove('hidden');
        document.getElementById('btn-dialog-ok').onclick = () => { overlay.classList.add('hidden'); resolve(); };
    });
}

function seleccionarPlan(plan, precio, nombre) {
    if (plan === 'hora') plan = 'diario';
    planSeleccionado = ['diario', 'semanal', 'mensual'].includes(plan) ? plan : 'diario';
    nombrePlan = nombre || (planSeleccionado.charAt(0).toUpperCase() + planSeleccionado.slice(1));
    document.querySelectorAll('.plan-card').forEach(card => card.classList.remove('selected'));
    const card = document.querySelector(`[data-plan="${planSeleccionado}"]`);
    if (card) card.classList.add('selected');
    document.getElementById('resumen-tipo').textContent = nombrePlan;
    document.getElementById('resumen-servicio').textContent = `${nombrePlan} - cobro a la salida`;
    document.getElementById('resumen-total').textContent = '$0 (entrada)';
    document.getElementById('step-servicio').classList.add('hidden');
    document.getElementById('step-pago').classList.remove('hidden');
    document.getElementById('step-pago').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cambiarTipoUsuario() {
    const type = document.getElementById('tipo-usuario').value;
    document.getElementById('group-programa').classList.toggle('hidden', type !== 'estudiante');
    document.getElementById('group-trabajador').classList.toggle('hidden', type !== 'trabajador_universidad');
}
function mostrarAvisoDatosRecuperados(entry) {
    let notice = document.getElementById('datos-recuperados-aviso');
    if (!notice) {
        notice = document.createElement('div');
        notice.id = 'datos-recuperados-aviso';
        notice.style.cssText = 'padding:12px;margin:10px 0;border-left:4px solid #15803D;background:#F0FDF4;color:#166534;border-radius:8px;font-weight:600;';
        document.getElementById('placa').closest('.form-group').after(notice);
    }
    notice.textContent = `Datos recuperados para ${entry.nombre}. Solo se solicita nuevamente la placa.`;
    notice.classList.remove('hidden');
}

function alternarCamposRegistroRapido(rapido) {
    registroRapido = rapido;
    ['nombre', 'cedula', 'telefono', 'correo', 'tipo-usuario', 'group-programa', 'group-trabajador'].forEach(id => {
        const element = document.getElementById(id);
        const group = element?.classList.contains('form-group') ? element : element?.closest('.form-group');
        if (group) group.classList.toggle('hidden', rapido);
    });
}

async function buscarDatosPorPlaca() {
    const value = document.getElementById('placa')?.value.trim().toUpperCase().replace(/[- ]/g, '');
    if (!value || value.length < 5) return;
    const entry = await parkingDB.latestByPlate(value);
    if (!entry) { alternarCamposRegistroRapido(false); return; }
    document.getElementById('nombre').value = entry.nombre || '';
    document.getElementById('cedula').value = entry.cedula || '';
    document.getElementById('telefono').value = entry.telefono || '';
    document.getElementById('correo').value = entry.correo || '';
    document.getElementById('tipo-usuario').value = entry.tipo_usuario || 'particular';
    document.getElementById('programa-academico').value = entry.programa_academico || '';
    document.getElementById('area-trabajo').value = entry.area_trabajo || '';
    document.getElementById('cargo').value = entry.cargo || '';
    cambiarTipoUsuario();
    alternarCamposRegistroRapido(true);
    mostrarAvisoDatosRecuperados(entry);
    const service = (await parkingDB.activeServices(value))[0];
    if (service && ['diario', 'semanal', 'mensual'].includes(service.tipo_plan)) seleccionarPlan(service.tipo_plan, 0, service.tipo_plan.charAt(0).toUpperCase() + service.tipo_plan.slice(1));
}
/* Legacy payment validation retained for reference during migration.
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
*/

function showEntryTicket(result) {
    const entry = result.entry;
    ultimaEntrada = entry;
    window._datosComprobante = {
        ref: entry.ticket_entrada,
        placa: entry.placa,
        nombre: entry.nombre,
        cedula: entry.cedula,
        servicio: entry.plan === 'exento' ? 'Exento - trabajador autorizado' : `${entry.plan} - cobro a la salida`,
        total: 0,
        metodo: entry.exento_cobro ? 'Exento' : 'Pendiente de salida',
        jornada: entry.tipo_usuario === 'trabajador_universidad' ? (entry.area_trabajo || 'Trabajador') : 'Operación continua',
        fecha: new Date(entry.entrada_at).toLocaleString('es-CO'),
        vigencia: entry.exento_cobro ? 'Sin cobro' : 'Cobro únicamente al salir'
    };
    document.getElementById('conf-plan').textContent = entry.plan === 'exento' ? 'Exento - trabajador autorizado' : entry.plan;
    document.getElementById('conf-placa').textContent = entry.placa;
    document.getElementById('conf-nombre').textContent = entry.nombre;
    document.getElementById('conf-total').textContent = '$0 - pendiente de salida';
    document.getElementById('conf-metodo').textContent = entry.exento_cobro ? 'Exento' : 'Pendiente de salida';
    document.getElementById('conf-ref').textContent = entry.ticket_entrada;
    document.getElementById('conf-jornada').textContent = entry.tipo_usuario === 'trabajador_universidad'
        ? `${entry.area_trabajo || 'Trabajador'}${entry.cargo ? ` - ${entry.cargo}` : ''}`
        : (entry.es_estudiante ? `Estudiante - ${entry.programa_academico || 'Programa no indicado'}` : 'Particular');
    document.getElementById('step-servicio').classList.add('hidden');
    document.getElementById('step-pago').classList.add('hidden');
    document.getElementById('step-confirmacion').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
/*
    } catch (err) {
        console.error('Error al procesar el pago:', err);
        await uiAlert('Error', 'No se pudo completar el proceso de pago: ' + (err.message || err), '❌');
    } finally {
        if (spinnerOverlay) spinnerOverlay.classList.add('hidden');
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar Pago';
    }
*/
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
    ctx.fillText('SISTEMA DE PARQUEADERO OFICIAL — TICKET DE ENTRADA', 40, 105);

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
    ctx.fillText('✅ ENTRADA REGISTRADA', 58, 212);

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
        ['Estado:', c.metodo],
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
    ctx.fillText('VALOR EN ENTRADA:', 60, y + 52);

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

async function confirmarPago() {
    const btn = document.querySelector('.btn-confirmar');
    const placa = document.getElementById('placa').value.trim().toUpperCase();
    const nombre = document.getElementById('nombre').value.trim();
    const cedula = document.getElementById('cedula').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const correo = document.getElementById('correo').value.trim();
    const tipoUsuario = document.getElementById('tipo-usuario').value;
    const programa = document.getElementById('programa-academico').value.trim();
    const codigoLaboral = document.getElementById('codigo-laboral').value.trim();
    const areaTrabajo = document.getElementById('area-trabajo').value.trim();
    const cargo = document.getElementById('cargo').value.trim();

    if (!placa || !nombre || !cedula || !correo) { await uiAlert('Datos incompletos', 'Placa, nombre, cédula y correo son obligatorios.'); return; }
    if (!/^[A-Z0-9]{5,7}$/.test(placa.replace(/[- ]/g, ''))) { await uiAlert('Placa inválida', 'Verifica el formato de la placa.'); return; }
    if (tipoUsuario === 'estudiante' && !programa) { await uiAlert('Programa requerido', 'Indica el programa académico.'); return; }
    if (tipoUsuario === 'trabajador_universidad' && !codigoLaboral) { await uiAlert('Identificación requerida', 'Ingresa el código laboral.'); return; }

    btn.disabled = true;
    btn.textContent = 'Guardando entrada...';
    try {
        const result = await parkingDB.createEntry({
            placa: placa.replace(/[- ]/g, ''), nombre, cedula, telefono, correo,
            tipo_usuario: tipoUsuario, es_estudiante: tipoUsuario === 'estudiante',
            programa_academico: programa, codigo_laboral: codigoLaboral,
            area_trabajo: areaTrabajo, cargo, plan: planSeleccionado
        });
        showEntryTicket(result);
    } catch (error) {
        await uiAlert('No se pudo registrar la entrada', error.message || 'Error inesperado.', '❌');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Generar ticket de entrada';
    }
}

async function registrarReingresoPorPlaca() {
    const input = document.getElementById('placa-recurrente');
    const placa = input.value.trim().toUpperCase().replace(/[- ]/g, '');
    if (!placa) { await uiAlert('Placa requerida', 'Ingresa la placa para recuperar tus datos.'); return; }
    document.getElementById('placa').value = placa;
    await buscarDatosPorPlaca();
    if (!registroRapido) { await uiAlert('Placa no encontrada', 'No existe información previa. Completa el registro inicial.'); return; }
    await confirmarPago();
}

function cambiarPlan() {
    document.getElementById('step-pago').classList.add('hidden');
    document.getElementById('step-servicio').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function imprimirTicketEntrada() {
    if (!ultimaEntrada) return;
    const e = ultimaEntrada;
    const w = window.open('', '_blank', 'width=420,height=650');
    if (!w) return;
    w.document.write(`<html><head><title>${e.ticket_entrada}</title><style>body{font-family:Arial;padding:20px;max-width:360px}h2{text-align:center}hr{border:0;border-top:1px solid #aaa}.row{display:flex;justify-content:space-between;margin:8px 0}</style></head><body><h2>PARQUEADERO UNIMETA</h2><p style="text-align:center">TICKET DE ENTRADA</p><hr><div class="row"><b>Ticket</b><span>${e.ticket_entrada}</span></div><div class="row"><b>Placa</b><span>${e.placa}</span></div><div class="row"><b>Usuario</b><span>${e.nombre}</span></div><div class="row"><b>Cédula</b><span>${e.cedula}</span></div><div class="row"><b>Entrada</b><span>${new Date(e.entrada_at).toLocaleString('es-CO')}</span></div><div class="row"><b>Espacio</b><span>#${e.espacio_numero}</span></div><div class="row"><b>Estado</b><span>${e.exento_cobro ? 'EXENTO' : 'Cobro a la salida'}</span></div><hr><p>Conserve este ticket para registrar la salida.</p><script>window.print();</script></body></html>`);
    w.document.close();
}

function verMiEspacio() {
    const ticket = ultimaEntrada?.ticket_entrada;
    window.location.href = ticket ? `mapa.html?ticket=${encodeURIComponent(ticket)}` : 'mapa.html';
}

document.addEventListener('DOMContentLoaded', async () => {
    await parkingDB.ready();
    if (parkingDB.isOnline()) await parkingDB.syncNow();
    cambiarTipoUsuario();
    document.getElementById('placa').addEventListener('input', () => {
        clearTimeout(lookupTimer);
        lookupTimer = setTimeout(buscarDatosPorPlaca, 250);
    });
    const params = new URLSearchParams(window.location.search);
    const placa = params.get('placa');
    if (placa) {
        document.getElementById('placa').value = placa.toUpperCase().replace(/[- ]/g, '');
        await buscarDatosPorPlaca();
    }
    const plan = params.get('plan');
    if (plan && ['diario', 'semanal', 'mensual'].includes(plan)) seleccionarPlan(plan, 0, plan.charAt(0).toUpperCase() + plan.slice(1));
/* Legacy online payment initializer retained for reference during migration.
// Auto-select plan y placa desde URL y cargar tarifas
document.addEventListener('DOMContentLoaded', async () => {
    await cargarTarifas();
    const params     = new URLSearchParams(window.location.search);
    const plan       = params.get('plan');
    const precio     = params.get('precio');
    const nombre     = params.get('nombre');
    const placaParam = (params.get('placa') || params.get('plate') || '').trim().toUpperCase();

    // 1. Si viene plan en la URL, seleccionarlo; si viene placa desde ANPR sin plan, seleccionar 'diario' para desplegar formulario
    if (plan && precio && nombre) {
        seleccionarPlan(plan, parseInt(precio), nombre);
    } else if (placaParam) {
        const diarioPrecio = tarifasBase['diario'] || 2000;
        seleccionarPlan('diario', diarioPrecio, 'Diario');
    }

    // 2. Rellenar automáticamente el campo de la placa proveniente de ANPR
    if (placaParam) {
        const inputPlaca = document.getElementById('placa');
        if (inputPlaca) {
            inputPlaca.value = placaParam;
            inputPlaca.style.borderColor = '#2eb85c';
            inputPlaca.style.backgroundColor = '#f0fff4';
            inputPlaca.dispatchEvent(new Event('input'));
        }

        // Consultar si este vehículo ya tiene registros previos en pagos para autocompletar nombre/cédula/teléfono
        try {
            const { data: previousUser } = await db
                .from('pagos')
                .select('nombre, cedula, telefono')
                .eq('placa', placaParam)
                .order('created_at', { ascending: false })
                .limit(1);

            if (previousUser && previousUser.length > 0) {
                const u = previousUser[0];
                const inputNombre   = document.getElementById('nombre');
                const inputCedula   = document.getElementById('cedula');
                const inputTelefono = document.getElementById('telefono');
                if (inputNombre && !inputNombre.value && u.nombre) inputNombre.value = u.nombre;
                if (inputCedula && !inputCedula.value && u.cedula) inputCedula.value = u.cedula;
                if (inputTelefono && !inputTelefono.value && u.telefono) inputTelefono.value = u.telefono;
            }
        } catch (errUser) {
            console.warn('No se pudieron precargar datos previos del usuario:', errUser);
        }
    }
*/
});
