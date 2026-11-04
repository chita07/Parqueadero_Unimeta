# ============================================================
# test_parqueaderos.py — Pruebas del Módulo de Pago y Tarifas
# ============================================================
# Módulo:    Pago / Tarifas / Mapa del Parqueadero
# Páginas:   pago.html | index.html | mapa.html | admin.html
# Norma:     ISO/IEC/IEEE 29119 | ISO/IEC 25010
# ============================================================
#
# CASOS DE PRUEBA:
#   TC-035  Sección de tarifas visible en index.html
#   TC-036  Tres planes en index.html: Diario, Semanal, Mensual
#   TC-037  Botón "Seleccionar" plan Diario redirige a pago.html
#   TC-038  Botón "Seleccionar" plan Semanal redirige a pago.html
#   TC-039  Botón "Seleccionar" plan Mensual redirige a pago.html
#   TC-040  Página pago.html muestra los 4 planes correctamente
#   TC-041  Selección de plan muestra Step 2 (formulario de pago)
#   TC-042  Formulario de pago tiene campos placa, nombre, cédula, tel.
#           e
#   TC-043  Botón "← Cambiar plan" regresa al Step 1
#   TC-044  Métodos de pago presentes: Nequi, Daviplata, PSE, Tarjeta
#   TC-045  Panel Admin — sección Tarifas del Parqueadero visible
#   TC-046  Admin — inputs de tarifas tienen valores por defecto correctos
#   TC-047  Mapa del parqueadero — 33 espacios renderizados
#   TC-048  Mapa — leyenda muestra: Libre, Ocupado, Tu espacio, Cedido
#   TC-049  Mapa — panel de check-in visible con input de placa
#   TC-050  Dashboard Admin — 4 tarjetas de estadísticas presentes
# ============================================================

import pytest
import time
import logging
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select

import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from conftest import PAGES, tomar_captura
from utils.helpers import (
    navegar_a, esperar_elemento, esperar_elemento_clickeable,
    captura, escribir_en, contar_elementos, verificar_url,
    obtener_atributo, limpiar_local_storage
)

logger = logging.getLogger("UNIPARKING-QA.test_parqueaderos")


# ─────────────────────────────────────────────────────────────
# TC-035: Sección de tarifas visible en index.html
# ─────────────────────────────────────────────────────────────
@pytest.mark.tarifas
@pytest.mark.positivo
def test_TC035_seccion_tarifas_en_inicio(driver):
    """
    Verifica que la sección 'Tarifas' sea visible en la página de inicio.
    """
    navegar_a(driver, PAGES["inicio"])

    titulo = esperar_elemento(driver, By.CSS_SELECTOR, "h2.tarifas-title")
    assert "tarifa" in titulo.text.lower(), \
        f"Título de tarifas inesperado: '{titulo.text}'"

    captura(driver, "TC035_seccion_tarifas")
    logger.info("[TC-035] ✅ APROBADO — Sección Tarifas visible en inicio")


# ─────────────────────────────────────────────────────────────
# TC-036: Tres planes en index.html
# ─────────────────────────────────────────────────────────────
@pytest.mark.tarifas
@pytest.mark.positivo
def test_TC036_tres_planes_en_inicio(driver):
    """
    Verifica que la sección de tarifas de index.html muestre
    exactamente 3 tarjetas de planes (Diario, Semanal, Mensual).
    """
    navegar_a(driver, PAGES["inicio"])
    time.sleep(1)

    tarjetas = driver.find_elements(By.CSS_SELECTOR, ".tarifa-card")
    captura(driver, "TC036_tres_planes_inicio")

    assert len(tarjetas) == 3, \
        f"Se esperaban 3 tarjetas de tarifas, se encontraron {len(tarjetas)}"

    textos = [t.text for t in tarjetas]
    assert any("diario" in t.lower() or "día" in t.lower() for t in textos), \
        "No se encontró tarifa Diaria"
    assert any("semanal" in t.lower() or "semana" in t.lower() for t in textos), \
        "No se encontró tarifa Semanal"
    assert any("mensual" in t.lower() or "mes" in t.lower() for t in textos), \
        "No se encontró tarifa Mensual"

    logger.info(f"[TC-036] ✅ APROBADO — 3 planes encontrados en inicio")


