const planNombres = { diario: 'Día', semanal: 'Semana', mensual: 'Mes' };

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



// Cargar registros de hoy
async function cargarRegistros() {
    const { data, error } = await db
        .from('pagos')
        .select('*')
        .order('fecha_inicio', { ascending: false });

    if (error) {
        console.error('Error cargando registros:', error);
        return;
    }

    mostrarRegistros(data);
    actualizarEstadisticas(data);
}

// Mostrar registros en la tabla
function mostrarRegistros(registros) {
    const tbody = document.getElementById('tabla-registros');
    if (registros.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:#888;">No hay registros</td></tr>';
        return;
    }
    tbody.innerHTML = registros.map((r, i) => {
        const estado = calcularEstado(r.fecha_fin);
        return `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${r.placa}</strong></td>
            <td><span class="vehicle-type"><span class="icon">🏍️</span> Moto</span></td>
            <td>${planNombres[r.tipo_servicio] || r.tipo_servicio}</td>
            <td>${formatHora(r.fecha_inicio)}</td>
            <td>${badgeEstado(estado)}</td>
            <td>$${r.precio.toLocaleString('es-CO')}</td>
            <td><button class="btn-action btn-view" onclick="verDetalle('${r.placa}')">Ver</button></td>
        </tr>
    `}).join('');
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

    if (!placa || !nombre || !cedula) {
        alert('Por favor completa al menos placa, nombre y cédula.');
        return;
    }

    const btn = this;
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const fechaInicio = new Date();
    const fechaFin = calcFechaFin(fechaInicio, plan);
    const ref = 'EF-' + Date.now().toString().slice(-8);

    const { data, error } = await db.from('pagos').insert([{
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
        estado: 'activo'
    }]);

    btn.disabled = false;
    btn.textContent = '💵 Registrar Pago en Efectivo';

    if (error) {
        alert('Error al registrar: ' + error.message);
        console.error('Supabase error:', error);
        return;
    }

    // Mostrar éxito
    document.getElementById('reg-ref').textContent = ref;
    const exito = document.getElementById('registro-exito');
    exito.classList.remove('hidden');
    setTimeout(() => exito.classList.add('hidden'), 5000);

    // Limpiar formulario
    document.getElementById('reg-placa').value = '';
    document.getElementById('reg-nombre').value = '';
    document.getElementById('reg-cedula').value = '';
    document.getElementById('reg-telefono').value = '';
    document.getElementById('reg-plan').value = 'diario';

    // Recargar tabla y estadísticas
    cargarRegistros();
});

// Cargar al iniciar
document.addEventListener('DOMContentLoaded', cargarRegistros);
