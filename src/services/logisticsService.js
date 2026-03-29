import { db } from '../config/firebase';
import { collection, addDoc, updateDoc, doc, increment, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

// FUNCIÓN 1: REGISTRAR O SUMAR STOCK (Ya la tenías)
export const registerMovement = async (userEmail, type, company, data) => {
  try {
    await addDoc(collection(db, "AuditLog"), {
      user: userEmail,
      action: type,
      company: company,
      itemName: data.itemName,
      quantity: data.quantity,
      batchInternal: data.batchInternal,
      timestamp: serverTimestamp(),
    });

    const inventoryRef = collection(db, "Inventory");
    const q = query(
      inventoryRef, 
      where("company", "==", company), 
      where("batchInternal", "==", data.batchInternal),
      where("stockType", "==", data.stockType || 'MP') 
    );
    
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const itemDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "Inventory", itemDoc.id), {
        quantity: increment(Number(data.quantity)),
        lastUpdated: serverTimestamp()
      });
    } else {
      await addDoc(inventoryRef, {
        ...data,
        company: company,
        quantity: Number(data.quantity),
        stockType: data.stockType || 'MP', 
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });
    }
  } catch (error) {
    console.error("Error en registerMovement:", error);
    throw error;
  }
};

// FUNCIÓN 2: RESTAR STOCK (La nueva joya del sistema)
export const deductStock = async (company, itemName, quantity, batchInternal, stockType) => {
  try {
    const inventoryRef = collection(db, "Inventory");
    const q = query(
      inventoryRef,
      where("company", "==", company),
      where("itemName", "==", itemName),
      where("batchInternal", "==", batchInternal),
      where("stockType", "==", stockType)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const itemDoc = querySnapshot.docs[0];
      const currentQty = itemDoc.data().quantity;

      // Restamos la cantidad
      await updateDoc(doc(db, "Inventory", itemDoc.id), {
        quantity: increment(-Number(quantity)),
        lastUpdated: serverTimestamp()
      });
      
      return true;
    } else {
      console.warn(`No se encontró stock para restar: ${itemName} Lote: ${batchInternal}`);
      return false;
    }
  } catch (error) {
    console.error("Error al restar stock:", error);
    throw error;
  }
};