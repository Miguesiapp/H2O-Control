import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

const generateHTML = (order) => {
  const { type, data, id, _createdAt } = order;
  const dateObj = data?.fechaCreacion ? new Date(data.fechaCreacion.seconds * 1000) : new Date();
  const dateStr = dateObj.toLocaleDateString();

  let title = 'ORDEN DE TRABAJO';
  let productLabel = 'Producto:';
  let productName = 'Desconocido';
  let batchInfo = 'S/D';
  let quantity = '0';

  if (type === 'OP') {
    title = 'ORDEN DE PRODUCCIÓN';
    productName = data?.formulaName || data?.itemName || 'General';
    batchInfo = data?.batch || data?.batchInternal || 'S/D';
    const lts = data?.quantity || data?.liters || data?.targetVolume || 0;
    const kgs = data?.kilos || data?.targetKilos || 0;
    const dens = data?.density || 'S/D';
    quantity = `${lts} Litros (${Number(kgs).toFixed(2)} Kg) | Densidad: ${dens}`;
  } else if (type === 'OE' || type === 'OEM') {
    title = 'ORDEN DE ENVASADO';
    // itemName tiene formato "PRODUCTO COMERCIAL - 20L", extraemos solo el nombre
    const rawItemName = data?.itemName || '';
    productName = rawItemName.includes(' - ')
      ? rawItemName.split(' - ').slice(0, -1).join(' - ')  // quitar solo la parte final " - XL"
      : (data?.productName || data?.commercialName || rawItemName || 'Envasado');
    batchInfo = data?.batchInternal || data?.targetBatch || 'S/D';
    const isPote = data?.containerType === 'POTE' || rawItemName.includes('POTE');
    const unitSuffix = isPote ? 'Kg (Pote)' : 'L';
    quantity = `${data?.quantity || 0} x ${data?.presentation || ''}${unitSuffix}`;
  } else if (type === 'OD') {
    title = 'ORDEN DE DESPACHO';
    productName = data?.productName || 'Despacho';
    batchInfo = data?.dispatchId || 'S/D';
    quantity = `${data?.quantity || 0}`;
  }

  // Styles
  const style = `
    <style>
      @page { size: A4; margin: 15mm; }
      body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 0; }
      
      /* Nuevo Header Premium */
      .header-container { border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 25px; overflow: hidden; }
      .header-left { float: left; }
      .header-center { text-align: center; }
      .header-title { margin: 0; font-size: 20px; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; font-weight: 900; }
      .header-sub { margin: 0; font-size: 12px; color: #64748b; font-weight: 600; }
      
      .h2o-logo-box { display: inline-block; width: 60px; height: 60px; border: 3px solid #2563eb; border-radius: 12px; text-align: center; vertical-align: middle; padding-top: 8px; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .h2o-logo-big { display: block; font-size: 16px; font-weight: 900; color: #2563eb; line-height: 1.2; }
      .h2o-logo-small { display: block; font-size: 7px; font-weight: 700; color: #2563eb; letter-spacing: 2px; }

      /* Tarjeta de Metadatos */
      .meta-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin-bottom: 25px; display: flex; flex-wrap: wrap; gap: 15px; }
      .meta-item { flex: 1; min-width: 200px; }
      .meta-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 4px; }
      .meta-value { font-size: 14px; color: #0f172a; font-weight: 700; }

      /* Tablas de Datos */
      h3 { font-size: 14px; color: #2563eb; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-top: 15px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px;}
      table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 12px; }
      th, td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
      th { background-color: #f8fafc; font-weight: bold; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;}
      td { color: #334155; }
      
      .highlight-row td { background-color: #eff6ff; font-weight: bold; color: #1d4ed8; }
      .note-row td { background-color: #fffbeb; color: #b45309; font-style: italic; font-size: 11px; }
      
      /* Secciones Inferiores */
      .observaciones { background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 15px; min-height: 80px; margin-bottom: 40px; }
      .obs-title { font-weight: bold; font-size: 12px; color: #64748b; margin-bottom: 5px; text-transform: uppercase; }
      
      .signatures { display: flex; justify-content: space-between; margin-top: 30px; gap: 30px; }
      .signature-box { flex: 1; text-align: center; border-top: 1px solid #94a3b8; padding-top: 10px; }
      .signature-box p { margin: 0; font-size: 12px; color: #0f172a; font-weight: bold; }
      .signature-box span { font-size: 10px; color: #64748b; }
      
      .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; }
    </style>
  `;

  let itemsHtml = '';
  if (type === 'OP') {
    const ingredients = data?.ingredients || data?.needs || [];
    itemsHtml = `
      <h3>Desglose de Formulación</h3>
      <table>
        <thead>
          <tr>
            <th>Ingrediente</th>
            <th>Especificación</th>
            <th>Lote Origen / Asignado</th>
            <th>Lote Real</th>
            <th>Consumo Real</th>
            <th>Firma</th>
          </tr>
        </thead>
        <tbody>
          ${ingredients.map(ing => {
      if (ing.type === 'NOTE') return `<tr class="note-row"><td colspan="6"><b>Nota Operativa:</b> ${ing.text}</td></tr>`;

      let lotesAsignados = '';
      if (ing.batchesToConsume && ing.batchesToConsume.length > 0) {
        lotesAsignados = ing.batchesToConsume.map(b => {
          const hasProv = b.batchProvider && b.batchProvider !== 'S/D' && b.batchProvider !== 'S/L';
          const displayBatch = hasProv ? `Prov: ${b.batchProvider}` : `Int: ${b.batchInternal || 'S/D'}`;
          return `${displayBatch} (${b.consumed} ${ing.isGranel ? 'Lts' : 'Kg'})`;
        }).join('<br/>');
      } else {
        lotesAsignados = ing.batchInternal || 'A Definir';
      }

      const actual = data?.actualIngredients?.find(a => a.name === ing.name);
      const actualQtyHtml = actual ? `<b>${Number(actual.actualQty).toFixed(2)} ${ing.isGranel ? 'Lts' : 'Kg'}</b>` : '';

      return `
              <tr>
                <td style="font-weight:700">${ing.name}</td>
                <td>${Number(ing.required || ing.amount || 0).toFixed(2)} ${ing.isGranel ? 'Lts' : 'Kg'}</td>
                <td><span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:10px;">${lotesAsignados}</span></td>
                <td></td>
                <td>${actualQtyHtml}</td>
                <td></td>
              </tr>
            `;
    }).join('')}
        </tbody>
      </table>
    `;
  } else if (type === 'OE' || type === 'OEM') {
    itemsHtml = `
      <h3>Componentes del Envasado</h3>
      <table>
        <thead>
          <tr>
            <th>Insumo / Granel</th>
            <th>Especificación</th>
            <th>Lote Real Usado</th>
            <th>Cantidad Real</th>
            <th>Firma</th>
          </tr>
        </thead>
        <tbody>
          <tr class="highlight-row">
            <td>${productName} (${(data?.containerType === 'POTE' || (data?.itemName || '').includes('POTE')) ? 'Materia Prima' : 'Granel / MP'})</td>
            <td>${data?.litersConsumed || data?.quantity || 0} ${(data?.containerType === 'POTE' || (data?.itemName || '').includes('POTE')) ? 'Kg' : 'Lts'}</td>
            <td><span style="background:#e0f2fe; padding:2px 6px; border-radius:4px; font-size:10px; color:#0369a1;">${batchInfo}</span></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td style="font-weight:700">Envase: ${(data?.containerType === 'POTE' || (data?.itemName || '').includes('POTE')) ? `POTE ${data?.presentation || 5}KG` : `BIDON ${data?.presentation || 20}L`} (${data?.brandPote || data?.brandBidon || 'H2O'})</td>
            <td>${data?.quantity || 0} Unidades</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td style="font-weight:700">Tapas / Etiquetas</td>
            <td>${data?.quantity || 0} Unidades</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    `;
  } else if (type === 'OD') {
    itemsHtml = `
      <h3>Detalle del Despacho</h3>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Presentación</th>
            <th>Lote</th>
            <th>Cant. Pedida</th>
            <th>Verificado y Cargado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight:700">${productName}</td>
            <td>${data?.presentation || '-'}</td>
            <td><span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:10px;">${batchInfo}</span></td>
            <td><b>${data?.quantity || 0}</b></td>
            <td>[ &nbsp;&nbsp;&nbsp; ] SÍ, CONFORME</td>
          </tr>
        </tbody>
      </table>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title} - ${batchInfo}</title>
        ${style}
      </head>
      <body>
        <div class="header-container">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="80" valign="middle">
                <div class="h2o-logo-box">
                  <span class="h2o-logo-big">H₂O</span>
                  <span class="h2o-logo-small">CONTROL</span>
                </div>
              </td>
              <td valign="middle" style="text-align:center;">
                <p class="header-title">${title}</p>
                <p class="header-sub">Generado en sistema el ${dateStr}</p>
              </td>
              <td width="80"></td>
            </tr>
          </table>
        </div>
        
        <div class="meta-card">
          <div class="meta-item">
            <div class="meta-label">Producto</div>
            <div class="meta-value">${productName}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Lote Objetivo</div>
            <div class="meta-value" style="color: #2563eb;">${batchInfo}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Cantidad Teórica</div>
            <div class="meta-value">${quantity}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Cliente / Prov / Sector</div>
            <div class="meta-value">${data?.clientName || data?.company || 'General / Interno'}</div>
          </div>
          ${data?.clientLot ? `
          <div class="meta-item">
            <div class="meta-label" style="color: #0f766e;">Lote Personalizado Cliente</div>
            <div class="meta-value" style="color: #0f766e;">${data.clientLot}</div>
          </div>` : `
          <div class="meta-item">
            <div class="meta-label">Destino / Tanque</div>
            <div class="meta-value">${data?.tank || 'No aplica'}</div>
          </div>
          `}
        </div>

        ${itemsHtml}

        <div class="observaciones">
          <div class="obs-title">Observaciones</div>
        </div>

        <div class="signatures">
          <div class="signature-box">
            <p>Operario / Ejecutor</p>
            <span>Firma y Aclaración</span>
          </div>
          <div class="signature-box">
            <p>Control de Calidad (Laboratorio)</p>
            <span>Firma y Sello BBS</span>
          </div>
          <div class="signature-box">
            <p>Supervisión de Planta</p>
            <span>Firma y Sello</span>
          </div>
        </div>
        
        <div class="footer">
          Documento emitido mediante H2O Control · Powered by VAMO'apps
        </div>
      </body>
    </html>
  `;
};

export const executePrint = async (html, documentTitle = 'H2O Control - Documento') => {
  try {
    if (Platform.OS === 'web') {
      const toolbarHtml = `
        <div class="h2o-web-toolbar">
          <div class="h2o-toolbar-info">
            <span class="h2o-toolbar-badge">H2O CONTROL</span>
            <span class="h2o-toolbar-title">${documentTitle}</span>
          </div>
          <div class="h2o-toolbar-hint">
            💡 Para enviar por WhatsApp o guardar: pulsa <strong>Imprimir / Guardar PDF</strong> y selecciona <em>"Guardar como PDF"</em> en Destino.
          </div>
          <div class="h2o-toolbar-actions">
            <button onclick="window.print()" class="h2o-btn-print" title="Abrir cuadro de impresión o guardar como PDF">
              🖨️ Imprimir / Guardar PDF
            </button>
            <button onclick="window.close()" class="h2o-btn-close" title="Cerrar esta vista">
              ✕ Cerrar
            </button>
          </div>
        </div>
      `;

      const toolbarStyles = `
        <style>
          @media print {
            .h2o-web-toolbar {
              display: none !important;
            }
          }
          .h2o-web-toolbar {
            position: sticky;
            top: 0;
            left: 0;
            right: 0;
            background: #0f172a;
            color: #f8fafc;
            padding: 12px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 4px 14px rgba(0,0,0,0.25);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            border-bottom: 2px solid #2563eb;
            gap: 16px;
          }
          .h2o-toolbar-info {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .h2o-toolbar-badge {
            background-color: #2563eb;
            color: #ffffff;
            font-size: 11px;
            font-weight: 800;
            padding: 3px 8px;
            border-radius: 4px;
            letter-spacing: 0.5px;
          }
          .h2o-toolbar-title {
            font-size: 14px;
            font-weight: 700;
            color: #e2e8f0;
          }
          .h2o-toolbar-hint {
            font-size: 12px;
            color: #94a3b8;
            background-color: rgba(255,255,255,0.06);
            padding: 6px 12px;
            border-radius: 6px;
            border: 1px solid rgba(255,255,255,0.1);
          }
          .h2o-toolbar-hint strong {
            color: #60a5fa;
          }
          .h2o-toolbar-hint em {
            color: #fde047;
            font-style: normal;
            font-weight: 600;
          }
          .h2o-toolbar-actions {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .h2o-btn-print {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: #ffffff;
            border: none;
            padding: 8px 18px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 2px 6px rgba(37,99,235,0.4);
            transition: all 0.2s;
          }
          .h2o-btn-print:hover {
            background: #1d4ed8;
            transform: translateY(-1px);
          }
          .h2o-btn-close {
            background-color: #334155;
            color: #cbd5e1;
            border: 1px solid #475569;
            padding: 8px 14px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }
          .h2o-btn-close:hover {
            background-color: #475569;
            color: #ffffff;
          }
          @media (max-width: 768px) {
            .h2o-web-toolbar {
              flex-direction: column;
              align-items: stretch;
              gap: 10px;
              padding: 10px 14px;
            }
            .h2o-toolbar-hint {
              font-size: 11px;
            }
            .h2o-toolbar-actions {
              justify-content: flex-end;
            }
          }
        </style>
      `;

      let finalHtml = html;
      if (finalHtml.includes('</head>')) {
        finalHtml = finalHtml.replace('</head>', `${toolbarStyles}</head>`);
      } else {
        finalHtml = toolbarStyles + finalHtml;
      }

      if (finalHtml.includes('<body')) {
        finalHtml = finalHtml.replace(/<body[^>]*>/, `$&${toolbarHtml}`);
      } else {
        finalHtml = toolbarHtml + finalHtml;
      }

      if (documentTitle) {
        if (finalHtml.includes('<title>')) {
          finalHtml = finalHtml.replace(/<title>.*?<\/title>/i, `<title>${documentTitle}</title>`);
        } else if (finalHtml.includes('<head>')) {
          finalHtml = finalHtml.replace('<head>', `<head><title>${documentTitle}</title>`);
        }
      }

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(finalHtml);
        printWindow.document.close();
        if (documentTitle) {
          printWindow.document.title = documentTitle;
        }

        const triggerPrint = () => {
          try {
            printWindow.focus();
            printWindow.print();
          } catch (e) {
            console.warn('Trigger print error in window:', e);
          }
        };

        if (printWindow.document.readyState === 'complete') {
          setTimeout(triggerPrint, 350);
        } else {
          printWindow.onload = () => setTimeout(triggerPrint, 350);
          setTimeout(triggerPrint, 700);
        }
      } else {
        window.print();
      }
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: documentTitle || 'Enviar o Imprimir Documento',
        });
      } else {
        await Print.printAsync({ html });
      }
    }
  } catch (error) {
    console.error('Error al ejecutar impresión:', error);
    if (Platform.OS === 'web') {
      console.warn('Error en impresión Web:', error);
    } else {
      Alert.alert('Error', 'No se pudo generar el documento.');
    }
  }
};