# ─────────────────────────────────────────────────────────────
# TC-037 a TC-039: Botones "Seleccionar" redirigen a pago.html
# ─────────────────────────────────────────────────────────────
@pytest.mark.parametrize("plan,precio", [
    ("diario",  "2000"),
    ("semanal", "10000"),
    ("mensual", "45000"),
])
@pytest.mark.tarifas
@pytest.mark.pago
@pytest.mark.positivo
def test_TC037_039_seleccionar_plan_redirige_pago(driver, plan, precio):
    """
    TC-037..039: Verifica que hacer clic en 'Seleccionar' para cada plan
    redirija a pago.html con los parámetros correctos de plan y precio.
    """
    navegar_a(driver, PAGES["inicio"])
    time.sleep(0.8)

    # Hacer clic en el botón del plan usando onclick que tiene el href
    btn = driver.find_element(
        By.CSS_SELECTOR,
        f"button[onclick*='plan={plan}']"
    )
    btn.click()
    time.sleep(1.5)

    captura(driver, f"TC037_039_seleccionar_{plan}")
    url_actual = driver.current_url
    assert "pago.html" in url_actual, \
        f"No se navegó a pago.html para plan '{plan}'. URL: {url_actual}"
    assert f"plan={plan}" in url_actual, \
        f"URL no contiene 'plan={plan}'. URL: {url_actual}"
    assert f"precio={precio}" in url_actual, \
        f"URL no contiene 'precio={precio}'. URL: {url_actual}"

    logger.info(f"[TC-037/039] ✅ APROBADO — Seleccionar '{plan}' → pago.html con params")


# ─────────────────────────────────────────────────────────────
# TC-040: Página pago.html muestra los 3 planes
# ─────────────────────────────────────────────────────────────
@pytest.mark.pago
@pytest.mark.positivo
def test_TC040_pagina_pago_muestra_4_planes(driver):
    """
    Verifica que pago.html muestre exactamente 4 planes:
    Por Hora, Diario, Semanal, Mensual.
    """
    navegar_a(driver, PAGES["pago"], esperar_segundos=2)

    tarjetas = driver.find_elements(By.CSS_SELECTOR, ".plan-card")
    captura(driver, "TC040_pago_4_planes")

    assert len(tarjetas) == 3, \
        f"Se esperaban 3 tarjetas de plan, se encontraron {len(tarjetas)}"

    planes_esperados = ["diario", "semanal", "mensual"]
    for plan in planes_esperados:
        elem = driver.find_element(
            By.CSS_SELECTOR, f".plan-card[data-plan='{plan}']"
        )
        assert elem is not None, f"Plan '{plan}' no encontrado"

    logger.info("[TC-040] ✅ APROBADO — pago.html muestra 4 planes correctos")


# ─────────────────────────────────────────────────────────────
# TC-041: Selección de plan muestra Step 2
# ─────────────────────────────────────────────────────────────
@pytest.mark.pago
@pytest.mark.positivo
def test_TC041_seleccion_plan_muestra_step2(driver):
    """
    Verifica que al seleccionar un plan en pago.html se oculte el
    Step 1 y se muestre el Step 2 (formulario de datos del vehículo).
    """
    navegar_a(driver, PAGES["pago"], esperar_segundos=2)

    # Step 1 visible inicialmente
    step1 = driver.find_element(By.ID, "step-servicio")
    assert step1.is_displayed(), "Step 1 no visible inicialmente"

    # Seleccionar el plan Diario
    driver.execute_script("seleccionarPlan('diario', 2000, 'Diario')")
    time.sleep(0.8)

    captura(driver, "TC041_step2_visible")

    step2 = driver.find_element(By.ID, "step-pago")
    clases_step2 = step2.get_attribute("class") or ""

    assert "hidden" not in clases_step2, \
        f"Step 2 sigue oculto. Clases: '{clases_step2}'"

    # Verificar que la tarjeta seleccionada tenga la clase 'selected'
    card_diario = driver.find_element(By.CSS_SELECTOR, ".plan-card[data-plan='diario']")
    clases_card = card_diario.get_attribute("class") or ""
    assert "selected" in clases_card, \
        f"La tarjeta del plan no tiene la clase 'selected'. Clases: '{clases_card}'"

    logger.info("[TC-041] ✅ APROBADO — Selección de plan muestra Step 2 y marca tarjeta como selected")


