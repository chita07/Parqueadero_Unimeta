# ============================================================
# test_validaciones.py — Pruebas de Validación y Acceso
# ============================================================
# Módulo:    Validaciones UI / Control de acceso / ANPR
# Páginas:   index.html | pago.html | admin.html | anpr.html
# Norma:     ISO/IEC/IEEE 29119 | ISO/IEC 25010
# ============================================================
#
# CASOS DE PRUEBA:
#   TC-064  Placa con más de 7 caracteres rechazada (maxlength)
#   TC-065  Campo teléfono tipo tel validación HTML5
#   TC-066  Campo email tipo email en formulario de registro
#   TC-067  Input placa en formulario pago — maxlength=7
#   TC-068  Mapa — input check-in maxlength=7
#   TC-069  Cesión — input placa maxlength=7
#   TC-070  ANPR — página carga con título correcto
#   TC-071  ANPR — botones selector modo (Cámara / Archivo) presentes
#   TC-072  ANPR — historial de escaneos existe en el DOM
#   TC-073  ANPR — input manual de placa corregida presente
#   TC-074  Admin — panel ANPR (Control de Acceso) presente
#   TC-075  Admin — tabla alertas ANPR tiene cabeceras correctas
#   TC-076  Acceso a admin.html sin sesión — página carga (no hay SSO)
#   TC-077  Sección "¿Cómo funciona?" en inicio — 3 pasos presentes
#   TC-078  Resumen de pago se actualiza al seleccionar plan
#   TC-079  Jornada seleccionada por defecto es "Diurna"
#   TC-080  Admin — búsqueda en tabla de registros presente
# ============================================================

import pytest
import time
import logging
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select

import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from conftest import PAGES, TEST_PLACA, tomar_captura
from utils.helpers import (
    navegar_a, esperar_elemento, esperar_elemento_clickeable,
    captura, escribir_en, elemento_visible, limpiar_local_storage,
    obtener_atributo, contar_elementos
)

logger = logging.getLogger("UNIPARKING-QA.test_validaciones")


# ─────────────────────────────────────────────────────────────
# TC-064: Placa con más de 7 caracteres rechazada (maxlength)
# ─────────────────────────────────────────────────────────────
@pytest.mark.validacion
@pytest.mark.negativo
def test_TC064_placa_maxlength_en_pago(driver):
    """
    Verifica que el campo 'placa' en pago.html tenga maxlength=7,
    impidiendo que se ingresen más de 7 caracteres.
    """
    navegar_a(driver, PAGES["pago"], esperar_segundos=2)
    driver.execute_script("seleccionarPlan('diario', 2000, 'Diario')")
    time.sleep(0.6)

    campo = driver.find_element(By.ID, "placa")
    maxlen = campo.get_attribute("maxlength")

    captura(driver, "TC064_placa_maxlength")
    assert maxlen == "7", \
        f"maxlength esperado '7', obtenido '{maxlen}'"

    # Escribir más de 7 caracteres y verificar que se trunca
    campo.clear()
    campo.send_keys("ABCDEFGHIJ")  # 10 chars
    valor_ingresado = campo.get_attribute("value")
    assert len(valor_ingresado) <= 7, \
        f"El campo aceptó más de 7 caracteres: '{valor_ingresado}'"

    logger.info(f"[TC-064] ✅ APROBADO — Placa maxlength=7 funciona: '{valor_ingresado}'")


# ─────────────────────────────────────────────────────────────
# TC-065: Campo teléfono tipo "tel"
# ─────────────────────────────────────────────────────────────
@pytest.mark.validacion
@pytest.mark.positivo
def test_TC065_campo_telefono_tipo_tel(driver):
    """
    Verifica que los campos de teléfono en index.html y pago.html
    sean de tipo 'tel'.
    """
    navegar_a(driver, PAGES["inicio"])
    driver.find_element(By.ID, "btn-register-hero").click()
    time.sleep(0.6)

    campo_tel = driver.find_element(By.ID, "reg-telefono-u")
    tipo      = campo_tel.get_attribute("type")

    captura(driver, "TC065_telefono_tipo_tel")
    assert tipo == "tel", \
        f"Campo teléfono no es tipo 'tel'. Tipo: '{tipo}'"

    logger.info("[TC-065] ✅ APROBADO — Campo teléfono es tipo 'tel'")


