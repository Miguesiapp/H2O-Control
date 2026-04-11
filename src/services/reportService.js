import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// ============================================================================
// CSS Maestro (Diseño Corporativo C-Level)
// ============================================================================
const masterStyles = `
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg); opacity: 0.04; font-size: 100px; font-weight: 900; color: #0f172a; z-index: -1; pointer-events: none; white-space: nowrap; }
  .header { border-bottom: 3px solid #0f172a; padding-bottom: 15px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
  .logo-area h1 { color: #0f172a; margin: 0; font-size: 28px; letter-spacing: -0.5px; }
  .slogan { color: #475569; font-weight: 600; font-size: 12px; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
  .report-meta { text-align: right; font-size: 11px; color: #64748b; }
  .report-meta strong { color: #0f172a; font-size: 12px; }
  .report-title { font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 5px; text-transform: uppercase; border-left: 5px solid #38bdf8; padding-left: 15px; }
  .stats-grid { display: flex; gap: 15px; margin-bottom: 30px; }
  .stat-card { flex: 1; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; border-top: 4px solid #3b82f6; text-align: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
  .stat-label { font-size: 10px; color: #64748b; font-weight: 800; text-transform: uppercase; margin-bottom: 5px; }
  .stat-value { font-size: 24px; font-weight: 900; color: #0f172a; }
  
  /* Estilo ChatGPT para Insights de IA */
  .ai-insight-box { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 25px; border-radius: 16px; margin-bottom: 30px; border-top: 4px solid #10b981; }
  .ai-insight-header { display: flex; align-items: center; margin-bottom: 15px; }
  .ai-insight-header h3 { color: #0f172a; margin: 0; font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
  .ai-content { font-size: 13px; color: #334155; text-align: justify; }
  .ai-content strong { color: #0f172a; }
  
  table { width: 100%; border-collapse: collapse; margin-top: 15px; background: white; font-size: 11px; }
  th { background-color: #0f172a; color: white; padding: 12px; text-align: left; font-weight: 600; text-transform: uppercase; font-size: 10px; }
  td { border-bottom: 1px solid #f1f5f9; padding: 12px; color: #334155; font-weight: 500; }
  tr:nth-child(even) { background-color: #f8fafc; }
  .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; text-align: center; text-transform: uppercase; letter-spacing: 1px; }
`;

// Función para determinar quién firma el reporte (Mantiene tu anonimato)
const getSignature = (requestedBy) => {
  return requestedBy === 'bduville@h2ocontrol.com.ar' 
    ? 'B. Duville (Dirección)' 
    : 'H2O Neural (Sistema Automatizado)';
};

// Generador de Cabecera Dinámica
const getHeaderHTML = (reportType, period, date, reportId) => `
  <div class="watermark">H2O CONTROL</div>
  <div class="header">
    <div class="logo-area">
      <h1>H2O CONTROL</h1>
      <p class="slogan">Inteligencia Operativa</p>
    </div>
    <div class="report-meta">
      <strong>USO EXCLUSIVO DIRECCIÓN</strong><br/>
      Generado: ${date}<br/>
      Hash ID: ${reportId}
    </div>
  </div>
  <div class="report-title">${reportType} - ${period}</div>
`;

