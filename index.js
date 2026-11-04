// index.js - Autenticación Real con Supabase (Tabla usuarios)

document.addEventListener('DOMContentLoaded', () => {
    // Referencias a los botones de abrir modal
    const btnLoginHero = document.getElementById('btn-login-hero');
    const btnRegisterHero = document.getElementById('btn-register-hero');

    // Referencias al modal y controles de cierre
    const authModal = document.getElementById('auth-modal');
    const closeAuthModal = document.getElementById('close-auth-modal');

    // Contenedores de formularios
    const loginFormContainer = document.getElementById('login-form-container');
    const registerFormContainer = document.getElementById('register-form-container');

    // Botones para alternar entre form de login y registro
    const switchToRegister = document.getElementById('switch-to-register');
    const switchToLogin = document.getElementById('switch-to-login');

    // Formularios
    const formLoginReal = document.getElementById('form-login-real');
    const formRegisterReal = document.getElementById('form-register-real');

    // Función para abrir el modal en una vista específica (login o register)
    function openModal(view) {
        if (view === 'login') {
            loginFormContainer.classList.add('active');
            registerFormContainer.classList.remove('active');
        } else if (view === 'register') {
            registerFormContainer.classList.add('active');
            loginFormContainer.classList.remove('active');
        }
        
        authModal.classList.add('show');
    }

    // Función para cerrar modal
    function closeModal() {
        authModal.classList.remove('show');
    }

    // Event Listeners (Abrir modal)
    if(btnLoginHero) btnLoginHero.addEventListener('click', () => openModal('login'));
    if(btnRegisterHero) btnRegisterHero.addEventListener('click', () => openModal('register'));

    // Event Listener (Cerrar modal)
    if(closeAuthModal) closeAuthModal.addEventListener('click', closeModal);

    // Cerrar si se da click fuera del contenido del modal
    window.addEventListener('click', (event) => {
        if (event.target === authModal) {
            closeModal();
        }
    });

    // Cambiar entre Login y Registro
    if(switchToRegister) switchToRegister.addEventListener('click', () => openModal('register'));
    if(switchToLogin) switchToLogin.addEventListener('click', () => openModal('login'));

    // ===== LOGIN REAL =====
    if (formLoginReal) {
        formLoginReal.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const btnSubmit = document.getElementById('btn-submit-login');

            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Verificando...';

            try {
                const { data: user, error } = await db
                    .from('usuarios')
                    .select('*')
                    .eq('email', email)
                    .eq('password', password)
                    .single();

                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Ingresar';

                if (error || !user) {
                    alert('❌ Correo o contraseña incorrectos.');
                    return;
                }

                // Guardar sesión
                localStorage.setItem('unimeta_session', JSON.stringify(user));
                closeModal();

                if (user.rol === 'admin') {
                    alert(`🔑 Bienvenido Administrador: ${user.nombre}`);
                    window.location.href = 'admin.html';
                } else {
                    alert(`✅ ¡Bienvenido, ${user.nombre}!`);
                    window.location.href = 'pago.html';
                }
            } catch (err) {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Ingresar';
                alert('Error al conectar con el servidor: ' + err.message);
            }
        });
    }

    // ===== REGISTRO REAL =====
    if (formRegisterReal) {
        formRegisterReal.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('reg-nombre-u').value.trim();
            const cedula = document.getElementById('reg-cedula-u').value.trim();
            const email = document.getElementById('reg-email-u').value.trim();
            const telefono = document.getElementById('reg-telefono-u').value.trim();
            const password = document.getElementById('reg-password-u').value;
            const btnSubmit = document.getElementById('btn-submit-register');

            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Creando cuenta...';

            try {
                const nuevoUsuario = {
                    nombre,
                    cedula,
                    email,
                    telefono,
                    password,
                    rol: 'usuario',
                    activo: true
                };

                const { data, error } = await db.from('usuarios').insert([nuevoUsuario]).select().single();

                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Crear Cuenta';

                if (error) {
                    alert('❌ Error al registrar: ' + (error.message.includes('unique') ? 'La cédula o correo ya se encuentran registrados.' : error.message));
                    return;
                }

                localStorage.setItem('unimeta_session', JSON.stringify(data));
                alert(`🎉 ¡Cuenta creada con éxito! Bienvenido, ${nombre}`);
                closeModal();
                window.location.href = 'pago.html';
            } catch (err) {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Crear Cuenta';
                alert('Error al procesar registro: ' + err.message);
            }
        });
    }

    // Cargar disponibilidad en vivo y tarifas al iniciar
    cargarDisponibilidadLive();
    cargarTarifasLanding();

    // Refrescar disponibilidad cada 25 segundos
    setInterval(cargarDisponibilidadLive, 25000);
});

