// ===== Control de Acceso ANPR — Unimeta =====

let stream = null;          // MediaStream de la cámara
let imagenCapturada = null; // DataURL de la imagen a procesar
let metodoCaptura = 'camara';// 'camara' o 'archivo'
let placaDetectada = '';    // Resultado del OCR limpio
let ocrConfianza = 0;       // Confianza del OCR (0-100)

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    activarCamara();
    cargarHistorial();

    // Drag & Drop events para la zona de archivos
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.style.borderColor = '#E30614';
                dropZone.style.background = '#fff5f5';
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.style.borderColor = '#d1d5db';
                dropZone.style.background = '#f9fafb';
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                document.getElementById('input-imagen').files = files;
                cargarArchivoImagen({ target: { files } });
            }
        });
    }
});

// ===== 1. Modo Cámara en Vivo =====
async function activarCamara() {
    metodoCaptura = 'camara';
    document.getElementById('btn-modo-camara').classList.add('active');
    document.getElementById('btn-modo-archivo').classList.remove('active');

    document.getElementById('camara-box').classList.remove('hidden');
    document.getElementById('archivo-box').classList.add('hidden');
    document.getElementById('preview-box').classList.add('hidden');
    document.getElementById('resultado-area').classList.add('hidden');

    detenerCamara();

    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Tu navegador o dispositivo no soporta acceso directo a la cámara por getUserMedia.');
        }

        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        const videoEl = document.getElementById('video-preview');
        videoEl.srcObject = stream;
        await videoEl.play();
    } catch (err) {
        console.warn('Error accediendo a la cámara:', err);
        await uiAlert(
            'Cámara no disponible',
            'No se pudo acceder a la cámara en vivo (' + err.message + '). Puedes usar la opción "Cargar Imagen / Foto" como alternativa.',
            '📷'
        );
        activarArchivo();
    }
}

function detenerCamara() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

// ===== 2. Modo Archivo / Carga de Imagen =====
function activarArchivo() {
    metodoCaptura = 'archivo';
    document.getElementById('btn-modo-archivo').classList.add('active');
    document.getElementById('btn-modo-camara').classList.remove('active');

    document.getElementById('archivo-box').classList.remove('hidden');
    document.getElementById('camara-box').classList.add('hidden');
    document.getElementById('preview-box').classList.add('hidden');
    document.getElementById('resultado-area').classList.add('hidden');

    detenerCamara();
}

// ===== 3. Capturar Foto desde la Cámara =====
function capturarFoto() {
    const video = document.getElementById('video-preview');
    if (!video || !video.videoWidth) {
        uiAlert('Error', 'No hay señal de video disponible para capturar.', '⚠️');
        return;
    }

    const canvas = document.getElementById('canvas-captura');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    imagenCapturada = canvas.toDataURL('image/png');

    detenerCamara();
    mostrarPreview(imagenCapturada, 'Cámara en Vivo');
}

// ===== 4. Cargar Imagen desde Archivo =====
function cargarArchivoImagen(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        uiAlert('Archivo no válido', 'Por favor selecciona un archivo de imagen (JPG, PNG).', '⚠️');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        imagenCapturada = e.target.result;
        mostrarPreview(imagenCapturada, 'Archivo: ' + file.name);
    };
    reader.readAsDataURL(file);
}

// ===== 5. Mostrar Preview antes del OCR =====
function mostrarPreview(dataUrl, etiquetaModo) {
    document.getElementById('camara-box').classList.add('hidden');
    document.getElementById('archivo-box').classList.add('hidden');
    document.getElementById('preview-box').classList.remove('hidden');
    document.getElementById('resultado-area').classList.add('hidden');

    document.getElementById('img-preview').src = dataUrl;
    document.getElementById('badge-modo').textContent = etiquetaModo;
}

