import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkStock() {
  const inventoryRef = collection(db, 'Inventory');
  const q = query(inventoryRef, where("company", "==", "STOCK_CENTRAL_MP"));
  
  const snap = await getDocs(q);
  console.log("Total docs in STOCK_CENTRAL_MP:", snap.docs.length);
  
  snap.docs.forEach(doc => {
    const data = doc.data();
    if (data.itemName && data.itemName.includes("ATMP")) {
      console.log("\nFound ATMP Doc:");
      console.log("ID:", doc.id);
      console.log("itemName:", `"${data.itemName}"`);
      console.log("quantity:", data.quantity);
      console.log("status:", `"${data.status}"`);
      console.log("batchInternal:", `"${data.batchInternal}"`);
    }
  });
}

checkStock().catch(console.error);
