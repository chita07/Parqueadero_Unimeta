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
}