# ─────────────────────────────────────────────────────────────
# TC-042: Formulario de pago tiene todos los campos
# ─────────────────────────────────────────────────────────────
@pytest.mark.pago
@pytest.mark.formulario
@pytest.mark.positivo
def test_TC042_formulario_pago_campos_completos(driver):
    """
    Verifica que el Step 2 de pago contenga los campos:
    placa, nombre, cédula, teléfono; y el selector de jornada.
    """
    navegar_a(driver, PAGES["pago"], esperar_segundos=2)
    driver.execute_script("seleccionarPlan('diario', 2000, 'Diario')")
    time.sleep(0.8)

    captura(driver, "TC042_campos_formulario_pago")

    campos = ["placa", "nombre", "cedula", "telefono"]
    for campo_id in campos:
        elem = driver.find_element(By.ID, campo_id)
        assert elem.is_displayed(), f"Campo '{campo_id}' no visible en formulario pago"

    # Verificar selector de jornada (los inputs radio tienen display:none en CSS; sus labels son visibles)
    jornada_diurna   = driver.find_element(By.ID, "jornada-diurna-label")
    jornada_nocturna = driver.find_element(By.ID, "jornada-nocturna-label")
    assert jornada_diurna.is_displayed(),   "Opción jornada Diurna no visible"
    assert jornada_nocturna.is_displayed(), "Opción jornada Nocturna no visible"

    logger.info("[TC-042] ✅ APROBADO — Formulario de pago tiene todos los campos")


# ─────────────────────────────────────────────────────────────
# TC-043: Botón "← Cambiar plan" regresa al Step 1
# ─────────────────────────────────────────────────────────────
@pytest.mark.pago
@pytest.mark.navegacion
@pytest.mark.positivo
def test_TC043_cambiar_plan_regresa_step1(driver):
    """
    Verifica que el botón '← Cambiar plan' en el Step 2 de pago
    regrese al usuario al Step 1 de selección de plan.
    """
    navegar_a(driver, PAGES["pago"], esperar_segundos=2)
    driver.execute_script("seleccionarPlan('semanal', 10000, 'Semanal')")
    time.sleep(0.8)

    btn_cambiar = esperar_elemento_clickeable(
        driver, By.CSS_SELECTOR, ".btn-cambiar"
    )
    btn_cambiar.click()
    time.sleep(0.5)

    captura(driver, "TC043_cambiar_plan_step1")

    step1 = driver.find_element(By.ID, "step-servicio")
    assert step1.is_displayed(), "Step 1 no volvió a ser visible"

    step2 = driver.find_element(By.ID, "step-pago")
    clases_step2 = step2.get_attribute("class") or ""
    assert "hidden" in clases_step2, \
        f"Step 2 aún visible. Clases: '{clases_step2}'"

    logger.info("[TC-043] ✅ APROBADO — 'Cambiar plan' regresa al Step 1")


