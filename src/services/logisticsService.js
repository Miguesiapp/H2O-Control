import { db } from '../config/firebase';
import { collection, addDoc, updateDoc, doc, increment, serverTimestamp, query, where, getDocs, getDoc, deleteDoc } from 'firebase/firestore';

// Helper: Elimina el documento de inventario si la cantidad llega a 0 o menos
const checkAndCleanupEmptyStock = async (docRef) => {
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const currentQty = snap.data().quantity || 0;
      if (currentQty <= 0) {
        await deleteDoc(docRef);
        console.log(`Lote ${docRef.id} eliminado porque su stock llegó a ${currentQty}`);
      }
    }
  } catch (error) {
    console.error("Error limpiando stock en 0:", error);
  }
};
// ============================================================================
// FUNCIÓN 1: REGISTRAR MOVIMIENTOS (El Director de Orquesta)
// ============================================================================
export const registerMovement = async (userEmail, actionType, company, data) => {
  try {
    // 1. GUARDAR SIEMPRE EN AUDITORÍA (Historial Inalterable)
    const isFuzzyItem = Array.isArray(data.itemName);
    
    await addDoc(collection(db, "AuditLog"), {
      user: userEmail,
      action: actionType,
      company: company,
      itemName: isFuzzyItem ? data.itemName.map(i => Array.isArray(i) ? i.join('|') : i).join(' + ') : data.itemName?.toUpperCase(),
      quantity: data.quantity, // Puede ser positivo o negativo
      unit: data.unit || 'Lts',
      stockType: data.stockType || 'MP',
      batchInternal: data.batchInternal || 'N/A',
      loteProveedor: data.loteProveedor || 'N/A',
      details: data.details || '',
      timestamp: serverTimestamp(),
    });

    const numericQty = Number(data.quantity);
    const inventoryRef = collection(db, "Inventory");
    const itemNameUpper = isFuzzyItem ? data.itemName : data.itemName?.toUpperCase();

    // INTERCEPCIÓN CENTRALIZADA: Si es Materia Prima, va al stock global unificado
    const effectiveCompany = (data.stockType === 'MP') ? 'STOCK_CENTRAL_MP' : company;

    // 2. LÓGICA DE INVENTARIO: ¿Suma o Resta?
    if (numericQty > 0) {
      // ---------------------------------------------------
      // CASO A: INYECCIÓN DE STOCK (Suma)
      // ---------------------------------------------------
      const q = query(
        inventoryRef, 
        where("company", "==", effectiveCompany), 
        where("batchInternal", "==", data.batchInternal),
        where("itemName", "==", itemNameUpper)
      );
      
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // El lote ya existe: Sumamos a la cantidad actual
        const itemDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, "Inventory", itemDoc.id), {
          quantity: increment(numericQty),
          lastUpdated: serverTimestamp()
        });
      } else {
        // Lote totalmente nuevo (Ingresos, Cargas Iniciales, OP nuevas)
        await addDoc(inventoryRef, {
          ...data,
          itemName: itemNameUpper,
          company: effectiveCompany,
          quantity: numericQty,
          stockType: data.stockType || 'MP', 
          status: data.status || 'PENDIENTE', // Vital para que Laboratorio lo vea o lo libere
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp()
        });
      }

    } else if (numericQty < 0) {
      // ---------------------------------------------------
      // ---------------------------------------------------
      const absQty = Number(Math.abs(numericQty).toFixed(2));

      // ENRUTADOR INTELIGENTE: ¿Descuento Exacto o FIFO?
      // NOTA: Insumos (Bidones, Cajas, Etiquetas) siempre usan FIFO porque no comparten el lote del granel.
      const isExactDeduction = 
        !isFuzzyItem && (
          actionType === 'EGRESO_DESPACHO_CLIENTE' || 
          actionType === 'CONSUMO_ENVASADO' ||
          actionType === 'RETIRO_PRODUCCION' ||
          ((actionType === 'EGRESO_CLEARING' || actionType === 'BAJA_POR_AJUSTE') && data.batchInternal && data.batchInternal !== 'S/D')
        );

      if (isExactDeduction) {
        // DESCUENTO EXACTO: Va directo al Lote que el usuario eligió en pantalla
        const qExact = query(
          inventoryRef, 
          where("company", "==", effectiveCompany), 
          where("itemName", "==", itemNameUpper),
          where("batchInternal", "==", data.batchInternal)
        );
        const snapExact = await getDocs(qExact);
        
        if (!snapExact.empty) {
          const itemDoc = snapExact.docs[0];
          const docRef = doc(db, "Inventory", itemDoc.id);
          await updateDoc(docRef, {
            quantity: increment(-absQty),
            lastUpdated: serverTimestamp()
          });
          await checkAndCleanupEmptyStock(docRef);
        } else {
          console.warn(`Alerta: No se encontró el lote exacto ${data.batchInternal} para descontar.`);
        }
      } else {
        // DESCUENTO FIFO: Se usa para Producción o Retiros casuales donde no importa qué tambor se abre primero.
        await deductStockFIFO(effectiveCompany, itemNameUpper, absQty);
      }
    }
  } catch (error) {
    console.error("Error en registerMovement:", error);
    throw error;
  }
};


