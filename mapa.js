// ===== Mapa del Parqueadero — Sistema de Jornadas y Check-ins =====
const TOTAL_ESPACIOS = 33;
const planNombres = { diario: 'Diario', semanal: 'Semanal', mensual: 'Mensual' };

const JORNADAS = {
    diurna:   { label: '☀️ Diurna',   inicio: 6,  fin: 13, icono: '☀️', texto: 'Jornada Diurna',   hora: '6 AM – 1 PM' },
    nocturna: { label: '🌙 Nocturna', inicio: 18, fin: 22, icono: '🌙', texto: 'Jornada Nocturna', hora: '6 PM – 10 PM' }
};

let checkinsMapa = {};  // { espacio_numero: checkin }
let cesionesMapa = {};  // { espacio_numero: cesion } — cedidas hoy
let reservasMapa = {};  // { espacio_numero: reserva } — reservadas hoy
let miCheckin = null;

document.addEventListener('DOMContentLoaded', async function () {
    limpiarCheckinsPasados(); // limpieza silenciosa
    actualizarIndicadorJornada();
    await cargarDatos();
    document.getElementById('checkin-placa').addEventListener('input', function () {
        this.value = this.value.toUpperCase();
    });
    document.getElementById('tooltip-cerrar').addEventListener('click', cerrarTooltip);

    // Si viene de pago con ref/placa, auto-rellenar el campo check-in
    const params = new URLSearchParams(window.location.search);
    const placa = params.get('placa');
    if (placa) {
        document.getElementById('checkin-placa').value = placa.toUpperCase();
    }
});

// ===== Detectar jornada activa =====
function getJornadaActual() {
    const h = new Date().getHours();
    if (h >= 6  && h < 13) return 'diurna';
    if (h >= 18 && h < 22) return 'nocturna';
    return null; // fuera de jornada
}

function getAutoLiberaA(jornada) {
    const ahora = new Date();
    const date = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    if (jornada === 'diurna')   { date.setHours(13, 0, 0, 0); }
    if (jornada === 'nocturna') { date.setHours(22, 0, 0, 0); }
    // Si ya pasó esa hora hoy (ej. son las 14h y jornada diurna ya venció), poner mañana
    if (date < ahora) date.setDate(date.getDate() + 1);
    return date;
}

function actualizarIndicadorJornada() {
    const j = getJornadaActual();
    const iconEl  = document.getElementById('jornada-badge-icon');
    const labelEl = document.getElementById('jornada-badge-label');
    const horaEl  = document.getElementById('jornada-badge-hora');
    const badge   = document.getElementById('jornada-badge');

    if (j && JORNADAS[j]) {
        iconEl.textContent  = JORNADAS[j].icono;
        labelEl.textContent = JORNADAS[j].texto + ' activa';
        horaEl.textContent  = JORNADAS[j].hora;
        badge.classList.remove('jornada-fuera');
    } else {
        iconEl.textContent  = '🌙';
        labelEl.textContent = 'Fuera de jornada';
        horaEl.textContent  = 'Diurna 6AM-1PM | Nocturna 6PM-10PM';
        badge.classList.add('jornada-fuera');
    }
}

// ===== Limpiar check-ins vencidos desde el cliente =====
async function limpiarCheckinsPasados() {
    const ahora = new Date().toISOString();
    await db.from('checkins').delete().lt('auto_liberar_a', ahora);
}