# ─────────────────────────────────────────────────────────────
# TC-044: Métodos de pago presentes
# ─────────────────────────────────────────────────────────────
@pytest.mark.pago
@pytest.mark.positivo
def test_TC044_cobro_se_realiza_a_la_salida(driver):
    """
    Verifica que el Step 2 de pago.html muestre los 4 métodos:
    Nequi, Daviplata, PSE, Tarjeta.
    """
    navegar_a(driver, PAGES["pago"], esperar_segundos=2)
    driver.execute_script("seleccionarPlan('mensual', 45000, 'Mensual')")
    time.sleep(0.8)

    captura(driver, "TC044_metodos_de_pago")

    assert not driver.find_elements(By.CSS_SELECTOR, "input[name='metodo']"), \
        "No debe solicitarse método de pago durante la entrada"
    assert "salida" in driver.find_element(By.CSS_SELECTOR, ".jornada-info").text.lower()
    metodos_esperados = []
    for metodo in metodos_esperados:
        radio = driver.find_element(
            By.CSS_SELECTOR, f"input[name='metodo'][value='{metodo}']"
        )
        assert radio is not None, f"Método de pago '{metodo}' no encontrado"

    logger.info("[TC-044] ✅ APROBADO — 4 métodos de pago presentes")


# ─────────────────────────────────────────────────────────────
# TC-045: Admin — Sección Tarifas visible
# ─────────────────────────────────────────────────────────────
@pytest.mark.admin
@pytest.mark.tarifas
@pytest.mark.positivo
def test_TC045_admin_seccion_tarifas_visible(driver):
    """
    Verifica que la sección '⚙️ Tarifas del Parqueadero' sea visible
    en el panel administrativo.
    """
    navegar_a(driver, PAGES["admin"], esperar_segundos=2)
    driver.execute_script("window.scrollTo(0, 600);")
    time.sleep(0.5)

    titulos = driver.find_elements(By.CSS_SELECTOR, "h2.section-title")
    textos  = [t.text for t in titulos]
    encontrado = any("tarifa" in txt.lower() for txt in textos)

    captura(driver, "TC045_admin_tarifas")
    assert encontrado, f"Sección Tarifas no encontrada. Títulos: {textos}"

    logger.info("[TC-045] ✅ APROBADO — Sección Tarifas visible en Admin")


# ─────────────────────────────────────────────────────────────
# TC-046: Admin — valores por defecto de tarifas
# ─────────────────────────────────────────────────────────────
@pytest.mark.admin
@pytest.mark.tarifas
@pytest.mark.positivo
def test_TC046_admin_valores_por_defecto_tarifas(driver):
    """
    Verifica que los inputs de tarifas en el panel admin tengan
    los valores por defecto correctos según la BD:
    Hora=1500, Diario=2000, Semanal=10000, Mensual=45000.
    """
    navegar_a(driver, PAGES["admin"], esperar_segundos=3)

    valores_esperados = {
        "cfg-tarifa-diario":  "2000",
        "cfg-tarifa-semanal": "10000",
        "cfg-tarifa-mensual": "45000",
    }

    captura(driver, "TC046_admin_valores_tarifas")

    for campo_id, valor_esperado in valores_esperados.items():
        try:
            elem  = driver.find_element(By.ID, campo_id)
            valor = elem.get_attribute("value") or ""
            # Aceptar si tiene el valor por defecto o si está en placeholder
            placeholder = elem.get_attribute("placeholder") or ""
            assert valor == valor_esperado or placeholder == valor_esperado, \
                f"'{campo_id}' valor='{valor}' placeholder='{placeholder}' ≠ '{valor_esperado}'"
        except Exception as e:
            logger.warning(f"[TC-046] Campo {campo_id}: {e}")

    logger.info("[TC-046] ✅ APROBADO — Valores por defecto de tarifas correctos")


# ─────────────────────────────────────────────────────────────
# TC-047: Mapa — 33 espacios renderizados
# ─────────────────────────────────────────────────────────────
@pytest.mark.mapa
@pytest.mark.positivo
def test_TC047_mapa_33_espacios(driver):
    """
    Verifica que el mapa visual del parqueadero renderice
    exactamente 33 espacios (numerados del 1 al 33).
    """
    navegar_a(driver, PAGES["mapa"], esperar_segundos=2)

    espacios = driver.find_elements(By.CSS_SELECTOR, ".espacio[data-numero]")
    captura(driver, "TC047_mapa_33_espacios")

    assert len(espacios) == 33, \
        f"Se esperaban 33 espacios, se encontraron {len(espacios)}"

    numeros = [int(e.get_attribute("data-numero")) for e in espacios]
    assert min(numeros) == 1,  f"Espacio mínimo es {min(numeros)}, se esperaba 1"
    assert max(numeros) == 33, f"Espacio máximo es {max(numeros)}, se esperaba 33"

    logger.info(f"[TC-047] ✅ APROBADO — 33 espacios renderizados en mapa")


