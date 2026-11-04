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

function showEntryTicket(result) {
    const entry = result.entry;
    ultimaEntrada = entry;
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
    if (placa) document.getElementById('placa').value = placa.toUpperCase();
    const plan = params.get('plan');
    if (plan && ['diario', 'semanal', 'mensual'].includes(plan)) seleccionarPlan(plan, 0, plan.charAt(0).toUpperCase() + plan.slice(1));
});
