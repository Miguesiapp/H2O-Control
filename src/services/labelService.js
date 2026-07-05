import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const LABEL_STYLE = `
  @page { margin: 0; size: 100mm 150mm; }
  body { 
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
    margin: 0; 
    padding: 0; 
    width: 100mm; 
    height: 150mm; 
    background-color: white;
    color: black;
  }
  .label-container {
    width: 90mm;
    height: 140mm;
    padding: 5mm;
    box-sizing: border-box;
    border: 3px solid black;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    page-break-after: always;
  }
  .header {
    text-align: center;
    border-bottom: 3px solid black;
    padding-bottom: 10px;
    margin-bottom: 15px;
  }
  .brand { font-size: 24px; font-weight: 900; letter-spacing: 2px; }
  .type { font-size: 16px; font-weight: bold; }
  
  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  
  .product-name {
    font-size: 42px;
    font-weight: 900;
    text-align: center;
    text-transform: uppercase;
    line-height: 1.1;
    margin-bottom: 20px;
  }
  
  .info-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 15px;
  }
  
  .info-box {
    border: 2px solid black;
    padding: 10px;
    text-align: center;
  }
  
  .info-label {
    font-size: 14px;
    font-weight: bold;
    text-transform: uppercase;
    margin-bottom: 5px;
  }
  
  .info-value {
    font-size: 28px;
    font-weight: 900;
  }

  .qty-box {
    background-color: black;
    color: white;
    border: 2px solid black;
  }

  .footer {
    text-align: center;
    font-size: 12px;
    font-weight: bold;
    border-top: 2px dashed black;
    padding-top: 10px;
    margin-top: 15px;
  }
`;

const generateLabelHTML = ({ type, name, batch, expiration, quantity, unit }) => {
  const typeText = type === 'MP' ? 'MATERIA PRIMA' : 'PRODUCTO TERMINADO';
  
  return `
    <div class="label-container">
      <div class="header">
        <div class="brand">H2O CONTROL</div>
        <div class="type">${typeText}</div>
      </div>
      
      <div class="content">
        <div class="product-name">${name}</div>
        
        <div class="info-grid">
          <div class="info-box qty-box">
            <div class="info-label">CANTIDAD / SALDO</div>
            <div class="info-value">${quantity} ${unit}</div>
          </div>
          
          <div class="info-box">
            <div class="info-label">LOTE</div>
            <div class="info-value">${batch || 'S/L'}</div>
          </div>
          
          <div class="info-box">
            <div class="info-label">VENCIMIENTO</div>
            <div class="info-value" style="font-size: 22px;">${expiration || 'N/A'}</div>
          </div>
        </div>
      </div>
      
      <div class="footer">
        FECHA IMPRESIÓN: ${new Date().toLocaleDateString()}
      </div>
    </div>
  `;
};

export const printSingleLabel = async (itemData) => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head><style>${LABEL_STYLE}</style></head>
        <body>${generateLabelHTML(itemData)}</body>
      </html>
    `;
    await executePrint(htmlContent, `Etiqueta_${itemData.name}.pdf`);
  } catch (error) {
    console.error("Error al imprimir etiqueta individual:", error);
    throw error;
  }
};

export const printMultipleLabels = async (itemData, count) => {
  try {
    let allLabelsHTML = '';
    for(let i=0; i<count; i++){
      allLabelsHTML += generateLabelHTML(itemData);
    }
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head><style>${LABEL_STYLE}</style></head>
        <body>${allLabelsHTML}</body>
      </html>
    `;
    
    await executePrint(htmlContent, `Etiquetas_${itemData.name}_x${count}.pdf`);
  } catch (error) {
    console.error("Error al imprimir múltiples etiquetas:", error);
    throw error;
  }
};

export const printBatchLabels = async (productData, rawMaterialsData) => {
  try {
    let allLabelsHTML = generateLabelHTML(productData);
    
    rawMaterialsData.forEach(rm => {
      allLabelsHTML += generateLabelHTML(rm);
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head><style>${LABEL_STYLE}</style></head>
        <body>${allLabelsHTML}</body>
      </html>
    `;
    await executePrint(htmlContent, `Lote_${productData.batch}.pdf`);
  } catch (error) {
    console.error("Error al imprimir lote de etiquetas:", error);
    throw error;
  }
};

const executePrint = async (htmlContent, filename) => {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html: htmlContent });
  } else {
    const { uri } = await Print.printToFileAsync({ html: htmlContent, base64: false });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: filename
      });
    } else {
      // Fallback a impresión directa si no se puede compartir
      await Print.printAsync({ uri });
    }
  }
};
