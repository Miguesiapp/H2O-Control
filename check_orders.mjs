import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function checkOrders() {
  try {
    await signInWithEmailAndPassword(auth, "produccion@h2ocontrol.com.ar", "123456");
  } catch(e) {}

  const q = query(collection(db, "Orders"), where("type", "==", "OP"));
  const snap = await getDocs(q);
  
  const orders = [];
  snap.forEach(doc => {
    orders.push({ id: doc.id, ...doc.data() });
  });

  orders.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  
  console.log("Recent Orders:");
  orders.slice(0, 5).forEach(o => {
    console.log(`- ID: ${o.id}`);
    console.log(`  Status: ${o.status}`);
    console.log(`  Item: ${o.data?.itemName}`);
    console.log(`  Company: ${o.data?.company}`);
    console.log(`  Date: ${o.createdAt ? new Date(o.createdAt.seconds * 1000).toLocaleString() : 'N/A'}`);
  });
}
checkOrders();
