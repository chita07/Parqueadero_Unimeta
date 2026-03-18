let planSeleccionado = null;
let precioSeleccionado = 0;
let nombrePlan = '';

// Calcular fecha_fin según el tipo de servicio
function calcularFechaFin(fechaInicio, tipoServicio) {
    const fin = new Date(fechaInicio);
    if (tipoServicio === 'diario') fin.setDate(fin.getDate() + 1);
    else if (tipoServicio === 'semanal') fin.setDate(fin.getDate() + 7);
    else if (tipoServicio === 'mensual') fin.setMonth(fin.getMonth() + 1);
    return fin;
}

function seleccionarPlan(plan, precio, nombre) {
    planSeleccionado = plan;
    precioSeleccionado = precio;
    nombrePlan = nombre;

    // Highlight selected card
    document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`[data-plan="${plan}"]`).classList.add('selected');

    // Update resumen
    document.getElementById('resumen-tipo').textContent = nombre;
    document.getElementById('resumen-servicio').textContent = 'Moto - Tarifa ' + nombre;
    document.getElementById('resumen-total').textContent = '$' + precio.toLocaleString('es-CO');

    // Show step 2
    document.getElementById('step-pago').classList.remove('hidden');
    document.getElementById('step-pago').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Update placa in resumen in real-time
document.getElementById('placa').addEventListener('input', function () {
    const valor = this.value.toUpperCase() || '—';
    document.getElementById('resumen-placa').textContent = valor;
    this.value = this.value.toUpperCase();
});

async function confirmarPago() {
    const placa = document.getElementById('placa').value.trim();
    const nombre = document.getElementById('nombre').value.trim();
    const cedula = document.getElementById('cedula').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const metodo = document.querySelector('input[name="metodo"]:checked');

    if (!placa) {
        alert('Por favor ingresa la placa del vehículo.');
        return;
    }
    if (!nombre) {
        alert('Por favor ingresa tu nombre completo.');
        return;
    }
    if (!cedula) {
        alert('Por favor ingresa tu número de cédula.');
        return;
    }
    if (!metodo) {
        alert('Por favor selecciona un método de pago.');
        return;
    }

    const metodoNombres = { nequi: 'Nequi', pse: 'PSE', tarjeta: 'Tarjeta de Crédito/Débito' };
    const ref = 'PQ-' + Date.now().toString().slice(-8);

    // Calcular fechas automáticamente
    const fechaInicio = new Date();
    const fechaFin = calcularFechaFin(fechaInicio, planSeleccionado);

    // El estado es 'activo' porque se acaba de registrar (está dentro del período)
    const estado = 'activo';

    // Guardar en Supabase
    const { data, error } = await db.from('pagos').insert([{
        placa: placa.toUpperCase(),
        nombre: nombre,
        cedula: cedula,
        telefono: telefono,
        tipo_servicio: planSeleccionado,
        precio: precioSeleccionado,
        metodo_pago: metodo.value,
        referencia: ref,
        fecha_inicio: fechaInicio.toISOString(),
        fecha_fin: fechaFin.toISOString(),
        estado: estado
    }]);

    if (error) {
        alert('Error al registrar: ' + error.message);
        console.error('Supabase error:', error);
        return;
    }

    // Mostrar confirmación
    document.getElementById('conf-plan').textContent = nombrePlan;
    document.getElementById('conf-placa').textContent = placa.toUpperCase();
    document.getElementById('conf-nombre').textContent = nombre;
    document.getElementById('conf-total').textContent = '$' + precioSeleccionado.toLocaleString('es-CO');
    document.getElementById('conf-metodo').textContent = metodoNombres[metodo.value];
    document.getElementById('conf-ref').textContent = ref;

    document.getElementById('step-servicio').classList.add('hidden');
    document.getElementById('step-pago').classList.add('hidden');
    document.getElementById('step-confirmacion').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cambiarPlan() {
    document.getElementById('step-pago').classList.add('hidden');
    document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.remove('selected');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Auto-select plan from URL parameters (when redirected from index.html)
document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get('plan');
    const precio = params.get('precio');
    const nombre = params.get('nombre');

    if (plan && precio && nombre) {
        seleccionarPlan(plan, parseInt(precio), nombre);
    }
});
