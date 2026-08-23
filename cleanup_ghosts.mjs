import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanupGhosts() {
  console.log("Fetching all inventory to clean up ghosts...");
  const inventoryRef = collection(db, 'Inventory');
  const snap = await getDocs(inventoryRef);
  
  let deletedCount = 0;
  
  for (const itemDoc of snap.docs) {
    const data = itemDoc.data();
    if (data.quantity !== undefined && data.quantity <= 0) {
      console.log(`Deleting ghost item: ${data.itemName || 'Unknown'} (Qty: ${data.quantity}) ID: ${itemDoc.id}`);
      await deleteDoc(doc(db, "Inventory", itemDoc.id));
      deletedCount++;
    }
  }
  
  console.log(`\nCleanup complete! Deleted ${deletedCount} ghost documents.`);
}

cleanupGhosts().catch(console.error);
