import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * Genera y comparte un reporte PDF de movimientos operativos con el resumen de IA
 */
export const generateAndSharePDF = async (monthYear, filterName, summaryText, movements) => {
  try {
    // 1. Generar filas de la tabla
    const tableRows = movements.map(m => {
      const isNegative = Number(m.quantity) < 0;
      const qtyColor = isNegative ? '#ef4444' : '#10b981';
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${m.formattedDate || 'N/A'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${m.action?.replace(/_/g, ' ') || 'OP'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${m.itemName || 'Desconocido'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: ${qtyColor}">
            ${isNegative ? '' : '+'}${m.quantity} ${m.unit}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">${m.user || 'Sistema'}</td>
        </tr>
      `;
    }).join('');

    // 2. Construir HTML
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reporte H2O Control</title>
          <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #0f172a; }
              .header { border-bottom: 3px solid #004ca8; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; alignItems: center; }
              .title { font-size: 28px; font-weight: 900; color: #004ca8; margin: 0; }
              .subtitle { font-size: 14px; color: #64748b; letter-spacing: 2px; }
              .report-meta { text-align: right; font-size: 12px; color: #64748b; }
              .ai-box { background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 30px; border-radius: 4px; }
              .ai-title { font-size: 14px; font-weight: bold; color: #3b82f6; margin-top: 0; margin-bottom: 10px; display: flex; align-items: center; }
              .ai-text { font-size: 14px; line-height: 1.6; color: #334155; margin: 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
              th { background-color: #f1f5f9; padding: 12px; text-align: left; font-weight: bold; color: #475569; }
              .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          </style>
      </head>
      <body>
          <div class="header">
              <div>
                  <h1 class="title">H2O CONTROL</h1>
                  <div class="subtitle">REPORTE OPERATIVO</div>
              </div>
              <div class="report-meta">
                  <strong>PERÍODO:</strong> ${monthYear}<br>
                  <strong>FILTRO:</strong> ${filterName}<br>
                  <strong>FECHA EMISIÓN:</strong> ${new Date().toLocaleDateString()}
              </div>
          </div>

          <div class="ai-box">
              <h3 class="ai-title">✨ Auditoría de Inteligencia Artificial (H2O Neural)</h3>
              <p class="ai-text">${summaryText}</p>
          </div>

          <h3>Detalle de Movimientos (${movements.length} registros)</h3>
          <table>
              <thead>
                  <tr>
                      <th>Fecha</th>
                      <th>Operación</th>
                      <th>Producto / Item</th>
                      <th>Cantidad</th>
                      <th>Usuario</th>
                  </tr>
              </thead>
              <tbody>
                  ${tableRows}
              </tbody>
          </table>

          <div class="footer">
              Generado automáticamente por H2O Control System - Documento Interno y Confidencial
          </div>
      </body>
      </html>
    `;

    // 3. Imprimir a PDF
    if (Platform.OS === 'web') {
      await Print.printAsync({ html: htmlContent });
    } else {
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Reporte H2O_${monthYear}.pdf`
        });
      } else {
        throw new Error('El dispositivo no soporta compartir archivos.');
      }
    }

    return true;
  } catch (error) {
    console.error("Error generando PDF:", error);
    throw error;
  }
};