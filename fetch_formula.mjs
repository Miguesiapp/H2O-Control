import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import * as dotenv from "dotenv";

dotenv.config();

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

async function main() {
  console.log("Fetching formulas...");
  const snap = await getDocs(collection(db, "Formulas_Maestras"));
  
  snap.forEach(doc => {
    const data = doc.data();
    if (data.productName && data.productName.toUpperCase().includes("MOMENTUM")) {
      console.log(`Found: ${doc.id}`);
      console.log(JSON.stringify(data, null, 2));
    }
  });
  console.log("Done");
  process.exit(0);
}

main().catch(console.error);
