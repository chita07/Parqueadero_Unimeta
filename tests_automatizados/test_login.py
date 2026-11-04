# ============================================================
# test_login.py — Pruebas de Autenticación UNIPARKING
# ============================================================
# Módulo:    Login / Registro de Usuarios
# Página:    index.html
# Norma:     ISO/IEC/IEEE 29119 | ISO/IEC 25010
# ============================================================
#
# CASOS DE PRUEBA:
#   TC-001  Carga correcta de la página de inicio
#   TC-002  Apertura del modal de Login al hacer clic en "Iniciar Sesión"
#   TC-003  Modal de Registro al hacer clic en "Registrarse"
#   TC-004  Cierre del modal con el botón X
#   TC-005  Alternancia entre formularios Login ↔ Registro
#   TC-006  Campos del formulario de Login presentes
#   TC-007  Campos del formulario de Registro presentes
#   TC-008  Login con credenciales vacías (validación HTML5)
#   TC-009  Registro con todos los campos vacíos (validación HTML5)
#   TC-010  Navegación al panel de Admin desde la barra de navegación
#   TC-011  Cierre del modal haciendo clic fuera
# ============================================================

import pytest
import time
import logging
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from conftest import PAGES, ADMIN_EMAIL, ADMIN_PASSWORD, TEST_USER, tomar_captura
from utils.helpers import (
    navegar_a, esperar_elemento, esperar_elemento_clickeable,
    hacer_click, escribir_en, elemento_visible, captura,
    modal_visible, limpiar_local_storage, verificar_titulo,
    verificar_url, aceptar_alerta
)

logger = logging.getLogger("UNIPARKING-QA.test_login")

PAGINA_INICIO = PAGES["inicio"]


# ─────────────────────────────────────────────────────────────
# TC-001: Carga correcta de la página de inicio
# ─────────────────────────────────────────────────────────────
@pytest.mark.navegacion
@pytest.mark.positivo
def test_TC001_carga_pagina_inicio(driver):
    """
    Verifica que la página de inicio cargue correctamente mostrando
    el título del sistema y los elementos principales.
    Resultado esperado: título 'Parqueadero Unimeta' visible.
    """
    navegar_a(driver, PAGINA_INICIO)
    captura(driver, "TC001_inicio_cargada")

    assert verificar_titulo(driver, "Parqueadero Unimeta"), \
        "El título de la página no contiene 'Parqueadero Unimeta'"

    # Verificar encabezado principal
    h1 = esperar_elemento(driver, By.TAG_NAME, "h1")
    assert "UNIMETA" in h1.text.upper() or "Parqueadero" in h1.text, \
        f"Encabezado inesperado: '{h1.text}'"

    logger.info("[TC-001] ✅ APROBADO — Página de inicio carga correctamente")


# ─────────────────────────────────────────────────────────────
# TC-002: Apertura del modal de Login
# ─────────────────────────────────────────────────────────────
@pytest.mark.autenticacion
@pytest.mark.positivo
def test_TC002_abrir_modal_login(driver):
    """
    Verifica que al hacer clic en 'Iniciar Sesión' se abra el modal
    con el formulario de login visible.
    Resultado esperado: modal con id='auth-modal' visible (clase 'show').
    """
    navegar_a(driver, PAGINA_INICIO)
    limpiar_local_storage(driver)

    btn_login = esperar_elemento_clickeable(driver, By.ID, "btn-login-hero")
    btn_login.click()
    time.sleep(0.8)

    captura(driver, "TC002_modal_login_abierto")

    # El modal debe tener la clase 'show'
    modal = driver.find_element(By.ID, "auth-modal")
    clases = modal.get_attribute("class") or ""
    assert "show" in clases, f"El modal no tiene clase 'show'. Clases: '{clases}'"

    # El formulario de login debe ser visible
    form_login = driver.find_element(By.ID, "login-form-container")
    clases_form = form_login.get_attribute("class") or ""
    assert "active" in clases_form, \
        f"El contenedor de login no tiene clase 'active'. Clases: '{clases_form}'"

    logger.info("[TC-002] ✅ APROBADO — Modal de login abre correctamente")


# ─────────────────────────────────────────────────────────────
# TC-003: Apertura del modal de Registro
# ─────────────────────────────────────────────────────────────
@pytest.mark.autenticacion
@pytest.mark.positivo
def test_TC003_abrir_modal_registro(driver):
    """
    Verifica que al hacer clic en 'Registrarse' se abra el modal
    mostrando el formulario de creación de cuenta.
    """
    navegar_a(driver, PAGINA_INICIO)
    limpiar_local_storage(driver)

    btn_reg = esperar_elemento_clickeable(driver, By.ID, "btn-register-hero")
    btn_reg.click()
    time.sleep(0.8)

    captura(driver, "TC003_modal_registro_abierto")

    modal = driver.find_element(By.ID, "auth-modal")
    clases = modal.get_attribute("class") or ""
    assert "show" in clases, "El modal no se abrió"

    form_reg = driver.find_element(By.ID, "register-form-container")
    clases_form = form_reg.get_attribute("class") or ""
    assert "active" in clases_form, \
        f"El formulario de registro no está activo. Clases: '{clases_form}'"

    logger.info("[TC-003] ✅ APROBADO — Modal de registro abre correctamente")


