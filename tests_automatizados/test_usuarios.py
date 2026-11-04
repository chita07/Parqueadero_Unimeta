# ============================================================
# test_usuarios.py — Pruebas del Módulo de Usuarios UNIPARKING
# ============================================================
# Módulo:    Gestión de Usuarios (Panel Admin)
# Página:    admin.html
# Norma:     ISO/IEC/IEEE 29119 | ISO/IEC 25010
# ============================================================
#
# CASOS DE PRUEBA:
#   TC-025  Sección "Gestión de Usuarios" visible en admin.html
#   TC-026  Botón "+ Nuevo Usuario" visible y clickeable
#   TC-027  Formulario de nuevo usuario se despliega al hacer clic
#   TC-028  Formulario tiene todos los campos requeridos
#   TC-029  Botón "Cancelar" oculta el formulario nuevamente
#   TC-030  Campo Rol tiene opciones: usuario y admin
#   TC-031  Tabla de usuarios con cabeceras correctas
#   TC-032  Formulario de registro en index (lado usuario) — campos válidos
#   TC-033  Email con formato inválido rechazado (HTML5)
#   TC-034  Campos Nombre/Cédula/Email marcados como required
# ============================================================

import pytest
import time
import logging
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select

import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from conftest import PAGES, TEST_USER, tomar_captura
from utils.helpers import (
    navegar_a, esperar_elemento, esperar_elemento_clickeable,
    hacer_click, escribir_en, captura, elemento_visible,
    limpiar_local_storage, contar_elementos, obtener_texto
)

logger = logging.getLogger("UNIPARKING-QA.test_usuarios")

PAGINA_ADMIN  = PAGES["admin"]
PAGINA_INICIO = PAGES["inicio"]


# ─────────────────────────────────────────────────────────────
# TC-025: Sección "Gestión de Usuarios" visible en admin.html
# ─────────────────────────────────────────────────────────────
@pytest.mark.admin
@pytest.mark.positivo
def test_TC025_seccion_gestion_usuarios_visible(driver):
    """
    Verifica que la sección '👥 Gestión de Usuarios Registrados'
    sea visible en el panel administrativo.
    """
    navegar_a(driver, PAGINA_ADMIN, esperar_segundos=2)
    captura(driver, "TC025_admin_usuarios_seccion")

    # Buscar el título de la sección
    titulos = driver.find_elements(By.CSS_SELECTOR, "h2.section-title")
    textos  = [t.text for t in titulos]
    encontrado = any("usuario" in txt.lower() for txt in textos)

    assert encontrado, \
        f"Sección 'Gestión de Usuarios' no encontrada. Títulos: {textos}"

    logger.info("[TC-025] ✅ APROBADO — Sección Gestión de Usuarios visible")


# ─────────────────────────────────────────────────────────────
# TC-026: Botón "+ Nuevo Usuario" visible
# ─────────────────────────────────────────────────────────────
@pytest.mark.admin
@pytest.mark.positivo
def test_TC026_boton_nuevo_usuario_visible(driver):
    """
    Verifica que el botón '+ Nuevo Usuario' esté presente y visible
    en el panel administrativo.
    """
    navegar_a(driver, PAGINA_ADMIN, esperar_segundos=2)

    # Scroll para ver la sección
    driver.execute_script("window.scrollTo(0, 800);")
    time.sleep(0.5)

    # Buscar el botón por su texto
    botones = driver.find_elements(By.CSS_SELECTOR, ".btn-unimeta-outline")
    encontrado = any("nuevo usuario" in b.text.lower() for b in botones)

    captura(driver, "TC026_boton_nuevo_usuario")
    assert encontrado, "Botón '+ Nuevo Usuario' no encontrado"

    logger.info("[TC-026] ✅ APROBADO — Botón '+ Nuevo Usuario' visible")


# ─────────────────────────────────────────────────────────────
# TC-027: Formulario de nuevo usuario se despliega
# ─────────────────────────────────────────────────────────────
@pytest.mark.admin
@pytest.mark.formulario
@pytest.mark.positivo
def test_TC027_formulario_nuevo_usuario_despliega(driver):
    """
    Verifica que al hacer clic en '+ Nuevo Usuario' aparezca el
    formulario de registro de usuario (id='form-nuevo-usuario-box').
    """
    navegar_a(driver, PAGINA_ADMIN, esperar_segundos=2)
    driver.execute_script("window.scrollTo(0, 800);")
    time.sleep(0.5)

    # El formulario empieza oculto (clase 'hidden')
    form_box = driver.find_element(By.ID, "form-nuevo-usuario-box")
    clases_antes = form_box.get_attribute("class") or ""
    assert "hidden" in clases_antes, \
        f"El formulario no estaba oculto inicialmente. Clases: '{clases_antes}'"

    # Clic en el botón usando JS (función toggleFormNuevoUsuario)
    driver.execute_script("toggleFormNuevoUsuario();")
    time.sleep(0.5)

    clases_despues = form_box.get_attribute("class") or ""
    captura(driver, "TC027_formulario_desplegado")

    assert "hidden" not in clases_despues, \
        f"El formulario sigue oculto tras clic. Clases: '{clases_despues}'"

    logger.info("[TC-027] ✅ APROBADO — Formulario de nuevo usuario desplegado")


