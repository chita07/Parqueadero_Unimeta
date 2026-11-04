# ============================================================
# utils/helpers.py — Utilidades Comunes para Tests UNIPARKING
# ============================================================

import time
import logging
import os
from datetime import datetime
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import (
    TimeoutException, NoSuchElementException,
    ElementNotInteractableException, WebDriverException
)

logger = logging.getLogger("UNIPARKING-QA.helpers")

# ── Constantes ───────────────────────────────────────────────
EXPLICIT_WAIT = 15
EVIDENCIAS_DIR = os.path.join(os.path.dirname(__file__), "..", "evidencias")


# ═══════════════════════════════════════════════════════════
# NAVEGACIÓN
# ═══════════════════════════════════════════════════════════

def navegar_a(driver, url: str, esperar_segundos: float = 1.5):
    """Navega a una URL y espera brevemente a que cargue."""
    logger.info(f"[NAV] Navegando a: {url}")
    driver.get(url)
    time.sleep(esperar_segundos)


# ═══════════════════════════════════════════════════════════
# ESPERAS EXPLÍCITAS
# ═══════════════════════════════════════════════════════════

def esperar_elemento(driver, by: By, selector: str, timeout: int = EXPLICIT_WAIT):
    """Espera hasta que un elemento sea visible y lo retorna."""
    try:
        return WebDriverWait(driver, timeout).until(
            EC.visibility_of_element_located((by, selector))
        )
    except TimeoutException:
        logger.error(f"[ESPERA] Elemento no encontrado: {by}={selector}")
        raise

def esperar_elemento_clickeable(driver, by: By, selector: str, timeout: int = EXPLICIT_WAIT):
    """Espera hasta que un elemento sea clickeable."""
    return WebDriverWait(driver, timeout).until(
        EC.element_to_be_clickable((by, selector))
    )

def esperar_texto_en(driver, by: By, selector: str, texto: str, timeout: int = EXPLICIT_WAIT):
    """Espera hasta que un elemento contenga el texto dado."""
    return WebDriverWait(driver, timeout).until(
        EC.text_to_be_present_in_element((by, selector), texto)
    )

def esperar_url_contiene(driver, fragmento: str, timeout: int = EXPLICIT_WAIT):
    """Espera hasta que la URL contenga el fragmento dado."""
    return WebDriverWait(driver, timeout).until(
        EC.url_contains(fragmento)
    )

def esperar_modal_visible(driver, id_modal: str, timeout: int = EXPLICIT_WAIT):
    """Espera hasta que un modal esté visible."""
    return WebDriverWait(driver, timeout).until(
        EC.visibility_of_element_located((By.ID, id_modal))
    )

def elemento_existe(driver, by: By, selector: str) -> bool:
    """Retorna True si el elemento existe en el DOM."""
    try:
        driver.find_element(by, selector)
        return True
    except NoSuchElementException:
        return False


# ═══════════════════════════════════════════════════════════
# INTERACCIÓN CON ELEMENTOS
# ═══════════════════════════════════════════════════════════

def escribir_en(driver, by: By, selector: str, texto: str, limpiar: bool = True):
    """Escribe texto en un campo de entrada."""
    campo = esperar_elemento_clickeable(driver, by, selector)
    if limpiar:
        campo.clear()
    campo.send_keys(texto)
    logger.debug(f"[ESCRIBIR] {selector} ← '{texto}'")

def hacer_click(driver, by: By, selector: str):
    """Hace clic en un elemento."""
    elem = esperar_elemento_clickeable(driver, by, selector)
    elem.click()
    logger.debug(f"[CLICK] {selector}")

def hacer_click_js(driver, elemento):
    """Hace clic usando JavaScript (para elementos difíciles de clicar)."""
    driver.execute_script("arguments[0].click();", elemento)

def seleccionar_opcion(driver, by: By, selector: str, valor: str):
    """Selecciona una opción de un <select> por valor."""
    select_elem = esperar_elemento(driver, by, selector)
    Select(select_elem).select_by_value(valor)

def obtener_texto(driver, by: By, selector: str) -> str:
    """Obtiene el texto de un elemento."""
    elem = esperar_elemento(driver, by, selector)
    return elem.text.strip()

def obtener_atributo(driver, by: By, selector: str, atributo: str) -> str:
    """Obtiene el valor de un atributo HTML de un elemento."""
    elem = esperar_elemento(driver, by, selector)
    return elem.get_attribute(atributo) or ""

def clase_contiene(driver, by: By, selector: str, clase: str) -> bool:
    """Verifica si un elemento tiene una clase CSS específica."""
    elem = driver.find_element(by, selector)
    clases = elem.get_attribute("class") or ""
    return clase in clases.split()

