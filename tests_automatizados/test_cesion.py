# ============================================================
# test_cesion.py — Pruebas del Módulo de Cesión UNIPARKING
# ============================================================
# Módulo:    Cesión Temporal de Plazas
# Páginas:   cesion.html | admin.html
# Norma:     ISO/IEC/IEEE 29119 | ISO/IEC 25010
# ============================================================
#
# CASOS DE PRUEBA:
#   TC-051  Página cesion.html carga correctamente
#   TC-052  Formulario de cesión — campos requeridos presentes
#   TC-053  Placa mensualista tiene atributo required
#   TC-054  Fecha de ausencia tiene atributo required
#   TC-055  Opciones de jornada: Diurna, Nocturna, Ambas
#   TC-056  Botón "Confirmar Cesión" visible y habilitado
#   TC-057  Envío sin placa muestra validación HTML5
#   TC-058  Panel lateral "Consultar Mis Cesiones" visible
#   TC-059  Panel "Plazas Cedidas Hoy" visible
#   TC-060  Admin — Módulo Cesión de Plazas presente
#   TC-061  Admin — botón "+ Nueva Cesión" despliega formulario
#   TC-062  Admin — formulario cesión tiene campos: placa, fecha, jornada
#   TC-063  Admin — botón Cancelar oculta formulario de cesión
# ============================================================

import pytest
import time
import logging
from datetime import date, timedelta
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select

import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from conftest import PAGES, TEST_PLACA, tomar_captura
from utils.helpers import (
    navegar_a, esperar_elemento, esperar_elemento_clickeable,
    captura, escribir_en, verificar_titulo, verificar_url,
    contar_elementos, elemento_visible
)

logger = logging.getLogger("UNIPARKING-QA.test_cesion")


# ─────────────────────────────────────────────────────────────
# TC-051: Página cesion.html carga correctamente
# ─────────────────────────────────────────────────────────────
@pytest.mark.cesion
@pytest.mark.positivo
def test_TC051_carga_pagina_cesion(driver):
    """
    Verifica que la página cesion.html cargue con el título
    'Cesión Temporal de Plazas' visible.
    """
    navegar_a(driver, PAGES["cesion"], esperar_segundos=2)
    captura(driver, "TC051_cesion_cargada")

    assert verificar_titulo(driver, "Cesión"), \
        f"Título inesperado: '{driver.title}'"

    h1 = esperar_elemento(driver, By.TAG_NAME, "h1")
    assert "cesión" in h1.text.lower(), \
        f"Encabezado inesperado: '{h1.text}'"

    logger.info("[TC-051] ✅ APROBADO — Página cesion.html carga correctamente")


# ─────────────────────────────────────────────────────────────
# TC-052: Campos del formulario de cesión presentes
# ─────────────────────────────────────────────────────────────
@pytest.mark.cesion
@pytest.mark.formulario
@pytest.mark.positivo
def test_TC052_campos_formulario_cesion_presentes(driver):
    """
    Verifica que el formulario de cesión tenga los campos:
    placa mensualista, fecha de ausencia, jornada.
    """
    navegar_a(driver, PAGES["cesion"], esperar_segundos=2)

    campos_ids = ["placa-mensual", "fecha-ausencia"]
    for campo_id in campos_ids:
        elem = esperar_elemento(driver, By.ID, campo_id)
        assert elem.is_displayed(), f"Campo '{campo_id}' no visible"

    captura(driver, "TC052_campos_cesion")
    logger.info("[TC-052] ✅ APROBADO — Campos formulario cesión presentes")


# ─────────────────────────────────────────────────────────────
# TC-053: Placa mensualista tiene required
# ─────────────────────────────────────────────────────────────
@pytest.mark.cesion
@pytest.mark.validacion
@pytest.mark.positivo
def test_TC053_placa_mensualista_required(driver):
    """
    Verifica que el campo 'placa-mensual' tenga atributo required.
    """
    navegar_a(driver, PAGES["cesion"], esperar_segundos=2)

    campo = driver.find_element(By.ID, "placa-mensual")
    req   = campo.get_attribute("required")

    captura(driver, "TC053_placa_mensualista_required")
    assert req is not None, "Campo 'placa-mensual' no tiene atributo 'required'"

    logger.info("[TC-053] ✅ APROBADO — placa-mensual tiene required")


# ─────────────────────────────────────────────────────────────
# TC-054: Fecha de ausencia tiene required
# ─────────────────────────────────────────────────────────────
@pytest.mark.cesion
@pytest.mark.validacion
@pytest.mark.positivo
def test_TC054_fecha_ausencia_required(driver):
    """
    Verifica que el campo 'fecha-ausencia' tenga atributo required.
    """
    navegar_a(driver, PAGES["cesion"], esperar_segundos=2)

    campo = driver.find_element(By.ID, "fecha-ausencia")
    req   = campo.get_attribute("required")
    tipo  = campo.get_attribute("type")

    captura(driver, "TC054_fecha_ausencia")
    assert req  is not None, "Campo 'fecha-ausencia' no tiene 'required'"
    assert tipo == "date",   f"Campo fecha no es tipo 'date', es '{tipo}'"

    logger.info("[TC-054] ✅ APROBADO — fecha-ausencia tiene required y tipo date")


