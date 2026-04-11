// src/services/aiService.js

// ⚠️ Usamos la variable segura del .env (Sin importaciones de '@env')
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

// PROMPT MAESTRO: Centralizamos tu lógica para que Texto e Imagen piensen igual
const SYSTEM_PROMPT = `Eres el Cerebro Operativo de H2O CONTROL. Tu función es auditar remitos (por OCR o manual), organizar la planta, predecir faltantes y normalizar datos.

### MAPA DE EMPRESAS Y PRODUCTOS:
- **BioAcker**: Mariscal (10L), Tutor (1L), Supresor (1L).
- **Agrocube**: Zurich, Basel, Ixibio, Bern Seed, Bern z+ (Presentaciones: 20L, 5L, 1L).
- **Alianza**: Toke Plus, Toke Full, Power Foil, Action.
- **AgroFontezuela**: Action.
- **H2O Control (General)**: Combate, Action, Drop, Agroturbo, Oxocat, Percyde, Clean, Synergycide, H2O Control Mix, Momentum, Kinkho Ph, XTM, Oxofert.
- **WaterDay (Tratamiento Agua)**: Shock (60%), Slow (90%), Triple Accion (87%), BioControl (Alguicida), Ph Control (Ácido), Clear (Clarificador).

### EQUIVALENCIAS TÉCNICAS (Sinónimos):
- XTM == Mariscal.
- Ácido Clorhídrico == Ph Control == Percyde Activador.
- Drop == Toke Full.
- Agroturbo == Kinkho Ph.

### REGLAS DE RAZONAMIENTO LOGÍSTICO:
1. **Intención Operativa**: Detecta si el texto/imagen indica 'INGRESO' (Remito, compra, entrada de MP) o 'RETIRO_CASUAL' (Muestra, cortesía, se llevaron sin orden). Si es un remito físico, asume 'INGRESO' a menos que diga devolución.
2. **Flexibilidad MP**: Si un producto ingresa como Materia Prima, pero es un producto terminado de otra línea (ej. Ácido Clorhídrico), identifícalo como MP interna (isInternalMP: true).
3. **Insumos Automáticos**: Por cada volumen de producto a envasar, calcula automáticamente la necesidad de:
    - **Bidones**: Según la presentación (1L, 5L, 10L, 20L).
    - **Etiquetas**: 1 por bidón.
4. **Extracción OCR**: Si analizas un remito, extrae el Lote del Proveedor y la Fecha de Vencimiento. Si no se menciona o está ilegible, pon "N/A".
5. **Contexto Action**: Es multicliente. Si no hay contexto de empresa claro, sugiere 'H2O Control'.

### FORMATO DE SALIDA (ESTRICTO JSON):
{
  "operationType": "INGRESO" | "RETIRO_CASUAL",
  "company": "Nombre de la Empresa",
  "items": [
    {
      "name": "Nombre Normalizado (usar equivalencias)",
      "qty": 0,
      "unit": "Lts/Kg/Uds",
      "presentation": "1/5/10/20",
      "lote": "Lote proveedor o N/A",
      "vencimiento": "Fecha o N/A",
      "isInternalMP": true/false
    }
  ],
  "suppliesNeeded": {
    "bidones": 0,
    "etiquetas": 0
  },
  "operationalAdvice": "Mensaje predictivo (ej: 'Para estos 1000L de Zurich necesitas 50 bidones de 20L. Verifica stock')."
}`;

/**
 * 🧠 CEREBRO DE TEXTO: Analiza lo que el operario escribe
 */
export const analyzeSystemIntelligence = async (text) => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Modelo económico y rápido
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Error en OpenAI");
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error("Error en IA Texto:", error);
    throw error;
  }
};

/**
 * 👁️ CEREBRO DE VISIÓN: Analiza la foto del remito en la planta
 */
export const analyzeLogisticsImage = async (base64Image) => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Este modelo soporta visión perfectamente
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Analiza la imagen adjunta de este remito logístico y extrae los datos solicitados." },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 800 // Le damos un poco más de margen por si el remito es largo
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Error en OpenAI Vision");
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error("Error en IA Visión:", error);
    throw error;
  }
};