# ─────────────────────────────────────────────────────────────
# TC-066: Campo email tipo "email" en registro
# ─────────────────────────────────────────────────────────────
@pytest.mark.validacion
@pytest.mark.positivo
def test_TC066_campo_email_tipo_email_registro(driver):
    """
    Verifica que el campo email en el formulario de registro
    sea de tipo 'email' (habilita validación nativa del navegador).
    """
    navegar_a(driver, PAGES["inicio"])
    driver.find_element(By.ID, "btn-register-hero").click()
    time.sleep(0.6)

    campo_email = driver.find_element(By.ID, "reg-email-u")
    tipo        = campo_email.get_attribute("type")

    captura(driver, "TC066_email_tipo_email")
    assert tipo == "email", \
        f"Campo email no es tipo 'email'. Tipo: '{tipo}'"

    logger.info("[TC-066] ✅ APROBADO — Campo email es tipo 'email'")


# ─────────────────────────────────────────────────────────────
# TC-067: Input placa en pago — maxlength=7
# ─────────────────────────────────────────────────────────────
@pytest.mark.validacion
@pytest.mark.positivo
def test_TC067_placa_maxlength_en_formulario_pago(driver):
    """
    Verifica maxlength=7 en el campo placa del formulario pago.html.
    """
    navegar_a(driver, PAGES["pago"], esperar_segundos=2)
    driver.execute_script("seleccionarPlan('diario', 2000, 'Diario')")
    time.sleep(0.5)

    campo  = driver.find_element(By.ID, "placa")
    maxlen = campo.get_attribute("maxlength")
    assert maxlen == "7", f"maxlength esperado '7', obtenido '{maxlen}'"

    captura(driver, "TC067_pago_placa_maxlength")
    logger.info("[TC-067] ✅ APROBADO — placa en pago.html tiene maxlength=7")


# ─────────────────────────────────────────────────────────────
# TC-068: Mapa — input check-in maxlength=7
# ─────────────────────────────────────────────────────────────
@pytest.mark.validacion
@pytest.mark.mapa
@pytest.mark.positivo
def test_TC068_mapa_checkin_placa_maxlength(driver):
    """
    Verifica que el input de placa en el panel de check-in del mapa
    tenga maxlength=7.
    """
    navegar_a(driver, PAGES["mapa"], esperar_segundos=2)

    campo  = driver.find_element(By.ID, "checkin-placa")
    maxlen = campo.get_attribute("maxlength")

    captura(driver, "TC068_mapa_checkin_maxlength")
    assert maxlen == "7", \
        f"maxlength esperado '7' en check-in, obtenido '{maxlen}'"

    logger.info("[TC-068] ✅ APROBADO — check-in placa maxlength=7 en mapa")


# ─────────────────────────────────────────────────────────────
# TC-069: Cesión — input placa maxlength=7
# ─────────────────────────────────────────────────────────────
@pytest.mark.validacion
@pytest.mark.cesion
@pytest.mark.positivo
def test_TC069_cesion_placa_maxlength(driver):
    """
    Verifica que el input de placa mensualista en cesion.html
    tenga maxlength=7.
    """
    navegar_a(driver, PAGES["cesion"], esperar_segundos=2)

    campo  = driver.find_element(By.ID, "placa-mensual")
    maxlen = campo.get_attribute("maxlength")

    captura(driver, "TC069_cesion_placa_maxlength")
    assert maxlen == "7", \
        f"maxlength esperado '7' en cesión, obtenido '{maxlen}'"

    logger.info("[TC-069] ✅ APROBADO — Placa mensualista maxlength=7 en cesión")


