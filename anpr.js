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

// ===== 5B. Mostrar Debug Visual (FASE 1) =====
function mostrarDebugVisual(canvasRecorte, imgContraste, imgOtsu, imgOtsuInvert) {
    const box = document.getElementById('debug-visual-box');
    if (!box) return;

    const recorteDataUrl = typeof canvasRecorte === 'string'
        ? canvasRecorte
        : canvasRecorte.toDataURL('image/png');

    document.getElementById('debug-img-recorte').src = recorteDataUrl;
    document.getElementById('debug-img-contraste').src = imgContraste;
    document.getElementById('debug-img-otsu').src = imgOtsu;
    document.getElementById('debug-img-otsu-inv').src = imgOtsuInvert;

    box.classList.remove('hidden');
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

// ===== 5B. Detección Inteligente de Placa Amarilla por Densidad de Color =====
function detectarRegionPlacaAmarilla(imgElement) {
    const origW = imgElement.naturalWidth || imgElement.width;
    const origH = imgElement.naturalHeight || imgElement.height;

    // Redimensionar para análisis rápido de densidad
    const scale = Math.min(1, 600 / origW);
    const w = Math.round(origW * scale);
    const h = Math.round(origH * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgElement, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Crear mapa de cuadrícula (bloques de 10x10 px) para encontrar la mayor densidad de amarillo
    const blockSize = 10;
    const cols = Math.ceil(w / blockSize);
    const rows = Math.ceil(h / blockSize);
    const grid = Array.from({ length: rows }, () => new Array(cols).fill(0));

    for (let y = 0; y < h; y++) {
        const row = Math.floor(y / blockSize);
        for (let x = 0; x < w; x++) {
            const col = Math.floor(x / blockSize);
            const idx = (y * w + x) * 4;
            const [hue, sat, lig] = rgbToHsl(data[idx], data[idx + 1], data[idx + 2]);
            // Rango amarillo de placa colombiana
            if (hue >= 28 && hue <= 70 && sat >= 35 && lig >= 25 && lig <= 85) {
                grid[row][col]++;
            }
        }
    }

    // Encontrar el rectángulo continuo con mayor concentración de bloques amarillos
    let bestX = 0, bestY = 0, bestW = 0, bestH = 0, maxDensity = 0;

    // Ventanas deslizantes representativas de placas (anchos de 20% a 95% del cuadro)
    for (let winCols = Math.floor(cols * 0.20); winCols <= Math.floor(cols * 0.95); winCols += 2) {
        // Relación de aspecto de placa (ancho/alto entre 1.1 y 2.6)
        for (let winRows = Math.floor(winCols / 2.6); winRows <= Math.floor(winCols / 1.05); winRows += 2) {
            if (winRows >= rows) continue;

            for (let r = 0; r <= rows - winRows; r += 2) {
                for (let c = 0; c <= cols - winCols; c += 2) {
                    let count = 0;
                    for (let dr = 0; dr < winRows; dr++) {
                        for (let dc = 0; dc < winCols; dc++) {
                            count += grid[r + dr][c + dc];
                        }
                    }
                    const area = winRows * winCols * (blockSize * blockSize);
                    const density = count / area;

                    if (count > 200 && density > maxDensity) {
                        maxDensity = density;
                        bestX = Math.floor(c * blockSize / scale);
                        bestY = Math.floor(r * blockSize / scale);
                        bestW = Math.floor(winCols * blockSize / scale);
                        bestH = Math.floor(winRows * blockSize / scale);
                    }
                }
            }
        }
    }

    // Si se encontró un cluster amarillo con suficiente densidad (>15%)
    if (maxDensity > 0.12 && bestW > 40 && bestH > 20) {
        // Si la foto ya está enfocada casi totalmente en la placa (más del 60% del ancho/alto)
        const esPrimerPlano = (bestW / origW) > 0.65 && (bestH / origH) > 0.40;
        
        // Recorte interior seguro (no comerse las letras superiores o inferiores)
        const innerTrimX = esPrimerPlano ? 0 : Math.round(bestW * 0.03);
        const innerTrimY = esPrimerPlano ? Math.round(bestH * 0.02) : Math.round(bestH * 0.06);
        const innerTrimYBot = esPrimerPlano ? Math.round(bestH * 0.02) : Math.round(bestH * 0.05);

        const cropX = Math.max(0, bestX + innerTrimX);
        const cropY = Math.max(0, bestY + innerTrimY);
        const cropW = Math.min(origW - cropX, bestW - innerTrimX * 2);
        const cropH = Math.min(origH - cropY, bestH - innerTrimY - innerTrimYBot);

        if (cropW < 40 || cropH < 20) {
            // Fallback: usar la region completa
            const cropCanvas2 = document.createElement('canvas');
            cropCanvas2.width = Math.min(origW, bestW);
            cropCanvas2.height = Math.min(origH, bestH);
            cropCanvas2.getContext('2d').drawImage(imgElement, bestX, bestY, bestW, bestH, 0, 0, cropCanvas2.width, cropCanvas2.height);
            return cropCanvas2;
        }

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.drawImage(imgElement, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        console.log(`✂️ Recorte de placa: ${cropW}x${cropH}px (primerPlano: ${esPrimerPlano})`);
        return cropCanvas;
    }

    return null;
}

// ===== 6. Pre-procesamiento de Imagen (Escalado + Contraste + Otsu + Limpieza de Bordes) =====
function limpiarBordesNegros(ctx, width, height) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const visited = new Uint8Array(width * height);
    const queue = [];

    // Añadir todos los píxeles negros que toquen los 4 bordes exteriores
    for (let x = 0; x < width; x++) {
        // Borde superior
        let idxTop = (0 * width + x) * 4;
        if (data[idxTop] < 128) { queue.push(x, 0); visited[0 * width + x] = 1; }
        // Borde inferior
        let idxBot = ((height - 1) * width + x) * 4;
        if (data[idxBot] < 128) { queue.push(x, height - 1); visited[(height - 1) * width + x] = 1; }
    }
    for (let y = 0; y < height; y++) {
        // Borde izquierdo
        let idxLeft = (y * width + 0) * 4;
        if (data[idxLeft] < 128 && !visited[y * width + 0]) { queue.push(0, y); visited[y * width + 0] = 1; }
        // Borde derecho
        let idxRight = (y * width + (width - 1)) * 4;
        if (data[idxRight] < 128 && !visited[y * width + (width - 1)]) { queue.push(width - 1, y); visited[y * width + (width - 1)] = 1; }
    }

    // BFS Flood Fill: Convertir todos los píxeles negros conectados al borde en blanco puro (255)
    let head = 0;
    while (head < queue.length) {
        const cx = queue[head++];
        const cy = queue[head++];

        const cIdx = (cy * width + cx) * 4;
        data[cIdx] = 255;
        data[cIdx + 1] = 255;
        data[cIdx + 2] = 255;

        const neighbors = [
            [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]
        ];

        for (let i = 0; i < 4; i++) {
            const nx = neighbors[i][0];
            const ny = neighbors[i][1];
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nPos = ny * width + nx;
                if (!visited[nPos]) {
                    visited[nPos] = 1;
                    const nIdx = nPos * 4;
                    if (data[nIdx] < 128) {
                        queue.push(nx, ny);
                    }
                }
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);
}

function preprocesarImagen(dataUrlOrCanvas, usarOtsu = false, invertir = false, afilar = false) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const MIN_WIDTH = 900;
            let w = img.naturalWidth || img.width;
            let h = img.naturalHeight || img.height;
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

            const imageData = ctx.getImageData(0, 0, w, h);
            const d = imageData.data;

            // Escala de grises (luminosidad perceptual)
            for (let i = 0; i < d.length; i += 4) {
                const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                d[i] = d[i + 1] = d[i + 2] = gray;
            }

            // Estiramiento de histograma (contraste máximo)
            let min = 255, max = 0;
            for (let i = 0; i < d.length; i += 4) {
                if (d[i] < min) min = d[i];
                if (d[i] > max) max = d[i];
            }
            const range = max - min || 1;
            for (let i = 0; i < d.length; i += 4) {
                const stretched = Math.min(255, Math.max(0, ((d[i] - min) / range) * 255));
                d[i] = d[i + 1] = d[i + 2] = stretched;
            }

            // Afilado (Sharpen Kernel 3×3) para mejorar bordes de caracteres
            if (afilar) {
                const src = new Uint8ClampedArray(d);
                for (let y = 1; y < h - 1; y++) {
                    for (let x = 1; x < w - 1; x++) {
                        const i = (y * w + x) * 4;
                        const val = 5 * src[i]
                            - src[((y - 1) * w + x) * 4]
                            - src[((y + 1) * w + x) * 4]
                            - src[(y * w + x - 1) * 4]
                            - src[(y * w + x + 1) * 4];
                        const clamped = Math.min(255, Math.max(0, val));
                        d[i] = d[i + 1] = d[i + 2] = clamped;
                    }
                }
            }

            if (usarOtsu) {
                // Umbralización de Otsu
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
                for (let i = 0; i < d.length; i += 4) {
                    const val = d[i] < threshold ? 0 : 255;
                    d[i] = d[i + 1] = d[i + 2] = val;
                }

                ctx.putImageData(imageData, 0, 0);
                // Eliminar artefactos y marcos negros conectados a los bordes exteriores
                limpiarBordesNegros(ctx, w, h);
            } else {
                ctx.putImageData(imageData, 0, 0);
            }

            // Añadir margen blanco perimetral (padding de 20px) para respiración del OCR
            const pad = 24;
            const paddedCanvas = document.createElement('canvas');
            paddedCanvas.width = w + pad * 2;
            paddedCanvas.height = h + pad * 2;
            const pCtx = paddedCanvas.getContext('2d');
            pCtx.fillStyle = '#ffffff';
            pCtx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height);
            pCtx.drawImage(canvas, pad, pad);

            // Invertir si se solicita (PSM 13)
            if (invertir) {
                const pImgData = pCtx.getImageData(0, 0, paddedCanvas.width, paddedCanvas.height);
                const pData = pImgData.data;
                for (let i = 0; i < pData.length; i += 4) {
                    pData[i] = 255 - pData[i];
                    pData[i + 1] = 255 - pData[i + 1];
                    pData[i + 2] = 255 - pData[i + 2];
                }
                pCtx.putImageData(pImgData, 0, 0);
            }

            resolve(paddedCanvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(typeof dataUrlOrCanvas === 'string' ? dataUrlOrCanvas : '');

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

    // Normalizar texto
    let raw = textoOCR.toUpperCase();

    // Eliminar palabras institucionales
    raw = raw.replace(/COLOMBIA/g, '')
        .replace(/VILLAVICENCIO/g, '')
        .replace(/BOGOTA/g, '')
        .replace(/MEDELLIN/g, '')
        .replace(/CALI/g, '');

    // 1. Extraer tokens alfanuméricos
    const tokens = (raw.match(/[A-Z0-9]+/g) || []).filter(t => t.length > 0);
    const candidatos = [];

    // Formatos válidos:
    // Moto clásica: 3 letras + 2 números (ej: XYQ73)
    const regexMotoClasica = /^[A-Z]{3}[0-9]{2}$/;
    // Moto nueva: 3 letras + 2 números + 1 letra (ej: XYQ73F, WUF62C)
    const regexMotoNueva = /^[A-Z]{3}[0-9]{2}[A-Z]$/;
    // Carro estándar: 3 letras + 3 números (ej: CCC890)
    const regexEstandar = /^[A-Z]{3}[0-9]{3}$/;

    // 1) corregirYValidar: normaliza según gramática de placas colombianas
    function corregirYValidar(str) {
        if (!str || str.length < 5 || str.length > 6) return null;
        const len = str.length;
        let cand = '';
        for (let pos = 0; pos < len; pos++) {
            const c = str[pos];
            if (pos < 3) {
                // Primeros 3 caracteres deben ser letras
                const lMap = {
                    '0': 'O', '1': 'I', '5': 'S', '8': 'B', '2': 'Z', '6': 'G', '7': 'T', '4': 'A'
                };
                let mapped = lMap[c] || c;

                // Reglas heurísticas de placas troqueladas colombianas:
                // Si en pos 0 lee '2', 'Z' o 'K' y el segundo carácter es 'W', 'Y' o 'V', casi con certeza el primero es 'X'
                if (pos === 0 && (c === '2' || c === 'Z' || c === 'K') && str.length >= 2) {
                    const next = str[1];
                    if (next === 'W' || next === 'Y' || next === 'V' || next === 'U') {
                        mapped = 'X';
                    }
                }
                // Si en pos 1 lee 'W' o 'V' y el primero fue 'X' o 'Z', es 'Y' (ej: XYQ)
                if (pos === 1 && (c === 'W' || c === 'V')) {
                    if (cand[0] === 'X' || str[0] === 'Z' || str[0] === '2' || str[0] === 'K') {
                        mapped = 'Y';
                    }
                }

                cand += mapped;
            } else if (pos === 5 && len === 6 && /[A-Z]/.test(c)) {
                // Posición 5 en moto nueva (6 chars) es letra (ej: WUF62C, XYQ73F)
                cand += c;
            } else {
                // Posiciones numéricas
                const nMap = { 'O': '0', 'Q': '0', 'D': '0', 'I': '1', 'L': '1', 'S': '5', 'B': '8', 'Z': '2', 'G': '6', 'T': '7' };
                cand += nMap[c] || c;
            }
        }

        if (regexMotoNueva.test(cand) || regexEstandar.test(cand) || (len === 5 && regexMotoClasica.test(cand))) {
            return { corregido: cand, bruto: str };
        }
        return null;
    }

    // A) tokens individuales
    for (let t of tokens) {
        const val = corregirYValidar(t);
        if (val) candidatos.push({ placa: val.corregido, bruto: val.bruto, score: 100 });
    }

    // B) combinación de 2 tokens adyacentes
    for (let i = 0; i < tokens.length - 1; i++) {
        const combo = tokens[i] + tokens[i + 1];
        const val = corregirYValidar(combo);
        if (val) candidatos.push({ placa: val.corregido, bruto: val.bruto, score: 90 });
    }

    // C) combinación de 3 tokens
    for (let i = 0; i < tokens.length - 2; i++) {
        const combo3 = tokens[i] + tokens[i + 1] + tokens[i + 2];
        const val = corregirYValidar(combo3);
        if (val) candidatos.push({ placa: val.corregido, bruto: val.bruto, score: 85 });
    }

    // D) búsqueda por subcadena en texto concatenado
    if (candidatos.length === 0) {
        const concatenado = tokens.join('');
        for (let len of [6, 5]) {
            for (let s = 0; s <= concatenado.length - len; s++) {
                const sub = concatenado.substr(s, len);
                const val = corregirYValidar(sub);
                if (val) candidatos.push({ placa: val.corregido, bruto: val.bruto, score: 50 });
            }
        }
    }

    if (candidatos.length > 0) {
        candidatos.sort((a, b) => b.score - a.score);
        return candidatos[0]; // Devuelve objeto completo { placa, bruto, score }
    }

    return null;
}

function esPlacaValida(placa) {
    if (!placa || placa.length < 5 || placa.length > 6) return false;
    return /^[A-Z]{3}[0-9]{2}$/.test(placa) ||
        /^[A-Z]{3}[0-9]{2}[A-Z]$/.test(placa) ||
        /^[A-Z]{3}[0-9]{3}$/.test(placa);
}

// ===== 7B. Votación por Consenso de Pases (Criterio: Conteo de Pases > Confianza) =====
function votarConsenso(resultadosTorneo) {
    if (resultadosTorneo.length === 0) return null;
    if (resultadosTorneo.length === 1) return resultadosTorneo[0].placa;

    const porLongitud = {};
    resultadosTorneo.forEach(r => {
        const len = r.placa.length;
        (porLongitud[len] = porLongitud[len] || []).push(r);
    });

    let mejorGrupo = [];
    let maxCount = 0;
    for (const len in porLongitud) {
        if (porLongitud[len].length > maxCount) {
            maxCount = porLongitud[len].length;
            mejorGrupo = porLongitud[len];
        }
    }
    if (mejorGrupo.length === 1) return mejorGrupo[0].placa;

    const longitud = mejorGrupo[0].placa.length;
    let resultado = '';

    for (let pos = 0; pos < longitud; pos++) {
        // conteo = criterio PRINCIPAL (cuántos pases distintos coinciden en esta letra/número)
        // pesoConf = criterio de DESEMPATE (suma de confianza)
        const conteo = {};
        const pesoConf = {};
        mejorGrupo.forEach(r => {
            const c = r.placa[pos];
            conteo[c] = (conteo[c] || 0) + 1;
            pesoConf[c] = (pesoConf[c] || 0) + Math.max(r.conf, 1);
        });

        let mejorChar = '';
        let mejorConteo = -1;
        let mejorConf = -1;
        for (const c in conteo) {
            const gana = conteo[c] > mejorConteo ||
                (conteo[c] === mejorConteo && pesoConf[c] > mejorConf);
            if (gana) {
                mejorConteo = conteo[c];
                mejorConf = pesoConf[c];
                mejorChar = c;
            }
        }
        resultado += mejorChar;
    }

    return esPlacaValida(resultado) ? resultado : mejorGrupo[0].placa;
}

// ===== 7C. Reconocimiento Híbrido Asistido por IA Multimodal (Gemini Vision / Vercel API) =====
async function consultarIAGemini(cropDataUrl, rawDataUrl) {
    try {
        const payload = {
            image: cropDataUrl || rawDataUrl,
            rawImage: rawDataUrl || cropDataUrl
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000); // 9 seg timeout

        const response = await fetch('/api/anpr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn('API /api/anpr no respondió 200:', response.status);
            return null;
        }

        const data = await response.json();
        if (data && data.success && data.valida && data.placa) {
            console.log(`🤖 [${data.motor || 'IA Vision'}] Detectó placa con éxito:`, data.placa, data);
            return data;
        }
        return null;
    } catch (e) {
        console.info('IA Serverless no disponible (usando OCR Local):', e.message);
        return null;
    }
}

// ===== 8. Procesamiento OCR Híbrido (IA Gemini + Tesseract.js Multi-Paso) =====
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
    const badgeTipo = document.getElementById('ocr-badge-tipo');

    resArea.classList.remove('hidden');
    ocrStatus.classList.remove('hidden');
    placaBox.classList.add('hidden');
    verifCard.classList.add('hidden');

    btnProcesar.disabled = true;
    btnProcesar.textContent = '⏳ Extrayendo con IA / OCR...';

    document.getElementById('ocr-progress').style.width = '0%';
    document.getElementById('ocr-progress-pct').textContent = '0%';

    try {
        let canvasParaPreprocesar = imagenCapturada;

        // Detección de región amarilla (localizar y recortar la zona de caracteres de la placa)
        const imgTmp = new Image();
        await new Promise((r) => { imgTmp.onload = r; imgTmp.src = imagenCapturada; });
        const regionPlaca = detectarRegionPlacaAmarilla(imgTmp);
        if (regionPlaca) {
            canvasParaPreprocesar = regionPlaca;
            console.log('✅ Placa localizada y recortada (zona de caracteres únicamente).');
        }

        // Obtener dataURL del recorte para enviar a la IA
        const cropDataUrl = typeof canvasParaPreprocesar === 'string'
            ? canvasParaPreprocesar
            : canvasParaPreprocesar.toDataURL('image/png');

        // Lanzar consulta de IA Gemini en paralelo mientras se preparan los filtros locales
        const promesaIA = consultarIAGemini(cropDataUrl, imagenCapturada);

        // Preparar las variantes de imagen para el torneo OCR local (7 pases)
        const imgContraste = await preprocesarImagen(canvasParaPreprocesar, false, false);
        const imgOtsu = await preprocesarImagen(canvasParaPreprocesar, true, false);
        const imgOtsuInvert = await preprocesarImagen(canvasParaPreprocesar, true, true);
        const imgSharpContr = await preprocesarImagen(canvasParaPreprocesar, false, false, true);
        const imgSharpOtsu = await preprocesarImagen(canvasParaPreprocesar, true, false, true);

        // Mostrar miniaturas en el panel de depuración visual (FASE 1)
        mostrarDebugVisual(canvasParaPreprocesar, imgContraste, imgOtsu, imgOtsuInvert);

        document.getElementById('ocr-progress').style.width = '20%';
        document.getElementById('ocr-progress-pct').textContent = '20%';

        // Instanciar Worker con modelo LSTM de alta precisión (tessdata_best)
        const worker = await Tesseract.createWorker('eng', 1, {
            langPath: 'https://tessdata.projectnaptha.com/4.0.0_best',
            logger: m => {
                if (m.status && m.status.includes('loading')) {
                    console.log(`🧠 [Tesseract Best]: ${m.status} ${Math.round((m.progress || 0) * 100)}%`);
                }
            }
        });
        const WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

        const pases = [
            { img: imgContraste, psm: '7', label: 'PSM7-contraste' },
            { img: imgContraste, psm: '8', label: 'PSM8-contraste' },
            { img: imgSharpContr, psm: '7', label: 'PSM7-sharp' },
            { img: imgOtsu, psm: '6', label: 'PSM6-otsu' },
            { img: imgOtsu, psm: '7', label: 'PSM7-otsu' },
            { img: imgSharpOtsu, psm: '7', label: 'PSM7-sharp-otsu' },
            { img: imgOtsuInvert, psm: '13', label: 'PSM13-inv' },
        ];

        const resultadosTorneo = [];
        const textosCrudos = [];
        let mejorConfianza = 0;

        for (let i = 0; i < pases.length; i++) {
            const pase = pases[i];
            await worker.setParameters({
                tessedit_char_whitelist: WHITELIST,
                tessedit_pageseg_mode: pase.psm
            });
            const res = await worker.recognize(pase.img);
            const texto = (res.data.text || '').trim();
            const conf = Math.round(res.data.confidence || 0);

            console.log(`🔍 [${pase.label}] conf=${conf}% → "${texto.replace(/\n/g, ' ')}"`);

            if (texto) textosCrudos.push(texto);
            const candidato = extraerPlacaColombiana(texto);
            if (candidato) {
                resultadosTorneo.push({
                    placa: candidato.placa,
                    bruto: candidato.bruto,
                    rawText: texto,
                    conf,
                    psm: pase.psm,
                    variant: pase.label,
                    label: pase.label
                });
            }
            if (conf > mejorConfianza) mejorConfianza = conf;

            const pct = Math.round(((i + 1) / pases.length) * 70) + 20;
            document.getElementById('ocr-progress').style.width = pct + '%';
            document.getElementById('ocr-progress-pct').textContent = pct + '%';
        }

        await worker.terminate();

        // Esperar el resultado de la IA (si aún no terminó)
        const resultadoIA = await promesaIA;

        document.getElementById('ocr-progress').style.width = '100%';
        document.getElementById('ocr-progress-pct').textContent = '100%';

        // Tabla de depuración en consola
        if (resultadosTorneo.length > 0) {
            console.table(resultadosTorneo.map(r => ({
                pase: r.label,
                crudo: r.rawText.replace(/\n/g, ' ').slice(0, 40),
                bruto: r.bruto,
                corregido: r.placa,
                confianza: r.conf + '%'
            })));
        }

        // Selección por consenso de pases locales
        const placaConsensoLocal = votarConsenso(resultadosTorneo);

        let placaFinal = '';
        let origenMotor = '';

        if (resultadoIA && resultadoIA.valida && esPlacaValida(resultadoIA.placa)) {
            // IA Gemini tiene máxima prioridad en visión multimodal
            placaFinal = resultadoIA.placa;
            ocrConfianza = resultadoIA.confianza || 98;
            origenMotor = resultadoIA.motor || '🤖 IA Gemini Vision';
            console.log(`✨ [DECISIÓN] Placa adoptada por ${origenMotor}: ${placaFinal}`);
        } else if (placaConsensoLocal) {
            placaFinal = placaConsensoLocal;
            const acuerdos = resultadosTorneo.filter(r => r.placa === placaFinal).length;
            const confConsenso = Math.round((acuerdos / pases.length) * 100);
            const confRawMejor = Math.max(...resultadosTorneo.filter(r => r.placa === placaFinal).map(r => r.conf));
            ocrConfianza = Math.max(confConsenso, confRawMejor);
            origenMotor = '⚡ Tesseract.js (Consenso)';
            console.log(`⚡ [DECISIÓN] Placa adoptada por ${origenMotor}: ${placaFinal} (${ocrConfianza}%)`);
        } else {
            placaFinal = '';
            ocrConfianza = 0;
            origenMotor = 'No identificada';
        }

        // Actualizar UI
        if (badgeTipo) {
            badgeTipo.textContent = origenMotor;
        }
        document.getElementById('ocr-confianza-valor').textContent = ocrConfianza + '%';

        // Mostrar textos crudos obtenidos
        const rawInfo = document.getElementById('ocr-raw-info');
        const rawTextEl = document.getElementById('ocr-raw-text');
        let resumenCrudo = textosCrudos.join(' | ');
        if (resultadoIA && resultadoIA.raw) {
            resumenCrudo = `[IA]: ${resultadoIA.raw} | ` + resumenCrudo;
        }
        if (resumenCrudo.trim()) {
            rawInfo.classList.remove('hidden');
            rawTextEl.textContent = resumenCrudo.replace(/\n/g, ' ');
        } else {
            rawInfo.classList.add('hidden');
        }

        placaDetectada = placaFinal || '';
        ocrStatus.classList.add('hidden');
        placaBox.classList.remove('hidden');

        if (placaFinal) {
            const formatoDisplay = placaFinal.slice(0, 3) + ' · ' + placaFinal.slice(3);
            document.getElementById('placa-code-text').textContent = formatoDisplay;
            document.getElementById('placa-corregida').value = placaFinal;
        } else {
            document.getElementById('placa-code-text').textContent = 'NO DETECTADA';
            document.getElementById('placa-corregida').value = '';
            document.getElementById('placa-corregida').placeholder = 'Ingresa placa manualmente...';
        }

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
            tiene_pago: tienePago,
            pago_id: pago ? pago.id : null,
            nombre_usuario: pago ? pago.nombre : null,
            tipo_servicio: pago ? pago.tipo_servicio : null,
            metodo_captura: metodoCaptura,
            confianza_ocr: ocrConfianza + '%',
            atendida: false
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
