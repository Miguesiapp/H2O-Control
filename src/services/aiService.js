import { OPENAI_API_KEY } from '@env';

export const analyzeLogisticsText = async (text) => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Eres el Asistente de Inteligencia Logística de H2O CONTROL. 
            Tu misión es procesar comunicaciones de planta y convertirlas en JSON.

            ### CONTEXTO DE EMPRESAS:
            - H2Ocontrol, WaterDay, Alianza, Agrocube, BioAcker.

            ### REGLAS DE EXTRACCIÓN Y NORMALIZACIÓN:
            1. **Unidades**: Convertir siempre a 'Lts', 'Uds' o 'Kg'.
            2. **Tipos de Stock**:
               - 'MP': Materia Prima (ácidos, envases, etiquetas, químicos base).
               - 'PT': Producto Terminado (mezclas en tanques, granel).
               - 'FINAL': Producto envasado listo para despacho.
            3. **Cálculo de Cantidades**: Si el texto dice "10 bidones de 20lts", la qty debe ser 200 y la unit 'Lts'.
            4. **Nombres Técnicos**: Si detectas abreviaturas como "Sulf", "Cloro", "Etic", normalízalas a sus nombres completos ("Ácido Sulfúrico", "Cloro", "Etiquetas").

            ### LÓGICA DE ALERTAS PREVENTIVAS:
            Si el usuario te pregunta por el estado de un producto, evalúa si la cantidad mencionada es baja (umbral general < 100).

            ### FORMATO DE SALIDA (ESTRICTO JSON):
            {
              "company": "Nombre de la Empresa",
              "items": [
                {
                  "name": "Nombre Producto",
                  "qty": 000,
                  "unit": "Lts/Uds/Kg",
                  "type": "MP/PT/FINAL"
                }
              ]
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
    console.error("Error en el cerebro de la IA:", error);
    throw error;
  }
};