import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, limit } from 'firebase/firestore';
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkMgo() {
  const inventoryRef = collection(db, 'Inventory');
  const snap = await getDocs(inventoryRef);
  
  console.log("INVENTORY MGO:");
  snap.docs.forEach(doc => {
    const data = doc.data();
    if (data.itemName && (data.itemName.includes("MGO") || data.itemName.includes("MAGNESIO"))) {
      console.log(`- ${data.itemName} (Qty: ${data.quantity})`);
    }
    if (data.itemName && (data.itemName.includes("ZNO") || data.itemName.includes("ZINC"))) {
      console.log(`- ${data.itemName} (Qty: ${data.quantity})`);
    }
  });

  console.log("\nFORMULAS WITH MGO:");
  const formulasRef = collection(db, 'Formulas_Maestras');
  const formSnap = await getDocs(formulasRef);
  
  formSnap.docs.forEach(doc => {
    const data = doc.data();
    const hasMgo = data.ingredients.some(ing => 
      ing.name.includes("MGO") || ing.name.includes("MAGNESIO") || ing.name.includes("ZNO") || ing.name.includes("ZINC")
    );
    if (hasMgo) {
      console.log(`Formula: ${data.productName}`);
      data.ingredients.forEach(ing => {
        if (ing.name.includes("MGO") || ing.name.includes("MAGNESIO") || ing.name.includes("ZNO") || ing.name.includes("ZINC")) {
          console.log(`   Ingrediente: ${ing.name}`);
        }
      });
    }
  });
}

checkMgo().catch(console.error);
