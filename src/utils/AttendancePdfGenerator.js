import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export const generateAttendancePdf = async (staffName, logs) => {
  const date = new Date().toLocaleDateString();
  const logoUrl = "https://lh3.googleusercontent.com/d/1v6L9W8_0E_Q8o0F-R_V-Qp8y-QG_W5_B"; // Tu logo de H2O Control

  const rows = logs.map(log => {
    const time = new Date(log.timestamp.seconds * 1000);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isLate = log.type === 'CHECK IN' && (time.getHours() > 8 || (time.getHours() === 8 && time.getMinutes() > 15));
    
    return `
      <tr>
        <td>${new Date(log.timestamp.seconds * 1000).toLocaleDateString()}</td>
        <td>${log.type}</td>
        <td style="color: ${isLate ? '#d32f2f' : '#2e7d32'}; font-weight: bold;">
          ${timeStr} ${isLate ? '(TARDE)' : ''}
        </td>
      </tr>
    `;
  }).join('');

  const htmlContent = `
    <html>
      <head>
        <style>
          body { 
            font-family: 'Helvetica', sans-serif; 
            padding: 40px; 
            color: #333; 
            position: relative;
          }
          /* MARCA DE AGUA CENTRAL */
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            opacity: 0.05;
            font-size: 80px;
            font-weight: bold;
            color: #2e4a3b;
            z-index: -1;
            white-space: nowrap;
          }
          .header { 
            flex-direction: row; 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            border-bottom: 2px solid #2e4a3b; 
            padding-bottom: 10px; 
            margin-bottom: 20px; 
          }
          .header-text h1 { color: #2e4a3b; margin: 0; font-size: 24px; }
          .logo { width: 100px; height: auto; }
          .info { margin-bottom: 30px; font-size: 14px; line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background-color: #f2f2f2; text-align: left; padding: 12px; border-bottom: 2px solid #2e4a3b; }
          td { padding: 12px; border-bottom: 1px solid #eee; font-size: 12px; }
          .footer { 
            margin-top: 50px; 
            border-top: 1px solid #eee;
            padding-top: 10px;
            font-size: 10px; 
            color: #888; 
            text-align: center; 
          }
          .slogan { color: #2e4a3b; font-weight: bold; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="watermark">H2O CONTROL</div>

        <div class="header">
          <div class="header-text">
            <h1>H2O CONTROL</h1>
            <p class="slogan">Agricultura Inteligente</p>
          </div>
          <img src="${logoUrl}" class="logo" />
        </div>

        <div class="info">
          <p><strong>REPORTE DE ASISTENCIA - PLANTA BATÁN</strong></p>
          <p><strong>Operario:</strong> ${staffName}</p>
          <p><strong>Fecha de Emisión:</strong> ${date}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Movimiento</th>
              <th>Hora Registrada</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="footer">
          H2O Control &copy; 2026 - Agricultura Inteligente<br>
          Documento digital con validez interna para auditoría de personal.
        </div>
      </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  } catch (error) {
    console.error("Error generando PDF:", error);
    Alert.alert("Error", "No se pudo generar el reporte.");
  }
};