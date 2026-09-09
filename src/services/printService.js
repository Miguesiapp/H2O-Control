import * as Print from 'expo-print';
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
    quantity = `${data?.liters || data?.targetVolume || 0} Lts (Aprox. ${Number(data?.kilos || data?.targetKilos || 0).toFixed(2)} Kg)`;
  } else if (type === 'OE') {
    title = 'ORDEN DE ENVASADO';
    // itemName tiene formato "PRODUCTO COMERCIAL - 20L", extraemos solo el nombre
    const rawItemName = data?.itemName || '';
    productName = rawItemName.includes(' - ') 
      ? rawItemName.split(' - ').slice(0, -1).join(' - ')  // quitar solo la parte final " - XL"
      : (data?.productName || data?.commercialName || rawItemName || 'Envasado');
    batchInfo = data?.batchInternal || data?.targetBatch || 'S/D';
    quantity = `${data?.quantity || 0} x ${data?.presentation || ''}L`;
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
              lotesAsignados = ing.batchesToConsume.map(b => `${b.batchInternal || 'S/D'} (${b.consumed} ${ing.isGranel ? 'Lts' : 'Kg'})`).join('<br/>');
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
  } else if (type === 'OE') {
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
            <td>${productName} (Granel)</td>
            <td>${data?.litersConsumed || data?.quantity || 0} Lts</td>
            <td><span style="background:#e0f2fe; padding:2px 6px; border-radius:4px; font-size:10px; color:#0369a1;">${batchInfo}</span></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td style="font-weight:700">Envase: ${data?.presentation}</td>
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
          <div class="meta-item">
            <div class="meta-label">Destino / Tanque</div>
            <div class="meta-value">${data?.tank || 'No aplica'}</div>
          </div>
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
          Documento emitido mediante H2O Neural Control · Bio Based Solutions
        </div>
      </body>
    </html>
  `;
};

export const printOrder = async (order) => {
  try {
    const html = generateHTML(order);
    
    if (Platform.OS === 'web') {
      // Usamos un iframe oculto para no abrir ni dejar tabs adicionales
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();
        // Esperar a que cargue el contenido y luego imprimir
        iframe.onload = () => {
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } catch(e) {
            console.warn('iframe print error', e);
          } finally {
            // Remover el iframe después de imprimir (con un pequeño delay)
            setTimeout(() => {
              document.body.removeChild(iframe);
            }, 1000);
          }
        };
      } else {
        document.body.removeChild(iframe);
        Alert.alert("Error", "No se pudo generar el documento de impresión.");
      }
    } else {
      await Print.printAsync({
        html,
      });
    }
  } catch (error) {
    console.error('Error printing:', error);
    if (Platform.OS === 'web') {
      console.warn('Error: No se pudo generar la impresión en Web.');
    } else {
      Alert.alert('Error', 'No se pudo generar la impresión.');
    }
  }
};
