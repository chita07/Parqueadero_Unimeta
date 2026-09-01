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
});
