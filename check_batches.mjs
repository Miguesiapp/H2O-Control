import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, getDocs, orderBy, limit, where } from 'firebase/firestore';
import 'dotenv/config';

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

async function checkStock() {
  const q = query(
    collection(db, "Inventory"),
    orderBy("createdAt", "desc"),
    limit(10)
  );
  
  const snap = await getDocs(q);
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`- ${data.itemName} | Int: ${data.batchInternal} | Prov: ${data.batchProvider || data.loteProveedor} | Qty: ${data.quantity}`);
  });
  process.exit(0);
}

checkStock().catch(console.error);
