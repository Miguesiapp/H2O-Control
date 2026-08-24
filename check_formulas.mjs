import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query, where } from 'firebase/firestore';
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkFormulas() {
  const formulasRef = collection(db, 'Formulas_Maestras');
  const snap = await getDocs(query(formulasRef, where("status", "==", "ACTIVA"), limit(5)));
  
  snap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`\nFormula: ${data.productName}`);
    console.log(`densidad: ${data.densidad}`);
    console.log(`densidadObjetivo: ${data.densidadObjetivo}`);
    console.log(`Ingredients:`, data.ingredients.slice(0, 2));
  });
}

checkFormulas().catch(console.error);