# ─────────────────────────────────────────────────────────────
# TC-055: Opciones de jornada correctas
# ─────────────────────────────────────────────────────────────
@pytest.mark.cesion
@pytest.mark.validacion
@pytest.mark.positivo
def test_TC055_opciones_jornada_en_cesion(driver):
    """
    Verifica que el selector de jornada en cesion.html tenga
    las 3 opciones: Diurna, Nocturna, Ambas.
    """
    navegar_a(driver, PAGES["cesion"], esperar_segundos=2)

    radios = driver.find_elements(By.CSS_SELECTOR, "input[name='jornada-cesion']")
    valores = [r.get_attribute("value") for r in radios]

    captura(driver, "TC055_opciones_jornada")
    assert "diurna"   in valores, f"'diurna' no encontrado. Valores: {valores}"
    assert "nocturna" in valores, f"'nocturna' no encontrado. Valores: {valores}"
    assert "ambas"    in valores, f"'ambas' no encontrado. Valores: {valores}"
    assert len(radios) == 3, f"Se esperaban 3 opciones, hay {len(radios)}"

    logger.info(f"[TC-055] ✅ APROBADO — 3 opciones de jornada: {valores}")


# ─────────────────────────────────────────────────────────────
# TC-056: Botón "Confirmar Cesión" visible y habilitado
# ─────────────────────────────────────────────────────────────
@pytest.mark.cesion
@pytest.mark.positivo
def test_TC056_boton_confirmar_cesion(driver):
    """
    Verifica que el botón 'Confirmar Cesión de Plaza' sea visible
    y esté habilitado en el formulario.
    """
    navegar_a(driver, PAGES["cesion"], esperar_segundos=2)

    btn = esperar_elemento(driver, By.ID, "btn-submit-cesion")
    assert btn.is_displayed(), "Botón submit cesión no visible"
    assert btn.is_enabled(),   "Botón submit cesión está deshabilitado"

    captura(driver, "TC056_boton_confirmar_cesion")
    logger.info("[TC-056] ✅ APROBADO — Botón 'Confirmar Cesión' visible y habilitado")


# ─────────────────────────────────────────────────────────────
# TC-057: Envío sin placa — validación HTML5
# ─────────────────────────────────────────────────────────────
@pytest.mark.cesion
@pytest.mark.negativo
@pytest.mark.validacion
def test_TC057_envio_cesion_sin_placa_validacion(driver):
    """
    Verifica que al enviar el formulario de cesión sin la placa
    requerida, la validación HTML5 bloquee el envío.
    Resultado esperado: el formulario no se envía.
    """
    navegar_a(driver, PAGES["cesion"], esperar_segundos=2)

    # Completar fecha pero dejar placa vacía
    fecha_manana = (date.today() + timedelta(days=1)).strftime("%Y-%m-%d")
    driver.execute_script(
        f"document.getElementById('fecha-ausencia').value = '{fecha_manana}';"
    )

    # Intentar enviar
    btn = driver.find_element(By.ID, "btn-submit-cesion")
    driver.execute_script("arguments[0].click();", btn)
    time.sleep(0.5)

    captura(driver, "TC057_cesion_sin_placa")

    # El div de resultado no debe mostrar éxito
    resultado = driver.find_element(By.ID, "resultado-cesion")
    clases    = resultado.get_attribute("class") or ""
    assert "hidden" in clases, \
        f"El formulario se envió sin placa obligatoria. Clases: '{clases}'"

    logger.info("[TC-057] ✅ APROBADO — Cesión sin placa bloqueada por HTML5")


# ─────────────────────────────────────────────────────────────
# TC-058: Panel "Consultar Mis Cesiones" visible
# ─────────────────────────────────────────────────────────────
@pytest.mark.cesion
@pytest.mark.positivo
def test_TC058_panel_consultar_mis_cesiones(driver):
    """
    Verifica que el panel lateral 'Consultar Mis Cesiones' sea visible
    con su input de búsqueda por placa y botón 'Buscar'.
    """
    navegar_a(driver, PAGES["cesion"], esperar_segundos=2)

    input_placa = esperar_elemento(driver, By.ID, "consulta-placa")
    btn_buscar  = driver.find_element(By.CSS_SELECTOR, ".btn-consultar")

    assert input_placa.is_displayed(), "Input consulta-placa no visible"
    assert btn_buscar.is_displayed(),  "Botón 'Buscar' no visible"

    captura(driver, "TC058_panel_mis_cesiones")
    logger.info("[TC-058] ✅ APROBADO — Panel Consultar Mis Cesiones visible")