// ===== Contador en vivo de espacios disponibles =====
async function cargarDisponibilidadLive() {
    const textEl = document.getElementById('live-count-text');
    const badgeEl = document.getElementById('live-availability');
    if (!textEl) return;

    try {
        const ahora = new Date().toISOString();
        const { data, error } = await db
            .from('checkins')
            .select('espacio_numero')
            .gt('auto_liberar_a', ahora)
            .is('fecha_salida', null);

        if (error) throw error;

        const ocupados = Array.isArray(data) ? data.length : 0;
        const total = 33;
        const libres = Math.max(0, total - ocupados);

        textEl.innerHTML = `<strong>${libres} de ${total}</strong> espacios disponibles ahora`;
        if (badgeEl) {
            badgeEl.classList.remove('ocupado-total', 'alerta-baja');
            if (libres === 0) {
                badgeEl.classList.add('ocupado-total');
                textEl.innerHTML = `<strong>Parqueadero lleno</strong> (0/${total} disponibles)`;
            } else if (libres <= 5) {
                badgeEl.classList.add('alerta-baja');
            }
        }
    } catch (e) {
        console.warn('No se pudo actualizar disponibilidad en vivo:', e);
        if (textEl) {
            textEl.innerHTML = `<strong>33</strong> espacios disponibles en total`;
        }
    }
}

// ===== Cargar tarifas dinámicas desde Supabase =====
async function cargarTarifasLanding() {
    try {
        const { data, error } = await db.from('tarifas').select('*').eq('activo', true);
        if (error || !data || data.length === 0) return;

        data.forEach(t => {
            const precioFmt = '$' + Number(t.precio).toLocaleString('es-CO');
            if (t.tipo_servicio === 'diario') {
                const el = document.getElementById('precio-tarifa-diario');
                const btn = document.getElementById('btn-tarifa-diario');
                if (el) el.innerHTML = `${precioFmt} <span>/ día</span>`;
                if (btn) btn.setAttribute('onclick', `location.href='pago.html?plan=diario&precio=${t.precio}&nombre=Diario'`);
            } else if (t.tipo_servicio === 'semanal') {
                const el = document.getElementById('precio-tarifa-semanal');
                const btn = document.getElementById('btn-tarifa-semanal');
                if (el) el.innerHTML = `${precioFmt} <span>/ semana</span>`;
                if (btn) btn.setAttribute('onclick', `location.href='pago.html?plan=semanal&precio=${t.precio}&nombre=Semanal'`);
            } else if (t.tipo_servicio === 'mensual') {
                const el = document.getElementById('precio-tarifa-mensual');
                const btn = document.getElementById('btn-tarifa-mensual');
                if (el) el.innerHTML = `${precioFmt} <span>/ mes</span>`;
                if (btn) btn.setAttribute('onclick', `location.href='pago.html?plan=mensual&precio=${t.precio}&nombre=Mensual'`);
            }
        });
    } catch (err) {
        console.warn('Tarifas por defecto usadas:', err);
    }
}
