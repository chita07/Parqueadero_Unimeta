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

// ===== 3. Capturar Foto desde la Cámara (Recorte ROI) =====
function capturarFoto() {
    const video = document.getElementById('video-preview');
    if (!video || !video.videoWidth) {
        uiAlert('Error', 'No hay señal de video disponible para capturar.', '⚠️');
        return;
    }

    const canvas = document.getElementById('canvas-captura');
    const fullW = video.videoWidth;
    const fullH = video.videoHeight;

    // Recortar SOLO la región del scan-target-box (75% ancho, 45% alto, centrado)
    const roiW = Math.round(fullW * 0.75);
    const roiH = Math.round(fullH * 0.45);
    const roiX = Math.round((fullW - roiW) / 2);
    const roiY = Math.round((fullH - roiH) / 2);

    canvas.width = roiW;
    canvas.height = roiH;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, roiX, roiY, roiW, roiH, 0, 0, roiW, roiH);

    imagenCapturada = canvas.toDataURL('image/png');

    detenerCamara();
    mostrarPreview(imagenCapturada, 'Cámara en Vivo (ROI)');
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

// Helper: Conversión de RGB a HSL
function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

// ===== 5B. Detección Inteligente de Placa Amarilla con Aspect Ratio =====
function detectarRegionPlacaAmarilla(imgElement) {
    const canvas = document.createElement('canvas');
    canvas.width = imgElement.naturalWidth || imgElement.width;
    canvas.height = imgElement.naturalHeight || imgElement.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgElement, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    let minX = canvas.width, maxX = 0, minY = canvas.height, maxY = 0;
    let yellowCount = 0;

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const [h, s, l] = rgbToHsl(data[idx], data[idx + 1], data[idx + 2]);
            // Rango espectral del amarillo de placas vehiculares colombianas
            if (h >= 30 && h <= 68 && s >= 40 && l >= 30 && l <= 82) {
                yellowCount++;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const aspectRatio = width / (height || 1);

    // Validar densidad, tamaño mínimo y morfología rectangular de placa (Aspect Ratio 1.1 a 3.5)
    if (yellowCount > 400 && width > 40 && height > 16 && aspectRatio >= 1.05 && aspectRatio <= 3.8) {
        const padX = Math.round(width * 0.08);
        const padY = Math.round(height * 0.08);
        const cropX = Math.max(0, minX - padX);
        const cropY = Math.max(0, minY - padY);
        const cropW = Math.min(canvas.width - cropX, width + padX * 2);
        const cropH = Math.min(canvas.height - cropY, height + padY * 2);

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        cropCanvas.getContext('2d').drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        return cropCanvas;
    }
    return null; // Si no se encuentra patrón rectangular amarillo, procesar recorte central
}

// ===== 6. Pre-procesamiento de Imagen (Escalado + Contraste + Binarización Otsu) =====
function preprocesarImagen(dataUrlOrCanvas) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            // Paso 1: Escalar a un ancho mínimo de 450px para OCR óptimo
            const MIN_WIDTH = 450;
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            if (w < MIN_WIDTH) {
                const scale = MIN_WIDTH / w;
                w = MIN_WIDTH;
                h = Math.round(h * scale);
            }

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);

            // Paso 2: Escala de grises
            const imageData = ctx.getImageData(0, 0, w, h);
            const d = imageData.data;
            for (let i = 0; i < d.length; i += 4) {
                const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                d[i] = d[i + 1] = d[i + 2] = gray;
            }

            // Paso 3: Estiramiento de Histograma (Contraste Máximo)
            let min = 255, max = 0;
            for (let i = 0; i < d.length; i += 4) {
                if (d[i] < min) min = d[i];
                if (d[i] > max) max = d[i];
            }
            const range = max - min || 1;
            for (let i = 0; i < d.length; i += 4) {
                const stretched = ((d[i] - min) / range) * 255;
                d[i] = d[i + 1] = d[i + 2] = stretched;
            }

            // Paso 4: Umbralización adaptativa de Otsu
            const histogram = new Array(256).fill(0);
            for (let i = 0; i < d.length; i += 4) {
                histogram[Math.round(d[i])]++;
            }
            const totalPixels = w * h;
            let sum = 0, sumB = 0, wB = 0, wF = 0, maxVar = 0, threshold = 128;
            for (let i = 0; i < 256; i++) sum += i * histogram[i];
            for (let t = 0; t < 256; t++) {
                wB += histogram[t];
                if (wB === 0) continue;
                wF = totalPixels - wB;
                if (wF === 0) break;
                sumB += t * histogram[t];
                const mB = sumB / wB;
                const mF = (sum - sumB) / wF;
                const variance = wB * wF * (mB - mF) * (mB - mF);
                if (variance > maxVar) {
                    maxVar = variance;
                    threshold = t;
                }
            }

            // Aplicar umbral binario: texto negro (0) sobre fondo blanco (255)
            for (let i = 0; i < d.length; i += 4) {
                const val = d[i] < threshold ? 0 : 255;
                d[i] = d[i + 1] = d[i + 2] = val;
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(dataUrlOrCanvas);

        if (typeof dataUrlOrCanvas === 'string') {
            img.src = dataUrlOrCanvas;
        } else if (dataUrlOrCanvas.toDataURL) {
            img.src = dataUrlOrCanvas.toDataURL('image/png');
        }
    });
}

