import fetch from 'node-fetch';

const PROJECT_ID = 'h2o-control-a153b';
const API_KEY = 'AIzaSyD9Hi4cke0FVFfklD7fj-Da-5s2USVrV7M';

// Usamos la REST API de Firestore directamente
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function runQuery(collectionId, filters) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery?key=${API_KEY}`;
  
  const body = {
    structuredQuery: {
      from: [{ collectionId }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'type' },
          op: 'EQUAL',
          value: { stringValue: 'OP' }
        }
      },
      limit: 20
    }
  };
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  return res.json();
}

async function check() {
  console.log('Consultando Orders (type=OP) via REST API...\n');
  
  const results = await runQuery('Orders');
  
  if (!Array.isArray(results)) {
    console.log('Respuesta inesperada:', JSON.stringify(results, null, 2));
    process.exit(0);
  }
  
  const docs = results.filter(r => r.document);
  console.log(`Encontradas: ${docs.length} OPs\n`);
  
  docs.forEach(r => {
    const f = r.document.fields || {};
    const dataFields = f.data?.mapValue?.fields || {};
    const status = f.status?.stringValue || 'N/A';
    const company = dataFields.company?.stringValue || 'N/A';
    const itemName = dataFields.itemName?.stringValue || 'N/A';
    const batchInternal = dataFields.batchInternal?.stringValue || 'N/A';
    const createdAtSec = f.createdAt?.timestampValue;
    const ts = createdAtSec ? new Date(createdAtSec).toLocaleString('es-AR') : 'SIN FECHA';
    const docId = r.document.name.split('/').pop();
    
    console.log(`ID: ${docId}`);
    console.log(`  status: ${status}`);
    console.log(`  data.company: "${company}"`);
    console.log(`  data.itemName: "${itemName}"`);
    console.log(`  data.batchInternal: "${batchInternal}"`);
    console.log(`  createdAt: ${ts}`);
    console.log('---');
  });
  
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