# ─────────────────────────────────────────────────────────────
# TC-004: Cierre del modal con botón X
# ─────────────────────────────────────────────────────────────
@pytest.mark.autenticacion
@pytest.mark.positivo
def test_TC004_cerrar_modal_con_boton_x(driver):
    """
    Verifica que al hacer clic en el botón '×' el modal se cierre.
    Resultado esperado: el modal pierde la clase 'show'.
    """
    navegar_a(driver, PAGINA_INICIO)
    limpiar_local_storage(driver)

    # Abrir modal
    driver.find_element(By.ID, "btn-login-hero").click()
    time.sleep(0.6)

    # Cerrar con X
    btn_cerrar = esperar_elemento_clickeable(driver, By.ID, "close-auth-modal")
    btn_cerrar.click()
    time.sleep(0.6)

    captura(driver, "TC004_modal_cerrado")

    modal = driver.find_element(By.ID, "auth-modal")
    clases = modal.get_attribute("class") or ""
    assert "show" not in clases, \
        f"El modal sigue visible después de cerrar. Clases: '{clases}'"

    logger.info("[TC-004] ✅ APROBADO — Modal se cierra con el botón X")


# ─────────────────────────────────────────────────────────────
# TC-005: Alternancia entre Login y Registro
# ─────────────────────────────────────────────────────────────
@pytest.mark.autenticacion
@pytest.mark.navegacion
@pytest.mark.positivo
def test_TC005_alternancia_login_registro(driver):
    """
    Verifica la alternancia entre los formularios de Login y Registro
    usando los enlaces 'Regístrate aquí' e 'Inicia sesión'.
    """
    navegar_a(driver, PAGINA_INICIO)
    limpiar_local_storage(driver)

    # Abrir en login
    driver.find_element(By.ID, "btn-login-hero").click()
    time.sleep(0.6)

    form_login = driver.find_element(By.ID, "login-form-container")
    assert "active" in (form_login.get_attribute("class") or ""), \
        "Login no activo al abrir"

    # Cambiar a registro
    switch_reg = esperar_elemento_clickeable(driver, By.ID, "switch-to-register")
    switch_reg.click()
    time.sleep(0.5)

    form_reg = driver.find_element(By.ID, "register-form-container")
    assert "active" in (form_reg.get_attribute("class") or ""), \
        "Registro no activo tras clic en 'Regístrate aquí'"

    captura(driver, "TC005_formulario_registro_activo")

    # Volver a login
    switch_login = esperar_elemento_clickeable(driver, By.ID, "switch-to-login")
    switch_login.click()
    time.sleep(0.5)

    assert "active" in (form_login.get_attribute("class") or ""), \
        "Login no activo al regresar"

    captura(driver, "TC005_formulario_login_activo")
    logger.info("[TC-005] ✅ APROBADO — Alternancia Login ↔ Registro correcta")


# ─────────────────────────────────────────────────────────────
# TC-006: Campos del formulario de Login presentes
# ─────────────────────────────────────────────────────────────
@pytest.mark.formulario
@pytest.mark.positivo
def test_TC006_campos_formulario_login(driver):
    """
    Verifica que el formulario de login contenga todos los campos
    requeridos: email, password y botón de envío.
    """
    navegar_a(driver, PAGINA_INICIO)
    driver.find_element(By.ID, "btn-login-hero").click()
    time.sleep(0.6)

    captura(driver, "TC006_campos_login")

    campo_email    = driver.find_element(By.ID, "login-email")
    campo_password = driver.find_element(By.ID, "login-password")
    btn_submit     = driver.find_element(By.ID, "btn-submit-login")

    assert campo_email.is_displayed(),    "Campo email no visible"
    assert campo_password.is_displayed(), "Campo password no visible"
    assert btn_submit.is_displayed(),     "Botón submit no visible"

    # Verificar tipos de campo
    assert campo_email.get_attribute("type") == "email", \
        "Campo email no es de tipo 'email'"
    assert campo_password.get_attribute("type") == "password", \
        "Campo contraseña no es de tipo 'password'"
    assert campo_email.get_attribute("required") is not None, \
        "Campo email no tiene atributo 'required'"

    logger.info("[TC-006] ✅ APROBADO — Campos del formulario de login correctos")


# ─────────────────────────────────────────────────────────────
# TC-007: Campos del formulario de Registro presentes
# ─────────────────────────────────────────────────────────────
@pytest.mark.formulario
@pytest.mark.positivo
def test_TC007_campos_formulario_registro(driver):
    """
    Verifica que el formulario de registro contenga todos los campos
    requeridos: nombre, cédula, email, teléfono, contraseña.
    """
    navegar_a(driver, PAGINA_INICIO)
    driver.find_element(By.ID, "btn-register-hero").click()
    time.sleep(0.6)

    captura(driver, "TC007_campos_registro")

    ids_campos = [
        "reg-nombre-u", "reg-cedula-u",
        "reg-email-u",  "reg-telefono-u", "reg-password-u"
    ]
    for campo_id in ids_campos:
        elem = driver.find_element(By.ID, campo_id)
        assert elem.is_displayed(), f"Campo '{campo_id}' no visible"

    btn = driver.find_element(By.ID, "btn-submit-register")
    assert btn.is_displayed(), "Botón 'Crear Cuenta' no visible"

    logger.info("[TC-007] ✅ APROBADO — Campos del formulario de registro correctos")