// ===== 7. Limpieza, Corrección y Validación de Formato Colombiano =====
function extraerPlacaColombiana(textoOCR) {
    if (!textoOCR) return null;

    // Eliminar palabras institucionales del marco de la placa (COLOMBIA, VILLAVICENCIO, etc.)
    let limpio = textoOCR.toUpperCase()
        .replace(/COLOMBIA/g, '')
        .replace(/VILLAVICENCIO/g, '')
        .replace(/BOGOTA/g, '')
        .replace(/MEDELLIN/g, '')
        .replace(/CALI/g, '')
        .replace(/[^A-Z0-9]/g, '');

    // 1. Matches directos con patrones oficiales
    // Formato Moto clásica (5 chars): Ej: XYQ73
    const regexMotoClasica = /[A-Z]{3}[0-9]{2}/;
    // Formato Moto nueva (6 chars): Ej: XYQ73F, ABC12D
    const regexMotoNueva = /[A-Z]{3}[0-9]{2}[A-Z]/;
    // Formato Carro estándar (6 chars): Ej: CCC890, ABC123
    const regexEstandar = /[A-Z]{3}[0-9]{3}/;

    const matchNueva = limpio.match(regexMotoNueva);
    if (matchNueva) return matchNueva[0];

    const matchEst = limpio.match(regexEstandar);
    if (matchEst) return matchEst[0];

    const matchClasica = limpio.match(regexMotoClasica);
    if (matchClasica) return matchClasica[0];

    // 2. Corrección inteligente de confusiones OCR por posición
    if (limpio.length >= 5) {
        for (let len of [6, 5]) {
            for (let start = 0; start <= limpio.length - len; start++) {
                const sub = limpio.substr(start, len);
                let cand = '';
                for (let i = 0; i < len; i++) {
                    const c = sub[i];
                    if (i < 3) {
                        // Posiciones 0-2: Letras (O->O, 0->O, 1->I, 5->S, 8->B, 2->Z)
                        const lMap = { '0': 'O', '1': 'I', '5': 'S', '8': 'B', '2': 'Z', '6': 'G' };
                        cand += lMap[c] || c;
                    } else if (i === 5 && len === 6 && /[A-Z]/.test(c)) {
                        // Posición 5 en moto nueva: Letra
                        cand += c;
                    } else {
                        // Posiciones numéricas: Números (O->0, I->1, L->1, S->5, B->8, Z->2)
                        const nMap = { 'O': '0', 'Q': '0', 'D': '0', 'I': '1', 'L': '1', 'S': '5', 'B': '8', 'Z': '2', 'G': '6' };
                        cand += nMap[c] || c;
                    }
                }

                if (regexMotoNueva.test(cand) || regexEstandar.test(cand) || (len === 5 && regexMotoClasica.test(cand))) {
                    return cand;
                }
            }
        }
    }

    return null;
}

function esPlacaValida(placa) {
    if (!placa || placa.length < 5 || placa.length > 6) return false;
    return /^[A-Z]{3}[0-9]{2}$/.test(placa) ||
           /^[A-Z]{3}[0-9]{2}[A-Z]$/.test(placa) ||
           /^[A-Z]{3}[0-9]{3}$/.test(placa);
}

// ===== 8. Procesamiento OCR con Tesseract.js (PSM = 7 Single Line) =====
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
        let canvasParaPreprocesar = imagenCapturada;

        // Si la imagen proviene de archivo, buscar primero la placa amarilla morfológicamente
        if (metodoCaptura === 'archivo') {
            const imgTmp = new Image();
            await new Promise((r) => { imgTmp.onload = r; imgTmp.src = imagenCapturada; });
            const regionPlaca = detectarRegionPlacaAmarilla(imgTmp);
            if (regionPlaca) {
                canvasParaPreprocesar = regionPlaca;
            }
        }

        // Pre-procesar imagen con binarización Otsu
        const imagenOptimizada = await preprocesarImagen(canvasParaPreprocesar);

        // Invocar Tesseract.js v5 con Single Line Mode (PSM = 7)
        const worker = await Tesseract.createWorker('eng');
        await worker.setParameters({
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            tessedit_pageseg_mode: '7' // Modo 7: Single text line
        });

        const result = await worker.recognize(imagenOptimizada);
        await worker.terminate();

        const textoRaw = result.data.text || '';
        const confianza = Math.round(result.data.confidence || 0);

        ocrConfianza = confianza;
        document.getElementById('ocr-confianza-valor').textContent = confianza + '%';

        // Mostrar texto crudo en la interfaz
        const rawInfo = document.getElementById('ocr-raw-info');
        const rawTextEl = document.getElementById('ocr-raw-text');
        if (textoRaw.trim()) {
            rawInfo.classList.remove('hidden');
            rawTextEl.textContent = textoRaw.trim().replace(/\n/g, ' ');
        } else {
            rawInfo.classList.add('hidden');
        }

        // Extraer formato de placa colombiana
        const placa = extraerPlacaColombiana(textoRaw);
        placaDetectada = placa || '';

        ocrStatus.classList.add('hidden');
        placaBox.classList.remove('hidden');

        if (placa) {
            // Formatear visualmente ej: "XYQ 73" o "XYQ 73F" o "CCC 890"
            const formatoDisplay = placa.length === 5 
                ? placa.slice(0, 3) + ' · ' + placa.slice(3)
                : placa.slice(0, 3) + ' · ' + placa.slice(3);
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

// ===== 9. Verificar Estado de Pago en Supabase (Consulta No Bloqueante) =====
async function verificarPago() {
    const inputCorregido = document.getElementById('placa-corregida').value.trim().toUpperCase();
    const placaFinal = inputCorregido || placaDetectada;

    if (!placaFinal) {
        await uiAlert('Placa Requerida', 'Por favor ingresa o confirma el número de placa para verificar.', '⚠️');
        return;
    }

    if (!esPlacaValida(placaFinal)) {
        await uiAlert(
            'Formato Inválido',
            `La placa "${placaFinal}" no cumple con el formato vehicular colombiano (ej: XYQ73, XYQ73F, CCC890). Por favor verifica los caracteres.`,
            '⚠️'
        );
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
