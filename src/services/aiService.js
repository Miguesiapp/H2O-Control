// src/services/aiService.js

// URL de tu Bóveda Segura en Firebase (Cloud Function)
const GEMINI_URL = 'https://us-central1-h2o-control-a153b.cloudfunctions.net/geminiProxy';

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
- TUTOR es el mismo producto que KINKHO PH, VITTA IONIC y HARD.
- ACTION es lo mismo que UNIQUE, SHIRIKON SILIC y TOKE ULTRA.
- TOKE PLUS es el mismo producto que COMBATE.
- Ácido Clorhídrico = Ph Control = Percyde Activador.

*REGLA EVOLUTIVA*: Si en la conversación el usuario te dice "Oye, a partir de ahora llamaremos X a Y", acéptalo con gusto y utilízalo en esa sesión.

### REGLAS LOGÍSTICAS Y DE SISTEMA:
1. Detecta si la operación es 'INGRESO_COMPRA', 'INGRESO_OP', 'INGRESO_OE', o 'RETIRO_CASUAL'.
2. Si un producto terminado ingresa para usarse en una fórmula, es MP (isInternalMP: true).
3. OCR: Extrae Lote y Vencimiento de las imágenes. Si no hay, pon "N/A".
4. NOMBRES EXACTOS: NUNCA elimines las palabras "GRANEL" ni "MP" de los nombres de los productos. Si el usuario dice "GRANEL Buffer", el nombre debe ser "GRANEL Buffer". Si dice "GRANEL MOMENTUM MP", el nombre debe ser exactamente ese. No asumas que son prefijos de categoría.
5. INSUMOS: Al cargar insumos, DEBES clasificar cada ítem anteponiendo EXACTAMENTE una de estas tres palabras: "BIDON", "CAJA" o "ETIQUETA". Si el usuario escribe "cajas de 5L", debes poner "CAJA 5L". Si escribe "envases", pon "BIDON". IMPORTANTE: NO inventes ni agregues palabras que el usuario no escribió (por ejemplo "transparente", "rojo", etc. si no estaban en el texto).

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
 * 🧠 CEREBRO DE TEXTO
 */
export const analyzeSystemIntelligence = async (text, contextCompany = null, contextMode = null, targetStock = null) => {
  try {
    let dynamicPrompt = SYSTEM_PROMPT_BASE;
    if (contextCompany) dynamicPrompt += `\nCONTEXTO: Empresa seleccionada '${contextCompany}'.`;
    if (contextMode) dynamicPrompt += `\nCONTEXTO: Operación '${contextMode}'.`;
    if (targetStock) dynamicPrompt += `\nCONTEXTO CRÍTICO: El usuario está cargando específicamente la categoría '${targetStock}'. Ajusta tus categorizaciones a esta bodega.`;

    // Combinamos las reglas del sistema directamente con el texto del usuario
    const fullPrompt = dynamicPrompt + "\n\n=== TEXTO A ANALIZAR ===\n" + text;

    const payload = {
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    };

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || data.error || "Error en el servidor proxy");

    const jsonString = data.candidates[0].content.parts[0].text;
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error en IA Texto (Proxy):", error);
    throw error;
  }
};

/**
 * 👁️ CEREBRO DE VISIÓN MULTIMODAL
 */
export const analyzeLogisticsImage = async (base64Image, contextCompany = null, contextMode = null) => {
  try {
    let dynamicPrompt = SYSTEM_PROMPT_BASE;
    if (contextCompany) dynamicPrompt += `\nCONTEXTO: Empresa seleccionada '${contextCompany}'.`;
    if (contextMode) dynamicPrompt += `\nCONTEXTO: Operación '${contextMode}'.`;

    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const fullPrompt = dynamicPrompt + "\n\nINSTRUCCIÓN: Analiza la imagen adjunta de este remito/documento y extrae los datos en el formato JSON estricto que se te indicó arriba.";

    const payload = {
      contents: [{
        role: "user",
        parts: [
          { text: fullPrompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64
            }
          }
        ]
      }],
      generationConfig: { responseMimeType: "application/json" }
    };

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || data.error || "Error en el servidor proxy de Visión");

    const jsonString = data.candidates[0].content.parts[0].text;
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error en IA Visión (Proxy):", error);
    throw error;
  }
};