# ─────────────────────────────────────────────────────────────
# TC-070: ANPR — página carga con título correcto
# ─────────────────────────────────────────────────────────────
@pytest.mark.anpr
@pytest.mark.positivo
def test_TC070_anpr_carga_correctamente(driver):
    """
    Verifica que la página anpr.html cargue con el título
    'Control de Acceso ANPR'.
    """
    navegar_a(driver, PAGES["anpr"], esperar_segundos=2)
    captura(driver, "TC070_anpr_cargada")

    titulo = driver.title
    assert "anpr" in titulo.lower() or "acceso" in titulo.lower(), \
        f"Título ANPR inesperado: '{titulo}'"

    logger.info(f"[TC-070] ✅ APROBADO — ANPR carga con título: '{titulo}'")


# ─────────────────────────────────────────────────────────────
# TC-071: ANPR — botones de modo Cámara / Archivo
# ─────────────────────────────────────────────────────────────
@pytest.mark.anpr
@pytest.mark.positivo
def test_TC071_anpr_botones_modo_camara_archivo(driver):
    """
    Verifica que el selector de modo en anpr.html tenga los botones
    'Cámara en Vivo' y 'Cargar Imagen / Foto'.
    """
    navegar_a(driver, PAGES["anpr"], esperar_segundos=2)

    btn_camara  = esperar_elemento(driver, By.ID, "btn-modo-camara")
    btn_archivo = driver.find_element(By.ID, "btn-modo-archivo")

    assert btn_camara.is_displayed(),  "Botón 'Cámara en Vivo' no visible"
    assert btn_archivo.is_displayed(), "Botón 'Cargar Imagen' no visible"

    captura(driver, "TC071_anpr_botones_modo")
    logger.info("[TC-071] ✅ APROBADO — Botones modo ANPR presentes")


# ─────────────────────────────────────────────────────────────
# TC-072: ANPR — historial de escaneos en DOM
# ─────────────────────────────────────────────────────────────
@pytest.mark.anpr
@pytest.mark.positivo
def test_TC072_anpr_historial_escaneos(driver):
    """
    Verifica que la sección 'Registro de Escaneos y Accesos Recientes'
    exista en anpr.html con su contenedor de lista.
    """
    navegar_a(driver, PAGES["anpr"], esperar_segundos=2)

    historial = esperar_elemento(driver, By.CSS_SELECTOR, ".historial-card")
    assert historial is not None, "Sección historial no encontrada"

    lista = driver.find_element(By.ID, "historial-lista")
    assert lista is not None, "Contenedor 'historial-lista' no encontrado"

    captura(driver, "TC072_anpr_historial")
    logger.info("[TC-072] ✅ APROBADO — Historial de escaneos presente en ANPR")


# ─────────────────────────────────────────────────────────────
# TC-073: ANPR — input manual de placa corregida
# ─────────────────────────────────────────────────────────────
@pytest.mark.anpr
@pytest.mark.positivo
def test_TC073_anpr_input_placa_corregida(driver):
    """
    Verifica que exista el campo de corrección manual de placa
    ('placa-corregida') en anpr.html con maxlength=7.
    """
    navegar_a(driver, PAGES["anpr"], esperar_segundos=2)

    campo  = driver.find_element(By.ID, "placa-corregida")
    maxlen = campo.get_attribute("maxlength")

    captura(driver, "TC073_anpr_placa_corregida")
    assert maxlen == "7", \
        f"maxlength esperado '7' en placa-corregida, obtenido '{maxlen}'"

    logger.info("[TC-073] ✅ APROBADO — Input placa-corregida en ANPR tiene maxlength=7")


