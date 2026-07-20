import * as Print from 'expo-print';
import { Alert } from 'react-native';

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
    quantity = `${data?.liters || data?.targetVolume || 0} Lts (Aprox. ${data?.kilos || data?.targetKilos || 0} Kg)`;
  } else if (type === 'OE') {
    title = 'ORDEN DE ENVASADO';
    productName = data?.productName || 'Envasado';
    batchInfo = data?.targetBatch || 'S/D';
    quantity = `${data?.quantity || 0} x ${data?.presentation || ''}`;
  } else if (type === 'OD') {
    title = 'ORDEN DE DESPACHO';
    productName = data?.productName || 'Despacho';
    batchInfo = data?.dispatchId || 'S/D';
    quantity = `${data?.quantity || 0}`;
  }

  // Styles
  const style = `
    <style>
      body { font-family: 'Helvetica', 'Arial', sans-serif; margin: 0; padding: 20px; color: #1e293b; }
      .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      .header-table td { border: none; vertical-align: middle; }
      .logo { font-size: 24px; font-weight: 900; color: #0f172a; }
      .logo-blue { color: #0284c7; }
      .title { text-align: center; font-size: 20px; font-weight: 900; letter-spacing: 1px; }
      
      .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; border: 2px solid #0f172a; }
      .meta-table td, .meta-table th { border: 1px solid #94a3b8; padding: 8px 12px; font-size: 13px; }
      .meta-table th { background-color: #f1f5f9; text-align: left; width: 150px; }
      
      .data-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; border: 2px solid #0f172a; }
      .data-table th, .data-table td { border: 1px solid #94a3b8; padding: 8px; font-size: 12px; text-align: center; }
      .data-table th { background-color: #0284c7; color: white; font-weight: bold; }
      .data-table tr:nth-child(even) { background-color: #f8fafc; }
      
      .observaciones { width: 100%; min-height: 100px; border: 2px solid #0f172a; padding: 10px; margin-bottom: 40px; }
      .obs-title { font-weight: bold; font-size: 14px; margin-bottom: 10px; text-decoration: underline; }
      
      .signatures { width: 100%; margin-top: 50px; display: flex; justify-content: space-around; }
      .signature-box { width: 250px; text-align: center; border-top: 1px solid #0f172a; padding-top: 10px; }
    </style>
  `;

  let itemsHtml = '';
  if (type === 'OP') {
    const ingredients = data?.ingredients || data?.needs || [];
    itemsHtml = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Ingrediente</th>
            <th>Especificación (Teórica)</th>
            <th>Lote Asignado / Origen</th>
            <th>Lote Real Usado</th>
            <th>Cantidad Real Consumida</th>
            <th>Operario (Firma)</th>
          </tr>
        </thead>
        <tbody>
          ${ingredients.map(ing => {
            if (ing.type === 'NOTE') return `<tr><td colspan="6" style="text-align:left; background-color:#ffedd5; padding-left:15px"><b>Nota:</b> ${ing.text}</td></tr>`;
            
            let lotesAsignados = '';
            if (ing.batchesToConsume && ing.batchesToConsume.length > 0) {
              lotesAsignados = ing.batchesToConsume.map(b => `${b.batchInternal || 'S/D'} (${b.consumed} ${ing.isGranel ? 'Lts' : 'Kg'})`).join('<br/>');
            } else {
               lotesAsignados = ing.batchInternal || 'A Definir';
            }

            return `
              <tr>
                <td style="text-align:left; font-weight:bold">${ing.name}</td>
                <td>${ing.required || ing.amount || 0} ${ing.isGranel ? 'Lts' : 'Kg'}</td>
                <td>${lotesAsignados}</td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } else if (type === 'OE') {
    itemsHtml = `
      <table class="data-table">
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
          <tr>
            <td style="text-align:left; font-weight:bold">${productName} (Granel)</td>
            <td>${data?.quantity || 0} Lts</td>
            <td>${batchInfo}</td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align:left; font-weight:bold">Envase: ${data?.presentation}</td>
            <td>${data?.quantity || 0} Unidades</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td style="text-align:left; font-weight:bold">Tapas / Etiquetas</td>
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
      <table class="data-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Presentación</th>
            <th>Lote</th>
            <th>Cantidad Pedida</th>
            <th>Verificado y Cargado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align:left; font-weight:bold">${productName}</td>
            <td>${data?.presentation || '-'}</td>
            <td>${batchInfo}</td>
            <td>${data?.quantity || 0}</td>
            <td>[   ] SI</td>
          </tr>
        </tbody>
      </table>
    `;
  }

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        ${style}
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="width: 25%;"><div class="logo">BBS<br/><span style="font-size:12px; font-weight:normal;">Bio Based Solutions</span></div></td>
            <td style="width: 50%;"><div class="title">${title}</div></td>
            <td style="width: 25%; text-align: right;"><div class="logo logo-blue">H2O<br/><span style="font-size:12px; font-weight:bold; letter-spacing:3px;">CONTROL</span></div></td>
          </tr>
        </table>
        
        <table class="meta-table">
          <tr>
            <th>Producto:</th><td>${productName}</td>
            <th>Lote Objetivo:</th><td>${batchInfo}</td>
          </tr>
          <tr>
            <th>Cliente / Proveedor:</th><td>${data?.clientName || data?.company || 'General / Interno'}</td>
            <th>Cantidad Teórica:</th><td>${quantity}</td>
          </tr>
          <tr>
            <th>Fecha de Emisión:</th><td>${dateStr}</td>
            <th>Tanque / Ubicación:</th><td>${data?.tank || 'No aplica'}</td>
          </tr>
        </table>

        ${itemsHtml}

        <div class="observaciones">
          <div class="obs-title">Observaciones / Novedades del Turno:</div>
          <br/><br/><br/>
        </div>

        <div class="signatures">
          <div class="signature-box">
            Firma Operario / Ejecutor<br/><br/>
            <span style="font-size: 11px;">Nombre: _______________________</span>
          </div>
          <div class="signature-box">
            Supervisión / Control de Calidad<br/><br/>
            <span style="font-size: 11px;">Firma y Sello</span>
          </div>
        </div>
      </body>
    </html>
  `;
};

export const printOrder = async (order) => {
  try {
    const html = generateHTML(order);
    await Print.printAsync({
      html,
    });
  } catch (error) {
    console.error('Error printing:', error);
    Alert.alert('Error', 'No se pudo generar la impresión.');
  }
};
