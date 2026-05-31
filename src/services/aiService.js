// src/services/aiService.js

// Obtenemos la clave de forma segura desde el archivo .env
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// URL base de la API de Gemini 3.1 Flash-Lite (Súper rápido y soporta texto, visión y JSON)
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-Flash-Lite:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT_BASE = `Eres H2O Neural, el asistente de IA colaborativo, empático y servicial de H2O Control.
Tu tono es educado y profesional, pero relajado y amigable, no eres un robot aburrido. Estás aquí para facilitar la vida del equipo de planta.

### MAPA DE EMPRESAS Y PRODUCTOS:
- BioAcker: Mariscal (10L), Tutor (1L), Supresor (1L).
- Agrocube: Zurich, Basel, Ixibio, Bern Seed, Bern z+ (Presentaciones: 20L, 5L, 1L).
- Alianza: Toke Plus, Toke Full, Power Foil, Action.
- AgroFontezuela: Action.
- H2O Control: Combate, Action, Drop, Agroturbo, Oxocat, Percyde, Clean, Synergycide, Mix, Momentum, Kinkho Ph, XTM, Oxofert, Hard.
- WaterDay: Shock, Slow, Triple Accion, BioControl, Ph Control, Clear.

### DICCIONARIO DE EQUIVALENCIAS (MEMORIZA ESTO):
- Materias Primas: DOSS es exactamente lo mismo que DIOCTIL.
- XTM es el mismo producto que MARISCAL (distinto nombre según cliente).
- DROP es el mismo producto que TOKE FULL.
- AGROTURBO es el mismo producto que KINKHO PH.
- TUTOR es el mismo producto que HARD.
- TOKE es el mismo producto que COMBATE.
- Ácido Clorhídrico = Ph Control = Percyde Activador.

*REGLA EVOLUTIVA*: Si en la conversación el usuario te dice "Oye, a partir de ahora llamaremos X a Y", acéptalo con gusto y utilízalo en esa sesión.

### REGLAS LOGÍSTICAS Y DE SISTEMA:
1. Detecta si la operación es 'INGRESO_COMPRA', 'INGRESO_OP', 'INGRESO_OE', o 'RETIRO_CASUAL'.
2. Si un producto terminado ingresa para usarse en una fórmula, es MP (isInternalMP: true).
3. OCR: Extrae Lote y Vencimiento de las imágenes. Si no hay, pon "N/A".

### FORMATO DE SALIDA (ESTRICTO JSON PARA FUNCIONES DE SISTEMA):
Cuando se te pida auditar un remito o texto estructurado, responde ÚNICAMENTE con este JSON:
{
  "operationType": "INGRESO_COMPRA" | "INGRESO_OP" | "INGRESO_OE" | "RETIRO_CASUAL",
  "company": "Nombre de la Empresa",
  "items": [
    {
      "name": "Nombre Normalizado",
      "qty": 0,
      "unit": "Lts/Kg/Uds",
      "presentation": "1/5/10/20",
      "lote": "Lote proveedor o N/A",
      "vencimiento": "Fecha o N/A",
      "isInternalMP": true/false
    }
  ],
  "operationalAdvice": "Tu comentario empático y útil sobre la operación."
}`;

/**
 * 🧠 CEREBRO DE TEXTO (GEMINI)
 */
export const analyzeSystemIntelligence = async (text, contextCompany = null, contextMode = null) => {
  try {
    let dynamicPrompt = SYSTEM_PROMPT_BASE;
    if (contextCompany) dynamicPrompt += `\nCONTEXTO: Empresa seleccionada '${contextCompany}'.`;
    if (contextMode) dynamicPrompt += `\nCONTEXTO: Operación '${contextMode}'.`;

    const payload = {
      systemInstruction: { parts: [{ text: dynamicPrompt }] },
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: { responseMimeType: "application/json" } // Forzamos JSON
    };

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Error en Gemini API");
    
    // Gemini devuelve el texto dentro de la estructura de candidates
    const jsonString = data.candidates[0].content.parts[0].text;
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error en IA Texto (Gemini):", error);
    throw error;
  }
};

/**
 * 👁️ CEREBRO DE VISIÓN MULTIMODAL (GEMINI)
 */
export const analyzeLogisticsImage = async (base64Image, contextCompany = null, contextMode = null) => {
  try {
    let dynamicPrompt = SYSTEM_PROMPT_BASE;
    if (contextCompany) dynamicPrompt += `\nCONTEXTO: Empresa seleccionada '${contextCompany}'.`;
    if (contextMode) dynamicPrompt += `\nCONTEXTO: Operación '${contextMode}'.`;

    const payload = {
      systemInstruction: { parts: [{ text: dynamicPrompt }] },
      contents: [{
        role: "user",
        parts: [
          { text: "Analiza la imagen adjunta de este remito/documento y extrae los datos en el formato JSON estricto que se te indicó." },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          }
        ]
      }],
      generationConfig: { responseMimeType: "application/json" } // Forzamos JSON
    };

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Error en Gemini Vision");
    
    const jsonString = data.candidates[0].content.parts[0].text;
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error en IA Visión (Gemini):", error);
    throw error;
  }
};

/**
 * 🤖 CEREBRO CONVERSACIONAL Y EMPÁTICO (H2O Neural Chat con Gemini)
 */
export const chatWithLogisticsAI = async (userMessage, history, plantContext) => {
  try {
    const formulasResumen = plantContext.formulas.map(f => 
      `${f.productName} (Densidad: ${f.densidadObjetivo}): ${f.ingredients.map(i => `${i.name} ${i.percentage}%`).join(', ')}`
    ).join(' | ');

    const stockAgrupado = {};
    plantContext.inventory.forEach(item => {
      if (!stockAgrupado[item.itemName]) stockAgrupado[item.itemName] = 0;
      stockAgrupado[item.itemName] += Number(item.quantity);
    });
    const stockResumen = Object.keys(stockAgrupado).map(k => `${k}: ${stockAgrupado[k]}`).join(', ');

    const CHAT_PROMPT = `${SYSTEM_PROMPT_BASE}
    
=== ESTADO ACTUAL DE LA PLANTA EN TIEMPO REAL ===
- Fórmulas Activas: ${formulasResumen}
- Stock Físico Disponible: ${stockResumen}

INSTRUCCIONES PARA EL CHAT:
Eres H2O Neural. Habla directamente con el operario. Si te preguntan si alcanza para fabricar "X" cantidad de producto, haz las matemáticas: (Litros * Densidad = Masa Total). Multiplica la Masa Total por los porcentajes de la receta, y cruza el resultado considerando el 'Stock Físico Disponible' y los SINÓNIMOS del diccionario (si piden DOSS y hay Dioctil, es lo mismo). 
Responde con calidez y servicialidad. Si te enseñan un nuevo sinónimo, agradécelo y úsalo. Si no tienes un dato, sé honesto. (NOTA: Responde en texto plano, no uses JSON aquí).`;

    // Formateamos el historial para Gemini (requiere roles 'user' y 'model')
    const geminiHistory = history.map(msg => ({
      role: msg.sender === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));
    
    // Agregamos el mensaje actual
    geminiHistory.push({ role: "user", parts: [{ text: userMessage }] });

    const payload = {
      systemInstruction: { parts: [{ text: CHAT_PROMPT }] },
      contents: geminiHistory,
    };

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message);
    
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Error en AI Chat (Gemini):", error);
    throw error;
  }
};