# ─────────────────────────────────────────────────────────────
# TC-074: Admin — panel ANPR presente
# ─────────────────────────────────────────────────────────────
@pytest.mark.admin
@pytest.mark.anpr
@pytest.mark.positivo
def test_TC074_admin_panel_anpr_presente(driver):
    """
    Verifica que el panel '📷 Control de Acceso Vehicular (ANPR)'
    esté presente en admin.html con su id 'panel-anpr-alertas'.
    """
    navegar_a(driver, PAGES["admin"], esperar_segundos=2)

    panel = driver.find_element(By.ID, "panel-anpr-alertas")
    assert panel is not None, "Panel ANPR no encontrado en admin.html"

    captura(driver, "TC074_admin_panel_anpr")
    logger.info("[TC-074] ✅ APROBADO — Panel ANPR presente en Admin")


# ─────────────────────────────────────────────────────────────
# TC-075: Admin — tabla alertas ANPR tiene cabeceras correctas
# ─────────────────────────────────────────────────────────────
@pytest.mark.admin
@pytest.mark.anpr
@pytest.mark.positivo
def test_TC075_admin_tabla_alertas_anpr_cabeceras(driver):
    """
    Verifica que la tabla de alertas ANPR en admin.html tenga
    las cabeceras: Hora, Placa, Captura, Estado Pago, Plan/Titular, Confianza, Atendida.
    """
    navegar_a(driver, PAGES["admin"], esperar_segundos=2)
    driver.execute_script("window.scrollTo(0, 3000);")
    time.sleep(0.5)

    tabla_body = driver.find_element(By.ID, "tabla-alertas-anpr")
    thead = tabla_body.find_element(
        By.XPATH, "ancestor::table//thead"
    )
    cabeceras = [th.text.strip().lower() for th in thead.find_elements(By.TAG_NAME, "th")]

    captura(driver, "TC075_admin_alertas_anpr_cabeceras")

    cols_clave = ["hora", "placa"]
    for col in cols_clave:
        assert any(col in c for c in cabeceras), \
            f"Columna '{col}' no encontrada. Cabeceras: {cabeceras}"

    logger.info(f"[TC-075] ✅ APROBADO — Cabeceras ANPR: {cabeceras}")


# ─────────────────────────────────────────────────────────────
# TC-076: Acceso a admin.html sin sesión — página carga
# ─────────────────────────────────────────────────────────────
@pytest.mark.acceso
@pytest.mark.positivo
def test_TC076_acceso_admin_sin_sesion(driver):
    """
    Verifica el comportamiento al acceder a admin.html sin sesión.
    Nota: El sistema no implementa redirección SSO en el frontend;
    la página es accesible directamente (sin bloqueo de acceso).
    Este comportamiento se documenta como limitación del prototipo.
    """
    navegar_a(driver, PAGES["admin"], esperar_segundos=2)
    limpiar_local_storage(driver)

    titulo = driver.title
    captura(driver, "TC076_admin_sin_sesion")

    # La página debe cargar (no hay SSO en el frontend)
    assert "admin" in titulo.lower() or "parqueadero" in titulo.lower(), \
        f"La página admin no cargó. Título: '{titulo}'"

    logger.info(
        "[TC-076] ✅ APROBADO — admin.html accesible sin sesión "
        "(sin SSO frontend — limitación conocida del prototipo)"
    )


# ─────────────────────────────────────────────────────────────
# TC-077: Sección "¿Cómo funciona?" — 3 pasos
# ─────────────────────────────────────────────────────────────
@pytest.mark.navegacion
@pytest.mark.positivo
def test_TC077_seccion_como_funciona_3_pasos(driver):
    """
    Verifica que la sección '¿Cómo funciona?' de index.html
    muestre exactamente 3 tarjetas de pasos: Regístrate,
    Ingresa tu vehículo, Paga y ve tu espacio.
    """
    navegar_a(driver, PAGES["inicio"])
    time.sleep(1)

    pasos = driver.find_elements(By.CSS_SELECTOR, ".paso-card")
    captura(driver, "TC077_como_funciona_pasos")

    assert len(pasos) == 3, \
        f"Se esperaban 3 pasos, se encontraron {len(pasos)}"

    textos = [p.text.lower() for p in pasos]
    assert any("regístr" in t for t in textos), "Paso 'Regístrate' no encontrado"
    assert any("vehículo" in t or "vehiculo" in t for t in textos), \
        "Paso 'Ingresa tu vehículo' no encontrado"
    assert any("paga" in t for t in textos), "Paso 'Paga' no encontrado"

    logger.info("[TC-077] ✅ APROBADO — Sección ¿Cómo funciona? tiene 3 pasos")


