# ============================================================
# test_navegacion.py — Pruebas de Navegación UNIPARKING
# ============================================================
# Módulo:    Navegación entre páginas del sistema
# Norma:     ISO/IEC/IEEE 29119 | ISO/IEC 25010
# ============================================================
#
# CASOS DE PRUEBA:
#   TC-012  Acceso directo a index.html
#   TC-013  Acceso directo a admin.html
#   TC-014  Acceso directo a pago.html
#   TC-015  Acceso directo a mapa.html
#   TC-016  Acceso directo a cesion.html
#   TC-017  Acceso directo a anpr.html
#   TC-018  Navegación Inicio → Mapa desde header
#   TC-019  Navegación Inicio → Cesión desde header
#   TC-020  Navegación Admin → Escáner ANPR
#   TC-021  Navegación Admin → Mapa en Vivo
#   TC-022  Botón "Cerrar Sesión" en Admin redirige a index.html
#   TC-023  Footer presente en todas las páginas
#   TC-024  Logo UNIMETA presente en todas las páginas
# ============================================================

import pytest
import time
import logging
from selenium.webdriver.common.by import By

import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from conftest import PAGES, tomar_captura
from utils.helpers import (
    navegar_a, esperar_elemento, esperar_elemento_clickeable,
    verificar_titulo, verificar_url, captura, elemento_visible
)

logger = logging.getLogger("UNIPARKING-QA.test_navegacion")


# ─────────────────────────────────────────────────────────────
# TC-012 a TC-017: Acceso directo a cada página
# ─────────────────────────────────────────────────────────────

@pytest.mark.parametrize("pagina,fragmento_titulo", [
    ("inicio", "Parqueadero Unimeta"),
    ("admin",  "Admin"),
    ("pago",   "Pago"),
    ("mapa",   "Mapa"),
    ("cesion", "Cesión"),
    ("anpr",   "ANPR"),
])
@pytest.mark.navegacion
@pytest.mark.positivo
def test_TC012_017_acceso_directo_paginas(driver, pagina, fragmento_titulo):
    """
    TC-012..017: Verifica que cada página del sistema cargue
    directamente con el título correcto.
    """
    url = PAGES[pagina]
    navegar_a(driver, url, esperar_segundos=2)
    captura(driver, f"TC_acceso_{pagina}")

    titulo = driver.title
    assert fragmento_titulo.lower() in titulo.lower(), \
        f"Página '{pagina}': título esperado con '{fragmento_titulo}', obtenido: '{titulo}'"

    logger.info(f"[TC-01{2 + list(PAGES.keys()).index(pagina)}] ✅ APROBADO — {pagina}.html carga: '{titulo}'")


# ─────────────────────────────────────────────────────────────
# TC-018: Navegación Inicio → Mapa desde header
# ─────────────────────────────────────────────────────────────
@pytest.mark.navegacion
@pytest.mark.positivo
def test_TC018_inicio_a_mapa_desde_header(driver):
    """
    Verifica que el botón '📍 Ver Mapa' en el header de inicio.html
    navegue correctamente a mapa.html.
    """
    navegar_a(driver, PAGES["inicio"])

    btn_mapa = esperar_elemento_clickeable(
        driver, By.CSS_SELECTOR, "nav a[href='mapa.html']"
    )
    btn_mapa.click()
    time.sleep(1.5)

    captura(driver, "TC018_inicio_a_mapa")
    assert verificar_url(driver, "mapa.html"), \
        f"No se navegó a mapa.html. URL: {driver.current_url}"

    logger.info("[TC-018] ✅ APROBADO — Inicio → Mapa.html correcto")


# ─────────────────────────────────────────────────────────────
# TC-019: Navegación Inicio → Cesión desde header
# ─────────────────────────────────────────────────────────────
@pytest.mark.navegacion
@pytest.mark.positivo
def test_TC019_inicio_a_cesion_desde_header(driver):
    """
    Verifica que el enlace '🔄 Cesión' navegue a cesion.html.
    """
    navegar_a(driver, PAGES["inicio"])

    enlace = esperar_elemento_clickeable(
        driver, By.CSS_SELECTOR, "nav a[href='cesion.html']"
    )
    enlace.click()
    time.sleep(1.5)

    captura(driver, "TC019_inicio_a_cesion")
    assert verificar_url(driver, "cesion.html"), \
        f"No se navegó a cesion.html. URL: {driver.current_url}"

    logger.info("[TC-019] ✅ APROBADO — Inicio → Cesion.html correcto")


