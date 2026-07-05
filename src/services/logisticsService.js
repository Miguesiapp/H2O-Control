import { db } from '../config/firebase';
import { collection, addDoc, updateDoc, doc, increment, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

// ============================================================================
// FUNCIÓN 1: REGISTRAR MOVIMIENTOS (El Director de Orquesta)
// ============================================================================
export const registerMovement = async (userEmail, actionType, company, data) => {
  try {
    // 1. GUARDAR SIEMPRE EN AUDITORÍA (Historial Inalterable)
    await addDoc(collection(db, "AuditLog"), {
      user: userEmail,
      action: actionType,
      company: company,
      itemName: data.itemName?.toUpperCase(),
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
    const itemNameUpper = data.itemName?.toUpperCase();

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
      // CASO B: EXTRACCIÓN DE STOCK (Resta)
      // ---------------------------------------------------
      const absQty = Math.abs(numericQty);

      // ENRUTADOR INTELIGENTE: ¿Descuento Exacto o FIFO?
      const isExactDeduction = 
        actionType === 'EGRESO_DESPACHO_CLIENTE' || 
        actionType === 'CONSUMO_ENVASADO' ||
        (actionType === 'EGRESO_CLEARING' && data.batchInternal && data.batchInternal !== 'S/D');

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
          await updateDoc(doc(db, "Inventory", itemDoc.id), {
            quantity: increment(-absQty),
            lastUpdated: serverTimestamp()
          });
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
    const q = query(
      inventoryRef,
      where("company", "==", company),
      where("itemName", "==", itemName),
      where("quantity", ">", 0)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.warn(`Alerta FIFO: Se intentó retirar ${itemName} pero el stock es 0 en ${company}.`);
      return false;
    }

    // Ordenamos en memoria por fecha de creación (Gastamos primero lo más viejo)
    const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    docs.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));

    let remainingToDeduct = quantityToDeduct;

    // Bucle inteligente: vacía lotes antiguos y pasa al siguiente si es necesario
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
      console.warn(`Alerta FIFO: Quedaron faltando ${remainingToDeduct} unidades de ${itemName}.`);
    }

    return true;
  } catch (error) {
    console.error("Error al restar stock FIFO:", error);
    throw error;
  }
};

// ============================================================================
// FUNCIÓN 3: CREAR ÓRDENES DE TRABAJO (Tickets)
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