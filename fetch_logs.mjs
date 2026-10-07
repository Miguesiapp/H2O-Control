import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function main() {
  await signInWithEmailAndPassword(auth, process.env.ADMIN_EMAIL || 'tomas@vamo.uy', process.env.ADMIN_PASSWORD || '123456');
  const q = query(collection(db, "AuditLog"), orderBy("timestamp", "desc"), limit(200));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    const data = doc.data();
    if (data.itemName && (data.itemName.includes("MOMENTUM") || Array.isArray(data.itemName))) {
      const name = Array.isArray(data.itemName) ? data.itemName.join(' ') : data.itemName;
      if (name.includes("MOMENTUM")) {
        console.log(`[${data.timestamp.toDate().toISOString()}] ${data.action} | ${data.company} | ${name} | QTY: ${data.quantity} | TYPE: ${data.stockType} | BATCH: ${data.batchInternal}`);
      }
    }
  });
}
main().catch(console.error);