# ─────────────────────────────────────────────────────────────
# TC-028: Formulario tiene todos los campos requeridos
# ─────────────────────────────────────────────────────────────
@pytest.mark.admin
@pytest.mark.formulario
@pytest.mark.positivo
def test_TC028_formulario_usuario_campos_completos(driver):
    """
    Verifica que el formulario de nuevo usuario contenga todos
    los campos: nombre, cédula, email, teléfono, contraseña, rol.
    """
    navegar_a(driver, PAGINA_ADMIN, esperar_segundos=2)
    driver.execute_script("toggleFormNuevoUsuario();")
    time.sleep(0.5)

    captura(driver, "TC028_campos_formulario_usuario")

    campos_ids = ["usr-nombre", "usr-cedula", "usr-email",
                  "usr-telefono", "usr-password", "usr-rol"]
    for campo_id in campos_ids:
        elem = driver.find_element(By.ID, campo_id)
        assert elem is not None, f"Campo '{campo_id}' no encontrado"

    # Verificar que el select de rol tiene las opciones correctas
    select_rol = driver.find_element(By.ID, "usr-rol")
    select     = Select(select_rol)
    valores    = [opt.get_attribute("value") for opt in select.options]
    assert "usuario" in valores, "Opción 'usuario' no encontrada en select rol"
    assert "admin"   in valores, "Opción 'admin' no encontrada en select rol"

    logger.info("[TC-028] ✅ APROBADO — Formulario usuario tiene todos los campos")


# ─────────────────────────────────────────────────────────────
# TC-029: Botón "Cancelar" oculta el formulario
# ─────────────────────────────────────────────────────────────
@pytest.mark.admin
@pytest.mark.formulario
@pytest.mark.positivo
def test_TC029_cancelar_oculta_formulario_usuario(driver):
    """
    Verifica que al hacer clic en 'Cancelar' el formulario
    de nuevo usuario vuelva a ocultarse.
    """
    navegar_a(driver, PAGINA_ADMIN, esperar_segundos=2)
    driver.execute_script("toggleFormNuevoUsuario();")
    time.sleep(0.5)

    form_box = driver.find_element(By.ID, "form-nuevo-usuario-box")
    assert "hidden" not in (form_box.get_attribute("class") or ""), \
        "El formulario no se abrió"

    # Clic en Cancelar
    btn_cancelar = driver.find_element(
        By.CSS_SELECTOR, "#form-nuevo-usuario-box .btn-unimeta-secondary"
    )
    btn_cancelar.click()
    time.sleep(0.5)

    captura(driver, "TC029_formulario_cancelado")
    clases = form_box.get_attribute("class") or ""
    assert "hidden" in clases, \
        f"El formulario no se ocultó al cancelar. Clases: '{clases}'"

    logger.info("[TC-029] ✅ APROBADO — Cancelar oculta el formulario de usuario")


# ─────────────────────────────────────────────────────────────
# TC-030: Select Rol tiene opciones "usuario" y "admin"
# ─────────────────────────────────────────────────────────────
@pytest.mark.admin
@pytest.mark.validacion
@pytest.mark.positivo
def test_TC030_select_rol_opciones_correctas(driver):
    """
    Verifica que el select de Rol en el formulario de nuevo usuario
    contenga exactamente las opciones: 'usuario' y 'admin'.
    """
    navegar_a(driver, PAGINA_ADMIN, esperar_segundos=2)
    driver.execute_script("toggleFormNuevoUsuario();")
    time.sleep(0.4)

    select_elem = driver.find_element(By.ID, "usr-rol")
    select      = Select(select_elem)
    valores     = [opt.get_attribute("value") for opt in select.options]

    captura(driver, "TC030_select_rol")
    assert "usuario" in valores, f"Falta opción 'usuario'. Valores: {valores}"
    assert "admin"   in valores, f"Falta opción 'admin'. Valores: {valores}"
    assert len(valores) == 2, f"Se esperaban 2 opciones, hay {len(valores)}: {valores}"

    logger.info("[TC-030] ✅ APROBADO — Select Rol tiene opciones correctas")