export const printOrder = async (order) => {
  const html = generateHTML(order);
  const type = order?.type || 'ORDEN';
  const data = order?.data || {};
  const batch = data?.batch || data?.batchInternal || data?.dispatchId || order?.id || '';
  const documentTitle = `H2O_${type}_${batch || 'Doc'}`;
  await executePrint(html, documentTitle);
};

export const generateTraceabilityHTML = (logs, query) => {
  const currentDate = new Date().toLocaleDateString('es-ES', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const tableRows = logs.map(log => {
    const isNegative = Number(log.quantity) < 0;
    const qtyText = `${isNegative ? '' : '+'}${log.quantity} ${log.unit || 'Uds'}`;
    const dateText = log.formattedDate || log.dateObj?.toLocaleString() || '';
    const lot = log.batchInternal || '-';
    const client = log.clientName || log.company || '-';
    const actionName = (log.action || '').replace(/_/g, ' ');
    
    return `
      <tr>
        <td>${dateText}</td>
        <td>${actionName}</td>
        <td><strong>${log.itemName || '-'}</strong></td>
        <td>${lot}</td>
        <td>${client}</td>
        <td style="text-align: right; font-weight: bold; color: ${isNegative ? '#dc2626' : '#16a34a'}">${qtyText}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Reporte de Trazabilidad</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #333;
            margin: 0;
            padding: 40px;
            background-color: #fff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .h2o-logo-box { display: inline-block; width: 60px; height: 60px; border: 3px solid #2563eb; border-radius: 12px; text-align: center; vertical-align: middle; padding-top: 8px; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .h2o-logo-big { display: block; font-size: 16px; font-weight: 900; color: #2563eb; line-height: 1.2; }
          .h2o-logo-small { display: block; font-size: 7px; font-weight: 700; color: #2563eb; letter-spacing: 2px; }
          .doc-info {
            text-align: right;
          }
          .doc-title {
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 5px 0;
            text-transform: uppercase;
          }
          .doc-meta {
            font-size: 12px;
            color: #64748b;
            margin: 2px 0;
          }
          .report-summary {
            background-color: #f8fafc;
            border-left: 4px solid #2563eb;
            padding: 15px 20px;
            margin-bottom: 30px;
            border-radius: 0 8px 8px 0;
          }
          .report-summary p {
            margin: 5px 0;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
            font-size: 12px;
          }
          th {
            background-color: #f1f5f9;
            color: #334155;
            text-transform: uppercase;
            font-size: 11px;
            padding: 12px 15px;
            text-align: left;
            border-bottom: 2px solid #cbd5e1;
          }
          td {
            padding: 12px 15px;
            border-bottom: 1px solid #e2e8f0;
            color: #1e293b;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="h2o-logo-box">
            <span class="h2o-logo-big">H2O</span>
            <span class="h2o-logo-small">CONTROL</span>
          </div>
          <div class="doc-info">
            <h2 class="doc-title">HOJA TÉCNICA DE TRAZABILIDAD</h2>
            <p class="doc-meta">Emisión: <strong>${currentDate}</strong></p>
            <p class="doc-meta">Registros: <strong>${logs.length}</strong></p>
          </div>
        </div>

        <div class="report-summary">
          <p><strong>Criterio de Búsqueda / Filtro:</strong> ${query || 'Todos los registros'}</p>
          <p>Este documento es un reporte consolidado e inalterable generado a partir del registro de movimientos de la bóveda criptográfica del sistema.</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Movimiento</th>
              <th>Producto</th>
              <th>Lote</th>
              <th>Cliente / Origen</th>
              <th style="text-align: right;">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows.length > 0 ? tableRows : '<tr><td colspan="6" style="text-align: center; padding: 30px;">No hay registros para mostrar.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          Documento emitido mediante H2O Control · Powered by VAMO'apps<br>
          <span style="font-size: 8px;">Las firmas de autorización se encuentran alojadas digitalmente en la base de datos segura.</span>
        </div>
      </body>
    </html>
  `;
};

export const printTraceabilityReport = async (logs, query) => {
  const html = generateTraceabilityHTML(logs, query);
  const documentTitle = query ? `H2O_Trazabilidad_${String(query).trim().replace(/\s+/g, '_')}` : 'H2O_Trazabilidad_Reporte';
  await executePrint(html, documentTitle);
};

export const generateStockHTML = ({ title, companyName, stockType, items, filterQuery, activeTab }) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  // Ordenar alfabéticamente de A a Z
  const sortedItems = [...(items || [])].sort((a, b) => {
    const nameA = (a.itemName || '').trim().toUpperCase();
    const nameB = (b.itemName || '').trim().toUpperCase();
    return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
  });

  const totalProducts = sortedItems.length;
  let totalBatches = 0;
  let optimalCount = 0;
  let lowCount = 0;
  let breakCount = 0;

  sortedItems.forEach(item => {
    totalBatches += (item.lotes ? item.lotes.length : 1);
    const qty = Number(item.quantity) || 0;
    const min = Number(item.minStock) || 100;
    if (qty <= 0) breakCount++;
    else if (qty <= min) lowCount++;
    else optimalCount++;
  });

  const tableRows = sortedItems.map((item, index) => {
    const qty = Number(item.quantity) || 0;
    const min = Number(item.minStock) || 100;
    let badgeBg = '#ecfdf5';
    let badgeColor = '#059669';
    let statusText = 'ÓPTIMO';
    if (qty <= 0) {
      badgeBg = '#fef2f2';
      badgeColor = '#dc2626';
      statusText = 'QUIEBRE';
    } else if (qty <= min) {
      badgeBg = '#fffbeb';
      badgeColor = '#d97706';
      statusText = 'P. PEDIDO';
    }

    // Lotes formateados
    const lotesSummary = (item.lotes && item.lotes.length > 0)
      ? item.lotes.map(l => {
          const lNum = l.batchInternal || 'S/D';
          const lQty = Number(l.quantity) || 0;
          return `<span class="lot-pill"><strong>${lNum}</strong>: ${lQty.toFixed(2)} ${l.unit || item.unit || ''}</span>`;
        }).join(' ')
      : '<span style="color: #94a3b8; font-style: italic;">Sin detalle de lotes</span>';

    return `
      <tr>
        <td style="text-align: center; color: #64748b; font-weight: 700; width: 35px;">${index + 1}</td>
        <td>
          <span style="font-weight: 800; color: #0f172a; font-size: 13px;">${item.itemName || 'S/N'}</span>
        </td>
        <td>
          <div class="lots-container">${lotesSummary}</div>
        </td>
        <td style="text-align: right; color: #64748b; font-weight: 600;">
          ${min} ${item.unit || ''}
        </td>
        <td style="text-align: center;">
          <span class="status-badge" style="background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}33;">
            ${statusText}
          </span>
        </td>
        <td style="text-align: right; font-weight: 900; color: #0f172a; font-size: 13px;">
          ${qty.toFixed(2)} <span style="font-size: 10px; color: #64748b;">${item.unit || ''}</span>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>H2O Control - Reporte de Stock</title>
        <style>
          @page { size: A4 portrait; margin: 12mm 15mm; }
          body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif; color: #1e293b; line-height: 1.4; margin: 0; padding: 0; }
          
          /* Header estilo OP */
          .header-container { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
          .header-left { display: flex; align-items: center; gap: 15px; }
          .h2o-logo-box { width: 55px; height: 55px; border: 3px solid #2563eb; border-radius: 12px; text-align: center; vertical-align: middle; padding-top: 6px; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .h2o-logo-big { display: block; font-size: 16px; font-weight: 900; color: #2563eb; line-height: 1.1; }
          .h2o-logo-small { display: block; font-size: 7px; font-weight: 800; color: #2563eb; letter-spacing: 2px; }
          
          .header-text { }
          .header-title { margin: 0; font-size: 18px; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; font-weight: 900; }
          .header-sub { margin: 2px 0 0 0; font-size: 12px; color: #64748b; font-weight: 600; }
          
          .header-right { text-align: right; }
          .badge-type { background-color: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; display: inline-block; }
          .date-text { font-size: 10px; color: #64748b; margin-top: 4px; font-weight: 600; }

          /* Tarjeta de Resumen */
          .meta-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 15px; margin-bottom: 18px; display: flex; justify-content: space-between; gap: 15px; }
          .meta-item { text-align: center; flex: 1; }
          .meta-label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 2px; }
          .meta-value { font-size: 15px; color: #0f172a; font-weight: 900; }

          /* Tablas */
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
          th, td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
          th { background-color: #f1f5f9; font-weight: 800; color: #334155; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; }
          tr:nth-child(even) { background-color: #fafbfc; }
          
          .status-badge { display: inline-block; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.5px; }
          .lots-container { display: flex; flex-wrap: wrap; gap: 4px; }
          .lot-pill { background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px 5px; font-size: 9.5px; color: #334155; display: inline-block; }

          /* Observaciones y Firmas */
          .observaciones { background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px; min-height: 45px; margin-bottom: 25px; }
          .obs-title { font-weight: 800; font-size: 10px; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }

          .signatures { display: flex; justify-content: space-between; margin-top: 25px; gap: 20px; }
          .signature-box { flex: 1; text-align: center; border-top: 1px solid #94a3b8; padding-top: 6px; }
          .signature-box p { margin: 0; font-size: 10.5px; color: #0f172a; font-weight: 800; }
          .signature-box span { font-size: 9px; color: #64748b; }

          .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div class="header-left">
            <div class="h2o-logo-box">
              <span class="h2o-logo-big">H2O</span>
              <span class="h2o-logo-small">CONTROL</span>
            </div>
            <div class="header-text">
              <h1 class="header-title">${title || 'ESTADO GENERAL DE STOCK'}</h1>
              <p class="header-sub">Empresa: <strong>${companyName}</strong> ${activeTab ? `• Categoría: <strong>${activeTab}</strong>` : ''}</p>
            </div>
          </div>
          <div class="header-right">
            <span class="badge-type">TIPO: ${stockType}</span>
            <div class="date-text">Emisión: ${dateStr} - ${timeStr} hs</div>
          </div>
        </div>

        <div class="meta-card">
          <div class="meta-item">
            <div class="meta-label">Total Artículos</div>
            <div class="meta-value">${totalProducts}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Lotes Totales</div>
            <div class="meta-value">${totalBatches}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Stock Óptimo</div>
            <div class="meta-value" style="color: #059669;">${optimalCount}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Puntos de Pedido</div>
            <div class="meta-value" style="color: #d97706;">${lowCount}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Quiebres (Sin Stock)</div>
            <div class="meta-value" style="color: #dc2626;">${breakCount}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">#</th>
              <th>Artículo / Producto (Orden Alfabético)</th>
              <th>Desglose Lotes Activos (Lote: Cant.)</th>
              <th style="text-align: right; width: 90px;">Mínimo Req.</th>
              <th style="text-align: center; width: 85px;">Estado</th>
              <th style="text-align: right; width: 95px;">Stock Total</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="6" style="text-align: center; padding: 20px;">No hay registros en inventario.</td></tr>'}
          </tbody>
        </table>

        <div class="observaciones">
          <div class="obs-title">Observaciones de Auditoría de Planta</div>
          ${filterQuery ? `<p style="margin: 0; font-size: 10px; color: #475569;">Filtro de búsqueda aplicado: <em>"${filterQuery}"</em>.</p>` : ''}
        </div>

        <div class="signatures">
          <div class="signature-box">
            <p>Responsable de Inventario / Stock</p>
            <span>Firma y Aclaración</span>
          </div>
          <div class="signature-box">
            <p>Control de Calidad (Laboratorio)</p>
            <span>Firma y Sello</span>
          </div>
          <div class="signature-box">
            <p>Supervisión de Planta / Logística</p>
            <span>Firma y Aclaración</span>
          </div>
        </div>

        <div class="footer">
          Documento emitido mediante H2O Control · Sistema Integral de Gestión de Planta y Trazabilidad Químico-Industrial.
        </div>
      </body>
    </html>
  `;
};

export const printStockReport = async (options) => {
  const html = generateStockHTML(options);
  const sType = options?.stockType || 'General';
  const cName = options?.companyName ? `_${String(options.companyName).trim().replace(/\s+/g, '_')}` : '';
  const documentTitle = `H2O_Stock_${sType}${cName}`;
  await executePrint(html, documentTitle);
};
