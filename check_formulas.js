const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');

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

async function checkFormulas() {
  const q = query(collection(db, "Formulas_Maestras"), where("status", "==", "ACTIVA"));
  const querySnapshot = await getDocs(q);
  const data = querySnapshot.docs.map(doc => doc.data().productName);
  
  const zurich = data.filter(name => name.toUpperCase().includes('ZURICH'));
  console.log("Zurich formulas in DB:", JSON.stringify(zurich, null, 2));
}

require('dotenv').config();
checkFormulas();