// ===== Cargar datos: check-ins activos + cesiones + reservas de hoy =====
async function cargarDatos() {
    const ahora = new Date().toISOString();
    const hoy = new Date().toISOString().slice(0, 10);

    // 1. Check-ins activos
    const { data, error } = await db
        .from('checkins')
        .select('*')
        .gt('auto_liberar_a', ahora)
        .is('fecha_salida', null);

    if (error) {
        console.warn('Error cargando check-ins:', error.message);
        renderizarTodosLibres();
        actualizarContador(TOTAL_ESPACIOS, 0);
        return;
    }

    checkinsMapa = {};
    (data || []).forEach(c => { checkinsMapa[c.espacio_numero] = c; });

    // 2. Cesiones activas para hoy
    cesionesMapa = {};
    const { data: cesiones } = await db
        .from('cesiones_plaza')
        .select('*')
        .eq('fecha_ausencia', hoy)
        .eq('estado', 'activa');
    (cesiones || []).forEach(c => {
        if (c.espacio_numero) cesionesMapa[c.espacio_numero] = c;
    });

    // 3. Reservas activas para hoy
    reservasMapa = {};
    const { data: reservas } = await db
        .from('reservas')
        .select('*')
        .eq('fecha_reserva', hoy)
        .eq('estado', 'reservada');
    (reservas || []).forEach(r => {
        reservasMapa[r.espacio_numero] = r;
    });

    renderizarEspacios();
    actualizarContador();
}

// ===== Renderizar espacios (5 estados: libre, ocupado, mi-espacio, cedida, reservada) =====
function renderizarEspacios() {
    document.querySelectorAll('.espacio').forEach(el => {
        const numero = parseInt(el.dataset.numero);
        const checkin  = checkinsMapa[numero];
        const cesion   = cesionesMapa[numero];
        const reserva  = reservasMapa[numero];

        el.classList.remove('libre', 'ocupado', 'mi-espacio', 'cedida', 'reservada');

        let esMio = false;
        if (checkin && miCheckin && checkin.id === miCheckin.id) esMio = true;

        if (esMio) {
            el.classList.add('mi-espacio');
            setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
        } else if (checkin) {
            el.classList.add('ocupado');
        } else if (cesion) {
            el.classList.add('cedida');
        } else if (reserva) {
            el.classList.add('reservada');
        } else {
            el.classList.add('libre');
        }

        const nuevo = el.cloneNode(true);
        nuevo.addEventListener('click', () => handleClick(numero, checkin, cesion, reserva));
        el.parentNode.replaceChild(nuevo, el);
    });
}

function renderizarTodosLibres() {
    document.querySelectorAll('.espacio').forEach(el => el.classList.add('libre'));
}

function actualizarContador() {
    const ocupados = Object.keys(checkinsMapa).length;
    const libres   = TOTAL_ESPACIOS - ocupados;
    document.getElementById('espacios-libres').textContent = libres;
    document.getElementById('espacios-total').textContent  = TOTAL_ESPACIOS;

    const badge  = document.getElementById('badge-disponibilidad');
    const strong = badge.querySelector('#espacios-libres');
    if (libres === 0) {
        badge.style.borderLeftColor = '#E30614'; strong.style.color = '#E30614';
    } else if (libres <= 5) {
        badge.style.borderLeftColor = '#FFB300'; strong.style.color = '#FFB300';
    } else {
        badge.style.borderLeftColor = '#2eb85c'; strong.style.color = '#2eb85c';
    }
}

// ===== REALIZAR CHECK-IN =====
async function realizarCheckin() {
    const placa = document.getElementById('checkin-placa').value.trim().toUpperCase();
    const resultado = document.getElementById('checkin-resultado');

    if (!placa) {
        mostrarResultado('⚠️ Ingresa tu número de placa.', 'warning');
        return;
    }

    const btn = document.getElementById('btn-checkin');
    btn.disabled = true;
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
    const textoEl = el.previousElementSibling;
    if (textoEl) textoEl.textContent = 'Espacio libre en: ';
    function tick() {
        const diff = fechaFin - new Date();
        if (diff <= 0) {
            el.textContent = 'Espacio liberado';
            el.style.color = '#E30614';
            clearInterval(tempInterval);
            return;
        }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    tick();
    tempInterval = setInterval(tick, 1000);
}

// ===== Click en espacio =====
function handleClick(numero, checkin, cesion, reserva) {
    if (checkin) mostrarTooltip(numero, checkin);
    else if (cesion) mostrarTooltipCesion(numero, cesion);
    else if (reserva) mostrarTooltipReserva(numero, reserva);
}

// ===== Tooltip espacio ocupado =====
function mostrarTooltip(numero, checkin) {
    document.getElementById('tooltip-num').textContent     = numero;
    document.getElementById('tooltip-usuario').textContent = checkin.nombre || '—';
    document.getElementById('tooltip-placa').textContent   = checkin.placa  || '—';
    document.getElementById('tooltip-plan').textContent    = JORNADAS[checkin.jornada]?.label || checkin.jornada;
    const activo = new Date() <= new Date(checkin.auto_liberar_a);
    document.getElementById('tooltip-estado').textContent  = activo ? 'Activo ✅' : 'Vencido ⚠️';
    document.getElementById('tooltip-estado').style.color  = activo ? '#2eb85c' : '#E30614';
    document.getElementById('tooltip-espacio').classList.remove('hidden');

    let overlay = document.querySelector('.tooltip-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'tooltip-overlay';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', cerrarTooltip);
    }
    overlay.classList.remove('hidden');
}

