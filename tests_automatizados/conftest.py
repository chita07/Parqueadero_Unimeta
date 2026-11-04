# ============================================================
# conftest.py — Configuración Global de Pruebas UNIPARKING
# Selenium WebDriver + Pytest
# ============================================================
# Proyecto: UNIPARKING — Parqueadero UNIMETA
# Normas:   ISO/IEC/IEEE 29119 | ISO/IEC 25010
# Año:      2026
# ============================================================

import pytest
import os
import logging
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.firefox.service import Service as FirefoxService
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from webdriver_manager.chrome import ChromeDriverManager
from webdriver_manager.firefox import GeckoDriverManager

# ── Logger Global ───────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("UNIPARKING-QA")


# ═══════════════════════════════════════════════════════════
# CONFIGURACIÓN GLOBAL DEL PROYECTO
# ═══════════════════════════════════════════════════════════

# Directorio raíz del proyecto web (ruta absoluta al HTML)
PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..")
)

# URL base usando file:// para archivos estáticos locales
BASE_URL = f"file:///{PROJECT_ROOT.replace(os.sep, '/')}"

# Rutas de páginas del sistema
PAGES = {
    "inicio":    f"{BASE_URL}/index.html",
    "admin":     f"{BASE_URL}/admin.html",
    "pago":      f"{BASE_URL}/pago.html",
    "mapa":      f"{BASE_URL}/mapa.html",
    "cesion":    f"{BASE_URL}/cesion.html",
    "anpr":      f"{BASE_URL}/anpr.html",
}

# ── Credenciales de prueba (datos reales de la BD) ──────────
ADMIN_EMAIL    = "admin@unimeta.edu.co"
ADMIN_PASSWORD = "admin123"

# Datos ficticios para pruebas (NO afectan la BD real —
# se usan solo para verificar validaciones del lado cliente)
TEST_USER = {
    "nombre":   "Carlos Prueba QA",
    "cedula":   "9990001234",
    "email":    "qa.prueba.2026@testunimeta.co",
    "telefono": "3209876543",
    "password": "Prueba@2026",
}

# Placa ficticia de prueba
TEST_PLACA = "QAT-999"

# Directorio de evidencias (capturas de pantalla)
EVIDENCIAS_DIR = os.path.join(os.path.dirname(__file__), "evidencias")
os.makedirs(EVIDENCIAS_DIR, exist_ok=True)

# Directorio de reportes
REPORTES_DIR = os.path.join(os.path.dirname(__file__), "reportes")
os.makedirs(REPORTES_DIR, exist_ok=True)

# Tiempo de espera implícito (segundos)
IMPLICIT_WAIT   = 10
EXPLICIT_WAIT   = 15
PAGE_LOAD_WAIT  = 20


# ═══════════════════════════════════════════════════════════
# FIXTURE: DRIVER SELENIUM (alcance de función)
# Cada test recibe un driver limpio y lo cierra al terminar
# ═══════════════════════════════════════════════════════════

def _build_chrome_driver(headless: bool = True) -> webdriver.Chrome:
    """Construye un driver Chrome con opciones estables para CI."""
    opts = ChromeOptions()
    if headless:
        opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1366,768")
    opts.add_argument("--disable-extensions")
    opts.add_argument("--disable-infobars")
    opts.add_argument("--disable-popup-blocking")
    # Permite acceso a archivos locales (file://)
    opts.add_argument("--allow-file-access-from-files")
    opts.add_argument("--disable-web-security")
    opts.add_experimental_option("excludeSwitches", ["enable-logging"])
    opts.add_experimental_option("prefs", {
        "profile.default_content_setting_values.notifications": 2
    })
    service = ChromeService(ChromeDriverManager().install())
    driver  = webdriver.Chrome(service=service, options=opts)
    driver.set_page_load_timeout(PAGE_LOAD_WAIT)
    driver.implicitly_wait(IMPLICIT_WAIT)
    return driver


