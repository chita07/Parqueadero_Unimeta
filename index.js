// index.js - Lógica para simulador de Login/Registro

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

});
