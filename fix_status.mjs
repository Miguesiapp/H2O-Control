import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

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

async function fixStatus() {
  const q = query(collection(db, 'Inventory'), where('stockType', '==', 'INSUMOS'), where('status', '==', 'PENDIENTE'));
  const snap = await getDocs(q);
  console.log('Found ' + snap.size + ' INSUMOS with PENDIENTE status');
  let count = 0;
  for (const docSnap of snap.docs) {
    await updateDoc(doc(db, 'Inventory', docSnap.id), { status: 'APTO' });
    count++;
  }
  console.log('Updated ' + count + ' INSUMOS.');
}

fixStatus().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
