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

    if (req.method === 'GET') {
        const geminiKey = getEnv('GEMINI_API_KEY');
        const keyPrefix = geminiKey ? geminiKey.slice(0, 8) + '...' + geminiKey.slice(-4) : 'NO_CONFIGURADA';
        
        let testStatus = 'Sin probar';
        let testError = null;

        if (geminiKey) {
            try {
                const headers = {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': geminiKey
                };
                if (geminiKey.startsWith('AQ.')) {
                    headers['Authorization'] = `Bearer ${geminiKey}`;
                }

                const urlNoKey = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`;
                const urlWithKey = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`;
                const testUrl = geminiKey.startsWith('AQ.') ? urlNoKey : urlWithKey;

                const tRes = await fetch(testUrl, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: 'Hola, responde OK' }] }]
                    })
                });
                if (tRes.ok) {
                    const tData = await tRes.json();
                    testStatus = 'CONECTADO Y FUNCIONANDO';
                } else {
                    const tErr = await tRes.text();
                    testStatus = `ERROR HTTP ${tRes.status}`;
                    testError = tErr;
                }
            } catch (err) {
                testStatus = 'EXCEPCION';
                testError = err.message;
            }
        }

        const groqKey = getEnv('GROQ_API_KEY');
        let groqStatus = 'No configurado';
        let groqError = null;

        if (groqKey) {
            try {
                const gTest = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${groqKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'qwen/qwen3.6-27b',
                        messages: [{ role: 'user', content: 'Hola, responde OK' }],
                        max_tokens: 5
                    })
                });
                if (gTest.ok) {
                    groqStatus = 'CONECTADO Y FUNCIONANDO';
                } else {
                    const gErrTxt = await gTest.text();
                    groqStatus = `ERROR HTTP ${gTest.status}`;
                    groqError = gErrTxt;
                }
            } catch (err) {
                groqStatus = 'EXCEPCION';
                groqError = err.message;
            }
        }

        const varsDisponibles = Object.keys(process.env).filter(
            k => !k.startsWith('npm_') && !k.startsWith('VERCEL_') && !k.startsWith('AWS_') && !k.startsWith('PATH') && !k.startsWith('NODE_')
        );

        return res.status(200).json({
            endpoint: '/api/anpr',
            gemini: {
                configurada: Boolean(geminiKey),
                preview: keyPrefix,
                estado: testStatus,
                detalleError: testError
            },
            groq: {
                configurada: Boolean(groqKey),
                preview: groqKey ? groqKey.slice(0, 8) + '...' : 'NO_CONFIGURADA',
                estado: groqStatus,
                detalleError: groqError
            },
            variablesEncontradasEnVercel: varsDisponibles
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

        const geminiKey = getEnv('GEMINI_API_KEY');
        const groqKey = getEnv('GROQ_API_KEY');
        const openRouterKey = getEnv('OPENROUTER_API_KEY');

        const prompt = `Eres un sistema OCR especializado en matrículas colombianas.
Analiza exclusivamente la placa vehicular visible en la imagen.
No leas textos como COLOMBIA, nombres de ciudades, marcas, stickers ni elementos del vehículo.
Identifica únicamente la secuencia principal de caracteres de la matrícula.
Formatos esperados:
- 3 letras + 2 números
- 3 letras + 2 números + 1 letra
- 3 letras + 3 números
Devuelve SOLO una cadena: ABC123 (sin espacios, puntos, guiones ni explicaciones).
Si la placa no puede determinarse con suficiente claridad, devuelve: NO_DETECTADA`;

        let ultimoErrorGemini = '';
        let ultimoErrorGroq = '';

        // 1. Probar Google Gemini API si está configurado
        if (geminiKey) {
            try {
                const models = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
                let plateResult = null;
                let usedModel = null;

                const headers = {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': geminiKey
                };
                if (geminiKey.startsWith('AQ.')) {
                    headers['Authorization'] = `Bearer ${geminiKey}`;
                }

                for (const model of models) {
                    try {
                        const url = geminiKey.startsWith('AQ.')
                            ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
                            : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

                        const response = await fetch(url, {
                            method: 'POST',
                            headers: headers,
                            body: JSON.stringify({
                                contents: [{
                                    parts: [
                                        { text: prompt },
                                        {
                                            inlineData: {
                                                mimeType: mimeType,
                                                data: base64Data
                                            }
                                        }
                                    ]
                                }],
                                generationConfig: {
                                    temperature: 0.05,
                                    maxOutputTokens: 20
                                }
                            })
                        });

                        if (response.ok) {
                            const data = await response.json();
                            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
                            if (text) {
                                plateResult = text;
                                usedModel = model;
                                break;
                            }
                        } else {
                            const errBody = await response.text();
                            ultimoErrorGemini = `[${model} status ${response.status}]: ${errBody}`;
                            console.warn(`Gemini ${model} error:`, ultimoErrorGemini);
                        }
                    } catch (mErr) {
                        ultimoErrorGemini = `[${model} catch]: ${mErr.message}`;
                        console.warn(`Error llamando a Gemini ${model}:`, mErr.message);
                    }
                }

                if (plateResult) {
                    const cleaned = sanitizarPlaca(plateResult);
                    return res.status(200).json({
                        success: true,
                        placa: cleaned.placa,
                        valida: cleaned.esValida,
                        raw: plateResult,
                        motor: `IA Gemini (${usedModel})`,
                        confianza: cleaned.esValida ? 98 : 40
                    });
                } else {
                    console.warn('Gemini no produjo resultado válido. Último error:', ultimoErrorGemini);
                }
            } catch (gErr) {
                console.warn('Error general en bloque Gemini:', gErr);
            }
        }

        // 2. Probar Groq Vision API (Qwen 3.6 27B / Qwen 3.8 27B) si está configurado
        if (groqKey) {
            try {
                const groqModels = ['qwen/qwen3.6-27b', 'qwen/qwen3.8-27b'];
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
                                messages: [{
                                    role: 'user',
                                    content: [
                                        { type: 'text', text: prompt },
                                        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                                    ]
                                }],
                                temperature: 0.05,
                                max_tokens: 20
                            })
                        });

                        if (gRes.ok) {
                            const gData = await gRes.json();
                            const text = gData?.choices?.[0]?.message?.content?.trim() || '';
                            if (text) {
                                const cleaned = sanitizarPlaca(text);
                                return res.status(200).json({
                                    success: true,
                                    placa: cleaned.placa,
                                    valida: cleaned.esValida,
                                    raw: text,
                                    motor: `IA Groq (${model})`,
                                    confianza: cleaned.esValida ? 95 : 35
                                });
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

        // 3. Probar OpenRouter si está configurado
        if (openRouterKey) {
            try {
                const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${openRouterKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://parqueadero-unimeta.vercel.app',
                        'X-Title': 'Parqueadero Unimeta ANPR'
                    },
                    body: JSON.stringify({
                        model: 'google/gemini-2.0-flash-exp:free',
                        messages: [{
                            role: 'user',
                            content: [
                                { type: 'text', text: prompt },
                                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                            ]
                        }],
                        temperature: 0.1,
                        max_tokens: 20
                    })
                });

                if (orRes.ok) {
                    const orData = await orRes.json();
                    const text = orData?.choices?.[0]?.message?.content?.trim() || '';
                    if (text) {
                        const cleaned = sanitizarPlaca(text);
                        return res.status(200).json({
                            success: true,
                            placa: cleaned.placa,
                            valida: cleaned.esValida,
                            raw: text,
                            motor: 'IA OpenRouter',
                            confianza: cleaned.esValida ? 92 : 30
                        });
                    }
                }
            } catch (orErr) {
                console.warn('Error procesando con OpenRouter:', orErr);
            }
        }

        // Si ninguna API Key está configurada o fallaron
        return res.status(200).json({
            success: false,
            error: 'Los motores de IA configurados no pudieron procesar la imagen. Usando Tesseract.js local como respaldo.',
            geminiError: ultimoErrorGemini || null,
            groqError: ultimoErrorGroq || null,
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

    // Limpiar texto de signos, comillas, backticks y palabras no deseadas
    let clean = raw.toUpperCase()
        .replace(/```[a-z]*\n?/gi, '')
        .replace(/`/g, '')
        .replace(/COLOMBIA/g, '')
        .replace(/VILLAVICENCIO/g, '')
        .replace(/BOGOTA/g, '')
        .replace(/MEDELLIN/g, '')
        .replace(/CALI/g, '')
        .replace(/[^A-Z0-9]/g, '');

    // Formatos válidos colombianos:
    // Moto clásica: 3L + 2N (ej: XYQ73, XYO73)
    // Moto nueva: 3L + 2N + 1L (ej: WUF62C, MKH87E)
    // Carro estándar: 3L + 3N (ej: CCC890)
    const regexMotoClasica = /^[A-Z]{3}[0-9]{2}$/;
    const regexMotoNueva = /^[A-Z]{3}[0-9]{2}[A-Z]$/;
    const regexEstandar = /^[A-Z]{3}[0-9]{3}$/;

    if (regexMotoClasica.test(clean) || regexMotoNueva.test(clean) || regexEstandar.test(clean)) {
        return { placa: clean, esValida: true };
    }

    // Si tiene texto extra alrededor, buscar subcadena que cumpla regex
    const matchNueva = clean.match(/[A-Z]{3}[0-9]{2}[A-Z]/);
    if (matchNueva) return { placa: matchNueva[0], esValida: true };

    const matchEstandar = clean.match(/[A-Z]{3}[0-9]{3}/);
    if (matchEstandar) return { placa: matchEstandar[0], esValida: true };

    const matchClasica = clean.match(/[A-Z]{3}[0-9]{2}/);
    if (matchClasica) return { placa: matchClasica[0], esValida: true };

    return { placa: clean.slice(0, 6), esValida: false };
}
