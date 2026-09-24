const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, doc, updateDoc } = require('firebase/firestore');

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

async function fixZurichFormula() {
  const q = query(collection(db, "Formulas_Maestras"), where("status", "==", "ACTIVA"));
  const querySnapshot = await getDocs(q);
  
  for (const document of querySnapshot.docs) {
    const data = document.data();
    if (data.productName.toUpperCase().includes('ZURICH')) {
      console.log("Found:", data.productName);
      if (data.productName.includes('/')) {
        const newName = data.productName.replace('/', '').replace('  ', ' ').trim();
        console.log("Updating to:", newName);
        await updateDoc(doc(db, "Formulas_Maestras", document.id), {
          productName: newName
        });
        console.log("Updated!");
      }
    }
  }
}

require('dotenv').config();
fixZurichFormula();