/**
 * 🤖 CEREBRO CONVERSACIONAL Y EMPÁTICO (H2O Neural Chat)
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

    // 1. Inyectamos el prompt como si fuera el primer mensaje del historial
    const geminiHistory = [
      { role: "user", parts: [{ text: CHAT_PROMPT }] },
      { role: "model", parts: [{ text: "Entendido. A partir de ahora actuaré estrictamente bajo estas reglas e integraré el contexto de la planta a mis respuestas." }] }
    ];

    // 2. Añadimos el historial previo
    history.forEach(msg => {
      geminiHistory.push({
        role: msg.sender === 'ai' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      });
    });

    // 3. Añadimos el mensaje actual del usuario
    geminiHistory.push({ role: "user", parts: [{ text: userMessage }] });

    const payload = {
      contents: geminiHistory
    };

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || data.error || "Error en AI Chat proxy");

    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Error en AI Chat (Proxy):", error);
    throw error;
  }
};

/**
 * 📊 AUDITORÍA MENSUAL (Generación de Párrafo de Resumen para PDF)
 */
export const generateAuditSummary = async (movements, filterName, monthYear) => {
  try {
    // Resumimos los movimientos para que no excedan el límite de tokens
    const briefMovements = movements.map(m => 
      `[${m.formattedDate}] ${m.action}: ${m.quantity} ${m.unit} de ${m.itemName}`
    ).join('\n');

    const prompt = `Eres H2O Neural, el asistente de planta. 
Analiza los siguientes movimientos operativos del mes de ${monthYear}, filtrados por la categoría: "${filterName}".
Tu objetivo es redactar un párrafo gerencial breve (máximo 4-5 líneas) y profesional que resuma la actividad.
Menciona si hubo una alta intensidad de entradas/salidas, resalta el producto con más movimientos o cualquier anomalía aparente (ej. egresos inusualmente grandes). Sé conciso y directo, orientado a la dirección de la empresa.

MOVIMIENTOS:
${briefMovements.substring(0, 15000)} // Límite de texto por seguridad

REGLA: Responde SOLO con el párrafo redactado, sin saludos ni introducciones extras.`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    };

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || data.error || "Error en AI Audit proxy");

    return data.candidates[0].content.parts[0].text.trim();
  } catch (error) {
    console.error("Error en AI Audit Summary:", error);
    return "La auditoría automática de IA no está disponible en este momento. Revisa el listado de movimientos para analizar el balance general del mes.";
  }
};

/**
 * 💼 AUDITORÍA EJECUTIVA / C-LEVEL
 */
export const generateAIExecutiveAudit = async (logs, lowStock, period) => {
  try {
    // Resumimos los movimientos para que no excedan el límite de tokens
    // Solo pasamos acciones clave para la auditoría
    const briefLogs = logs
      .filter(m => m.action && (m.action.includes('PRODUCCION') || m.action.includes('CONSUMO') || m.action.includes('AJUSTE') || m.action.includes('INGRESO')))
      .map(m => `[${new Date(m.timestamp?.seconds * 1000 || Date.now()).toLocaleDateString()}] ${m.action}: ${m.quantity} de ${m.itemName} (${m.user})`)
      .slice(0, 150); // Limite de 150 para no saturar

    const briefStock = lowStock.map(s => `${s.name}: ${s.qty}`).join(', ');

    const prompt = `Eres H2O Neural, el Auditor Jefe y Director de Operaciones de H2O Control. 
Miguel, el Jefe de Planta, está sobrecargado combinando tareas operativas y de gestión, y tiene poco tiempo.
Tu objetivo es analizar los datos de este período (${period}) y generar un reporte estratégico que le diga EXACTAMENTE qué debe saber, qué está fallando y qué debe comprar/planear para la próxima semana, ahorrándole todo el estrés analítico.

DATOS DEL PERÍODO:
---
MOVIMIENTOS CLAVE (Últimos ${period}):
${briefLogs.join('\n') || 'Sin movimientos registrados.'}
---
ALERTAS DE STOCK (Cercano a agotarse):
${briefStock || 'Ningún quiebre inminente.'}

Tu respuesta debe ser estrictamente en formato JSON válido con esta estructura:
{
  "review": "Tu análisis general del período: destaca cuellos de botella, problemas en la carga de datos, mermas, intensidad de trabajo, si el autoelevador fue un limitante (infiévelo si hay demasiados movimientos simultáneos), etc. Sé empático pero directivo.",
  "futureNeeds": "Proyección: Qué materias primas o insumos debe comprar ya mismo (basado en las alertas de stock y en los consumos), qué debe delegar y qué precauciones tomar para la semana que entra."
}`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    };

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || data.error || "Error en proxy");

    const jsonString = data.candidates[0].content.parts[0].text;
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error en AI Executive Audit:", error);
    return {
      review: "No se pudo generar la auditoría de IA debido a un problema de conexión. Por favor, revisa manualmente los consumos del período.",
      futureNeeds: "Se recomienda revisar el inventario de materias primas críticas manualmente y verificar las órdenes pendientes."
    };
  }
};