def _build_firefox_driver(headless: bool = True) -> webdriver.Firefox:
    """Construye un driver Firefox (fallback)."""
    opts = FirefoxOptions()
    if headless:
        opts.add_argument("--headless")
    opts.set_preference("dom.webnotifications.enabled", False)
    service = FirefoxService(GeckoDriverManager().install())
    driver  = webdriver.Firefox(service=service, options=opts)
    driver.set_page_load_timeout(PAGE_LOAD_WAIT)
    driver.implicitly_wait(IMPLICIT_WAIT)
    return driver


@pytest.fixture(scope="function")
def driver(request):
    """
    Fixture principal de Selenium.
    Proporciona un driver Chrome (headless por defecto).
    Toma captura de pantalla automática en caso de fallo.
    """
    browser = request.config.getoption("--browser", default="chrome")
    headless = not request.config.getoption("--headed", default=False)

    logger.info(f"[DRIVER] Iniciando {browser} | headless={headless}")

    if browser == "firefox":
        drv = _build_firefox_driver(headless)
    else:
        drv = _build_chrome_driver(headless)

    yield drv

    # ── Post-test: captura en fallo ──────────────────────────
    if request.node.rep_call.failed if hasattr(request.node, "rep_call") else False:
        _tomar_captura(drv, f"FALLO_{request.node.name}")

    drv.quit()
    logger.info("[DRIVER] Driver cerrado.")


@pytest.fixture(scope="session")
def driver_session(request):
    """
    Driver de sesión (reutilizado en toda la sesión).
    Usar solo para suites que requieren estado persistente.
    """
    drv = _build_chrome_driver(headless=True)
    yield drv
    drv.quit()


# ═══════════════════════════════════════════════════════════
# HOOK: Captura automática en fallo
# ═══════════════════════════════════════════════════════════

@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep     = outcome.get_result()
    setattr(item, "rep_" + rep.when, rep)

    # Captura automática cuando falla un test con driver
    if rep.when == "call" and rep.failed:
        driver_fixture = item.funcargs.get("driver")
        if driver_fixture is not None:
            nombre = item.name.replace(" ", "_")
            _tomar_captura(driver_fixture, f"FALLO_AUTO_{nombre}")


# ═══════════════════════════════════════════════════════════
# UTILIDAD: Captura de Pantalla
# ═══════════════════════════════════════════════════════════

def _tomar_captura(drv, nombre: str) -> str:
    """Guarda una captura de pantalla y retorna la ruta."""
    ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe = "".join(c if c.isalnum() or c in ("_", "-") else "_" for c in nombre)
    ruta = os.path.join(EVIDENCIAS_DIR, f"{safe}_{ts}.png")
    try:
        drv.save_screenshot(ruta)
        logger.info(f"[CAPTURA] Guardada: {ruta}")
    except Exception as exc:
        logger.warning(f"[CAPTURA] No se pudo guardar: {exc}")
    return ruta


def tomar_captura(drv, nombre: str) -> str:
    """Función pública para usar dentro de los tests."""
    return _tomar_captura(drv, nombre)


# ═══════════════════════════════════════════════════════════
# OPCIONES DE LÍNEA DE COMANDOS PERSONALIZADAS
# ═══════════════════════════════════════════════════════════

def pytest_addoption(parser):
    parser.addoption(
        "--browser", action="store", default="chrome",
        help="Navegador: chrome (default) | firefox"
    )
    parser.addoption(
        "--headed", action="store_true", default=False,
        help="Ejecutar con interfaz gráfica visible"
    )


# ═══════════════════════════════════════════════════════════
# EXPORTAR CONFIGURACIÓN PARA USO EN TESTS
# ═══════════════════════════════════════════════════════════

__all__ = [
    "BASE_URL", "PAGES", "ADMIN_EMAIL", "ADMIN_PASSWORD",
    "TEST_USER", "TEST_PLACA", "EVIDENCIAS_DIR", "REPORTES_DIR",
    "IMPLICIT_WAIT", "EXPLICIT_WAIT", "tomar_captura",
]
