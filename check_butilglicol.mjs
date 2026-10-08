import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import * as dotenv from 'dotenv';
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

async function check() {
    await signInWithEmailAndPassword(auth, "tester@h2ocontrol.com", "H2oControl2024!");
    
    console.log("=== INVENTORY ===");
    const invRef = collection(db, "Inventory");
    const snap = await getDocs(invRef);
    snap.forEach(doc => {
        const d = doc.data();
        if (d.itemName && d.itemName.toUpperCase().includes("BUTIL")) {
            console.log(doc.id, d.itemName, d.quantity, d.status, d.company, d.stockType, d.batchInternal);
        }
    });

    console.log("\n=== LOGS ===");
    const logsRef = collection(db, "AuditLog");
    const snapLogs = await getDocs(logsRef);
    snapLogs.forEach(doc => {
        const d = doc.data();
        if (d.itemName && d.itemName.toUpperCase().includes("BUTIL")) {
            console.log(doc.id, d.action, d.quantity, d.status, d.itemName, d.company);
        }
    });
    
    process.exit(0);
}
check();
