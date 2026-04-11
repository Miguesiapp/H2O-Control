import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

/**
 * Genera un reporte de asistencia profesional nivel Enterprise
 */
export const generateAttendancePdf = async (staffName, logs) => {
  const dateStr = new Date().toLocaleDateString();
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Parámetros de la empresa
  const INGRESO_MAX_H = 8;
  const INGRESO_MAX_M = 15;

  const rows = logs.map(log => {
    const time = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp.seconds * 1000);
    const logDate = time.toLocaleDateString();
    const logTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Inteligencia de Auditoría: Detectar llegadas tarde
    const isLate = log.type === 'CHECK IN' && (time.getHours() > INGRESO_MAX_H || (time.getHours() === INGRESO_MAX_H && time.getMinutes() > INGRESO_MAX_M));
    
    return `
      <tr>
        <td style="font-weight: 600; color: #1e293b;">${logDate}</td>
        <td style="color: #475569;">${log.type}</td>
        <td style="color: ${isLate ? '#ef4444' : '#10b981'}; font-weight: 800;">
          ${logTime} ${isLate ? '<span style="font-size: 8px;">(DESVÍO)</span>' : ''}
        </td>
      </tr>
    `;
  }).join('');

  const htmlContent = `
    <html>
      <head>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
          .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-40deg); opacity: 0.04; font-size: 110px; font-weight: 900; color: #0f172a; z-index: -1; pointer-events: none; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
          .logo-area h1 { color: #0f172a; margin: 0; font-size: 26px; letter-spacing: -1px; font-weight: 900; }
          .slogan { color: #64748b; font-weight: 700; font-size: 10px; margin: 0; text-transform: uppercase; letter-spacing: 1.5px; }
          .report-meta { text-align: right; font-size: 10px; color: #64748b; }
          .report-title { font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 20px; text-transform: uppercase; border-left: 5px solid #3b82f6; padding-left: 15px; }
          
          .info-card { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin-bottom: 25px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px; }
          .info-label { color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 10px; }
          .info-value { color: #0f172a; font-weight: 800; }

          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th { background-color: #f1f5f9; color: #0f172a; padding: 12px; text-align: left; font-weight: 800; text-transform: uppercase; font-size: 9px; border-bottom: 2px solid #cbd5e1; }
          td { border-bottom: 1px solid #f1f5f9; padding: 12px; }
          
          .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; text-align: center; text-transform: uppercase; letter-spacing: 1px; }
        </style>
      </head>
      <body>
        <div class="watermark">H2O CONTROL</div>

        <div class="header">
          <div class="logo-area">
            <h1>H2O CONTROL</h1>
            <p class="slogan">Intelligence Operational System</p>
          </div>
          <div class="report-meta">
            <strong>AUDITORÍA DE PERSONAL</strong><br/>
            Emisión: ${dateStr} - ${timeStr}<br/>
            Hash: ${Math.random().toString(36).substr(2, 9).toUpperCase()}
          </div>
        </div>

        <div class="report-title">Reporte Individual de Asistencia</div>

        <div class="info-card">
          <div class="info-row">
            <span class="info-label">Operario auditado:</span>
            <span class="info-value">${staffName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Unidad Operativa:</span>
            <span class="info-value">Planta Batán, Bs. As.</span>
          </div>
          <div class="info-row">
            <span class="info-label">Rango Horario:</span>
            <span class="info-value">08:00 AM - 16:00 PM</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30%;">Fecha de Jornada</th>
              <th style="width: 30%;">Tipo de Registro</th>
              <th style="width: 40%;">Marcación Horaria</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="footer">
          H2O Control Intelligence © 2026<br/>
          Este documento es un registro oficial inalterable generado por H2O Neural.
        </div>
      </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html: htmlContent, base64: false });
    await Sharing.shareAsync(uri, { 
      UTI: '.pdf', 
      mimeType: 'application/pdf',
      dialogTitle: `H2O_Asistencia_${staffName.replace(/ /g, '_')}` 
    });
  } catch (error) {
    console.error("Error PDF:", error);
    Alert.alert("Error de Sistema", "No se pudo compilar el documento de asistencia.");
  }
};