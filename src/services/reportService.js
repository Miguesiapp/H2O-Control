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

/**
 * Genera y comparte un reporte PDF de auditoría de personal
 */
export const generateHRReport = async (period, hrData, aiInsights, operatorEmail) => {
  try {
    const tableRows = hrData.map(h => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${h.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${h.days}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${h.overtime} hs</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: ${h.anomalies > 0 ? '#ef4444' : '#10b981'}">${h.anomalies}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold;">${h.aiScore} / 10</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Auditoría de Personal</title>
          <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #0f172a; }
              .header { border-bottom: 3px solid #004ca8; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
              .title { font-size: 28px; font-weight: 900; color: #004ca8; margin: 0; }
              .subtitle { font-size: 14px; color: #64748b; letter-spacing: 2px; }
              .report-meta { text-align: right; font-size: 12px; color: #64748b; }
              .ai-box { background-color: #f8fafc; border-left: 4px solid #10b981; padding: 20px; margin-bottom: 30px; border-radius: 4px; }
              .ai-title { font-size: 14px; font-weight: bold; color: #10b981; margin-top: 0; margin-bottom: 10px; }
              .ai-text { font-size: 14px; line-height: 1.6; color: #334155; margin: 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
              th { background-color: #f1f5f9; padding: 12px; text-align: center; font-weight: bold; color: #475569; }
              .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          </style>
      </head>
      <body>
          <div class="header">
              <div>
                  <h1 class="title">AUDITORÍA DE PERSONAL</h1>
                  <div class="subtitle">RESUMEN ${period.toUpperCase()}</div>
              </div>
              <div class="report-meta">
                  <strong>Emisión:</strong> ${new Date().toLocaleDateString()}<br>
                  <strong>Autorizado por:</strong> ${operatorEmail}
              </div>
          </div>

          <div class="ai-box">
              <div class="ai-title">H2O Neural Evaluation</div>
              <p class="ai-text">${aiInsights.hrEvaluation}</p>
          </div>

          <table>
              <thead>
                  <tr>
                      <th style="text-align: left;">Operario</th>
                      <th>Días Trabajados</th>
                      <th>Horas Extra (Est.)</th>
                      <th>Anomalías / Desvíos</th>
                      <th>Score Neural</th>
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

    if (Platform.OS === 'web') {
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(htmlContent);
        newWindow.document.close();
        newWindow.setTimeout(() => {
          newWindow.print();
        }, 500);
      } else {
        await Print.printAsync({ html: htmlContent });
      }
    } else {
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Auditoria_Personal_${period}.pdf`
        });
      }
    }

    return true;
  } catch (error) {
    console.error("Error generando PDF de Auditoría:", error);
    throw error;
  }
};

/**
 * Genera y comparte el Respaldo Semanal con formato Premium (estilo OE/OP) y sumario de IA.
 */
export const generateWeeklyBackupPDF = async (periodString, filterName, summaryText, movements, operatorEmail) => {
  try {
    const tableRows = movements.map(m => {
      const isNegative = Number(m.quantity) < 0;
      const qtyColor = isNegative ? '#ef4444' : '#10b981';
      return `
        <tr>
          <td>${m.formattedDate || 'N/A'}</td>
          <td style="font-weight: bold; color: #1e293b;">${m.action?.replace(/_/g, ' ') || 'S/D'}</td>
          <td>${m.itemName || 'S/D'}</td>
          <td>${m.batchInternal || '-'}</td>
          <td style="font-weight: bold; color: ${qtyColor}">${isNegative ? '' : '+'}${m.quantity} ${m.unit}</td>
          <td>${m.user || 'Sistema'}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Respaldo Semanal H2O</title>
          <style>
            @page { size: A4 landscape; margin: 15mm; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 0; }
            
            /* Header Premium */
            .header-container { border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 25px; overflow: hidden; display: flex; align-items: center; justify-content: space-between; }
            .header-center { text-align: center; flex: 1; }
            .header-title { margin: 0; font-size: 20px; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; font-weight: 900; }
            .header-sub { margin: 0; font-size: 12px; color: #64748b; font-weight: 600; }
            
            .h2o-logo-box { display: inline-block; width: 60px; height: 60px; border: 3px solid #2563eb; border-radius: 12px; text-align: center; vertical-align: middle; padding-top: 8px; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .h2o-logo-big { display: block; font-size: 16px; font-weight: 900; color: #2563eb; line-height: 1.2; }
            .h2o-logo-small { display: block; font-size: 7px; font-weight: 700; color: #2563eb; letter-spacing: 2px; }

            /* Tarjeta de Metadatos */
            .meta-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin-bottom: 25px; display: flex; flex-wrap: wrap; gap: 15px; }
            .meta-item { flex: 1; min-width: 150px; }
            .meta-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 4px; }
            .meta-value { font-size: 14px; color: #0f172a; font-weight: 700; }

            .ai-box { background-color: #eff6ff; border: 1px dashed #3b82f6; border-radius: 12px; padding: 15px; margin-bottom: 25px; }
            .ai-title { font-weight: 900; font-size: 12px; color: #1d4ed8; margin-bottom: 5px; text-transform: uppercase; }
            .ai-text { font-size: 12px; color: #334155; line-height: 1.5; margin: 0; font-style: italic; }

            /* Tablas de Datos */
            h3 { font-size: 14px; color: #2563eb; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-top: 15px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px;}
            table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 11px; }
            th, td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
            th { background-color: #f8fafc; font-weight: bold; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;}
            td { color: #334155; }

            .signatures { display: flex; justify-content: space-between; margin-top: 50px; gap: 50px; }
            .signature-box { flex: 1; text-align: center; border-top: 1px solid #94a3b8; padding-top: 10px; }
            .signature-box p { margin: 0; font-size: 12px; color: #0f172a; font-weight: bold; }
            .signature-box span { font-size: 10px; color: #64748b; }
            
            .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="h2o-logo-box">
              <span class="h2o-logo-big">H₂O</span>
              <span class="h2o-logo-small">CONTROL</span>
            </div>
            <div class="header-center">
              <p class="header-title">RESPALDO SEMANAL DE MOVIMIENTOS</p>
              <p class="header-sub">Documento Oficial de Control y Trazabilidad</p>
            </div>
            <div style="width: 60px;"></div>
          </div>
          
          <div class="meta-card">
            <div class="meta-item">
              <div class="meta-label">Período</div>
              <div class="meta-value">${periodString}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Filtro Aplicado</div>
              <div class="meta-value">${filterName}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Total Registros</div>
              <div class="meta-value">${movements.length} movimientos</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Generado Por</div>
              <div class="meta-value">${operatorEmail}</div>
            </div>
          </div>

          <div class="ai-box">
            <div class="ai-title">✨ Resumen H2O Neural (IA)</div>
            <p class="ai-text">"${summaryText}"</p>
          </div>

          <h3>Registro Detallado</h3>
          <table>
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Operación</th>
                <th>Producto / Insumo</th>
                <th>Lote Int.</th>
                <th>Cantidad</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div class="signatures">
            <div class="signature-box">
              <p>Firma Operador de Planta</p>
              <span>Aclaración / DNI</span>
            </div>
            <div class="signature-box">
              <p>Firma Supervisor</p>
              <span>Aprobación de Respaldo</span>
            </div>
          </div>

          <div class="footer">
            Reporte generado el ${new Date().toLocaleString()} - Sistema de Trazabilidad H2O Control
          </div>
        </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(htmlContent);
        newWindow.document.close();
        newWindow.setTimeout(() => {
          newWindow.print();
        }, 500);
      } else {
        await Print.printAsync({ html: htmlContent });
      }
    } else {
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Respaldo_Semanal_H2O.pdf'
        });
      }
    }
    return true;
  } catch (error) {
    console.error("Error generando PDF Respaldo Semanal:", error);
    throw error;
  }
};