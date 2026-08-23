import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const EXACT_NAME = "ATMP / ACIDO AMINOTRIS / METILENFOSFONICO";

// normalize function similar to StockView.js
const normalizeString = (str) => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

async function fixStock() {
  const inventoryRef = collection(db, 'Inventory');
  const q = query(inventoryRef, where("company", "==", "STOCK_CENTRAL_MP"));
  
  const snap = await getDocs(q);
  console.log("Total docs in STOCK_CENTRAL_MP:", snap.docs.length);
  
  let fixed = 0;
  for (const itemDoc of snap.docs) {
    const data = itemDoc.data();
    if (!data.itemName) continue;
    
    // Check if it's ATMP using the same logic as StockView.js
    if (normalizeString(data.itemName).includes("atmp")) {
      console.log(`\nFound ATMP Doc ID: ${itemDoc.id}`);
      console.log(`Current itemName: "${data.itemName}"`);
      
      if (data.itemName !== EXACT_NAME) {
        console.log(`Mismatch detected! Updating to: "${EXACT_NAME}"`);
        await updateDoc(doc(db, "Inventory", itemDoc.id), {
           itemName: EXACT_NAME
        });
        fixed++;
      } else {
        console.log("Name is already perfect.");
      }
    }
  }
  
  console.log(`\nFixed ${fixed} documents.`);
}

fixStock().catch(console.error);
