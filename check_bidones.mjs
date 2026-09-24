import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

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

async function check() {
  const q = query(
    collection(db, "Inventory"),
    where("company", "==", "STOCK_CENTRAL_INSUMOS")
  );
  
  const snap = await getDocs(q);
  const items = snap.docs.map(d => d.data());
  
  const bidones = items.filter(i => i.itemName && i.itemName.toUpperCase().includes('BIDON'));
  
  const bidonSummary = {};
  bidones.forEach(b => {
    const name = b.itemName.toUpperCase();
    if (!bidonSummary[name]) {
      bidonSummary[name] = 0;
    }
    bidonSummary[name] += Number(b.quantity);
  });
  
  console.log("=== BIDONES EN STOCK CENTRAL ===");
  Object.entries(bidonSummary).forEach(([name, qty]) => {
    console.log(`${name}: ${qty} Uds`);
  });
  
  process.exit(0);
}

check();