// ============================================================================
// FUNCIÓN 2: SISTEMA FIFO (Primero en entrar, primero en salir)
// ============================================================================
export const deductStockFIFO = async (company, itemName, quantityToDeduct) => {
  try {
    const inventoryRef = collection(db, "Inventory");
    // Buscamos todos los lotes de este producto que tengan stock físico (> 0)
    let q;
    const isFuzzy = Array.isArray(itemName);
    
    if (isFuzzy) {
      q = query(inventoryRef, where("company", "==", company));
    } else {
      q = query(inventoryRef, where("company", "==", company), where("itemName", "==", itemName));
    }

    const querySnapshot = await getDocs(q);

    const docs = querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(doc => {
        if ((doc.quantity || 0) <= 0) return false;
        // CUARENTENA: No consumir lotes que aún no fueron aprobados por Calidad
        const pendingStatuses = ['PENDIENTE', 'PENDIENTE_LABORATORIO'];
        if (pendingStatuses.includes(doc.status)) return false;
        if (isFuzzy) {
          const name = (doc.itemName || '').toUpperCase();
          return itemName.every(kw => {
            if (Array.isArray(kw)) {
              return kw.some(subKw => name.includes(subKw.toUpperCase()));
            }
            return name.includes(kw.toUpperCase());
          });
        }
        return true;
      });

    if (docs.length === 0) {
      const nameStr = isFuzzy ? itemName.join(' + ') : itemName;
      console.warn(`Alerta FIFO: Se intentó retirar ${nameStr} pero el stock es 0 en ${company}.`);
      return false;
    }

    // Ordenamos en memoria por fecha de creación (Gastamos primero lo más viejo)
    docs.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));

    let remainingToDeduct = quantityToDeduct;

    // Bucle inteligente: vacía lotes antiguos y pasa al siguiente si es necesario
    for (const item of docs) {
      if (remainingToDeduct <= 0) break;

      const availableQty = item.quantity;
      const deduction = Number(Math.min(availableQty, remainingToDeduct).toFixed(2));

      // Actualizamos la base de datos restando lo correspondiente de este lote
      const docRef = doc(db, "Inventory", item.id);
      await updateDoc(docRef, {
        quantity: increment(-deduction),
        lastUpdated: serverTimestamp()
      });
      await checkAndCleanupEmptyStock(docRef);

      remainingToDeduct = Number((remainingToDeduct - deduction).toFixed(2));
    }

    if (remainingToDeduct > 0) {
      console.warn(`Alerta FIFO: Quedaron faltando ${remainingToDeduct} unidades de ${itemName}.`);
    }

    return true;
  } catch (error) {
    console.error("Error al restar stock FIFO:", error);
    throw error;
  }
};

// ============================================================================
// FUNCIÓN 3: CONSULTAR STOCK TOTAL
// ============================================================================
export const checkTotalStock = async (company, itemName) => {
  try {
    const inventoryRef = collection(db, "Inventory");
    let q;
    const isFuzzy = Array.isArray(itemName);

    if (isFuzzy) {
      q = query(inventoryRef, where("company", "==", company));
    } else {
      q = query(inventoryRef, where("company", "==", company), where("itemName", "==", itemName));
    }
    const snap = await getDocs(q);
    let total = 0;
    snap.forEach(doc => {
      const data = doc.data();
      // CUARENTENA: No contar stock que aún no fue aprobado por BBS Calidad
      const pendingStatuses = ['PENDIENTE', 'PENDIENTE_LABORATORIO'];
      if (pendingStatuses.includes(data.status)) return;
      if (data.quantity > 0) {
        if (isFuzzy) {
          const name = (data.itemName || '').toUpperCase();
          if (itemName.every(kw => {
            if (Array.isArray(kw)) {
              return kw.some(subKw => name.includes(subKw.toUpperCase()));
            }
            return name.includes(kw.toUpperCase());
          })) {
            total += Number(data.quantity);
          }
        } else {
          total += Number(data.quantity);
        }
      }
    });
    return total;
  } catch (error) {
    console.error("Error al consultar stock total:", error);
    return 0;
  }
};

// ============================================================================
// FUNCIÓN 4: CREAR ÓRDENES DE TRABAJO (Tickets)
// ============================================================================
export const createOrder = async (orderType, data, userEmail) => {
  try {
    const docRef = await addDoc(collection(db, "Orders"), {
      type: orderType, // 'OP', 'OE', 'OD'
      status: 'ENVIADO',
      data: data,
      createdBy: userEmail,
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    });

    // Guardar traza en auditoría
    await addDoc(collection(db, "AuditLog"), {
      user: userEmail,
      action: `CREACION_ORDEN_${orderType}`,
      orderId: docRef.id,
      timestamp: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error("Error al crear Orden:", error);
    throw error;
  }
};

// ============================================================================
// FUNCIÓN 4: ACTUALIZAR ESTADO DE ÓRDENES
// ============================================================================
export const updateOrderStatus = async (orderId, newStatus, userEmail) => {
  try {
    const updateData = {
      status: newStatus,
      lastUpdated: serverTimestamp(),
    };

    if (newStatus === 'EN_PROCESO') {
      updateData.acceptedBy = userEmail;
      updateData.acceptedAt = serverTimestamp();
    } else if (newStatus === 'FINALIZADO') {
      updateData.finalizedBy = userEmail;
      updateData.finalizedAt = serverTimestamp();
    }

    await updateDoc(doc(db, "Orders", orderId), updateData);

    // Guardar traza
    await addDoc(collection(db, "AuditLog"), {
      user: userEmail,
      action: `CAMBIO_ESTADO_ORDEN`,
      orderId: orderId,
      newStatus: newStatus,
      timestamp: serverTimestamp(),
    });

    return true;
  } catch (error) {
    console.error("Error al actualizar Orden:", error);
    throw error;
  }
};