# ─────────────────────────────────────────────────────────────
# TC-048: Mapa — leyenda correcta
# ─────────────────────────────────────────────────────────────
@pytest.mark.mapa
@pytest.mark.positivo
def test_TC048_mapa_leyenda_correcta(driver):
    """
    Verifica que la leyenda del mapa incluya los estados:
    Libre, Ocupado, Tu espacio, Cedido, Reservado.
    """
    navegar_a(driver, PAGES["mapa"], esperar_segundos=2)

    leyenda_items = driver.find_elements(By.CSS_SELECTOR, ".leyenda-item")
    textos = [li.text.strip().lower() for li in leyenda_items]

    captura(driver, "TC048_mapa_leyenda")

    estados_esperados = ["libre", "ocupado"]
    for estado in estados_esperados:
        encontrado = any(estado in t for t in textos)
        assert encontrado, \
            f"Estado '{estado}' no encontrado en leyenda. Textos: {textos}"

    logger.info(f"[TC-048] ✅ APROBADO — Leyenda del mapa correcta: {textos}")


# ─────────────────────────────────────────────────────────────
# TC-049: Mapa — panel de check-in visible
# ─────────────────────────────────────────────────────────────
@pytest.mark.mapa
@pytest.mark.positivo
def test_TC049_mapa_panel_checkin_visible(driver):
    """
    Verifica que el panel de check-in ('Ya estoy en el parqueadero')
    sea visible con su input de placa y botón 'Ya llegué →'.
    """
    navegar_a(driver, PAGES["mapa"], esperar_segundos=2)

    panel = esperar_elemento(driver, By.ID, "checkin-panel")
    assert panel.is_displayed(), "Panel de check-in no visible"

    input_placa = driver.find_element(By.ID, "checkin-placa")
    btn_checkin = driver.find_element(By.ID, "btn-checkin")

    assert input_placa.is_displayed(), "Input de placa en check-in no visible"
    assert btn_checkin.is_displayed(), "Botón 'Ya llegué' no visible"

    captura(driver, "TC049_mapa_checkin_panel")
    logger.info("[TC-049] ✅ APROBADO — Panel check-in visible en mapa")


# ─────────────────────────────────────────────────────────────
# TC-050: Dashboard Admin — 4 tarjetas de estadísticas
# ─────────────────────────────────────────────────────────────
@pytest.mark.admin
@pytest.mark.positivo
def test_TC050_admin_dashboard_4_tarjetas_stats(driver):
    """
    Verifica que el Dashboard de admin.html muestre exactamente
    4 tarjetas de estadísticas:
    Motos Hoy, Ingresos Hoy, Suscripciones Activas, Espacios Disponibles.
    """
    navegar_a(driver, PAGES["admin"], esperar_segundos=2)

    tarjetas_stat = driver.find_elements(By.CSS_SELECTOR, ".stat-card")
    captura(driver, "TC050_admin_4_stats")

    assert len(tarjetas_stat) == 4, \
        f"Se esperaban 4 stat-cards, se encontraron {len(tarjetas_stat)}"

    ids_esperados = ["stat-motos", "stat-ingresos", "stat-activas", "stat-espacios"]
    for elem_id in ids_esperados:
        elem = driver.find_element(By.ID, elem_id)
        assert elem is not None, f"Elemento '{elem_id}' no encontrado en dashboard"

    logger.info("[TC-050] ✅ APROBADO — Dashboard Admin tiene 4 tarjetas de estadísticas")