# ─────────────────────────────────────────────────────────────
# TC-020: Navegación Admin → Escáner ANPR
# ─────────────────────────────────────────────────────────────
@pytest.mark.navegacion
@pytest.mark.admin
@pytest.mark.positivo
def test_TC020_admin_a_anpr(driver):
    """
    Verifica que el enlace '📷 Escáner ANPR' en admin.html
    navegue a anpr.html.
    """
    navegar_a(driver, PAGES["admin"])
    time.sleep(1.5)

    enlace_anpr = esperar_elemento_clickeable(
        driver, By.CSS_SELECTOR, "a[href='anpr.html']"
    )
    enlace_anpr.click()
    time.sleep(1.5)

    captura(driver, "TC020_admin_a_anpr")
    assert verificar_url(driver, "anpr.html"), \
        f"No se navegó a anpr.html. URL: {driver.current_url}"

    logger.info("[TC-020] ✅ APROBADO — Admin → ANPR.html correcto")


# ─────────────────────────────────────────────────────────────
# TC-021: Navegación Admin → Mapa en Vivo
# ─────────────────────────────────────────────────────────────
@pytest.mark.navegacion
@pytest.mark.admin
@pytest.mark.positivo
def test_TC021_admin_a_mapa(driver):
    """
    Verifica que el enlace '📍 Mapa en Vivo' en admin.html
    navegue a mapa.html.
    """
    navegar_a(driver, PAGES["admin"])
    time.sleep(1.5)

    enlace_mapa = esperar_elemento_clickeable(
        driver, By.CSS_SELECTOR, ".header-nav a[href='mapa.html']"
    )
    enlace_mapa.click()
    time.sleep(1.5)

    captura(driver, "TC021_admin_a_mapa")
    assert verificar_url(driver, "mapa.html"), \
        f"No se navegó a mapa.html. URL: {driver.current_url}"

    logger.info("[TC-021] ✅ APROBADO — Admin → Mapa.html correcto")


# ─────────────────────────────────────────────────────────────
# TC-022: Botón "Cerrar Sesión" en Admin
# ─────────────────────────────────────────────────────────────
@pytest.mark.navegacion
@pytest.mark.admin
@pytest.mark.positivo
def test_TC022_cerrar_sesion_admin(driver):
    """
    Verifica que el botón '🚪 Cerrar Sesión' en admin.html
    redirija al usuario a index.html.
    """
    navegar_a(driver, PAGES["admin"])
    time.sleep(1.5)

    btn_logout = esperar_elemento_clickeable(
        driver, By.CSS_SELECTOR, ".btn-logout"
    )
    btn_logout.click()
    time.sleep(1.5)

    captura(driver, "TC022_cerrar_sesion_admin")
    assert verificar_url(driver, "index.html"), \
        f"No redirigió a index.html tras cerrar sesión. URL: {driver.current_url}"

    logger.info("[TC-022] ✅ APROBADO — Cerrar Sesión → index.html correcto")


# ─────────────────────────────────────────────────────────────
# TC-023: Footer presente en todas las páginas
# ─────────────────────────────────────────────────────────────
@pytest.mark.parametrize("pagina", ["inicio", "admin", "pago", "mapa", "cesion", "anpr"])
@pytest.mark.navegacion
@pytest.mark.positivo
def test_TC023_footer_en_todas_las_paginas(driver, pagina):
    """
    TC-023: Verifica que el footer '© 2026 Parqueadero Unimeta'
    esté presente en todas las páginas del sistema.
    """
    navegar_a(driver, PAGES[pagina], esperar_segundos=1.5)

    footer = esperar_elemento(driver, By.TAG_NAME, "footer")
    texto  = footer.text
    assert "2026" in texto and ("Parqueadero" in texto or "Unimeta" in texto), \
        f"Footer incorrecto en {pagina}: '{texto}'"

    captura(driver, f"TC023_footer_{pagina}")
    logger.info(f"[TC-023] ✅ APROBADO — Footer correcto en {pagina}.html")


# ─────────────────────────────────────────────────────────────
# TC-024: Logo UNIMETA presente en todas las páginas
# ─────────────────────────────────────────────────────────────
@pytest.mark.parametrize("pagina", ["inicio", "admin", "pago", "mapa", "cesion", "anpr"])
@pytest.mark.navegacion
@pytest.mark.positivo
def test_TC024_logo_unimeta_en_todas_las_paginas(driver, pagina):
    """
    TC-024: Verifica que el logo de UNIMETA esté presente
    en el header de cada página.
    """
    navegar_a(driver, PAGES[pagina], esperar_segundos=1.5)

    logo = driver.find_element(By.CSS_SELECTOR, "img.logo-img")
    assert logo.is_displayed(), \
        f"Logo no visible en {pagina}.html"
    src = logo.get_attribute("src") or ""
    assert "logo" in src.lower(), \
        f"El img src no apunta al logo: '{src}'"

    logger.info(f"[TC-024] ✅ APROBADO — Logo UNIMETA visible en {pagina}.html")
