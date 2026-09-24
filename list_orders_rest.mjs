import fetch from 'node-fetch';

const PROJECT_ID = 'h2o-control-a153b';
const API_KEY = 'AIzaSyD9Hi4cke0FVFfklD7fj-Da-5s2USVrV7M';

async function listCollection(collectionId, limit = 5) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionId}?pageSize=${limit}&key=${API_KEY}`;
  const res = await fetch(url);
  return res.json();
}

async function check() {
  // 1. List all collections to see what exists
  console.log('=== Listando documentos en Orders (primeros 5) ===\n');
  const ordersResult = await listCollection('Orders', 5);
  console.log(JSON.stringify(ordersResult, null, 2).slice(0, 3000));
  
  process.exit(0);
}

check().catch(e => { console.error(e.message); process.exit(1); });