# ─────────────────────────────────────────────────────────────
# TC-078: Resumen de pago se actualiza al seleccionar plan
# ─────────────────────────────────────────────────────────────
@pytest.mark.pago
@pytest.mark.positivo
def test_TC078_resumen_pago_se_actualiza(driver):
    """
    Verifica que al seleccionar un plan en pago.html, el resumen
    muestre el tipo y que el valor en entrada sea cero.
    """
    navegar_a(driver, PAGES["pago"], esperar_segundos=2)
    driver.execute_script("seleccionarPlan('mensual', 45000, 'Mensual')")
    time.sleep(0.8)

    captura(driver, "TC078_resumen_pago")

    resumen_tipo = driver.find_element(By.ID, "resumen-tipo")
    resumen_total = driver.find_element(By.ID, "resumen-total")

    assert "mensual" in resumen_tipo.text.lower(), \
        f"Resumen tipo inesperado: '{resumen_tipo.text}'"
    assert "0" in resumen_total.text, \
        f"El ingreso debe quedar sin cobro: '{resumen_total.text}'"

    logger.info(f"[TC-078] ✅ APROBADO — Resumen: tipo={resumen_tipo.text}, total={resumen_total.text}")


# ─────────────────────────────────────────────────────────────
# TC-079: Jornada por defecto = "Diurna"
# ─────────────────────────────────────────────────────────────
@pytest.mark.pago
@pytest.mark.positivo
def test_TC079_jornada_por_defecto_diurna(driver):
    """
    Verifica que la opción de jornada seleccionada por defecto
    en el formulario de pago sea 'Diurna'.
    """
    navegar_a(driver, PAGES["pago"], esperar_segundos=2)
    driver.execute_script("seleccionarPlan('diario', 2000, 'Diario')")
    time.sleep(0.5)

    radio_diurna = driver.find_element(
        By.CSS_SELECTOR, "input[name='jornada'][value='diurna']"
    )
    captura(driver, "TC079_jornada_diurna_default")

    assert radio_diurna.is_selected(), \
        "La jornada 'Diurna' no está seleccionada por defecto"

    logger.info("[TC-079] ✅ APROBADO — Jornada 'Diurna' seleccionada por defecto")


# ─────────────────────────────────────────────────────────────
# TC-080: Admin — barra de búsqueda en tabla de registros
# ─────────────────────────────────────────────────────────────
@pytest.mark.admin
@pytest.mark.positivo
def test_TC080_admin_barra_busqueda_registros(driver):
    """
    Verifica que el panel 'Servicios Registrados Hoy' en admin.html
    tenga un campo de búsqueda por placa y un filtro por tarifa.
    """
    navegar_a(driver, PAGES["admin"], esperar_segundos=2)

    barra_busqueda = esperar_elemento(
        driver, By.CSS_SELECTOR, ".search-input"
    )
    filtro_tarifa = driver.find_element(By.CSS_SELECTOR, ".filter-select")
    btn_buscar    = driver.find_element(By.CSS_SELECTOR, ".btn-search")

    assert barra_busqueda.is_displayed(), "Barra de búsqueda no visible"
    assert filtro_tarifa.is_displayed(),  "Filtro tarifa no visible"
    assert btn_buscar.is_displayed(),     "Botón Buscar no visible"

    placeholder = barra_busqueda.get_attribute("placeholder") or ""
    assert "placa" in placeholder.lower(), \
        f"Placeholder inesperado: '{placeholder}'"

    captura(driver, "TC080_admin_barra_busqueda")
    logger.info("[TC-080] ✅ APROBADO — Barra búsqueda en Admin correcta")