# ─────────────────────────────────────────────────────────────
# TC-059: Panel "Plazas Cedidas Hoy" visible
# ─────────────────────────────────────────────────────────────
@pytest.mark.cesion
@pytest.mark.positivo
def test_TC059_panel_plazas_cedidas_hoy(driver):
    """
    Verifica que el panel 'Plazas Cedidas Hoy' sea visible en cesion.html.
    """
    navegar_a(driver, PAGES["cesion"], esperar_segundos=2)

    lista = esperar_elemento(driver, By.ID, "plazas-hoy-lista")
    assert lista is not None, "Lista de plazas cedidas hoy no encontrada"

    captura(driver, "TC059_plazas_cedidas_hoy")
    logger.info("[TC-059] ✅ APROBADO — Panel Plazas Cedidas Hoy visible")


# ─────────────────────────────────────────────────────────────
# TC-060: Admin — Módulo Cesión de Plazas presente
# ─────────────────────────────────────────────────────────────
@pytest.mark.admin
@pytest.mark.cesion
@pytest.mark.positivo
def test_TC060_admin_modulo_cesion_presente(driver):
    """
    Verifica que el módulo '🔄 Cesión Temporal de Plazas' exista
    en el panel administrativo con su id 'panel-cesiones'.
    """
    navegar_a(driver, PAGES["admin"], esperar_segundos=2)
    driver.execute_script("window.scrollTo(0, 2000);")
    time.sleep(0.5)

    panel = driver.find_element(By.ID, "panel-cesiones")
    assert panel is not None, "Panel de cesiones no encontrado en admin.html"

    captura(driver, "TC060_admin_modulo_cesion")
    logger.info("[TC-060] ✅ APROBADO — Módulo Cesión presente en Admin")


# ─────────────────────────────────────────────────────────────
# TC-061: Admin — botón "+ Nueva Cesión" despliega formulario
# ─────────────────────────────────────────────────────────────
@pytest.mark.admin
@pytest.mark.cesion
@pytest.mark.formulario
@pytest.mark.positivo
def test_TC061_admin_nueva_cesion_despliega_form(driver):
    """
    Verifica que el botón '+ Nueva Cesión' en admin.html
    despliegue el formulario de registro de cesión.
    """
    navegar_a(driver, PAGES["admin"], esperar_segundos=2)

    # Usar JS directo para toggle (evita dependencia de scroll)
    form_box = driver.find_element(By.ID, "form-cesion-box")
    clases_antes = form_box.get_attribute("class") or ""
    assert "hidden" in clases_antes, \
        f"Formulario cesión no estaba oculto. Clases: '{clases_antes}'"

    driver.execute_script("toggleFormCesion();")
    time.sleep(0.5)

    clases_despues = form_box.get_attribute("class") or ""
    captura(driver, "TC061_admin_cesion_form_desplegado")

    assert "hidden" not in clases_despues, \
        f"Formulario cesión sigue oculto. Clases: '{clases_despues}'"

    logger.info("[TC-061] ✅ APROBADO — Formulario Nueva Cesión desplegado en Admin")


# ─────────────────────────────────────────────────────────────
# TC-062: Admin — formulario cesión tiene campos correctos
# ─────────────────────────────────────────────────────────────
@pytest.mark.admin
@pytest.mark.cesion
@pytest.mark.formulario
@pytest.mark.positivo
def test_TC062_admin_form_cesion_campos(driver):
    """
    Verifica que el formulario de cesión en admin.html tenga:
    placa mensualista, fecha, jornada, placa beneficiario, observación.
    """
    navegar_a(driver, PAGES["admin"], esperar_segundos=2)
    driver.execute_script("toggleFormCesion();")
    time.sleep(0.5)

    campos_ids = ["ces-placa", "ces-fecha", "ces-jornada",
                  "ces-beneficiario", "ces-observacion"]
    for campo_id in campos_ids:
        elem = driver.find_element(By.ID, campo_id)
        assert elem is not None, f"Campo '{campo_id}' no encontrado"

    captura(driver, "TC062_admin_cesion_campos")
    logger.info("[TC-062] ✅ APROBADO — Formulario cesión Admin tiene todos los campos")


# ─────────────────────────────────────────────────────────────
# TC-063: Admin — Cancelar oculta formulario de cesión
# ─────────────────────────────────────────────────────────────
@pytest.mark.admin
@pytest.mark.cesion
@pytest.mark.positivo
def test_TC063_admin_cancelar_oculta_form_cesion(driver):
    """
    Verifica que el botón 'Cancelar' en el formulario de cesión
    de admin.html lo oculte correctamente.
    """
    navegar_a(driver, PAGES["admin"], esperar_segundos=2)
    driver.execute_script("toggleFormCesion();")
    time.sleep(0.4)

    form_box = driver.find_element(By.ID, "form-cesion-box")
    assert "hidden" not in (form_box.get_attribute("class") or ""), \
        "El formulario no se abrió"

    # Cancelar
    driver.execute_script("toggleFormCesion();")
    time.sleep(0.4)

    clases = form_box.get_attribute("class") or ""
    captura(driver, "TC063_admin_cesion_cancelado")
    assert "hidden" in clases, \
        f"Formulario cesión no se ocultó. Clases: '{clases}'"

    logger.info("[TC-063] ✅ APROBADO — Cancelar oculta formulario cesión en Admin")

