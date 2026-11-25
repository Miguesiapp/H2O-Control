import { db } from '../config/firebase';
import { collection, addDoc, updateDoc, doc, increment, serverTimestamp, query, where, getDocs, getDoc, deleteDoc } from 'firebase/firestore';
import { PRODUCT_SYNONYMS, getDistributorFromText, KNOWN_DISTRIBUTOR_BRANDS } from '../config/constants';

const normalizeNoAccent = (s) => {
  if (!s) return '';
  if (Array.isArray(s)) return s.map(i => Array.isArray(i) ? i[0] : i).filter(Boolean).join(' ').toUpperCase();
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
};

const hasToken = (docName, tokens) => {
  const name = normalizeNoAccent(docName);
  const list = Array.isArray(tokens) ? tokens : [tokens];
  return list.some(t => {
    if (!t) return false;
    const tClean = normalizeNoAccent(t);
    if (!tClean) return false;
    const escaped = tClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`, 'i');
    return regex.test(name);
  });
};

const extractLabelProductName = (docName) => {
  let s = normalizeNoAccent(docName);
  // Quitar prefijo de etiqueta
  s = s.replace(/^ETIQUETAS?\s*[:\-]?\s*/i, '');
  // Quitar tipo de envase si está mencionado
  s = s.replace(/\b(BIDON|BIDONES|POTE|POTES|BOTELLA|BOTELLAS|TAMBOR|TAMBORES|IBC|CONTENEDOR)\b/gi, ' ');
  // Quitar capacidades (20L, 20 L, 20 LTS, 20-L, 5KG, 1L, etc.) en cualquier parte
  s = s.replace(/(^|[^A-Z0-9])(20|10|5|1)\s*(LTS?|L|KGS?|KG|K|LITROS?)\b\.?/gi, ' ');
  // Quitar sufijos o marcas corporativas como H2O, H2O CONTROL, (H2O), - H2O
  s = s.replace(/\b(H2O(\s*CONTROL)?)\b/gi, ' ');
  // Limpiar signos de puntuación iniciales o finales (guiones, paréntesis, etc.)
  s = s.replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/gi, '');
  return s.replace(/\s+/g, ' ').trim();
};

// Helper para verificar coincidencia difusa precisa (especialmente etiquetas e insumos con marcas de clientes)
export const matchesFuzzyItem = (docItemName, fuzzyFilter) => {
  if (!docItemName || !fuzzyFilter || typeof docItemName !== 'string') return false;
  const name = normalizeNoAccent(docItemName);

  // Si es búsqueda de etiquetas: ['ETIQUETA', capacityKeywords, labelKeywords]
  const isLabelSearch = Array.isArray(fuzzyFilter) && fuzzyFilter.length > 0 && normalizeNoAccent(fuzzyFilter[0]) === 'ETIQUETA';
  if (isLabelSearch) {
    // 1. Debe ser una etiqueta
    if (!name.includes('ETIQUETA') && !name.includes('ETIQ')) return false;

    // 2. Capacidad debe coincidir con límites de palabra (evita que 20L RESTART M1 coincida con 1L)
    const capKeywords = Array.isArray(fuzzyFilter[1]) ? fuzzyFilter[1] : [fuzzyFilter[1]];
    if (!hasToken(name, capKeywords)) return false;

    // 3. El nombre del producto en la etiqueta debe coincidir exactamente con alguno de los alias válidos del producto
    const targetKeywords = Array.isArray(fuzzyFilter[2]) ? fuzzyFilter[2] : [fuzzyFilter[2]];
    const docProd = extractLabelProductName(name);
    return targetKeywords.some(subKw => {
      if (!subKw) return false;
      const kwNorm = extractLabelProductName(subKw);

      // Si el objetivo es un producto general (sin distribuidor), no debe coincidir con etiquetas de distribuidores
      const kwHasDistributor = (KNOWN_DISTRIBUTOR_BRANDS || []).some(d => kwNorm.includes(d));
      const docHasDistributor = (KNOWN_DISTRIBUTOR_BRANDS || []).some(d => docProd.includes(d));

      if (!kwHasDistributor && docHasDistributor) return false;
      if (kwHasDistributor && !docHasDistributor) return false;

      return docProd === kwNorm || docProd.replace(/\b(OIL)\b/g, '').trim() === kwNorm;
    });
  }

  // Comportamiento general para otros insumos (Bidones, Potes, Cajas) y productos con límites de palabra
  return fuzzyFilter.filter(Boolean).every(kw => {
    if (Array.isArray(kw)) {
      const validSubs = kw.filter(Boolean);
      if (validSubs.length === 0) return true;
      return hasToken(name, validSubs);
    }
    return hasToken(name, kw) || name.includes(normalizeNoAccent(kw));
  });
};

// Helper: Limpia documentos de insumos en 0, pero preserva MP y GRANEL en 0 para no perder su historial de BBS Calidad
const checkAndCleanupEmptyStock = async (docRef) => {
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const currentQty = Number(data.quantity) || 0;
      if (currentQty <= 0) {
        const isMPorGranel = data.stockType === 'MP' || data.stockType === 'GRANEL';
        if (isMPorGranel || data.authorizedAt || data.measuredPh || data.measuredDensity) {
          // No eliminar de Firestore para preservar el historial de Calidad BBS; fijar quantity en 0
          if (currentQty < 0) {
            await updateDoc(docRef, { quantity: 0 });
          }
        } else {
          await deleteDoc(docRef);
          console.log(`Lote de insumo/PT ${docRef.id} eliminado porque su stock llegó a ${currentQty}`);
        }
      }
    }
  } catch (error) {
    console.error("Error limpiando stock en 0:", error);
  }
};

// Helper: Barre y elimina todos los documentos con cantidad <= 0 de un ítem
export const cleanupNegativeStock = async (company, itemName) => {
  try {
    const q = query(
      collection(db, "Inventory"),
      where("company", "==", company),
      where("itemName", "==", itemName)
    );
    const snap = await getDocs(q);
    const toDelete = snap.docs.filter(d => (d.data().quantity || 0) <= 0);
    for (const d of toDelete) {
      await deleteDoc(doc(db, "Inventory", d.id));
      console.log(`Limpieza: eliminado lote negativo ${d.id} de ${itemName}`);
    }
    return toDelete.length;
  } catch (error) {
    console.error("Error en cleanupNegativeStock:", error);
    return 0;
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
    const itemNameStr = isFuzzyItem 
      ? data.itemName.map(i => Array.isArray(i) ? i.join('|') : i).join(' + ') 
      : (data.itemName || '').toUpperCase();

    // INTERCEPCIÓN CENTRALIZADA: Clasificación de Insumos vs MP vs PT
    const isItemInsumo = 
      data.stockType === 'INSUMOS' || 
      data.stockType === 'ENVASES' ||
      (data.category || '').toUpperCase().includes('ETIQUET') || 
      (data.category || '').toUpperCase().includes('BIDON') || 
      (data.category || '').toUpperCase().includes('POTE') || 
      (data.category || '').toUpperCase().includes('CAJA') ||
      itemNameStr.includes('ETIQUET') || 
      itemNameStr.includes('BIDON') || 
      itemNameStr.includes('POTE') || 
      itemNameStr.includes('CAJA');

    let effectiveCompany = company;
    let effectiveStockType = data.stockType || 'MP';
    let effectiveStatus = data.status;

    if (isItemInsumo) {
      effectiveCompany = 'STOCK_CENTRAL_INSUMOS';
      effectiveStockType = 'INSUMOS';
      // Insumos nunca quedan en cuarentena ni pendientes de laboratorio
      effectiveStatus = 'APTO';
    } else if (data.stockType === 'MP') {
      effectiveCompany = 'STOCK_CENTRAL_MP';
      effectiveStatus = data.status || 'PENDIENTE';
    }

    // 2. LÓGICA DE INVENTARIO: ¿Suma o Resta?
    if (numericQty > 0) {
      // ---------------------------------------------------
      // CASO A: INYECCIÓN DE STOCK (Suma)
      // ---------------------------------------------------
      if (isFuzzyItem) {
        // Si se devuelve un insumo con filtro difuso (ej. rechazo de OE/OED), buscar el documento existente que coincida y nunca guardar un Array como itemName
        const qFuzzy = query(inventoryRef, where("company", "==", effectiveCompany));
        const snapFuzzy = await getDocs(qFuzzy);
        const matchedDoc = snapFuzzy.docs.find(d => matchesFuzzyItem(d.data().itemName, data.itemName));

        if (matchedDoc) {
          await updateDoc(doc(db, "Inventory", matchedDoc.id), {
            quantity: increment(numericQty),
            lastUpdated: serverTimestamp()
          });
        } else {
          const fallbackStringName = (data.fallbackName || data.itemName.map(i => Array.isArray(i) ? i[0] : i).filter(Boolean).join(' ')).toUpperCase().trim();
          await addDoc(inventoryRef, {
            ...data,
            itemName: fallbackStringName,
            company: effectiveCompany,
            quantity: numericQty,
            stockType: effectiveStockType,
            status: effectiveStatus || 'APTO',
            minStock: data.minStock || 100,
            createdAt: serverTimestamp(),
            lastUpdated: serverTimestamp()
          });
        }
        return;
      }

      const q = query(
        inventoryRef, 
        where("company", "==", effectiveCompany), 
        where("batchInternal", "==", data.batchInternal),
        where("itemName", "==", itemNameUpper)
      );
      
      let querySnapshot = await getDocs(q);

      // Fallback SOLO para productos no-insumo (ej: graneles o MP) cuando batch coincide Y los nombres son sinónimos comprobados
      if (querySnapshot.empty && !isItemInsumo && data.batchInternal && data.batchInternal !== 'S/D') {
        const qFallback = query(
          inventoryRef, 
          where("company", "==", effectiveCompany), 
          where("batchInternal", "==", data.batchInternal)
        );
        const snapFallback = await getDocs(qFallback);
        if (!snapFallback.empty) {
          const existingItem = snapFallback.docs[0].data();
          const existingName = (existingItem.itemName || '').toUpperCase();
          const targetName = (itemNameUpper || '').toUpperCase();

          const existingParts = existingName.split(' / ').map(p => p.trim());
          const targetParts = targetName.split(' / ').map(p => p.trim());

          const isSameOrSynonym = 
            existingName === targetName ||
            existingParts.includes(targetName) ||
            targetParts.includes(existingName) ||
            (PRODUCT_SYNONYMS[targetName] && PRODUCT_SYNONYMS[targetName] === PRODUCT_SYNONYMS[existingName]) ||
            (PRODUCT_SYNONYMS[targetName] && existingParts.includes(PRODUCT_SYNONYMS[targetName])) ||
            (PRODUCT_SYNONYMS[existingName] && targetParts.includes(PRODUCT_SYNONYMS[existingName]));

          if (isSameOrSynonym) {
            querySnapshot = snapFallback;
          }
        }
      }

      if (!querySnapshot.empty) {
        // El lote ya existe: Sumamos a la cantidad actual
        const itemDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, "Inventory", itemDoc.id), {
          quantity: increment(numericQty),
          lastUpdated: serverTimestamp()
        });
      } else {
        // Buscar si ya existe algún documento previo de este producto para heredar su minStock configurado
        let inheritedMinStock = data.minStock;
        if (!inheritedMinStock) {
          const qMin = query(
            inventoryRef,
            where("company", "==", effectiveCompany),
            where("itemName", "==", itemNameUpper)
          );
          const snapMin = await getDocs(qMin);
          if (!snapMin.empty) {
            inheritedMinStock = snapMin.docs[0].data().minStock;
          }
        }

        // Lote totalmente nuevo (Ingresos, Cargas Iniciales, OP nuevas)
        await addDoc(inventoryRef, {
          ...data,
          itemName: itemNameUpper,
          company: effectiveCompany,
          quantity: numericQty,
          originalQuantity: data.originalQuantity || numericQty,
          stockType: effectiveStockType, 
          status: effectiveStatus || 'APTO',
          minStock: inheritedMinStock || 100,
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp()
        });
      }

    } else if (numericQty < 0) {
      // ---------------------------------------------------
      // ---------------------------------------------------
      const absQty = Number(Math.abs(numericQty).toFixed(2));

      // Caso 0: Deducción directa inmediata por docId si el cliente seleccionó el registro exacto de Inventory
      if (data.docId) {
        try {
          const directDocRef = doc(db, "Inventory", data.docId);
          const directSnap = await getDoc(directDocRef);
          if (directSnap.exists()) {
            await updateDoc(directDocRef, {
              quantity: increment(-absQty),
              lastUpdated: serverTimestamp()
            });
            await checkAndCleanupEmptyStock(directDocRef);
            return;
          }
        } catch (docErr) {
          console.warn("Fallo en deducción directa por docId, intentando búsqueda por lote...", docErr);
        }
      }

      // ENRUTADOR INTELIGENTE: ¿Descuento Exacto o FIFO?
      // NOTA: Insumos (Bidones, Cajas, Etiquetas) siempre usan FIFO porque no comparten el lote del granel.
      const isExactDeduction = 
        !isFuzzyItem && (
          actionType === 'EGRESO_DESPACHO_CLIENTE' || 
          actionType === 'CONSUMO_ENVASADO' ||
          actionType === 'CONSUMO_ENVASADO_DIRECTO' ||
          actionType === 'RETIRO_PRODUCCION' ||
          ((actionType === 'EGRESO_CLEARING' || actionType === 'BAJA_POR_AJUSTE') && data.batchInternal && data.batchInternal !== 'S/D')
        );

      if (isExactDeduction) {
        // DESCUENTO EXACTO: Va directo al Lote que el usuario eligió en pantalla
        let qExact = query(
          inventoryRef, 
          where("company", "==", effectiveCompany), 
          where("itemName", "==", itemNameUpper),
          where("batchInternal", "==", data.batchInternal)
        );
        let snapExact = await getDocs(qExact);

        // Fallback 1: Buscar por la company explícita enviada si difiere de effectiveCompany
        if (snapExact.empty && data.company && data.company !== effectiveCompany) {
          qExact = query(
            inventoryRef, 
            where("company", "==", data.company), 
            where("itemName", "==", itemNameUpper),
            where("batchInternal", "==", data.batchInternal)
          );
          snapExact = await getDocs(qExact);
        }

        // Fallback 2: Buscar por lote exacto e itemName en cualquier company
        if (snapExact.empty && data.batchInternal && data.batchInternal !== 'S/D') {
          qExact = query(
            inventoryRef, 
            where("itemName", "==", itemNameUpper), 
            where("batchInternal", "==", data.batchInternal)
          );
          snapExact = await getDocs(qExact);
        }

        // Fallback 3: Buscar por lote exacto en cualquier company (ignora diferencias menores de nombre)
        if (snapExact.empty && data.batchInternal && data.batchInternal !== 'S/D') {
          qExact = query(
            inventoryRef, 
            where("batchInternal", "==", data.batchInternal)
          );
          snapExact = await getDocs(qExact);
        }
        
        if (!snapExact.empty) {
          const itemDoc = snapExact.docs[0];
          const docRef = doc(db, "Inventory", itemDoc.id);
          await updateDoc(docRef, {
            quantity: increment(-absQty),
            lastUpdated: serverTimestamp()
          });
          await checkAndCleanupEmptyStock(docRef);
        } else {
          console.warn(`Alerta: No se encontró el lote exacto ${data.batchInternal} para descontar ${itemNameUpper}. Aplicando salvaguarda FIFO...`);
          await deductStockFIFO(effectiveCompany, itemNameUpper, absQty);
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

    let docs = querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(doc => {
        if ((doc.quantity || 0) <= 0) return false;
        if (doc.status === 'RECHAZADO') return false;
        const docNameStr = typeof doc.itemName === 'string' ? doc.itemName.toUpperCase() : '';
        const isDocInsumo = doc.stockType === 'INSUMOS' || doc.stockType === 'ENVASES' ||
          docNameStr.startsWith('ETIQUETA') ||
          docNameStr.startsWith('BIDON') ||
          docNameStr.startsWith('POTE') ||
          docNameStr.startsWith('CAJA');
        // CUARENTENA: Solo para MP y Granel, nunca para insumos
        const pendingStatuses = ['PENDIENTE', 'PENDIENTE_LABORATORIO'];
        if (!isDocInsumo && pendingStatuses.includes(doc.status)) return false;
        if (isFuzzy) {
          return matchesFuzzyItem(doc.itemName, itemName);
        }
        return true;
      });

    // Salvaguarda multi-empresa: si no se encontró en la empresa actual
    if (docs.length === 0) {
      const isItemInsumoFuzzy = isFuzzy && itemName.some(kw => typeof kw === 'string' && (kw.toUpperCase() === 'ETIQUETA' || kw.toUpperCase() === 'BIDON' || kw.toUpperCase() === 'CAJA' || kw.toUpperCase() === 'POTE'));
      const fallbackCompanies = isItemInsumoFuzzy
        ? ['STOCK_CENTRAL_INSUMOS', 'H2O', 'H2Ocontrol', 'STOCK_CENTRAL_MP']
        : (company !== 'STOCK_CENTRAL_MP' && company !== 'H2O' ? ['STOCK_CENTRAL_MP', 'H2O'] : []);

      for (const altCompany of fallbackCompanies) {
        if (altCompany === company) continue;
        const altQ = isFuzzy
          ? query(inventoryRef, where("company", "==", altCompany))
          : query(inventoryRef, where("company", "==", altCompany), where("itemName", "==", itemName));
        const altSnap = await getDocs(altQ);
        const altDocs = altSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(doc => {
            if ((doc.quantity || 0) <= 0) return false;
            if (doc.status === 'RECHAZADO') return false;
            const isDocInsumo = doc.stockType === 'INSUMOS' || doc.stockType === 'ENVASES' ||
              (doc.itemName || '').toUpperCase().startsWith('ETIQUETA') ||
              (doc.itemName || '').toUpperCase().startsWith('BIDON') ||
              (doc.itemName || '').toUpperCase().startsWith('POTE') ||
              (doc.itemName || '').toUpperCase().startsWith('CAJA');
            const pendingStatuses = ['PENDIENTE', 'PENDIENTE_LABORATORIO'];
            if (!isDocInsumo && pendingStatuses.includes(doc.status)) return false;
            if (isFuzzy) {
              return matchesFuzzyItem(doc.itemName, itemName);
            }
            return true;
          });
        if (altDocs.length > 0) {
          docs = altDocs;
          break;
        }
      }
    }

    if (docs.length === 0) {
      const nameStr = isFuzzy ? itemName.join(' + ') : itemName;
      console.warn(`Alerta FIFO: Se intentó retirar ${nameStr} pero el stock es 0 en ${company}.`);
      return false;
    }

    // Ordenamos en memoria por fecha de creación (Gastamos primero lo más viejo)
    docs.sort((a, b) => (typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() : Date.now()) - (typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() : Date.now()));

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
    const isFuzzy = Array.isArray(itemName);
    const isEtiquetaOrInsumo = isFuzzy 
      ? itemName.some(kw => typeof kw === 'string' && (kw.toUpperCase() === 'ETIQUETA' || kw.toUpperCase() === 'BIDON' || kw.toUpperCase() === 'CAJA' || kw.toUpperCase() === 'POTE'))
      : typeof itemName === 'string' && (itemName.toUpperCase().includes('ETIQUETA') || itemName.toUpperCase().includes('BIDON') || itemName.toUpperCase().includes('CAJA') || itemName.toUpperCase().includes('POTE'));

    const targetCompany = isEtiquetaOrInsumo ? 'STOCK_CENTRAL_INSUMOS' : company;
    let q;
    if (isFuzzy) {
      q = query(inventoryRef, where("company", "==", targetCompany));
    } else {
      q = query(inventoryRef, where("company", "==", targetCompany), where("itemName", "==", itemName));
    }

    const checkSnapshot = (snap) => {
      let subTotal = 0;
      snap.forEach(doc => {
        const data = doc.data();
        if ((data.quantity || 0) <= 0) return;
        if (data.status === 'RECHAZADO') return;

        const isDocInsumo = data.stockType === 'INSUMOS' || data.stockType === 'ENVASES' ||
          (data.itemName || '').toUpperCase().includes('ETIQUETA') ||
          (data.itemName || '').toUpperCase().includes('BIDON') ||
          (data.itemName || '').toUpperCase().includes('POTE') ||
          (data.itemName || '').toUpperCase().includes('CAJA');

        // CUARENTENA: No contar stock de MP o Granel que no fue aprobado, pero insumos siempre son válidos
        const pendingStatuses = ['PENDIENTE', 'PENDIENTE_LABORATORIO'];
        if (!isDocInsumo && pendingStatuses.includes(data.status)) return;

        if (isFuzzy) {
          if (matchesFuzzyItem(data.itemName, itemName)) {
            subTotal += Number(data.quantity);
          }
        } else {
          subTotal += Number(data.quantity);
        }
      });
      return subTotal;
    };

    let snap = await getDocs(q);
    let total = checkSnapshot(snap);

    // Salvaguarda multi-empresa si no se encontró en la empresa destino
    if (total === 0) {
      const fallbackList = isEtiquetaOrInsumo 
        ? ['H2O', 'H2Ocontrol', 'STOCK_CENTRAL_MP']
        : (company !== 'STOCK_CENTRAL_MP' && company !== 'H2O' ? ['STOCK_CENTRAL_MP', 'H2O'] : []);

      for (const altComp of fallbackList) {
        if (altComp === targetCompany) continue;
        const altQ = isFuzzy
          ? query(inventoryRef, where("company", "==", altComp))
          : query(inventoryRef, where("company", "==", altComp), where("itemName", "==", itemName));
        const altSnap = await getDocs(altQ);
        const altTotal = checkSnapshot(altSnap);
        if (altTotal > 0) {
          total = altTotal;
          break;
        }
      }
    }

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

    // Guardar traza en auditoría con datos del producto
    await addDoc(collection(db, "AuditLog"), {
      user: userEmail,
      action: `CREACION_ORDEN_${orderType}`,
      orderId: docRef.id,
      itemName: (data.itemName || '').toUpperCase(),
      company: data.company || '—',
      quantity: data.quantity || 0,
      unit: data.unit || 'Uds',
      batchInternal: data.batchInternal || 'N/A',
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

    // Guardar traza enriquecida con datos del producto
    let itemName = '—', company = '—', quantity = 0, unit = 'Uds', batchInternal = 'N/A';
    try {
      const orderSnap = await getDoc(doc(db, "Orders", orderId));
      if (orderSnap.exists()) {
        const od = orderSnap.data().data || {};
        itemName = (od.itemName || '—').toUpperCase();
        company = od.company || '—';
        quantity = od.quantity || 0;
        unit = od.unit || 'Uds';
        batchInternal = od.batchInternal || 'N/A';
      }
    } catch (_) {}

    await addDoc(collection(db, "AuditLog"), {
      user: userEmail,
      action: `CAMBIO_ESTADO_ORDEN`,
      orderId: orderId,
      newStatus: newStatus,
      itemName,
      company,
      quantity,
      unit,
      batchInternal,
      timestamp: serverTimestamp(),
    });

    return true;
  } catch (error) {
    console.error("Error al actualizar Orden:", error);
    throw error;
  }
};