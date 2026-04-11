import { db } from '../config/firebase';
import { collection, addDoc, updateDoc, doc, increment, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

// FUNCIÓN 1: REGISTRAR MOVIMIENTOS (El Director de Orquesta)
export const registerMovement = async (userEmail, type, company, data) => {
  try {
    // 1. Guardar siempre en el Historial de Auditoría (Inalterable)
    await addDoc(collection(db, "AuditLog"), {
      user: userEmail,
      action: type,
      company: company,
      itemName: data.itemName?.toUpperCase(),
      quantity: data.quantity, // Puede ser positivo o negativo
      unit: data.unit || 'Lts',
      batchInternal: data.batchInternal || 'N/A',
      loteProveedor: data.loteProveedor || 'N/A',
      timestamp: serverTimestamp(),
    });

    const numericQty = Number(data.quantity);
    const inventoryRef = collection(db, "Inventory");

    // 2. Lógica de Inyección vs Deducción
    if (numericQty > 0) {
      // INGRESO: Buscamos si por casualidad se está editando un lote exacto
      const q = query(
        inventoryRef, 
        where("company", "==", company), 
        where("batchInternal", "==", data.batchInternal),
        where("itemName", "==", data.itemName?.toUpperCase())
      );
      
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Sumar al existente
        const itemDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, "Inventory", itemDoc.id), {
          quantity: increment(numericQty),
          lastUpdated: serverTimestamp()
        });
      } else {
        // Lote totalmente nuevo (Lo normal en ingresos por compras/remitos)
        await addDoc(inventoryRef, {
          ...data,
          itemName: data.itemName?.toUpperCase(),
          company: company,
          quantity: numericQty,
          stockType: data.stockType || 'MP', 
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp()
        });
      }
    } else if (numericQty < 0) {
      // RETIRO CASUAL: Descontamos usando el sistema FIFO
      await deductStockFIFO(company, data.itemName?.toUpperCase(), Math.abs(numericQty));
    }
  } catch (error) {
    console.error("Error en registerMovement:", error);
    throw error;
  }
};

// FUNCIÓN 2: RESTAR STOCK CON SISTEMA FIFO (Primero en entrar, primero en salir)
export const deductStockFIFO = async (company, itemName, quantityToDeduct) => {
  try {
    const inventoryRef = collection(db, "Inventory");
    // Buscamos todos los lotes de este producto que tengan stock disponible
    const q = query(
      inventoryRef,
      where("company", "==", company),
      where("itemName", "==", itemName),
      where("quantity", ">", 0)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.warn(`🚨 Alerta: Se intentó retirar ${itemName} pero no hay stock registrado en ${company}.`);
      return false;
    }

    // Ordenamos en memoria por fecha de creación (FIFO) para gastar primero lo más viejo
    const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    docs.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));

    let remainingToDeduct = quantityToDeduct;

    // Empezamos a vaciar los lotes desde el más antiguo al más nuevo
    for (const item of docs) {
      if (remainingToDeduct <= 0) break;

      const availableQty = item.quantity;
      const deduction = Math.min(availableQty, remainingToDeduct);

      // Actualizamos la base de datos restando lo correspondiente de este lote
      await updateDoc(doc(db, "Inventory", item.id), {
        quantity: increment(-deduction),
        lastUpdated: serverTimestamp()
      });

      remainingToDeduct -= deduction;
    }

    if (remainingToDeduct > 0) {
      console.warn(`⚠️ Se retiró todo el stock posible, pero quedaron faltando ${remainingToDeduct} unidades de ${itemName}.`);
    }

    return true;
  } catch (error) {
    console.error("Error al restar stock FIFO:", error);
    throw error;
  }
};