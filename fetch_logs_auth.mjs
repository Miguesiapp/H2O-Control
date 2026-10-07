import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
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
const auth = getAuth(app);

async function main() {
  try {
    console.log("Signing in...");
    await signInWithEmailAndPassword(auth, 'tester@h2ocontrol.com', '123456');
    console.log("Signed in successfully!");

    console.log("Fetching recent history for MOMENTUM...");
    const q = query(
      collection(db, "History"),
      orderBy("timestamp", "desc"),
      limit(20)
    );
    
    const snap = await getDocs(q);
    
    snap.forEach(doc => {
      const data = doc.data();
      if (data.itemName && data.itemName.includes("MOMENTUM")) {
        console.log(`\n--- Log ${doc.id} ---`);
        console.log(`Action: ${data.action}`);
        console.log(`Item: ${data.itemName}`);
        console.log(`Quantity: ${data.quantity}`);
        console.log(`Stock Type: ${data.stockType}`);
        console.log(`Time: ${data.timestamp?.toDate()}`);
        console.log(`Batch: ${data.batchInternal}`);
      }
    });
    console.log("Done");
  } catch(e) {
    console.error(e.message);
  }
  process.exit(0);
}

main();
