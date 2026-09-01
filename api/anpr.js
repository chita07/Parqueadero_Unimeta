// Serverless Function para Vercel — /api/anpr
// Reconocimiento de Placas Asistido por IA Multimodal (Google Gemini 2.5 Flash / Groq / OpenRouter)

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

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido. Utiliza POST.' });
    }

    try {
        const { image, rawImage } = req.body || {};
        const imgToProcess = image || rawImage;

        if (!imgToProcess) {
            return res.status(400).json({ error: 'No se envió ninguna imagen (base64).' });
        }

        // Extraer base64 limpio y mime type
        let base64Data = imgToProcess;
        let mimeType = 'image/png';

        if (imgToProcess.startsWith('data:')) {
            const matches = imgToProcess.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                mimeType = matches[1];
                base64Data = matches[2];
            }
        }

        const geminiKey = process.env.GEMINI_API_KEY;
        const groqKey = process.env.GROQ_API_KEY;
        const openRouterKey = process.env.OPENROUTER_API_KEY;

        const prompt = `Eres un sistema ANPR de alta precisión especializado en matrículas vehiculares de Colombia.
Formatos válidos de placas colombianas:
1. Motos: 3 letras y 2 números (ej: XYQ73, XYO73) O 3 letras, 2 números y 1 letra (ej: WUF62C, MKH87E).
2. Carros/Camionetas: 3 letras y 3 números (ej: CCC890, ABC123).

Analiza la imagen adjunta con atención a los caracteres troquelados negros.
Instrucciones estrictas:
- Devuelve ÚNICAMENTE los 5 o 6 caracteres de la placa en mayúsculas, sin espacios, sin guiones ni puntos.
- Omite palabras como "COLOMBIA", "VILLAVICENCIO", "BOGOTA", "MEDELLIN", "CALI", o cualquier texto institucional.
- Distingue cuidadosamente letras de números (ejemplo: 'X' vs 'K'/'Z', 'Y' vs 'V'/'W', 'O' vs '0', 'I' vs '1', 'S' vs '5', 'B' vs '8').
- Si no hay una placa identificable, responde exactamente "NO_DETECTADA".
- NO incluyas explicaciones, markdown, etiquetas ni formato adicional. Solo el código de placa.`;

        // 1. Probar Google Gemini API (2.5 Flash / 1.5 Flash)
        if (geminiKey) {
            try {
                // Probar primero con gemini-2.5-flash, si no con gemini-1.5-flash
                const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];
                let plateResult = null;
                let usedModel = null;

                for (const model of models) {
                    try {
                        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
                        const response = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{
                                    parts: [
                                        { text: prompt },
                                        {
                                            inline_data: {
                                                mime_type: mimeType,
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
                            console.warn(`Gemini ${model} error:`, response.status, errBody);
                        }
                    } catch (mErr) {
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
                }
            } catch (gErr) {
                console.warn('Error procesando con Gemini:', gErr);
            }
        }

        // 2. Probar Groq Vision API si está configurado
        if (groqKey) {
            try {
                const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
                const gRes = await fetch(groqUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${groqKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'llama-3.2-11b-vision-preview',
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
                            motor: 'IA Groq Vision',
                            confianza: cleaned.esValida ? 95 : 35
                        });
                    }
                }
            } catch (grqErr) {
                console.warn('Error procesando con Groq:', grqErr);
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
            error: 'No hay credencial de API configurada en Vercel (GEMINI_API_KEY). Usando Tesseract.js local como respaldo.',
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