// ===== Tooltip espacio cedido =====
function mostrarTooltipCesion(numero, cesion) {
    document.getElementById('tooltip-num').textContent     = numero;
    document.getElementById('tooltip-usuario').textContent = cesion.placa_mensualista + ' (ausente)';
    document.getElementById('tooltip-placa').textContent   = cesion.placa_beneficiario || 'Abierto';
    document.getElementById('tooltip-plan').textContent    = cesion.jornada === 'diurna' ? '☀️ Diurna cedida' : '🌙 Nocturna cedida';
    document.getElementById('tooltip-estado').textContent  = '🔄 Cedido';
    document.getElementById('tooltip-estado').style.color  = '#8B5CF6';
    document.getElementById('tooltip-espacio').classList.remove('hidden');

    let overlay = document.querySelector('.tooltip-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'tooltip-overlay';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', cerrarTooltip);
    }
    overlay.classList.remove('hidden');
}

// ===== Tooltip espacio reservado =====
function mostrarTooltipReserva(numero, reserva) {
    document.getElementById('tooltip-num').textContent     = numero;
    document.getElementById('tooltip-usuario').textContent = reserva.placa || '—';
    document.getElementById('tooltip-placa').textContent   = reserva.placa || '—';
    document.getElementById('tooltip-plan').textContent    = reserva.jornada === 'diurna' ? '☀️ Diurna reservada' : '🌙 Nocturna reservada';
    document.getElementById('tooltip-estado').textContent  = '🟡 Reservado';
    document.getElementById('tooltip-estado').style.color  = '#F59E0B';
    document.getElementById('tooltip-espacio').classList.remove('hidden');

    let overlay = document.querySelector('.tooltip-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'tooltip-overlay';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', cerrarTooltip);
    }
    overlay.classList.remove('hidden');
}

function cerrarTooltip() {
    document.getElementById('tooltip-espacio').classList.add('hidden');
    const ov = document.querySelector('.tooltip-overlay');
    if (ov) ov.classList.add('hidden');
}

// ===== Registrar salida del usuario =====
async function registrarSalidaMiEspacio() {
    if (!miCheckin) {
        alert('No tienes un espacio asignado activo.');
        return;
    }

    const confirmacion = confirm(`¿Confirmas la salida de tu vehículo (${miCheckin.placa}) del espacio #${miCheckin.espacio_numero}?`);
    if (!confirmacion) return;

    const ahoraIso = new Date().toISOString();
    const { error } = await db
        .from('checkins')
        .update({ fecha_salida: ahoraIso })
        .eq('id', miCheckin.id);

    if (error) {
        alert('Error al registrar salida: ' + error.message);
        return;
    }

    alert(`✅ Salida registrada exitosamente. Espacio #${miCheckin.espacio_numero} liberado.`);
    miCheckin = null;
    document.getElementById('panel-reserva').classList.add('hidden');
    document.getElementById('checkin-resultado').classList.add('hidden');
    document.getElementById('checkin-placa').value = '';
    await cargarDatos();
}