// ============================================================================
// 1. REPORTE EJECUTIVO (Evolución, Gastos y Visión Estratégica AI)
// ============================================================================
export const generateExecutiveReport = async (period, stats, aiInsights, requestedBy) => {
  const date = new Date().toLocaleString();
  const reportId = `EXEC-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const signature = getSignature(requestedBy);

  const htmlContent = `
    <html>
      <head><style>${masterStyles}</style></head>
      <body>
        ${getHeaderHTML('Resumen Ejecutivo', period, date, reportId)}
        
        <div class="ai-insight-box">
          <div class="ai-insight-header">
            <h3>🧠 H2O Neural Vision: Análisis y Proyección</h3>
          </div>
          <div class="ai-content">
            <strong>Evaluación del Período:</strong><br/>${aiInsights.monthlyReview}<br/><br/>
            <strong style="color: #b91c1c;">Necesidades Futuras / Oportunidades:</strong><br/>${aiInsights.futureNeeds}
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card" style="border-top-color: #10b981;">
            <div class="stat-label">Volumen Producido (Lts/Kg)</div>
            <div class="stat-value">${stats.totalProduced}</div>
          </div>
          <div class="stat-card" style="border-top-color: #ef4444;">
            <div class="stat-label">Gastos Insumos Est.</div>
            <div class="stat-value">$${stats.estimatedExpenses}</div>
          </div>
          <div class="stat-card" style="border-top-color: #38bdf8;">
            <div class="stat-label">Eficiencia Operativa</div>
            <div class="stat-value">${stats.efficiencyScore}%</div>
          </div>
        </div>

        <h3 style="font-size: 14px; color: #0f172a; margin-top: 40px; text-transform: uppercase;">Desglose de Producción por Unidad</h3>
        <table>
          <thead><tr><th>Empresa</th><th>Producido</th><th>Insumos Consumidos</th><th>Tendencia</th></tr></thead>
          <tbody>
            ${stats.companiesData.map(c => `
              <tr>
                <td><strong>${c.name}</strong></td>
                <td>${c.produced}</td>
                <td>${c.consumed}</td>
                <td style="color: ${c.trend.includes('+') ? '#10b981' : '#ef4444'}; font-weight: bold;">${c.trend}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">Documento Confidencial • Autorizado por: ${signature} • Planta Batán, Bs. As.</div>
      </body>
    </html>
  `;
  return await shareReport(htmlContent, `H2O_Ejecutivo_${period}_${date.split(',')[0].replace(/\//g,'-')}`);
};

// ============================================================================
// 2. REPORTE DE RECURSOS HUMANOS (Desempeño y Totem)
// ============================================================================
export const generateHRReport = async (period, hrData, aiInsights, requestedBy) => {
  const date = new Date().toLocaleString();
  const reportId = `HR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const signature = getSignature(requestedBy);

  const htmlContent = `
    <html>
      <head><style>${masterStyles}</style></head>
      <body>
        ${getHeaderHTML('Auditoría de Personal y Desempeño', period, date, reportId)}
        
        <div class="ai-insight-box" style="border-top-color: #0ea5e9;">
          <div class="ai-insight-header">
            <h3>🧠 H2O Neural: Análisis de Personal</h3>
          </div>
          <div class="ai-content">
            ${aiInsights.hrEvaluation}
          </div>
        </div>

        <table>
          <thead><tr><th>Operario</th><th>Días Presente</th><th>Horas Extra</th><th>Desvíos / Tardanzas</th><th>Desempeño IA</th></tr></thead>
          <tbody>
            ${hrData.map(emp => `
              <tr>
                <td><strong>${emp.name}</strong></td>
                <td>${emp.days}</td>
                <td>${emp.overtime}h</td>
                <td style="color: #ef4444; font-weight: bold;">${emp.anomalies}</td>
                <td>${emp.aiScore}/10</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">Documento Confidencial • Autorizado por: ${signature} • Planta Batán, Bs. As.</div>
      </body>
    </html>
  `;
  return await shareReport(htmlContent, `H2O_RRHH_${period}_${date.split(',')[0].replace(/\//g,'-')}`);
};

// ============================================================================
// 3. REPORTE DE LOGÍSTICA Y MERMAS
// ============================================================================
export const generateTraceabilityReport = async (period, traceData, aiInsights, requestedBy) => {
  const date = new Date().toLocaleString();
  const reportId = `LOG-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const signature = getSignature(requestedBy);

  const htmlContent = `
    <html>
      <head><style>${masterStyles}</style></head>
      <body>
        ${getHeaderHTML('Control de Mermas y Trazabilidad', period, date, reportId)}
        
        <div class="ai-insight-box" style="border-top-color: #ef4444; background-color: #fef2f2;">
          <div class="ai-insight-header">
            <h3 style="color: #b91c1c;">⚠️ H2O Neural: Auditoría de Fugas</h3>
          </div>
          <div class="ai-content" style="color: #991b1b;">
            ${aiInsights.shrinkageAnalysis}
          </div>
        </div>

        <h3 style="font-size: 14px; color: #0f172a; margin-top: 40px; text-transform: uppercase;">Registro de Retiros Casuales</h3>
        <table>
          <thead><tr><th>Fecha</th><th>Producto</th><th>Cant. Retirada</th><th>Empresa Afectada</th><th>Auditor</th></tr></thead>
          <tbody>
            ${traceData.withdrawals.map(w => `
              <tr>
                <td>${w.date}</td>
                <td><strong>${w.product}</strong></td>
                <td style="color:#ef4444; font-weight: bold;">-${w.qty}</td>
                <td>${w.company}</td>
                <td>${w.user}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">Documento Confidencial • Autorizado por: ${signature} • Planta Batán, Bs. As.</div>
      </body>
    </html>
  `;
  return await shareReport(htmlContent, `H2O_Mermas_${period}_${date.split(',')[0].replace(/\//g,'-')}`);
};

// ============================================================================
// FUNCIÓN AUXILIAR PARA IMPRIMIR Y COMPARTIR
// ============================================================================
const shareReport = async (html, filename) => {
  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    await Sharing.shareAsync(uri, { 
      UTI: '.pdf', 
      mimeType: 'application/pdf',
      dialogTitle: filename 
    });
    return true;
  } catch (error) {
    console.error("Error generando PDF:", error);
    throw error;
  }
};