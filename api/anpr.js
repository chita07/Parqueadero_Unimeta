// Serverless Function para Vercel — /api/anpr
// Reconocimiento de Placas Asistido por IA Multimodal (Groq Vision — Qwen 3.6 27B)

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb'
        }
    }
};

export default async function handler(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Helper para buscar variables de entorno tolerando mayúsculas/minúsculas o espacios
    const getEnv = (name) => {
        const direct = process.env[name];
        if (direct && direct.trim()) return direct.trim();
        for (const [k, v] of Object.entries(process.env)) {
            if (k.trim().toUpperCase() === name.toUpperCase() && v && v.trim()) {
                return v.trim();
            }
            if (k.trim().toUpperCase().includes(name.toUpperCase()) && v && v.trim()) {
                return v.trim();
            }
        }
        return '';
    };

    // Diagnóstico GET para verificar estado de conexión y modelos de Groq
    if (req.method === 'GET') {
        const groqKey = getEnv('GROQ_API_KEY');
        let groqStatus = 'No configurado';
        let groqError = null;
        let modelosGroq = [];
        let testVisionStatus = 'Sin probar';
        let testVisionError = null;

        if (groqKey) {
            try {
                // 1. Obtener lista real de modelos disponibles en la cuenta de Groq
                const mRes = await fetch('https://api.groq.com/openai/v1/models', {
                    headers: { 'Authorization': `Bearer ${groqKey}` }
                });
                if (mRes.ok) {
                    const mData = await mRes.json();
                    modelosGroq = (mData?.data || []).map(m => m.id);
                    groqStatus = 'CONECTADO Y FUNCIONANDO';
                } else {
                    groqStatus = `ERROR HTTP ${mRes.status}`;
                    groqError = await mRes.text();
                }

                // 2. Probar visión real con una imagen 1x1 transparente
                const testBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
                const visionCandidates = ['qwen/qwen3.6-27b', 'llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview', 'qwen/qwen3.8-27b'];
                
                for (const vModel of visionCandidates) {
                    try {
                        const vRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${groqKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                model: vModel,
                                messages: [{
                                    role: 'user',
                                    content: [
                                        { type: 'text', text: 'Responde OK' },
                                        { type: 'image_url', image_url: { url: `data:image/png;base64,${testBase64}` } }
                                    ]
                                }],
                                max_tokens: 5
                            })
                        });
                        if (vRes.ok) {
                            testVisionStatus = `FUNCIONANDO con modelo [${vModel}]`;
                            testVisionError = null;
                            break;
                        } else {
                            testVisionStatus = `Fallo en [${vModel}] HTTP ${vRes.status}`;
                            testVisionError = await vRes.text();
                        }
                    } catch (vErr) {
                        testVisionStatus = `Excepción en [${vModel}]`;
                        testVisionError = vErr.message;
                    }
                }
            } catch (err) {
                groqStatus = 'EXCEPCION';
                groqError = err.message;
            }
        }

        return res.status(200).json({
            endpoint: '/api/anpr',
            groq: {
                configurada: Boolean(groqKey),
                preview: groqKey ? groqKey.slice(0, 8) + '...' : 'NO_CONFIGURADA',
                estadoGeneral: groqStatus,
                estadoVision: testVisionStatus,
                errorVision: testVisionError
            },
            modelosDisponiblesEnGroq: modelosGroq
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido. Utiliza POST o GET.' });
    }

    try {
        let bodyData = req.body;
        if (typeof bodyData === 'string') {
            try { bodyData = JSON.parse(bodyData); } catch (e) { }
        }

        const { image, rawImage } = bodyData || {};
        const imgToProcess = image || rawImage;

        if (!imgToProcess) {
            return res.status(400).json({ error: 'No se envió ninguna imagen (base64).' });
        }

        // Extraer base64 puro y mime type de forma segura
        let base64Data = imgToProcess;
        let mimeType = 'image/png';

        if (imgToProcess.includes('base64,')) {
            const parts = imgToProcess.split('base64,');
            const header = parts[0];
            const mimeMatch = header.match(/data:([^;]+)/);
            if (mimeMatch) mimeType = mimeMatch[1];
            base64Data = parts[1].replace(/[\r\n\s]+/g, '');
        }

        const groqKey = getEnv('GROQ_API_KEY');

        const prompt = `Analiza la imagen adjunta e identifica exclusivamente los caracteres de la matrícula vehicular de Colombia.
Formatos válidos colombianos:
- Motos: 3 letras y 2 números (ej: XYQ73) O 3 letras, 2 números y 1 letra (ej: WUF62C, MKH87E).
- Carros: 3 letras y 3 números (ej: CCC890).

Devuelve ÚNICAMENTE un objeto JSON en este formato exacto:
{"placa": "WUF62C"}

Si la matrícula no es visible ni identificable, responde:
{"placa": "NO_DETECTADA"}`;

        let ultimoErrorGroq = '';

        // Ejecutar Groq Vision API probando los modelos de visión activos
        if (groqKey) {
            try {
                const groqModels = [
                    'qwen/qwen3.6-27b',
                    'qwen/qwen3.8-27b',
                    'llama-3.2-11b-vision-preview',
                    'llama-3.2-90b-vision-preview'
                ];
                const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';

                for (const model of groqModels) {
                    try {
                        const gRes = await fetch(groqUrl, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${groqKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                model: model,
                                response_format: { type: 'json_object' },
                                messages: [
                                    {
                                        role: 'system',
                                        content: 'Eres un sistema OCR de precisión para placas vehiculares de Colombia. Devuelve exclusivamente un JSON con la propiedad "placa".'
                                    },
                                    {
                                        role: 'user',
                                        content: [
                                            { type: 'text', text: prompt },
                                            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                                        ]
                                    }
                                ],
                                temperature: 0.05,
                                max_tokens: 500
                            })
                        });

                        if (gRes.ok) {
                            const gData = await gRes.json();
                            const rawText = gData?.choices?.[0]?.message?.content?.trim() || '';
                            if (rawText) {
                                const cleaned = sanitizarPlaca(rawText);
                                if (cleaned.esValida) {
                                    return res.status(200).json({
                                        success: true,
                                        placa: cleaned.placa,
                                        valida: cleaned.esValida,
                                        raw: rawText,
                                        motor: `IA Groq (${model})`,
                                        confianza: 95
                                    });
                                } else {
                                    console.warn(`Groq (${model}) respondió pero no fue placa válida:`, rawText);
                                }
                            }
                        } else {
                            const errTxt = await gRes.text();
                            ultimoErrorGroq = `[${model} status ${gRes.status}]: ${errTxt}`;
                            console.warn('Groq Vision error:', ultimoErrorGroq);
                        }
                    } catch (mErr) {
                        ultimoErrorGroq = `[${model} catch]: ${mErr.message}`;
                        console.warn('Error llamando a Groq:', mErr.message);
                    }
                }
            } catch (grqErr) {
                console.warn('Error general en bloque Groq:', grqErr);
            }
        }

        // Si Groq no está configurado o falló, avisar para usar fallback local
        return res.status(200).json({
            success: false,
            error: 'Groq Vision no pudo procesar la imagen o no está configurado. Usando Tesseract.js local como respaldo.',
            groqError: ultimoErrorGroq || (groqKey ? 'No se obtuvo respuesta concluyente' : 'GROQ_API_KEY no encontrada en process.env'),
            usaLocalFallback: true
        });

    } catch (err) {
        console.error('Error en /api/anpr:', err);
        return res.status(500).json({ error: 'Error interno en el servidor de reconocimiento.', detalle: err.message });
    }
}

