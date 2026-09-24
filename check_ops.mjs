import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD9Hi4cke0FVFfklD7fj-Da-5s2USVrV7M",
  authDomain: "h2o-control-a153b.firebaseapp.com",
  projectId: "h2o-control-a153b",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkOrders() {
  // Fetch without auth using public rules or just check what's there
  try {
    const snap = await getDocs(query(
      collection(db, "Orders"),
      where("type", "==", "OP"),
      limit(20)
    ));
    
    console.log(`\n=== OPs en Firebase (${snap.size} total) ===\n`);
    snap.forEach(doc => {
      const d = doc.data();
      const ts = d.createdAt?.seconds ? new Date(d.createdAt.seconds * 1000).toLocaleString('es-AR') : 'SIN FECHA';
      console.log(`ID: ${doc.id}`);
      console.log(`  status: ${d.status}`);
      console.log(`  company (top level): ${d.company || 'N/A'}`);
      console.log(`  data.company: ${d.data?.company}`);
      console.log(`  data.itemName: ${d.data?.itemName}`);
      console.log(`  data.batchInternal: ${d.data?.batchInternal}`);
      console.log(`  createdAt: ${ts}`);
      console.log('---');
    });
  } catch (e) {
    console.error('Error (posiblemente por reglas de seguridad):', e.message);
    // Try AuditLog instead to see recent OP creations
    try {
      console.log('\n=== Buscando en AuditLog CREACION_ORDEN_OP ===\n');
      const snapLog = await getDocs(query(
        collection(db, "AuditLog"),
        where("action", "==", "CREACION_ORDEN_OP"),
        limit(20)
      ));
      snapLog.forEach(doc => {
        const d = doc.data();
        const ts = d.timestamp?.seconds ? new Date(d.timestamp.seconds * 1000).toLocaleString('es-AR') : 'SIN FECHA';
        console.log(`ID: ${doc.id}`);
        console.log(`  orderId: ${d.orderId}`);
        console.log(`  itemName: ${d.itemName}`);
        console.log(`  company: ${d.company}`);
        console.log(`  batchInternal: ${d.batchInternal}`);
        console.log(`  timestamp: ${ts}`);
        console.log('---');
      });
    } catch(e2) {
      console.error('Error AuditLog:', e2.message);
    }
  }
  process.exit(0);
}

checkOrders();
