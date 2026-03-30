import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export const generateProfessionalReport = async (companyName, data, stats, alerts = []) => {
  const date = new Date().toLocaleDateString();
  const reportId = `H2O-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

  const formatAction = (text) => {
    if (!text) return 'N/A';
    return text.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  // Bloque de alertas (IA) mejorado
  const alertsHtml = alerts.length > 0 ? `
    <div style="background-color: #fff5f5; border: 2px solid #d32f2f; padding: 15px; border-radius: 12px; margin-bottom: 25px;">
      <h3 style="color: #d32f2f; margin: 0 0 10px 0; font-size: 16px;">⚠️ ALERTAS DE REPOSICIÓN CRÍTICA (IA)</h3>
      <table style="width: 100%; font-size: 12px; border: none; background: none;">
        ${alerts.map(a => `
          <tr>
            <td style="color: #b71c1c; font-weight: bold; padding: 5px 0;">• ${a.itemName}</td>
            <td style="text-align: right; color: #333;">Stock Actual: <strong>${a.quantity}</strong> <span style="color: #888;">(Mín: ${a.minStock})</span></td>
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
          body { 
            font-family: 'Helvetica', sans-serif; 
            padding: 40px; 
            color: #333; 
            line-height: 1.5;
            position: relative;
          }
          
          /* MARCA DE AGUA CORPORATIVA */
          .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-35deg);
            opacity: 0.04;
            font-size: 90px;
            font-weight: 900;
            color: #2e4a3b;
            z-index: -1;
            white-space: nowrap;
            pointer-events: none;
          }

          .header { 
            border-bottom: 3px solid #2e4a3b; 
            padding-bottom: 15px; 
            margin-bottom: 30px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
          }
          .logo-area h1 { color: #2e4a3b; margin: 0; font-size: 28px; letter-spacing: 1px; }
          .slogan { color: #2e4a3b; font-weight: bold; font-style: italic; font-size: 12px; margin: 0; }
          
          .report-meta { text-align: right; font-size: 11px; color: #777; }

          .stats-grid { display: flex; gap: 20px; margin-bottom: 30px; }
          .stat-card { 
            flex: 1; 
            background: #f8faf9; 
            padding: 20px; 
            border-radius: 15px; 
            border: 1px solid #e0e6e3;
            border-top: 4px solid #2e4a3b;
            text-align: center;
          }
          .stat-label { font-size: 10px; color: #888; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; }
          .stat-value { font-size: 26px; font-weight: 900; color: #2e4a3b; }

          h3 { color: #2e4a3b; border-left: 4px solid #2e4a3b; padding-left: 10px; font-size: 16px; margin-top: 30px; }

          table { width: 100%; border-collapse: collapse; margin-top: 15px; background: white; }
          th { background-color: #2e4a3b; color: white; padding: 12px; text-align: left; font-size: 10px; letter-spacing: 1px; }
          td { border-bottom: 1px solid #eee; padding: 12px; font-size: 10px; color: #444; }
          tr:nth-child(even) { background-color: #fcfdfc; }

          .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; font-size: 9px; color: #aaa; text-align: center; }
        </style>
      </head>
      <body>
        <div class="watermark">H2O CONTROL</div>

        <div class="header">
          <div class="logo-area">
            <h1>H2O CONTROL</h1>
            <p class="slogan">Agricultura Inteligente</p>
          </div>
          <div class="report-meta">
            <strong>REPORTE DE GESTIÓN</strong><br/>
            Unidad: ${companyName}<br/>
            Fecha: ${date}<br/>
            ID: ${reportId}
          </div>
        </div>

        ${alertsHtml}

        <h3>Resumen de Actividad</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Ingresos / Producción</div>
            <div class="stat-value">${stats.totalIn || 0} <span style="font-size: 14px; font-weight: 400;">mov.</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Salidas / Despachos</div>
            <div class="stat-value">${stats.totalOut || 0} <span style="font-size: 14px; font-weight: 400;">mov.</span></div>
          </div>
        </div>

        <h3>Detalle de Auditoría</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 15%;">Fecha</th>
              <th style="width: 20%;">Operación</th>
              <th style="width: 30%;">Producto</th>
              <th style="width: 15%;">Cantidad</th>
              <th style="width: 20%;">Usuario</th>
            </tr>
          </thead>
          <tbody>
            ${data.length > 0 ? data.map(item => `
              <tr>
                <td>${item.timestamp || 'N/A'}</td>
                <td style="font-weight: bold; color: #2e4a3b;">${formatAction(item.action)}</td>
                <td style="font-weight: 600;">${item.itemName || 'N/A'}</td>
                <td>${item.quantity || 0} ${item.unit || ''}</td>
                <td>${item.user || 'Sist.'}</td>
              </tr>
            `).join('') : '<tr><td colspan="5" style="text-align:center; padding: 30px;">Sin movimientos registrados.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          H2O Control Intelligence - Sistema de Trazabilidad Batán<br/>
          Este documento es un registro oficial. La información es inalterable y auditada en tiempo real.
        </div>
      </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html: htmlContent, base64: false });
    await Sharing.shareAsync(uri, { 
      UTI: '.pdf', 
      mimeType: 'application/pdf',
      dialogTitle: `H2O_Reporte_${companyName}` 
    });
  } catch (error) {
    console.error("Error PDF:", error);
    throw error;
  }
};