// Función helper de sanitización y validación de formato colombiano
function sanitizarPlaca(raw) {
    if (!raw) return { placa: '', esValida: false };

    // 1. Intentar parsear directamente JSON {"placa": "..."}
    try {
        const jsonMatch = raw.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.placa && parsed.placa !== 'NO_DETECTADA') {
                const clean = parsed.placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (/^[A-Z]{3}[0-9]{2}[A-Z]?$/.test(clean) || /^[A-Z]{3}[0-9]{3}$/.test(clean)) {
                    return { placa: clean, esValida: true };
                }
            }
        }
    } catch (e) { }

    // 2. Extraer texto fuera del bloque <think> (soportando cierre </think> o corte abrupto)
    let text = raw.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();

    // Si todo el texto estaba dentro del <think>, extraer partes identificadas por Qwen
    if (!text && raw.includes('<think>')) {
        const seqMatch = raw.match(/sequence is ["']?([A-Z]{3}[-\s]?[0-9]{2,3}[A-Z]?)["']?/i);
        if (seqMatch) {
            const clean = seqMatch[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
            return { placa: clean, esValida: true };
        }
        const partL = raw.match(/letters?: ["']?([A-Z]{3})["']?/i);
        const partN = raw.match(/(?:numbers?|digits?)(?: and a letter)?: ["']?([0-9]{2,3}[A-Z]?)["']?/i);
        if (partL && partN) {
            const placa = `${partL[1]}${partN[1]}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (/^[A-Z]{3}[0-9]{2}[A-Z]?$/.test(placa) || /^[A-Z]{3}[0-9]{3}$/.test(placa)) {
                return { placa, esValida: true };
            }
        }
        text = raw;
    }

    // 3. Formatos válidos con regex en el texto limpio (evitando palabras comunes como 'letter')
    const matchMotoNueva = text.match(/\b([A-Z]{3})[-\s]?([0-9]{2})[-\s]?([A-Z])\b/i);
    if (matchMotoNueva && !['LET', 'THE', 'AND', 'NUM'].includes(matchMotoNueva[1].toUpperCase())) {
        const placa = `${matchMotoNueva[1]}${matchMotoNueva[2]}${matchMotoNueva[3]}`.toUpperCase();
        return { placa, esValida: true };
    }

    const matchCarro = text.match(/\b([A-Z]{3})[-\s]?([0-9]{3})\b/i);
    if (matchCarro && !['LET', 'THE', 'AND', 'NUM'].includes(matchCarro[1].toUpperCase())) {
        const placa = `${matchCarro[1]}${matchCarro[2]}`.toUpperCase();
        return { placa, esValida: true };
    }

    const matchMotoClasica = text.match(/\b([A-Z]{3})[-\s]?([0-9]{2})\b/i);
    if (matchMotoClasica && !['LET', 'THE', 'AND', 'NUM'].includes(matchMotoClasica[1].toUpperCase())) {
        const placa = `${matchMotoClasica[1]}${matchMotoClasica[2]}`.toUpperCase();
        return { placa, esValida: true };
    }

    // 4. Limpieza profunda estándar
    let clean = text.toUpperCase()
        .replace(/```[a-z]*\n?/gi, '')
        .replace(/`/g, '')
        .replace(/COLOMBIA/g, '')
        .replace(/VILLAVICENCIO/g, '')
        .replace(/BOGOTA/g, '')
        .replace(/MEDELLIN/g, '')
        .replace(/CALI/g, '')
        .replace(/[^A-Z0-9]/g, '');

    const regexMotoNueva = /^[A-Z]{3}[0-9]{2}[A-Z]$/;
    const regexEstandar = /^[A-Z]{3}[0-9]{3}$/;
    const regexMotoClasica = /^[A-Z]{3}[0-9]{2}$/;

    if (regexMotoNueva.test(clean) || regexEstandar.test(clean) || regexMotoClasica.test(clean)) {
        return { placa: clean, esValida: true };
    }

    const subNueva = clean.match(/[A-Z]{3}[0-9]{2}[A-Z]/);
    if (subNueva) return { placa: subNueva[0], esValida: true };

    const subEstandar = clean.match(/[A-Z]{3}[0-9]{3}/);
    if (subEstandar) return { placa: subEstandar[0], esValida: true };

    const subClasica = clean.match(/[A-Z]{3}[0-9]{2}/);
    if (subClasica) return { placa: subClasica[0], esValida: true };

    return { placa: clean.slice(0, 6), esValida: false };
}
