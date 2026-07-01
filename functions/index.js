const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const geminiApiKey = defineSecret("GEMINI_API_KEY");

exports.geminiProxy = onRequest({ secrets: [geminiApiKey] }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  try {
    let payload = req.body;
    
    // 1. REPARAMOS LAS INSTRUCCIONES DEL SISTEMA
    // Extraemos la instrucción y la inyectamos en el chat para que funcione 100% en Gemini 3
    let sysText = "";
    if (payload.systemInstruction) {
      sysText = payload.systemInstruction.parts[0].text;
      delete payload.systemInstruction;
    } else if (payload.system_instruction) {
      sysText = payload.system_instruction.parts[0].text;
      delete payload.system_instruction;
    }
    
    if (sysText) {
      payload.contents.unshift({ role: "model", parts: [{ text: "Understood." }] });
      payload.contents.unshift({ role: "user", parts: [{ text: sysText }] });
    }

    // The AI Service now sends camelCase, which is the correct format for Gemini REST API v1.
    // No need to convert to snake_case here.

    const apiKey = geminiApiKey.value();
    
    // USAMOS EL MODELO GEMINI 2.5 FLASH (El más estable actualmente)
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Error en Gemini API" });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error Proxy:", error);
    res.status(500).json({ error: "Error interno del servidor proxy." });
  }
});