# ─────────────────────────────────────────────────────────────
# TC-008: Login con campos vacíos → validación HTML5
# ─────────────────────────────────────────────────────────────
@pytest.mark.autenticacion
@pytest.mark.negativo
@pytest.mark.validacion
def test_TC008_login_campos_vacios(driver):
    """
    Verifica que el formulario de login NO se envíe cuando los
    campos están vacíos (validación nativa HTML5).
    Resultado esperado: el modal permanece abierto.
    """
    navegar_a(driver, PAGINA_INICIO)
    limpiar_local_storage(driver)
    driver.find_element(By.ID, "btn-login-hero").click()
    time.sleep(0.6)

    # Hacer clic en submit sin datos
    btn = esperar_elemento_clickeable(driver, By.ID, "btn-submit-login")
    driver.execute_script("arguments[0].click();", btn)
    time.sleep(0.5)

    captura(driver, "TC008_login_campos_vacios")

    # El modal debe seguir visible (el formulario no se envió)
    modal = driver.find_element(By.ID, "auth-modal")
    clases = modal.get_attribute("class") or ""
    assert "show" in clases, \
        "El modal se cerró inesperadamente con campos vacíos"

    logger.info("[TC-008] ✅ APROBADO — Login con campos vacíos rechazado por HTML5")


# ─────────────────────────────────────────────────────────────
# TC-009: Registro con campos vacíos → validación HTML5
# ─────────────────────────────────────────────────────────────
@pytest.mark.autenticacion
@pytest.mark.negativo
@pytest.mark.validacion
def test_TC009_registro_campos_vacios(driver):
    """
    Verifica que el formulario de registro NO se envíe cuando
    los campos obligatorios están vacíos.
    """
    navegar_a(driver, PAGINA_INICIO)
    limpiar_local_storage(driver)
    driver.find_element(By.ID, "btn-register-hero").click()
    time.sleep(0.6)

    btn = esperar_elemento_clickeable(driver, By.ID, "btn-submit-register")
    driver.execute_script("arguments[0].click();", btn)
    time.sleep(0.5)

    captura(driver, "TC009_registro_campos_vacios")

    modal = driver.find_element(By.ID, "auth-modal")
    clases = modal.get_attribute("class") or ""
    assert "show" in clases, \
        "El modal se cerró inesperadamente con campos vacíos"

    logger.info("[TC-009] ✅ APROBADO — Registro con campos vacíos rechazado por HTML5")


# ─────────────────────────────────────────────────────────────
# TC-010: Navegación al panel Administrador desde el header
# ─────────────────────────────────────────────────────────────
@pytest.mark.navegacion
@pytest.mark.positivo
def test_TC010_navegacion_a_admin_desde_header(driver):
    """
    Verifica que el enlace 'Administrador' en el header navegue
    a la página admin.html.
    """
    navegar_a(driver, PAGINA_INICIO)

    enlace_admin = esperar_elemento_clickeable(
        driver, By.CSS_SELECTOR, "nav a[href='admin.html']"
    )
    enlace_admin.click()
    time.sleep(2)

    captura(driver, "TC010_navegacion_admin")
    assert verificar_url(driver, "admin.html"), \
        f"No se navegó a admin.html. URL actual: {driver.current_url}"

    logger.info("[TC-010] ✅ APROBADO — Navegación a admin.html correcta")


# ─────────────────────────────────────────────────────────────
# TC-011: Cierre del modal al hacer clic fuera
# ─────────────────────────────────────────────────────────────
@pytest.mark.autenticacion
@pytest.mark.positivo
def test_TC011_cerrar_modal_clic_fuera(driver):
    """
    Verifica que al hacer clic en el área oscura (fuera del contenido
    del modal) este se cierre correctamente.
    """
    navegar_a(driver, PAGINA_INICIO)
    limpiar_local_storage(driver)

    driver.find_element(By.ID, "btn-login-hero").click()
    time.sleep(0.7)

    modal = driver.find_element(By.ID, "auth-modal")
    clases_antes = modal.get_attribute("class") or ""
    assert "show" in clases_antes, "El modal no estaba abierto"

    # Hacer clic en el overlay (parte izquierda superior del modal)
    driver.execute_script(
        "arguments[0].dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));",
        modal
    )
    time.sleep(0.6)

    captura(driver, "TC011_modal_cerrado_clic_fuera")

    clases_despues = modal.get_attribute("class") or ""
    assert "show" not in clases_despues, \
        f"El modal no se cerró al hacer clic fuera. Clases: '{clases_despues}'"

    logger.info("[TC-011] ✅ APROBADO — Modal se cierra al hacer clic fuera")
