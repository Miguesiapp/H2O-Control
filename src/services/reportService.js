import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export const generateProfessionalReport = async (companyName, data, stats, alerts = []) => {
  const formatAction = (text) => {
    if (!text) return 'N/A';
    return text.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  // Generamos el bloque de alertas si existen productos en rojo/naranja
  const alertsHtml = alerts.length > 0 ? `
    <div style="background-color: #fff3e0; border: 1px solid #ffb74d; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
      <h3 style="color: #e65100; margin: 0 0 10px 0; font-size: 16px;">⚠️ Alertas de Reposición (IA)</h3>
      <table style="width: 100%; font-size: 11px;">
        ${alerts.map(a => `
          <tr>
            <td style="color: #d32f2f; font-weight: bold;">${a.itemName}</td>
            <td style="text-align: right;">Stock Actual: <strong>${a.quantity}</strong> / Min: ${a.minStock}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  ` : '';

  const htmlContent = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { font-family: 'Helvetica', sans-serif; padding: 30px; color: #333; line-height: 1.4; }
          .header { border-bottom: 3px solid #2e4a3b; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
          .logo { font-size: 26px; font-weight: bold; color: #2e4a3b; letter-spacing: 1px; }
          .company-info { font-size: 14px; margin-top: 5px; color: #666; }
          
          .stats-grid { display: flex; gap: 15px; margin-bottom: 25px; }
          .stat-card { 
            flex: 1; 
            background: #f1f8f4; 
            padding: 15px; 
            border-radius: 10px; 
            border-left: 5px solid #2e4a3b;
          }
          .stat-label { font-size: 10px; color: #666; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
          .stat-value { font-size: 22px; font-weight: bold; color: #2e4a3b; }

          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background-color: #2e4a3b; color: white; padding: 12px 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
          td { border-bottom: 1px solid #eee; padding: 10px; font-size: 10px; color: #444; }
          tr:nth-child(even) { background-color: #f9f9f9; }

          .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; font-size: 9px; color: #aaa; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">H2O CONTROL</div>
            <div class="company-info">Reporte de Gestión: <strong>${companyName}</strong></div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #888;">
            Fecha: ${new Date().toLocaleDateString()}<br/>
            ID: #H2O-${Math.random().toString(36).substr(2, 6).toUpperCase()}
          </div>
        </div>

        ${alertsHtml}

        <h3>Resumen de Actividad</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Ingresos / Producción</div>
            <div class="stat-value">${stats.totalIn || 0} <small style="font-size: 12px; font-weight: normal;">mov.</small></div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Salidas / Despachos</div>
            <div class="stat-value">${stats.totalOut || 0} <small style="font-size: 12px; font-weight: normal;">mov.</small></div>
          </div>
        </div>

        <h3>Detalle de Auditoría</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 20%;">Fecha</th>
              <th style="width: 20%;">Operación</th>
              <th style="width: 25%;">Producto</th>
              <th style="width: 15%;">Cantidad</th>
              <th style="width: 20%;">Usuario</th>
            </tr>
          </thead>
          <tbody>
            ${data.length > 0 ? data.map(item => `
              <tr>
                <td>${item.timestamp || 'N/A'}</td>
                <td style="font-weight: bold;">${formatAction(item.action)}</td>
                <td>${item.itemName || 'N/A'}</td>
                <td>${item.quantity || 0} ${item.unit || ''}</td>
                <td>${item.user || 'Sist.'}</td>
              </tr>
            `).join('') : '<tr><td colspan="5" style="text-align:center;">Sin movimientos registrados.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          Este documento es un registro oficial de H2O Control Intelligence.<br/>
          La información aquí presentada es inalterable y está auditada en tiempo real.
        </div>
      </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html: htmlContent, base64: false });
    await Sharing.shareAsync(uri, { 
      UTI: '.pdf', 
      mimeType: 'application/pdf',
      dialogTitle: `Balance_${companyName}` 
    });
  } catch (error) {
    console.error("Error PDF:", error);
    throw error;
  }
};