// ===== 6. Pre-procesamiento de Imagen (Aumenta Contraste) =====
function preprocesarImagen(dataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');

            // Filtros de contraste y escala de grises para optimizar OCR de placas
            ctx.filter = 'grayscale(100%) contrast(175%) brightness(105%)';
            ctx.drawImage(img, 0, 0);

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

// ===== 7. Limpieza y Extracción con Regex de Placa Colombiana =====
function extraerPlacaColombiana(textoOCR) {
    if (!textoOCR) return null;

    // Eliminar saltos de línea, espacios, guiones y puntos
    const limpio = textoOCR.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Formatos colombianos válidos:
    // 1. Motos nuevas: 3 letras + 2 números + 1 letra (ej: ABC12D)
    // 2. Formato estándar: 3 letras + 3 números (ej: ABC123)
    const regexMotoNueva = /[A-Z]{3}[0-9]{2}[A-Z]/;
    const regexEstandar = /[A-Z]{3}[0-9]{3}/;

    const matchNueva = limpio.match(regexMotoNueva);
    if (matchNueva) return matchNueva[0];

    const matchEst = limpio.match(regexEstandar);
    if (matchEst) return matchEst[0];

    // Búsqueda flexible de 6 caracteres consecutivos
    const matchFlex = limpio.match(/[A-Z0-9]{6}/);
    if (matchFlex) return matchFlex[0];

    return null;
}

// ===== 8. Procesamiento OCR con Tesseract.js =====
async function procesarPlaca() {
    if (!imagenCapturada) {
        await uiAlert('Error', 'No hay ninguna imagen cargada para procesar.', '⚠️');
        return;
    }

    const resArea = document.getElementById('resultado-area');
    const ocrStatus = document.getElementById('ocr-procesando');
    const placaBox = document.getElementById('placa-detectada-box');
    const verifCard = document.getElementById('verificacion-resultado');
    const btnProcesar = document.getElementById('btn-procesar');

    resArea.classList.remove('hidden');
    ocrStatus.classList.remove('hidden');
    placaBox.classList.add('hidden');
    verifCard.classList.add('hidden');

    btnProcesar.disabled = true;
    btnProcesar.textContent = '⏳ Extrayendo...';

    document.getElementById('ocr-progress').style.width = '0%';
    document.getElementById('ocr-progress-pct').textContent = '0%';

    try {
        // Pre-procesar imagen para mayor nitidez
        const imagenOptimizada = await preprocesarImagen(imagenCapturada);

        // Invocar Tesseract.js v5
        const worker = await Tesseract.createWorker('eng');
        
        // Configurar whitelist de caracteres para placas vehiculares
        await worker.setParameters({
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        });

        const result = await worker.recognize(imagenOptimizada);
        await worker.terminate();

        const textoRaw = result.data.text || '';
        const confianza = Math.round(result.data.confidence || 0);

        ocrConfianza = confianza;
        document.getElementById('ocr-confianza-valor').textContent = confianza + '%';

        // Mostrar u ocultar texto crudo
        const rawInfo = document.getElementById('ocr-raw-info');
        const rawTextEl = document.getElementById('ocr-raw-text');
        if (textoRaw.trim()) {
            rawInfo.classList.remove('hidden');
            rawTextEl.textContent = textoRaw.trim().replace(/\n/g, ' ');
        } else {
            rawInfo.classList.add('hidden');
        }

        // Extraer formato de placa
        const placa = extraerPlacaColombiana(textoRaw);
        placaDetectada = placa || '';

        ocrStatus.classList.add('hidden');
        placaBox.classList.remove('hidden');

        if (placa) {
            // Formatear visualmente ej: "ABC 123" o "ABC 12D"
            const formatoDisplay = placa.length === 6 ? placa.slice(0, 3) + ' · ' + placa.slice(3) : placa;
            document.getElementById('placa-code-text').textContent = formatoDisplay;
            document.getElementById('placa-corregida').value = placa;
        } else {
            document.getElementById('placa-code-text').textContent = 'NO DETECTADA';
            document.getElementById('placa-corregida').value = '';
            document.getElementById('placa-corregida').placeholder = 'Ingresa placa manualmente...';
        }

        // Scroll suave al resultado
        resArea.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
        console.error('Error durante el OCR:', err);
        ocrStatus.classList.add('hidden');
        await uiAlert('Error en OCR', 'Ocurrió un error al procesar la imagen: ' + err.message, '❌');
    } finally {
        btnProcesar.disabled = false;
        btnProcesar.textContent = '⚡ Extraer Placa con OCR';
    }
}

// ===== 9. Verificar Estado de Pago en Supabase =====
async function verificarPago() {
    const inputCorregido = document.getElementById('placa-corregida').value.trim().toUpperCase();
    const placaFinal = inputCorregido || placaDetectada;

    if (!placaFinal) {
        await uiAlert('Placa Requerida', 'Por favor ingresa o confirma el número de placa para verificar.', '⚠️');
        return;
    }

    const btnVerificar = document.getElementById('btn-verificar-pago');
    btnVerificar.disabled = true;
    btnVerificar.textContent = 'Consultando...';

    const ahoraIso = new Date().toISOString();

    // 1. Consultar si tiene pago vigente
    const { data: pagos, error: errPago } = await db
        .from('pagos')
        .select('*')
        .ilike('placa', placaFinal)
        .gt('fecha_fin', ahoraIso)
        .order('fecha_inicio', { ascending: false })
        .limit(1);

    btnVerificar.disabled = false;
    btnVerificar.textContent = '🔍 Validar en Base de Datos';

    if (errPago) {
        await uiAlert('Error de Conexión', 'No se pudo consultar Supabase: ' + errPago.message, '❌');
        return;
    }

    const tienePago = Boolean(pagos && pagos.length > 0);
    const pago = tienePago ? pagos[0] : null;

    // 2. Registrar en la tabla alertas_acceso
    try {
        await db.from('alertas_acceso').insert([{
            placa_detectada: placaDetectada || placaFinal,
            placa_corregida: inputCorregido || null,
            tiene_pago:      tienePago,
            pago_id:         pago ? pago.id : null,
            nombre_usuario:  pago ? pago.nombre : null,
            tipo_servicio:   pago ? pago.tipo_servicio : null,
            metodo_captura:  metodoCaptura,
            confianza_ocr:   ocrConfianza + '%',
            atendida:        false
        }]);

        // Notificar a otras pestañas (panel admin) en tiempo real
        if (window.BroadcastChannel) {
            new BroadcastChannel('unimeta_channel').postMessage({ tipo: 'nueva_alerta', placa: placaFinal });
        }
    } catch (insertErr) {
        console.warn('Error guardando alerta_acceso:', insertErr);
    }

    // 3. Renderizar tarjeta de resultado
    const verifCard = document.getElementById('verificacion-resultado');
    verifCard.className = 'verificacion-card ' + (tienePago ? 'vigente' : 'sin-pago');
    verifCard.classList.remove('hidden');

    if (tienePago) {
        const vence = new Date(pago.fecha_fin).toLocaleString('es-CO', {
            dateStyle: 'short',
            timeStyle: 'short'
        });
        verifCard.innerHTML = `
            <div class="verif-header">
                <span class="verif-icon">✅</span>
                <div class="verif-title">
                    <h3>Vehículo Identificado — Pago Vigente</h3>
                    <p>Acceso autorizado para estacionamiento según suscripción activa.</p>
                </div>
            </div>
            <div class="verif-grid">
                <div class="verif-item"><strong>Placa</strong><span>${pago.placa}</span></div>
                <div class="verif-item"><strong>Titular</strong><span>${pago.nombre}</span></div>
                <div class="verif-item"><strong>Plan</strong><span>${pago.tipo_servicio.toUpperCase()}</span></div>
                <div class="verif-item"><strong>Vencimiento</strong><span>${vence}</span></div>
                <div class="verif-item"><strong>Jornada</strong><span>${pago.jornada || 'Diurna'}</span></div>
                <div class="verif-item"><strong>Referencia</strong><span>${pago.referencia || '—'}</span></div>
            </div>
            <div class="verif-actions">
                <a href="mapa.html?placa=${encodeURIComponent(pago.placa)}" class="btn-accion-mapa">📍 Asignar Espacio en Mapa →</a>
            </div>
        `;
    } else {
        verifCard.innerHTML = `
            <div class="verif-header">
                <span class="verif-icon">⚠️</span>
                <div class="verif-title">
                    <h3>Vehículo Sin Pago Registrado</h3>
                    <p>La placa <strong>${placaFinal}</strong> no cuenta con una suscripción activa o vigente.</p>
                </div>
            </div>
            <div class="verif-grid">
                <div class="verif-item"><strong>Placa Identificada</strong><span>${placaFinal}</span></div>
                <div class="verif-item"><strong>Estado</strong><span style="color:#E30614;">Sin pago activo</span></div>
                <div class="verif-item"><strong>Hora Detección</strong><span>${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}</span></div>
                <div class="verif-item"><strong>Alerta Generada</strong><span>Registrada en panel admin</span></div>
            </div>
            <div class="verif-actions">
                <a href="pago.html?placa=${encodeURIComponent(placaFinal)}" class="btn-accion-pago">💵 Registrar Pago Ahora →</a>
                <a href="mapa.html?placa=${encodeURIComponent(placaFinal)}" class="btn-accion-mapa" style="background:#4b5563;">Continuar a Mapa (Check-in)</a>
            </div>
        `;
    }

    verifCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    cargarHistorial();
}

// ===== 10. Cargar Historial de Escaneos Recientes =====
async function cargarHistorial() {
    const lista = document.getElementById('historial-lista');
    if (!lista) return;

    try {
        const { data, error } = await db
            .from('alertas_acceso')
            .select('*')
            .order('fecha_hora', { ascending: false })
            .limit(10);

        if (error || !data || data.length === 0) {
            lista.innerHTML = '<p class="placeholder">No hay escaneos registrados aún.</p>';
            return;
        }

        lista.innerHTML = data.map(item => {
            const hora = new Date(item.fecha_hora).toLocaleTimeString('es-CO', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            const placa = item.placa_corregida || item.placa_detectada;
            const tienePago = item.tiene_pago;

            return `
                <div class="historial-item">
                    <div class="hist-left">
                        <span class="hist-badge ${tienePago ? 'ok' : 'warn'}">
                            ${tienePago ? '✅ Pagado' : '⚠️ Sin pago'}
                        </span>
                        <span class="hist-placa">${placa}</span>
                        ${item.nombre_usuario ? `<small style="color:#666;">(${item.nombre_usuario})</small>` : ''}
                    </div>
                    <div class="hist-right">
                        <span>${hora}</span>
                        <small style="display:block;color:#999;">OCR: ${item.confianza_ocr || '—'}</small>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.warn('Error cargando historial:', e);
        lista.innerHTML = '<p class="placeholder">No se pudo cargar el historial.</p>';
    }
}

// ===== 11. Reiniciar Captura =====
function reiniciarCaptura() {
    imagenCapturada = null;
    placaDetectada = '';
    ocrConfianza = 0;

    if (metodoCaptura === 'camara') {
        activarCamara();
    } else {
        activarArchivo();
    }
}

// ===== 12. Helper UI Dialogs =====
function uiAlert(titulo, mensaje, icono = '⚠️') {
    return new Promise((resolve) => {
        document.getElementById('custom-dialog-title').textContent = titulo;
        document.getElementById('custom-dialog-msg').textContent = mensaje;
        document.getElementById('custom-dialog-icon').textContent = icono;

        const actions = document.getElementById('custom-dialog-actions');
        actions.innerHTML = '<button class="custom-dialog-btn custom-dialog-btn-primary" id="btn-dialog-ok">Aceptar</button>';

        document.getElementById('custom-dialog-overlay').classList.remove('hidden');

        document.getElementById('btn-dialog-ok').onclick = () => {
            document.getElementById('custom-dialog-overlay').classList.add('hidden');
            resolve();
        };
    });
}
