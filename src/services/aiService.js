import { OPENAI_API_KEY } from '@env';

export const analyzeSystemIntelligence = async (text, currentStock = {}) => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // ⚠️ Nota de Seguridad: Más adelante migraremos esto a Firebase Functions 
        // para que tu API KEY quede 100% blindada.
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Eres el Cerebro Operativo de H2O CONTROL. Tu función es auditar remitos (por OCR o manual), organizar la planta, predecir faltantes y normalizar datos.

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
            1. **Intención Operativa**: Detecta si el texto indica 'INGRESO' (Remito, compra, entrada de MP) o 'RETIRO_CASUAL' (Muestra, cortesía, se llevaron sin orden).
            2. **Flexibilidad MP**: Si un producto ingresa como Materia Prima, pero es un producto terminado de otra línea (ej. Ácido Clorhídrico), identifícalo como MP interna (isInternalMP: true).
            3. **Insumos Automáticos**: Por cada volumen de producto a envasar, calcula automáticamente la necesidad de:
               - **Bidones**: Según la presentación (1L, 5L, 10L, 20L).
               - **Etiquetas**: 1 por bidón.
            4. **Extracción OCR**: Si analizas un remito, extrae el Lote del Proveedor y la Fecha de Vencimiento. Si es un ingreso manual y no se menciona, pon "N/A".
            5. **Contexto Action**: Es multicliente. Si no hay contexto de empresa claro en el texto, sugiere 'H2O Control'.

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
              "operationalAdvice": "Mensaje predictivo (ej: 'Migue, para estos 1000L de Zurich necesitas 50 bidones de 20L. Verifica stock para la semana entrante')."
            }`
          },
          { role: "user", content: text }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error("Error en la IA Logística:", error);
    throw error;
  }
};