# ─────────────────────────────────────────────────────────────
# TC-031: Tabla de usuarios con cabeceras correctas
# ─────────────────────────────────────────────────────────────
@pytest.mark.admin
@pytest.mark.positivo
def test_TC031_tabla_usuarios_cabeceras(driver):
    """
    Verifica que la tabla de usuarios en admin.html tenga las columnas
    correctas: #, Nombre, Cédula, Correo, Teléfono, Rol, Estado.
    """
    navegar_a(driver, PAGINA_ADMIN, esperar_segundos=2)
    driver.execute_script("window.scrollTo(0, 900);")
    time.sleep(0.5)

    tabla_usuarios = driver.find_element(By.ID, "tabla-usuarios")
    # Buscar thead
    thead = tabla_usuarios.find_element(By.XPATH, "ancestor::table//thead")
    cabeceras = [th.text.strip() for th in thead.find_elements(By.TAG_NAME, "th")]

    captura(driver, "TC031_tabla_usuarios_cabeceras")

    cols_esperadas = ["nombre", "cédula", "correo", "rol", "estado"]
    for col in cols_esperadas:
        encontrada = any(col.lower() in c.lower() for c in cabeceras)
        assert encontrada, \
            f"Columna '{col}' no encontrada en tabla. Cabeceras: {cabeceras}"

    logger.info(f"[TC-031] ✅ APROBADO — Tabla usuarios tiene cabeceras: {cabeceras}")


# ─────────────────────────────────────────────────────────────
# TC-032: Registro usuario — campos con datos válidos
# ─────────────────────────────────────────────────────────────
@pytest.mark.autenticacion
@pytest.mark.formulario
@pytest.mark.positivo
def test_TC032_registro_usuario_datos_validos(driver):
    """
    Verifica que se puedan ingresar datos válidos en el formulario
    de registro de usuario (lado cliente, sin enviar a la BD).
    Verifica que el botón de envío se active correctamente.
    """
    navegar_a(driver, PAGINA_INICIO)
    limpiar_local_storage(driver)

    driver.find_element(By.ID, "btn-register-hero").click()
    time.sleep(0.6)

    # Llenar el formulario
    escribir_en(driver, By.ID, "reg-nombre-u",   TEST_USER["nombre"])
    escribir_en(driver, By.ID, "reg-cedula-u",   TEST_USER["cedula"])
    escribir_en(driver, By.ID, "reg-email-u",    TEST_USER["email"])
    escribir_en(driver, By.ID, "reg-telefono-u", TEST_USER["telefono"])
    escribir_en(driver, By.ID, "reg-password-u", TEST_USER["password"])

    captura(driver, "TC032_registro_datos_validos")

    # Verificar que el botón no está deshabilitado
    btn = driver.find_element(By.ID, "btn-submit-register")
    assert btn.is_enabled(), "El botón 'Crear Cuenta' está deshabilitado"

    logger.info("[TC-032] ✅ APROBADO — Formulario de registro acepta datos válidos")


# ─────────────────────────────────────────────────────────────
# TC-033: Email inválido rechazado por HTML5
# ─────────────────────────────────────────────────────────────
@pytest.mark.formulario
@pytest.mark.negativo
@pytest.mark.validacion
def test_TC033_email_invalido_en_registro(driver):
    """
    Verifica que un email con formato inválido (p.ej. 'no-es-email')
    no sea aceptado por la validación HTML5.
    Resultado esperado: el formulario no se envía.
    """
    navegar_a(driver, PAGINA_INICIO)
    limpiar_local_storage(driver)

    driver.find_element(By.ID, "btn-register-hero").click()
    time.sleep(0.6)

    escribir_en(driver, By.ID, "reg-nombre-u",   "Usuario Prueba")
    escribir_en(driver, By.ID, "reg-cedula-u",   "1234567890")
    escribir_en(driver, By.ID, "reg-email-u",    "esto-no-es-un-email")
    escribir_en(driver, By.ID, "reg-password-u", "password123")

    # Intentar enviar
    driver.execute_script(
        "document.getElementById('btn-submit-register').click();"
    )
    time.sleep(0.5)

    captura(driver, "TC033_email_invalido")

    # El modal debe seguir abierto (HTML5 bloquea el envío)
    modal = driver.find_element(By.ID, "auth-modal")
    clases = modal.get_attribute("class") or ""
    assert "show" in clases, \
        "El formulario se envió con email inválido (debería rechazarse)"

    logger.info("[TC-033] ✅ APROBADO — Email inválido rechazado por HTML5")


# ─────────────────────────────────────────────────────────────
# TC-034: Campos obligatorios tienen atributo "required"
# ─────────────────────────────────────────────────────────────
@pytest.mark.formulario
@pytest.mark.validacion
@pytest.mark.positivo
def test_TC034_campos_required_en_registro(driver):
    """
    Verifica que los campos obligatorios del formulario de registro
    tengan el atributo HTML5 'required'.
    """
    navegar_a(driver, PAGINA_INICIO)
    driver.find_element(By.ID, "btn-register-hero").click()
    time.sleep(0.6)

    captura(driver, "TC034_campos_required")

    campos_requeridos = ["reg-nombre-u", "reg-cedula-u",
                         "reg-email-u",  "reg-password-u"]
    for campo_id in campos_requeridos:
        elem = driver.find_element(By.ID, campo_id)
        req  = elem.get_attribute("required")
        assert req is not None, \
            f"Campo '{campo_id}' no tiene atributo 'required'"

    logger.info("[TC-034] ✅ APROBADO — Campos required verificados en registro")