def elemento_visible(driver, by: By, selector: str, timeout: int = 5) -> bool:
    """Verifica si un elemento está visible (con timeout corto)."""
    try:
        WebDriverWait(driver, timeout).until(
            EC.visibility_of_element_located((by, selector))
        )
        return True
    except TimeoutException:
        return False

def modal_visible(driver, id_modal: str, timeout: int = 5) -> bool:
    """Verifica si un modal con clase 'show' está activo."""
    try:
        WebDriverWait(driver, timeout).until(
            lambda d: "show" in (
                d.find_element(By.ID, id_modal).get_attribute("class") or ""
            )
        )
        return True
    except (TimeoutException, NoSuchElementException):
        return False


# ═══════════════════════════════════════════════════════════
# SCROLL
# ═══════════════════════════════════════════════════════════

def scroll_a_elemento(driver, elemento):
    """Hace scroll hasta que el elemento sea visible."""
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", elemento)
    time.sleep(0.3)

def scroll_hasta_fin(driver):
    """Hace scroll hasta el final de la página."""
    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    time.sleep(0.5)

def scroll_al_inicio(driver):
    """Hace scroll hasta el inicio de la página."""
    driver.execute_script("window.scrollTo(0, 0);")
    time.sleep(0.3)


# ═══════════════════════════════════════════════════════════
# ALERTAS Y DIÁLOGOS DEL NAVEGADOR
# ═══════════════════════════════════════════════════════════

def aceptar_alerta(driver, timeout: int = 5) -> str:
    """Acepta un alert nativo del navegador y retorna su texto."""
    try:
        WebDriverWait(driver, timeout).until(EC.alert_is_present())
        alerta = driver.switch_to.alert
        texto = alerta.text
        logger.info(f"[ALERT] Aceptando: '{texto}'")
        alerta.accept()
        return texto
    except TimeoutException:
        logger.debug("[ALERT] No apareció alert en el timeout.")
        return ""

def cancelar_alerta(driver, timeout: int = 5) -> str:
    """Cancela/rechaza un alert nativo del navegador."""
    try:
        WebDriverWait(driver, timeout).until(EC.alert_is_present())
        alerta = driver.switch_to.alert
        texto = alerta.text
        alerta.dismiss()
        return texto
    except TimeoutException:
        return ""


# ═══════════════════════════════════════════════════════════
# CAPTURA DE PANTALLA
# ═══════════════════════════════════════════════════════════

def captura(driver, nombre: str) -> str:
    """Guarda una captura de pantalla con timestamp."""
    os.makedirs(EVIDENCIAS_DIR, exist_ok=True)
    ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe = "".join(c if c.isalnum() or c in ("_", "-") else "_" for c in nombre)
    ruta = os.path.join(EVIDENCIAS_DIR, f"{safe}_{ts}.png")
    try:
        driver.save_screenshot(ruta)
        logger.info(f"[CAPTURA] → {os.path.basename(ruta)}")
    except Exception as exc:
        logger.warning(f"[CAPTURA] Error: {exc}")
    return ruta


# ═══════════════════════════════════════════════════════════
# LOCAL STORAGE (gestión de sesión)
# ═══════════════════════════════════════════════════════════

def limpiar_local_storage(driver):
    """Limpia el localStorage del navegador."""
    driver.execute_script("window.localStorage.clear();")
    logger.debug("[LS] localStorage limpiado.")

def obtener_local_storage(driver, clave: str) -> str:
    """Obtiene un valor del localStorage."""
    return driver.execute_script(f"return window.localStorage.getItem('{clave}');") or ""

def establecer_local_storage(driver, clave: str, valor: str):
    """Establece un valor en el localStorage."""
    valor_escaped = valor.replace("'", "\\'")
    driver.execute_script(f"window.localStorage.setItem('{clave}', '{valor_escaped}');")


# ═══════════════════════════════════════════════════════════
# VERIFICACIÓN DE PÁGINA
# ═══════════════════════════════════════════════════════════

def verificar_titulo(driver, texto_esperado: str) -> bool:
    """Verifica que el título de la página contenga el texto esperado."""
    titulo = driver.title
    resultado = texto_esperado.lower() in titulo.lower()
    logger.info(f"[TITULO] '{titulo}' contiene '{texto_esperado}': {resultado}")
    return resultado

def verificar_url(driver, fragmento: str) -> bool:
    """Verifica que la URL actual contenga un fragmento."""
    url_actual = driver.current_url
    resultado = fragmento in url_actual
    logger.info(f"[URL] '{url_actual}' contiene '{fragmento}': {resultado}")
    return resultado

def contar_elementos(driver, by: By, selector: str) -> int:
    """Cuenta cuántos elementos coinciden con el selector."""
    return len(driver.find_elements(by, selector))
