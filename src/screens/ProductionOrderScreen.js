import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Alert, StatusBar, ActivityIndicator, FlatList, Modal, Linking, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase'; 
import { collection, query, where, getDocs, onSnapshot, serverTimestamp, addDoc, Timestamp, updateDoc, doc } from 'firebase/firestore';
import { registerMovement, createOrder, updateOrderStatus } from '../services/logisticsService';
import { 
  ChevronLeft, Play, Beaker, FileText, Factory, AlertCircle, Calculator, CheckCircle2, XCircle, Plus, ClipboardList, CheckSquare, Calendar as CalendarIcon, X, Pencil, RotateCcw, Printer, ShieldAlert 
} from 'lucide-react-native';
import { Calendar as CalendarPicker } from 'react-native-calendars';
import { ChevronRight } from 'lucide-react-native';
import { printBatchLabels } from '../services/labelService';
import { printOrder } from '../services/printService';
import AutocompleteInput from '../components/AutocompleteInput';
import { EQUIVALENCIES } from '../services/formulaService';
import { PRODUCTS_MADRE_LIST, generateBatchId, RAW_MATERIALS_LIST, formatDisplayName } from '../config/constants';
import { canCreateOrders } from '../config/permissions';
import Toast from 'react-native-toast-message';

const normalizeString = (str) => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

const cleanStr = (str) => {
  return normalizeString(str)
    .replace(/[()\/_\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractCodes = (str) => {
  const norm = normalizeString(str).toUpperCase();
  const matches = norm.match(/\b(BBS[- ]?)?(FM\d+|FI\d+|FQ\d+|SQ\d+|\d+)\b/g) || [];
  return matches.map(m => m.replace(/[- ]/g, ''));
};

const scoreFormula = (f, searchInput) => {
  const fName = f.productName || '';
  const fClean = cleanStr(fName);
  const sClean = cleanStr(searchInput);

  if (fClean === sClean) return 10000;

  let score = 0;

  const fTokens = fClean.split(' ').filter(t => t.length > 0 && t !== 'granel');
  const sTokens = sClean.split(' ').filter(t => t.length > 0 && t !== 'granel');

  // 1. NF check (infracción estricta)
  const fHasNF = fTokens.includes('nf');
  const sHasNF = sTokens.includes('nf');
  if (sHasNF !== fHasNF) return -10000;

  // 2. Códigos técnicos (ej: FM00 vs FM02 vs FM01)
  const sCodes = extractCodes(searchInput);
  const fCodes = extractCodes(fName);
  
  if (sCodes.length > 0) {
    const hasSameCode = sCodes.some(sc => fCodes.includes(sc) || fCodes.some(fc => fc.includes(sc) || sc.includes(fc)));
    if (hasSameCode) {
      score += 4000;
    } else if (fCodes.length > 0) {
      score -= 5000;
    }
  }

  // 3. Nombres comerciales clave (ej: BERN vs BASEL)
  const keyNames = ['bern', 'basel', 'zurich', 'ixibio', 'momentum', 'syner', 'mariscal', 'power', 'restart'];
  keyNames.forEach(k => {
    const sHasK = sTokens.includes(k);
    const fHasK = fTokens.includes(k);
    if (sHasK && fHasK) score += 1000;
    if (!sHasK && fHasK) score -= 800;
  });

  // 4. Token overlap
  sTokens.forEach(st => {
    if (fTokens.includes(st)) score += 200;
  });

  // 5. Coincidencia por partes split('/')
  const fParts = fName.split('/').map(p => cleanStr(p).replace(/^granel\s+/i, ''));
  const sParts = searchInput.split('/').map(p => cleanStr(p).replace(/^granel\s+/i, ''));
  fParts.forEach(fp => {
    if (fp && sParts.includes(fp)) score += 500;
  });

  return score;
};

const findFormulaMatch = (allFormulas, searchInput) => {
  if (!allFormulas || allFormulas.length === 0 || !searchInput) return null;

  let bestFormula = null;
  let bestScore = -9999;

  for (const f of allFormulas) {
    const s = scoreFormula(f, searchInput);
    if (s > bestScore && s > 0) {
      bestScore = s;
      bestFormula = f;
    }
  }

  return bestFormula;
};

export default function ProductionOrderScreen({ route, navigation }) {
  const companyName = route?.params?.companyName || 'H2O';
  const [viewMode, setViewMode] = useState('LIST'); // 'LIST' | 'CREATE'
  
  // ======================================================================
  // ESTADOS DE LA VISTA LISTA
  // ======================================================================
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [eigDocs, setEigDocs] = useState([]);
  const [eigModalDoc, setEigModalDoc] = useState(null);

  useEffect(() => {
    // Escuchar órdenes de tipo OP en tiempo real
    const q = query(
      collection(db, "Orders"),
      where("type", "==", "OP")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Ordenar por fecha (más recientes primero)
      data.sort((a, b) => (typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() : Date.now()) - (typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() : Date.now()));
      // Filtramos en memoria por companyName para simplificar índices compuestos en Firebase
      const companyOrders = data.filter(o => !companyName || (o.data?.company || '').toUpperCase() === companyName.toUpperCase());
      setOrders(companyOrders);
      setLoadingOrders(false);
      
      // Actualizar modal si está abierto usando función de estado para evitar loop
      setSelectedOrder(prev => {
        if (!prev) return null;
        const updated = companyOrders.find(o => o.id === prev.id);
        return updated || null;
      });
    }, (error) => {
      console.error(error);
      setLoadingOrders(false);
    });
    return () => unsubscribe();
  }, [companyName]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'EIG_Documents')),
      (snap) => setEigDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, []);

  // Cerrar el modal automáticamente si la orden seleccionada desaparece (fue eliminada, etc.)
  useEffect(() => {
    if (!selectedOrder && orderModalVisible) {
      setOrderModalVisible(false);
    }
  }, [selectedOrder]);

  // Manejar apertura automática de una OP desde Historial de Calidad
  useEffect(() => {
    if (route.params?.openBatch && orders.length > 0) {
      const targetOrder = orders.find(o => o.data?.batchInternal === route.params.openBatch);
      if (targetOrder) {
        setSelectedOrder(targetOrder);
        setOrderModalVisible(true);
        navigation.setParams({ openBatch: undefined });
      }
    }
  }, [route.params?.openBatch, orders, navigation]);

  // ======================================================================
  // ESTADOS DE LA VISTA CREACIÓN
  // ======================================================================
  const getDefaultExpiryDate = () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear() + 2;
    return `${month}/${year}`;
  };

  const sanitizeData = (obj) => {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    return JSON.parse(JSON.stringify(obj, (k, v) => (v === undefined ? null : v)));
  };

  const scrollViewRef = useRef(null);
  const [calcError, setCalcError] = useState(null);
  const [allMasterFormulas, setAllMasterFormulas] = useState([]);

  const [productName, setProductName] = useState('');
  const [targetQuantity, setTargetQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState(getDefaultExpiryDate());
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [missingItems, setMissingItems] = useState([]);
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [forceModalVisible, setForceModalVisible] = useState(false);
  const [requirements, setRequirements] = useState(null);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [availableFormulas, setAvailableFormulas] = useState([]);

  // ======================================================================
  // ESTADOS PARA EDICIÓN DE CANTIDADES REALES DE MP
  // ======================================================================
  const [editIngModalVisible, setEditIngModalVisible] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null); // { index, name, formulaQty, batchesToConsume, isGranel }
  const [editQtyInput, setEditQtyInput] = useState('');
  const [editNoteInput, setEditNoteInput] = useState('');
  
  const [addExtraIngModalVisible, setAddExtraIngModalVisible] = useState(false);
  const [extraIngName, setExtraIngName] = useState('');
  const [extraIngQty, setExtraIngQty] = useState('');
  const [extraIngNote, setExtraIngNote] = useState('');
  
  useEffect(() => {
    const fetchFormulas = async () => {
      try {
        const snap = await getDocs(collection(db, "Formulas_Maestras"));
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllMasterFormulas(docs);

        const activeDocs = docs.filter(d => !d.status || d.status === 'ACTIVA');
        const data = activeDocs.map(doc => doc.productName).filter(Boolean);
        
        // Filter out formulas whose names are already part of a PRODUCTS_MADRE_LIST equivalent string
        const filteredData = data.filter(dbName => {
          return !PRODUCTS_MADRE_LIST.some(madre => madre.includes(dbName));
        });

        const uniqueProducts = [...new Set([...filteredData, ...PRODUCTS_MADRE_LIST])];
        setAvailableFormulas(uniqueProducts.sort());
      } catch (error) {
        console.error("Error fetching formulas", error);
      }
    };
    fetchFormulas();
  }, []);


  const handleCalculateNeeds = async () => {
    if (!productName.trim()) {
      Toast.show({
        type: 'info',
        text1: 'Falta Producto Madre',
        text2: 'Selecciona o escribe el producto que deseas fabricar.'
      });
      return;
    }

    if (!targetQuantity.trim()) {
      Toast.show({
        type: 'info',
        text1: 'Falta Volumen',
        text2: 'Ingresa el volumen objetivo en Litros.'
      });
      return;
    }

    const targetVolume = Number(targetQuantity.replace(',', '.'));
    if (isNaN(targetVolume) || targetVolume <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Volumen Inválido',
        text2: 'El volumen debe ser un número mayor a 0.'
      });
      return;
    }

    setIsCalculating(true);
    setCalcError(null);
    try {
      let formulas = allMasterFormulas;
      if (!formulas || formulas.length === 0) {
        const snap = await getDocs(collection(db, 'Formulas_Maestras'));
        formulas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllMasterFormulas(formulas);
      }

      const matchedFormula = findFormulaMatch(formulas, productName);

      if (!matchedFormula) {
        const errMsg = `No se encontró receta maestra para "${productName}".`;
        setCalcError(errMsg);
        Toast.show({
          type: 'error',
          text1: 'Fórmula no encontrada',
          text2: errMsg
        });
        setIsCalculating(false);
        return;
      }

      // Autocompletar nombre canónico
      if (matchedFormula.productName && matchedFormula.productName !== productName) {
        setProductName(matchedFormula.productName);
      }

      const density = Number(matchedFormula.densidadObjetivo || matchedFormula.densidad || 1);
      const targetKilos = targetVolume * density;
      const formulaIngredients = matchedFormula.ingredients || matchedFormula.ingredientes || [];

      if (!Array.isArray(formulaIngredients) || formulaIngredients.length === 0) {
        const errMsg = `La receta de "${matchedFormula.productName}" no tiene materias primas registradas.`;
        setCalcError(errMsg);
        Toast.show({
          type: 'error',
          text1: 'Receta sin ingredientes',
          text2: errMsg
        });
        setIsCalculating(false);
        return;
      }

      const calculatedNeeds = [];

      // CARGAMOS TODO EL STOCK ACTIVO UNA SOLA VEZ PARA MATCHEO LOCAL INTELIGENTE
      const inventoryRef = collection(db, 'Inventory');
      const qAllStock = query(inventoryRef, where('quantity', '>', 0));
      const allStockSnap = await getDocs(qAllStock);
      const allActiveStock = allStockSnap.docs.map(doc => {
         const data = doc.data();
         return {
           ...data,
           _id: doc.id,
           _createdAt: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : Date.now()
         };
      });

      // MAPA DE DENSIDADES PARA CONVERSIÓN DE GRANELES (Kg a Lts)
      const densityMap = {};
      formulas.forEach(f => {
        densityMap[normalizeString(f.productName || '')] = Number(f.densidadObjetivo || f.densidad || 1);
      });

      for (const ingredient of formulaIngredients) {
        if (ingredient.type === 'NOTE') {
          calculatedNeeds.push({
            type: 'NOTE',
            text: ingredient.text || ingredient.texto || ''
          });
          continue;
        }

        const percentageRaw = ingredient.percentage !== undefined ? ingredient.percentage : (ingredient.porcentaje !== undefined ? ingredient.porcentaje : 0);
        const percentageValue = Number(percentageRaw) / 100;
        const requiredKg = Number((targetKilos * percentageValue).toFixed(2)); // Siempre en Kg (para mostrar al operario)
        let requiredQty = requiredKg; // En Lts si es Granel (para comparar/descontar stock)
        
        let possibleNorm = [normalizeString(ingredient.name)];
        if ((ingredient.name || '').includes('/')) {
           possibleNorm.push(...ingredient.name.split('/').map(p => normalizeString(p)));
        }
        
        // 1. Expandir buscando en RAW_MATERIALS_LIST por coincidencia exacta de parte
        RAW_MATERIALS_LIST.forEach(rm => {
           const parts = rm.split('/').map(p => normalizeString(p));
           if (parts.some(p => possibleNorm.includes(p))) {
               possibleNorm.push(...parts);
           }
        });

        // 2. Expandir buscando en PRODUCTS_MADRE_LIST por coincidencia exacta de parte
        PRODUCTS_MADRE_LIST.forEach(pm => {
           const parts = pm.split('/').map(p => normalizeString(p.replace(/^granel\s+/i, '')));
           const fullParts = pm.split('/').map(p => normalizeString(p));
           if (parts.some(p => possibleNorm.includes(p)) || fullParts.some(p => possibleNorm.includes(p))) {
               possibleNorm.push(...parts);
               possibleNorm.push(...fullParts);
           }
        });

        // 3. Expandir buscando en EQUIVALENCIES (manuales)
        Object.keys(EQUIVALENCIES).forEach(k => {
           const normK = normalizeString(k);
           if (possibleNorm.includes(normK)) {
               possibleNorm.push(...EQUIVALENCIES[k].map(e => normalizeString(e)));
           }
        });

        possibleNorm = [...new Set(possibleNorm)];

        // Verificar si es Materia Prima conocida de la lista maestra
        const isRawMaterial = RAW_MATERIALS_LIST.some(rm => {
          const rmParts = rm.split('/').map(p => normalizeString(p.trim()));
          return rmParts.some(rp => possibleNorm.includes(rp));
        });

        // Solo es granel si NO es materia prima Y coincide con un Producto Madre
        const isGranel = !isRawMaterial && PRODUCTS_MADRE_LIST.some(pm => {
          const pmParts = pm.split('/').map(p => normalizeString(p.replace(/^granel\s+/i, '').trim()));
          const pmFullParts = pm.split('/').map(p => normalizeString(p.trim()));
          return pmParts.some(pp => possibleNorm.includes(pp)) || pmFullParts.some(pp => possibleNorm.includes(pp));
        });
        
        // CONVERSIÓN A LITROS SI ES UN GRANEL (solo para comparar/descontar stock)
        if (isGranel) {
           let ingDensity = 1;
           const matchedFormulaKey = Object.keys(densityMap).find(k => possibleNorm.includes(k));
           if (matchedFormulaKey) {
              ingDensity = densityMap[matchedFormulaKey];
           }
           requiredQty = Number((requiredKg / ingDensity).toFixed(2));
        }

        let currentStock = 0;
        const availableBatches = [];
        
        const BLOCKED_STATUSES = ['PENDIENTE', 'PENDIENTE_LABORATORIO'];
        allActiveStock.forEach(item => {
           if (BLOCKED_STATUSES.includes(item.status)) return; // Respetar cuarentena de BBS Calidad
           // Debe ser stock de Materia Prima o Granel (ignora insumos y producto terminado)
           if (item.stockType !== 'MP' && item.stockType !== 'GRANEL') return;

           const itemNorm = normalizeString(item.itemName);
           const itemCleanParts = (item.itemName || '').split('/').map(p => normalizeString(p.replace(/^granel\s+/i, '').trim()));
           const itemFullParts = (item.itemName || '').split('/').map(p => normalizeString(p.trim()));

           // Match exacto por nombre completo o por cualquiera de sus partes oficiales (evita colisiones por subcadenas)
           const isMatch = possibleNorm.some(pn => 
             pn === itemNorm || 
             itemCleanParts.includes(pn) || 
             itemFullParts.includes(pn)
           );
           if (isMatch) {
               availableBatches.push({
                  docId: item._id,
                  batchInternal: item.batchInternal || 'S/D',
                  batchProvider: item.batchProvider || 'S/D',
                  quantity: Number(item.quantity) || 0,
                  createdAt: item._createdAt,
                  realItemName: item.itemName,
                  company: item.company,
                  stockType: item.stockType
               });
               currentStock += Number(item.quantity) || 0;
           }
        });
        
        // (Batches ya recolectados arriba)
        availableBatches.sort((a, b) => a.createdAt - b.createdAt);
        let remainingRequired = requiredQty;
        const batchesToConsume = [];
        for (const b of availableBatches) {
           if (remainingRequired <= 0) break;
           const consumeQty = Number(Math.min(b.quantity, remainingRequired).toFixed(2));
           batchesToConsume.push({
              docId: b.docId ? String(b.docId) : '',
              batchInternal: b.batchInternal || 'S/D',
              batchProvider: b.batchProvider || 'S/D',
              consumed: consumeQty || 0,
              realItemName: b.realItemName || ingredient.name || '',
              company: b.company || companyName || 'H2O',
              stockType: b.stockType || (isGranel ? 'GRANEL' : 'MP')
           });
           remainingRequired = Number((remainingRequired - consumeQty).toFixed(2));
        }

        calculatedNeeds.push({
          name: ingredient.name,
          required: requiredQty,       // En Lts si Granel (para stock/deducción)
          requiredKg: requiredKg,       // Siempre en Kg (para mostrar al operario)
          stock: currentStock,
          isSufficient: currentStock >= requiredQty,
          missing: currentStock >= requiredQty ? 0 : Number((requiredQty - currentStock).toFixed(2)),
          isGranel: isGranel,
          batchesToConsume: batchesToConsume
        });
      }

      setRequirements({
        needs: calculatedNeeds,
        targetVolume,
        density,
        targetKilos,
        formulaName: matchedFormula.productName
      });
      setCalcError(null);

      Toast.show({
        type: 'success',
        text1: 'Requerimientos Calculados',
        text2: `Receta: ${matchedFormula.productName} | ${calculatedNeeds.filter(n => n.type !== 'NOTE').length} MPs calculadas.`
      });

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    } catch (error) {
      console.error('Error calculando requerimientos:', error);
      const errMsg = `Error al calcular: ${error?.message || 'Verifica la conexión'}`;
      setCalcError(errMsg);
      Toast.show({
        type: 'error',
        text1: 'Error de Cálculo',
        text2: errMsg
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const executeProductionOrder = async (force = false) => {
    try {
      setIsSubmitting(true);
      const baseBatchId = generateBatchId();
      let batchId = baseBatchId;
      const currentUser = auth.currentUser?.email || 'Sistema';

      // --- GENERACIÓN DE LOTE INCREMENTAL AUTOMÁTICA ---
      // Buscar si ya existe este lote para cualquier OP hoy (evita colisión de lotes entre graneles distintos)
      const ordersRef = collection(db, 'Orders');
      const qOrders = query(ordersRef, where('type', '==', 'OP'));
      const snapOrders = await getDocs(qOrders);
      
      let count = 0;
      snapOrders.forEach(doc => {
         const existingBatch = doc.data().data?.batchInternal || '';
         if (existingBatch.startsWith(baseBatchId)) {
            count++;
         }
      });
      
      if (count > 0) {
         batchId = `${baseBatchId}/${count}`;
      }
      // ---------------------------------------------------

      let finalExpiryDate = (expiryDate || '').trim();
      if (!finalExpiryDate) {
        finalExpiryDate = getDefaultExpiryDate();
        setExpiryDate(finalExpiryDate);
      }

      // === REGLA ESTRICTA DE INVENTARIO ===
      const hasMissingStock = requirements.needs.some(req => req.type !== 'NOTE' && !req.isSufficient);
      if (hasMissingStock && force !== true) {
        setForceModalVisible(true);
        setIsSubmitting(false);
        return;
      }

      // 1. PRIMERO: CREAR LA ORDEN (si esto falla, el stock NO se toca)
      const orderData = {
        itemName: productName.trim().toUpperCase(),
        quantity: requirements.targetVolume, 
        density: requirements.density,
        targetKilos: requirements.targetKilos,
        stockType: 'GRANEL', 
        batchInternal: batchId,
        expiryDate: finalExpiryDate,
        unit: 'Lts',
        company: companyName || 'H2O',
        ingredients: requirements.needs.map(req => ({
          name: req.name || req.text || 'Sin Nombre',
          type: req.type || 'MATERIAL',
          text: req.text || '',
          required: Number(req.required) || 0,
          requiredKg: Number(req.requiredKg) || 0,
          stock: Number(req.stock) || 0,
          isSufficient: !!req.isSufficient,
          missing: Number(req.missing) || 0,
          isGranel: !!req.isGranel,
          batchesToConsume: (req.batchesToConsume || []).map(b => ({
            docId: b.docId ? String(b.docId) : '',
            batchInternal: b.batchInternal || 'S/D',
            batchProvider: b.batchProvider || 'S/D',
            consumed: Number(b.consumed) || 0,
            realItemName: b.realItemName || req.name || '',
            company: b.company || companyName || 'H2O',
            stockType: b.stockType || (req.isGranel ? 'GRANEL' : 'MP')
          }))
        })),
        mpDeducted: true,
        actualIngredients: null
      };

      const cleanOrderData = sanitizeData(orderData);
      await createOrder('OP', cleanOrderData, currentUser);

      // 2. DESPUÉS: DESCONTAR LAS MP (solo si la orden se creó exitosamente)
      for (const req of requirements.needs) {
        if (req.batchesToConsume && req.batchesToConsume.length > 0) {
          for (const b of req.batchesToConsume) {
            const consumedQty = Number(b.consumed) || 0;
            if (consumedQty <= 0) continue;

            await registerMovement(currentUser, 'RETIRO_PRODUCCION', b.company || (req.isGranel ? 'H2O' : (companyName || 'H2O')), {
              docId: b.docId ? String(b.docId) : undefined,
              itemName: b.realItemName || req.name,
              quantity: -Math.abs(consumedQty), 
              stockType: b.stockType || (req.isGranel ? 'GRANEL' : 'MP'),
              batchInternal: b.batchInternal || 'S/D',
              loteProveedor: b.batchProvider || 'S/D', 
              unit: 'Kg/Lts',
              details: `OP ${batchId} - Reserva Formula`
            });
          }
        }
      }

      Toast.show({
        type: 'success',
        text1: 'OP Emitida con Exito',
        text2: `Lote: ${batchId} | ${requirements.targetVolume} L enviados a Produccion.`
      });

      setViewMode('LIST');
      setRequirements(null);
      setProductName('');
      setTargetQuantity('');
      setExpiryDate(getDefaultExpiryDate());
    } catch (error) {
      console.error('Error al emitir OP:', error);
      const msg = error?.code === 'permission-denied'
        ? 'Tu usuario no tiene permiso para crear ordenes. Contacta al administrador del sistema.'
        : `No se pudo emitir la orden: ${error?.message || 'Error desconocido'}`;
      Toast.show({
        type: 'error',
        text1: 'Error al emitir OP',
        text2: msg
      });
      Alert.alert('Error del Sistema', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ======================================================================
  // FUNCIONES DE ESTADO DE ÓRDEN (ACEPTAR / FINALIZAR)
  // ======================================================================
  const handleAcceptOrder = async () => {
    if (!selectedOrder) return;
    try {
      setProcessingOrder(true);
      const currentUser = auth.currentUser?.email || 'Sistema';
      await updateOrderStatus(selectedOrder.id, 'EN_PROCESO', currentUser);
      Alert.alert("Orden Aceptada", "El tiempo de proceso ha comenzado. Puedes ajustar las cantidades reales usadas de cada MP antes de finalizar.");
    } catch (error) {
      Alert.alert("Error", "No se pudo aceptar la orden.");
    } finally {
      setProcessingOrder(false);
    }
  };

  const handleRejectOrder = async () => {
    if (!selectedOrder) return;
    
    const executeRejection = async () => {
      try {
        setProcessingOrder(true);
        const currentUser = auth.currentUser?.email || 'Sistema';
        const orderData = selectedOrder.data;
        const batchId = orderData.batchInternal;

        // Devolver las MP descontadas
        for (const req of (orderData.ingredients || [])) {
          // Omitir ingredientes extra (isExtra = true) porque nunca se descontaron al emitir la OP
          if (req.isExtra) continue;

          if (req.batchesToConsume && req.batchesToConsume.length > 0) {
            for (const b of req.batchesToConsume) {
              await registerMovement(currentUser, 'DEVOLUCION_RECHAZO_OP', b.company || (req.isGranel ? 'H2O' : companyName), {
                itemName: b.realItemName || req.name,
                quantity: Math.abs(b.consumed), // positivo para devolver al stock
                stockType: b.stockType || (req.isGranel ? 'GRANEL' : 'MP'),
                batchInternal: b.batchInternal,
                loteProveedor: b.batchProvider,
                unit: 'Kg/Lts',
                details: `OP ${batchId} Rechazada - Devolución de Reserva`
              });
            }
          }
        }

        await updateOrderStatus(selectedOrder.id, 'RECHAZADO', currentUser);
        Toast.show({ type: 'info', text1: 'Orden Rechazada', text2: 'El stock ha sido devuelto exitosamente.' });
        setOrderModalVisible(false);
      } catch (error) {
        console.error(error);
        Alert.alert("Error", "No se pudo rechazar la orden.");
      } finally {
        setProcessingOrder(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("¿Estás seguro que deseas rechazar esta orden? Las materias primas reservadas volverán al stock.")) {
        executeRejection();
      }
    } else {
      Alert.alert(
        "Rechazar OP",
        "¿Estás seguro que deseas rechazar esta orden? Las materias primas reservadas volverán al stock.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Sí, Rechazar", style: "destructive", onPress: executeRejection }
        ]
      );
    }
  };

  // Abre el modal de edición para un ingrediente
  const handleOpenEditIngredient = (ing, index) => {
    setEditingIngredient({ index, ...ing });
    // Pre-cargar con la cantidad ajustada existente, o la de fórmula
    const currentActual = selectedOrder?.data?.actualIngredients;
    const existing = currentActual ? currentActual.find(a => a.name === ing.name) : null;
    setEditQtyInput(existing ? String(existing.actualQty) : String(ing.required || 0));
    setEditNoteInput(existing?.note || '');
    setEditIngModalVisible(true);
  };

  // Guarda el ajuste de cantidad real en Firestore
  const handleSaveIngredientAdjustment = async () => {
    if (!editingIngredient || !selectedOrder) return;
    const newQty = parseFloat(editQtyInput.replace(',', '.'));
    if (isNaN(newQty) || newQty < 0) {
      Alert.alert('Error', 'Ingresa una cantidad válida (puede ser 0).');
      return;
    }
    try {
      const existingActual = selectedOrder.data?.actualIngredients || [];
      // Reemplazar o agregar el ajuste para este ingrediente
      const updated = existingActual.filter(a => a.name !== editingIngredient.name);
      updated.push({
        name: editingIngredient.name,
        formulaQty: editingIngredient.required || 0,
        actualQty: newQty,
        batchesToConsume: editingIngredient.batchesToConsume || [],
        isGranel: editingIngredient.isGranel || false,
        note: editNoteInput.trim()
      });
      await updateDoc(doc(db, 'Orders', selectedOrder.id), {
        'data.actualIngredients': updated
      });
      Toast.show({ type: 'success', text1: 'Ajuste guardado', text2: `${editingIngredient.name}: ${newQty} Kg/Lts` });
      setEditIngModalVisible(false);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo guardar el ajuste.');
    }
  };

  const handleSaveExtraIngredient = async () => {
    if (!extraIngName.trim() || !extraIngQty) {
      Alert.alert('Error', 'Completa el nombre y la cantidad.');
      return;
    }
    const newQty = parseFloat(extraIngQty.replace(',', '.'));
    if (isNaN(newQty) || newQty <= 0) {
      Alert.alert('Error', 'Cantidad inválida.');
      return;
    }

    try {
      // 1. Agregar a ingredients con required = 0 para que figure en la UI y reconciliación
      const updatedIngredients = [...(selectedOrder.data?.ingredients || [])];
      updatedIngredients.push({
        name: extraIngName.trim().toUpperCase(),
        required: 0,
        requiredKg: 0,
        isGranel: false, // Las MP de ajuste suelen ser materias primas, no graneles
        batchesToConsume: [],
        isExtra: true
      });

      // 2. Agregar a actualIngredients con el valor ingresado
      const updatedActual = [...(selectedOrder.data?.actualIngredients || [])];
      updatedActual.push({
        name: extraIngName.trim().toUpperCase(),
        formulaQty: 0,
        actualQty: newQty,
        batchesToConsume: [],
        isGranel: false,
        note: extraIngNote.trim() || 'Ajuste extra'
      });

      await updateDoc(doc(db, 'Orders', selectedOrder.id), {
        'data.ingredients': updatedIngredients,
        'data.actualIngredients': updatedActual
      });

      Toast.show({ type: 'success', text1: 'MP de Ajuste Añadida', text2: `${extraIngName.trim().toUpperCase()}: ${newQty} Kg/Lts` });
      setAddExtraIngModalVisible(false);
      setExtraIngName('');
      setExtraIngQty('');
      setExtraIngNote('');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo guardar la MP de ajuste.');
    }
  };

  const handleFinalizeOrder = async () => {
    if (!selectedOrder) return;
    try {
      setProcessingOrder(true);
      const currentUser = auth.currentUser?.email || 'Sistema';
      const orderData = selectedOrder.data;
      const batchId = orderData.batchInternal;

      // ====================================================================
      // RECONCILIACIÓN DE MP: comparar fórmula vs. uso real
      // Al emitir la OP ya se descontó la cantidad de la fórmula.
      // Ahora ajustamos la diferencia: si se usó menos → devolver sobrante;
      // si se usó más → descontar la diferencia adicional.
      // ====================================================================
      const actualIngredients = orderData.actualIngredients || [];
      const formulaIngredients = orderData.ingredients || [];

      for (const formulaIng of formulaIngredients) {
        const actual = actualIngredients.find(a => a.name === formulaIng.name);
        if (!actual) continue; // Sin ajuste → no hay diferencia a reconciliar

        const diff = Number((actual.actualQty - formulaIng.required).toFixed(2));
        if (diff === 0) continue;

        const isGranel = formulaIng.isGranel || false;
        const batchRef = formulaIng.batchesToConsume?.[0]?.batchInternal || batchId;
        const realName = formulaIng.batchesToConsume?.[0]?.realItemName || formulaIng.name;

        if (diff < 0) {
          // Usó MENOS → devolver sobrante al stock
          await registerMovement(currentUser, 'DEVOLUCION_SOBRANTE_OP', isGranel ? 'H2O' : companyName, {
            itemName: realName,
            quantity: Math.abs(diff), // positivo = ingresa al stock
            stockType: isGranel ? 'GRANEL' : 'MP',
            batchInternal: batchRef,
            loteProveedor: formulaIng.batchesToConsume?.[0]?.batchProvider || 'S/D',
            unit: 'Kg/Lts',
            details: `Sobrante OP ${batchId} | Real: ${actual.actualQty} | Fórmula: ${formulaIng.required} | ${actual.note || 'Sin nota'}`
          });
        } else {
          // Usó MÁS → descontar diferencia extra del stock
          await registerMovement(currentUser, 'EXTRA_CONSUMO_OP', isGranel ? 'H2O' : companyName, {
            itemName: realName,
            quantity: -diff, // negativo = sale del stock
            stockType: isGranel ? 'GRANEL' : 'MP',
            batchInternal: batchRef,
            loteProveedor: formulaIng.batchesToConsume?.[0]?.batchProvider || 'S/D',
            unit: 'Kg/Lts',
            details: `Consumo extra OP ${batchId} | Real: ${actual.actualQty} | Fórmula: ${formulaIng.required} | ${actual.note || 'Sin nota'}`
          });
        }
      }

      // 1. Finalizar Ticket
      await updateOrderStatus(selectedOrder.id, 'FINALIZADO', currentUser);

      // 2. Inyectar Granel en Laboratorio
      await registerMovement(currentUser, 'INGRESO_OP', orderData.company, {
        itemName: orderData.itemName,
        quantity: orderData.quantity, 
        originalQuantity: orderData.quantity,
        stockType: 'GRANEL', 
        batchInternal: orderData.batchInternal,
        batchProvider: 'PROPIA',
        expiryDate: orderData.expiryDate,
        unit: orderData.unit,
        company: orderData.company,
        status: 'PENDIENTE_LABORATORIO'
      });

      Alert.alert(
        "Orden Finalizada",
        `Reconciliación completada.\n${actualIngredients.length} ajuste(s) de MP aplicados.\nEl producto fue enviado a BBS Calidad.\n¿Desea imprimir el set de etiquetas?`,
        [
          { text: "No, gracias", style: "cancel", onPress: () => setOrderModalVisible(false) },
          { text: "Imprimir Lote", onPress: async () => {
              try {
                const productLabel = {
                  type: 'GRANEL',
                  name: orderData.itemName,
                  batch: orderData.batchInternal,
                  expiration: orderData.expiryDate,
                  quantity: orderData.quantity,
                  unit: orderData.unit
                };
                const rawMaterialsLabels = (orderData.ingredients || []).map(ing => {
                  const actual = (orderData.actualIngredients || []).find(a => a.name === ing.name);
                  const usedQty = actual ? actual.actualQty : ing.required;
                  const usedBatches = ing.batchesToConsume?.map(b => b.batchProvider).join(', ') || 'S/L';
                  return {
                    type: 'MP',
                    name: ing.name,
                    batch: usedBatches,
                    expiration: actual ? `Ajustado (${actual.note || 'sin nota'})` : 'Según fórmula',
                    quantity: usedQty,
                    unit: 'Kg/L'
                  };
                });
                await printBatchLabels(productLabel, rawMaterialsLabels);
              } catch (e) {
                Alert.alert("Error de Impresión", "No se pudieron generar las etiquetas.");
              } finally {
                setOrderModalVisible(false);
              }
            } 
          }
        ]
      );
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo finalizar la orden.");
    } finally {
      setProcessingOrder(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ENVIADO': return '#3b82f6';
      case 'EN_PROCESO': return '#f59e0b';
      case 'FINALIZADO': return '#10b981';
      default: return '#64748b';
    }
  };

  // ======================================================================
  // RENDERIZADO
  // ======================================================================
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => viewMode === 'CREATE' ? setViewMode('LIST') : (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))} 
          style={styles.backBtn}
        >
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
          <Text style={styles.headerTitle}>Órdenes de Producción</Text>
          <Text style={styles.headerSub}>{companyName}</Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      {viewMode === 'LIST' ? (
        <View style={styles.container}>
          {canCreateOrders(auth.currentUser?.email) && (
            <TouchableOpacity style={styles.newOrderBtn} onPress={() => setViewMode('CREATE')}>
              <Plus color="#fff" size={20} />
              <Text style={styles.newOrderBtnText}>NUEVA OP</Text>
            </TouchableOpacity>
          )}
          
          <Text style={styles.sectionTitle}>Órdenes Recientes</Text>
          
          {loadingOrders ? (
            <ActivityIndicator color="#3b82f6" style={{ marginTop: 40 }} />
          ) : orders.length === 0 ? (
            <View style={styles.emptyBox}>
              <ClipboardList color="#cbd5e1" size={48} />
              <Text style={styles.emptyText}>No hay órdenes de producción registradas.</Text>
            </View>
          ) : (
            <FlatList 
              data={orders}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({item}) => (
                <TouchableOpacity 
                  style={styles.orderCard}
                  onPress={() => {
                    setSelectedOrder(item);
                    setOrderModalVisible(true);
                  }}
                >
                  <View style={styles.orderCardHeader}>
                    <Text style={styles.orderCardTitle}>{item.data.itemName}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                      <Text style={styles.statusText}>{item.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.orderCardSub}>Lote: {item.data.batchInternal}</Text>
                  <Text style={styles.orderCardSub}>Volumen: <Text style={{fontWeight: '700', color: '#0f172a'}}>{item.data.quantity} Lts</Text></Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      ) : (
        // VISTA CREACIÓN
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.infoBanner}>
            <View style={styles.iconBox}>
              <Factory color="#3b82f6" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Emisión de Nueva OP</Text>
              <Text style={styles.bannerText}>
                Las materias primas se reservarán al instante. La OP pasará al listado.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={[styles.inputGroup, { zIndex: 3000 }]}>
              <Text style={styles.label}>Producto Madre a Fabricar</Text>
              <AutocompleteInput 
                data={availableFormulas}
                value={productName}
                onChangeText={(text) => { setProductName(text); setRequirements(null); setCalcError(null); }}
                placeholder="Ej: PRODUCTO MADRE X"
                icon={<FileText color="#94a3b8" size={20} />}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Volumen Objetivo (Litros)</Text>
              <View style={styles.inputWrapper}>
                <Beaker color="#94a3b8" size={20} style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Ej: 1000" 
                  keyboardType="numeric"
                  value={targetQuantity}
                  onChangeText={(text) => { setTargetQuantity(text); setRequirements(null); setCalcError(null); }}
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Fecha Vencimiento del Granel *</Text>
              <TouchableOpacity 
                style={styles.inputWrapper}
                onPress={() => setIsCalendarVisible(true)}
              >
                <CalendarIcon color="#94a3b8" size={20} style={styles.inputIcon} />
                <Text style={[styles.input, { flex: 1, color: expiryDate ? '#0f172a' : '#94a3b8', paddingVertical: 14 }]}>
                  {expiryDate || 'MM/AAAA'}
                </Text>
              </TouchableOpacity>
            </View>

            {!requirements && (
              <TouchableOpacity 
                style={[styles.calcButton, isCalculating && { opacity: 0.7 }]} 
                onPress={handleCalculateNeeds}
                disabled={isCalculating}
              >
                {isCalculating ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <Calculator color="#fff" size={20} />
                    <Text style={styles.mainButtonText}>Calcular Requerimientos</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {calcError && (
              <View style={[styles.workflowAlert, { backgroundColor: '#fef2f2', borderColor: '#fca5a5', marginTop: 15 }]}>
                <ShieldAlert color="#ef4444" size={20} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.workflowTitle, { color: '#991b1b' }]}>Fórmula No Encontrada</Text>
                  <Text style={[styles.workflowText, { color: '#b91c1c' }]}>{calcError}</Text>
                </View>
              </View>
            )}
          </View>

          {requirements && (
            <View style={styles.requirementsCard}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reqTitle}>Proyección de Materias Primas</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#3b82f6', marginTop: 2 }}>
                    Receta: {requirements.formulaName || productName}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity 
                    onPress={() => setRequirements(null)} 
                    style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#f1f5f9', borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#475569' }}>MODIFICAR</Text>
                  </TouchableOpacity>
                  <View style={{alignItems: 'flex-end'}}>
                    <Text style={{fontSize: 10, color: '#64748b', fontWeight: '800'}}>DENSIDAD</Text>
                    <Text style={{fontSize: 14, color: '#0f172a', fontWeight: '900'}}>{requirements.density}</Text>
                  </View>
                </View>
              </View>
              
              <View style={{backgroundColor: '#f1f5f9', padding: 12, borderRadius: 12, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-around'}}>
                <View style={{alignItems: 'center'}}>
                  <Text style={{fontSize: 10, color: '#64748b', fontWeight: '700'}}>VOLUMEN</Text>
                  <Text style={{fontSize: 15, color: '#3b82f6', fontWeight: '900'}}>{requirements.targetVolume} Lts</Text>
                </View>
                <View style={{alignItems: 'center', borderLeftWidth: 1, borderColor: '#cbd5e1', paddingLeft: 25}}>
                  <Text style={{fontSize: 10, color: '#64748b', fontWeight: '700'}}>MASA TOTAL</Text>
                  <Text style={{fontSize: 15, color: '#8b5cf6', fontWeight: '900'}}>{requirements.targetKilos.toFixed(1)} Kg</Text>
                </View>
              </View>
              
              {requirements.needs.map((req, index) => {
                if (req.type === 'NOTE') {
                  return (
                    <View key={index} style={styles.reqRow}>
                      <View style={{flex: 1}}>
                        <Text style={[styles.reqName, { color: '#64748b', fontStyle: 'italic' }]}>Nota: {req.text}</Text>
                      </View>
                    </View>
                  );
                }
                return (
                  <View key={index} style={styles.reqRow}>
                    <View style={{flex: 1}}>
                      <Text style={styles.reqName}>{formatDisplayName(req.ingredientName || req.name)}</Text>
                      <Text style={styles.reqDetail}>
                        Req: {req.isGranel 
                          ? `${(req.requiredKg || req.required).toFixed(2)} Kg (≈ ${req.required.toFixed(2)} Lts)` 
                          : `${req.required.toFixed(2)} Kg`
                        } | Stock: {req.stock.toFixed(2)} {req.isGranel ? 'Lts' : 'Kg'}
                      </Text>
                      {req.batchesToConsume && req.batchesToConsume.length > 0 && (
                        <View style={styles.batchesPreview}>
                           {req.batchesToConsume.map((b, bIdx) => (
                             <Text key={bIdx} style={styles.batchLine}>
                               • Lote Int: {b.batchInternal} | Prov: {b.batchProvider} | Consumido: {b.consumed.toFixed(2)} {req.isGranel ? 'Lts' : 'Kg'}
                             </Text>
                           ))}
                        </View>
                      )}
                    </View>
                    {req.isSufficient ? (
                      <CheckCircle2 color="#10b981" size={24} />
                    ) : (
                      <View style={{alignItems: 'flex-end'}}>
                        <XCircle color="#ef4444" size={20} />
                        <Text style={styles.missingText}>Faltan {req.missing.toFixed(2)}</Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {requirements.needs.some(req => req.type !== 'NOTE' && !req.isSufficient) ? (
                <View style={[styles.workflowAlert, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}>
                  <ShieldAlert color="#ef4444" size={22} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.workflowTitle, { color: '#991b1b' }]}>Falta de Stock Detectada</Text>
                    <Text style={[styles.workflowText, { color: '#b91c1c' }]}>
                      Existen materias primas en rojo con stock insuficiente. Puedes forzar la emisión de la OP de todos modos para que pase a planta y ajustar las cantidades reales usadas en producción.
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.workflowAlert}>
                  <AlertCircle color="#f59e0b" size={20} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.workflowTitle}>Siguiente Paso</Text>
                    <Text style={styles.workflowText}>
                      Al confirmar, estas materias primas se descontarán y la OP quedará ENVIADA.
                    </Text>
                  </View>
                </View>
              )}

              <TouchableOpacity 
                style={[
                  styles.mainButton, 
                  requirements.needs.some(req => req.type !== 'NOTE' && !req.isSufficient) && { backgroundColor: '#d97706' },
                  isSubmitting && { opacity: 0.7 }
                ]} 
                onPress={() => {
                  const hasMissingStock = requirements.needs.some(req => req.type !== 'NOTE' && !req.isSufficient);
                  if (hasMissingStock) {
                    setForceModalVisible(true);
                    return;
                  }
                  executeProductionOrder(false);
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <Play color="#fff" size={20} fill="#fff" />
                    <Text style={styles.mainButtonText}>
                      {requirements.needs.some(req => req.type !== 'NOTE' && !req.isSufficient)
                        ? "Forzar y Enviar OP (Stock Insuficiente)"
                        : "Confirmar y Enviar Orden de Producción"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
          
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* CALENDAR MODAL */}
      <Modal visible={isCalendarVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Fecha de Vencimiento</Text>
              <TouchableOpacity onPress={() => setIsCalendarVisible(false)}>
                <X color="#64748b" size={24} />
              </TouchableOpacity>
            </View>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#f8fafc'}}>
              <TouchableOpacity onPress={() => setCalendarYear(y => y - 1)} style={{padding: 10}}>
                <ChevronLeft color="#3b82f6" size={28} />
              </TouchableOpacity>
              <Text style={{fontSize: 22, fontWeight: '900', color: '#0f172a'}}>{calendarYear}</Text>
              <TouchableOpacity onPress={() => setCalendarYear(y => y + 1)} style={{padding: 10}}>
                <ChevronRight color="#3b82f6" size={28} />
              </TouchableOpacity>
            </View>

            <View style={{flexDirection: 'row', flexWrap: 'wrap', padding: 15, justifyContent: 'center'}}>
              {["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"].map((m, i) => (
                <TouchableOpacity 
                  key={m}
                  style={{width: '30%', paddingVertical: 15, margin: '1.5%', backgroundColor: '#f1f5f9', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0'}}
                  onPress={() => {
                    const monthStr = String(i + 1).padStart(2, '0');
                    setExpiryDate(`${monthStr}/${calendarYear}`);
                    setIsCalendarVisible(false);
                  }}
                >
                  <Text style={{fontSize: 16, fontWeight: '700', color: '#334155'}}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE CONFIRMACIÓN PARA FORZAR OP CON STOCK INSUFICIENTE */}
      <Modal visible={forceModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.calendarContainer, { padding: 24, maxWidth: 480, alignSelf: 'center', width: '92%' }]}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ backgroundColor: '#fef3c7', padding: 16, borderRadius: 50, marginBottom: 12 }}>
                <ShieldAlert color="#d97706" size={36} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f172a', textAlign: 'center' }}>
                Stock Insuficiente Detectado
              </Text>
            </View>

            <Text style={{ fontSize: 14, color: '#475569', lineHeight: 22, textAlign: 'center', marginBottom: 22 }}>
              Existen materias primas en rojo con faltante de stock para cubrir la receta teórica.{'\n\n'}
              ¿Deseas <Text style={{ fontWeight: '800', color: '#0f172a' }}>FORZAR la emisión de la OP</Text> de todos modos? Se reservará todo el stock disponible y las cantidades faltantes podrán ajustarse luego en planta.
            </Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#f1f5f9', padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setForceModalVisible(false)}
              >
                <Text style={{ color: '#64748b', fontWeight: '800', fontSize: 15 }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1.2, backgroundColor: '#d97706', padding: 14, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                onPress={() => {
                  setForceModalVisible(false);
                  executeProductionOrder(true);
                }}
              >
                <Play color="#fff" size={18} fill="#fff" />
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>Forzar OP</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* MODAL DETALLES DE ORDEN */}
      <Modal visible={orderModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOrderModalVisible(false)}>
        <SafeAreaView style={{flex: 1, backgroundColor: '#f8fafc'}}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setOrderModalVisible(false)} style={styles.backBtn}>
              <ChevronLeft color="#0f172a" size={28} />
            </TouchableOpacity>
            <View style={{alignItems: 'center'}}>
              <Text style={styles.headerTitle}>Detalle de OP</Text>
              <View style={styles.batchBadge}>
                <Text style={styles.batchBadgeText}>{selectedOrder?.data?.batchInternal}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => selectedOrder && printOrder(selectedOrder)} style={{ padding: 8, backgroundColor: '#3b82f6', borderRadius: 8 }}>
              <Printer color="#fff" size={20} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{flex: 1, padding: 20}}>
            <View style={styles.card}>
              <Text style={{fontSize: 20, fontWeight: '900', color: '#0f172a', marginBottom: 5}}>{selectedOrder?.data?.itemName}</Text>
              <View style={[styles.statusBadge, { alignSelf: 'flex-start', backgroundColor: getStatusColor(selectedOrder?.status), marginBottom: 15 }]}>
                 <Text style={styles.statusText}>{selectedOrder?.status}</Text>
              </View>
              <Text style={{fontSize: 14, color: '#475569', marginBottom: 5}}>Volumen: <Text style={{fontWeight: '800', color: '#0f172a'}}>{selectedOrder?.data?.quantity} Lts</Text></Text>
              <Text style={{fontSize: 14, color: '#475569', marginBottom: 5}}>Masa Total: <Text style={{fontWeight: '800', color: '#0f172a'}}>{selectedOrder?.data?.targetKilos ? selectedOrder.data.targetKilos.toFixed(2) : 'N/A'} Kg</Text></Text>
              <Text style={{fontSize: 14, color: '#475569', marginBottom: 15}}>Densidad: <Text style={{fontWeight: '800', color: '#0f172a'}}>{selectedOrder?.data?.density || 'N/A'}</Text></Text>
              
              <Text style={{fontSize: 14, fontWeight: '800', color: '#334155', marginBottom: 4, textTransform: 'uppercase'}}>MP Comprometida (Fórmula)</Text>
              {selectedOrder?.status === 'EN_PROCESO' && (
                <Text style={{fontSize: 11, color: '#3b82f6', fontWeight: '700', marginBottom: 10}}>
                  ✏️ Toca el lápiz para ajustar la cantidad real usada
                </Text>
              )}
              {selectedOrder?.data?.ingredients?.map((ing, idx) => {
                if (ing.type === 'NOTE') {
                  return (
                    <View key={idx} style={styles.ingRow}>
                      <View style={{flex: 1}}>
                        <Text style={[{fontSize: 13, color: '#64748b', fontStyle: 'italic'}]}>Nota: {ing.text || ing.name}</Text>
                      </View>
                    </View>
                  );
                }

                const actual = selectedOrder?.data?.actualIngredients?.find(a => a.name === ing.name);
                const hasAdjustment = !!actual;
                
                // Formatear lotes de la MP
                const usedBatches = ing.batchesToConsume
                  ?.map(b => {
                    const hasProv = b.batchProvider && b.batchProvider !== 'S/D' && b.batchProvider !== 'S/L';
                    return hasProv ? `Prov: ${b.batchProvider} (Int: ${b.batchInternal})` : `Int: ${b.batchInternal || 'S/D'}`;
                  })
                  .join(' | ') || 'S/L';

                return (
                  <View key={idx} style={[styles.ingRow, hasAdjustment && styles.ingRowAdjusted]}>
                    <View style={{flex: 1}}>
                      <Text style={{fontSize: 13, fontWeight: '800', color: '#1e293b'}}>{ing.name || ing.ingredientName}</Text>
                      <Text style={{fontSize: 12, color: '#64748b'}}>
                        Fórmula: {ing.isGranel
                          ? `${((ing.requiredKg || ing.required) || 0).toFixed(2)} Kg (≈ ${(ing.required || 0).toFixed(2)} Lts)`
                          : `${(ing.required || 0).toFixed(2)} Kg`
                        }
                      </Text>
                      <Text style={{fontSize: 11, color: '#94a3b8', marginTop: 2, marginBottom: hasAdjustment ? 4 : 0}}>
                        Lote(s): {usedBatches}
                      </Text>
                      {hasAdjustment && (
                        <>
                          <Text style={{fontSize: 12, color: '#10b981', fontWeight: '800'}}>
                             Real: {actual.actualQty.toFixed(2)} {ing.isGranel ? 'Lts' : 'Kg'}
                            {actual.actualQty < ing.required ? ` (sobrante: ${(ing.required - actual.actualQty).toFixed(2)})` : actual.actualQty > ing.required ? ` (extra: ${(actual.actualQty - ing.required).toFixed(2)})` : ' (sin diferencia)'}
                          </Text>
                          {actual.note ? <Text style={{fontSize: 11, color: '#64748b', fontStyle: 'italic'}}>📝 {actual.note}</Text> : null}
                        </>
                      )}
                    </View>
                    {selectedOrder?.status === 'EN_PROCESO' && (
                      <TouchableOpacity
                        style={styles.editIngBtn}
                        onPress={() => handleOpenEditIngredient(ing, idx)}
                      >
                        <Pencil color={hasAdjustment ? '#10b981' : '#3b82f6'} size={18} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              
              {selectedOrder?.status === 'EN_PROCESO' && (
                <TouchableOpacity
                  onPress={() => setAddExtraIngModalVisible(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed', marginTop: 10 }}
                >
                  <Plus size={16} color="#64748b" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748b' }}>Añadir MP Extra de Ajuste</Text>
                </TouchableOpacity>
              )}
              
              {(() => {
                const productName = selectedOrder?.data?.formulaName || selectedOrder?.data?.itemName || '';
                const eigDoc = eigDocs.find(e => e.linkedName?.toUpperCase() === productName.toUpperCase());
                if (!eigDoc) return null;
                return (
                  <TouchableOpacity
                    onPress={() => setEigModalDoc(eigDoc)}
                    style={[styles.mainButton, { backgroundColor: '#0f766e', marginTop: 25 }]}
                  >
                    <ShieldAlert color="#fff" size={20} />
                    <Text style={styles.mainButtonText}>⚠️ Info EIG — {eigDoc.title}</Text>
                  </TouchableOpacity>
                );
              })()}
            </View>

            {selectedOrder?.status === 'ENVIADO' && (
              <TouchableOpacity style={[styles.mainButton, {backgroundColor: '#f59e0b'}]} onPress={handleAcceptOrder} disabled={processingOrder}>
                {processingOrder ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <CheckSquare color="#fff" size={20} />
                    <Text style={styles.mainButtonText}>Aceptar Orden (Iniciar)</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {selectedOrder?.status === 'EN_PROCESO' && (
              <TouchableOpacity style={[styles.mainButton, {backgroundColor: '#10b981'}]} onPress={handleFinalizeOrder} disabled={processingOrder}>
                {processingOrder ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <CheckCircle2 color="#fff" size={20} />
                    <Text style={styles.mainButtonText}>Finalizar y Enviar a BBS</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {(selectedOrder?.status === 'ENVIADO' || selectedOrder?.status === 'EN_PROCESO') && (
              <TouchableOpacity style={[styles.mainButton, {backgroundColor: '#ef4444', marginTop: 10}]} onPress={handleRejectOrder} disabled={processingOrder}>
                {processingOrder ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <XCircle color="#fff" size={20} />
                    <Text style={styles.mainButtonText}>Rechazar y Devolver Stock</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <View style={{height: 40}}/>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL EIG INFO */}
      <Modal visible={!!eigModalDoc} transparent animationType="fade" onRequestClose={() => setEigModalDoc(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 22, elevation: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <ShieldAlert size={22} color="#0f766e" />
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>{eigModalDoc?.title}</Text>
                  <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700', marginTop: 2 }}>{eigModalDoc?.linkedName}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setEigModalDoc(null)}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            {eigModalDoc?.notes ? (
              <View style={{ backgroundColor: '#f0fdfa', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <Text style={{ fontSize: 10, fontWeight: '900', color: '#0f766e', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Observaciones de Seguridad</Text>
                <Text style={{ fontSize: 14, color: '#134e4a', lineHeight: 22 }}>{eigModalDoc.notes}</Text>
              </View>
            ) : null}
            {eigModalDoc?.pdfUrl && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0369a1', padding: 14, borderRadius: 12, marginBottom: 10 }}
                onPress={() => Linking.openURL(eigModalDoc.pdfUrl).catch(() => Alert.alert('Error', 'No se pudo abrir el PDF.'))}
              >
                <FileText size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Abrir Hoja Técnica (PDF)</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setEigModalDoc(null)} style={{ alignItems: 'center', padding: 12 }}>
              <Text style={{ color: '#94a3b8', fontWeight: '800', fontSize: 14 }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL AJUSTE DE CANTIDAD REAL DE MP */}
      <Modal visible={editIngModalVisible} transparent animationType="slide" onRequestClose={() => setEditIngModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.calendarContainer, {padding: 24}]}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
              <Text style={{fontSize: 16, fontWeight: '900', color: '#0f172a', flex: 1}}>Ajuste de Uso Real</Text>
              <TouchableOpacity onPress={() => setEditIngModalVisible(false)} style={{padding: 4}}>
                <X color="#64748b" size={22} />
              </TouchableOpacity>
            </View>

            <Text style={{fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 4}}>{editingIngredient?.name}</Text>
            <Text style={{fontSize: 12, color: '#64748b', marginBottom: 16}}>
              Cantidad según fórmula: {(editingIngredient?.required || 0).toFixed(2)} Kg/Lts
            </Text>

            <Text style={{fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 6, textTransform: 'uppercase'}}>Cantidad Real Utilizada (Kg/Lts)</Text>
            <View style={styles.inputWrapper}>
              <Beaker color="#94a3b8" size={18} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={editQtyInput}
                onChangeText={setEditQtyInput}
                placeholderTextColor="#94a3b8"
              />
            </View>

            <Text style={{fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 6, marginTop: 14, textTransform: 'uppercase'}}>Motivo del ajuste (opcional)</Text>
            <View style={[styles.inputWrapper, {height: 70, alignItems: 'flex-start', paddingTop: 10}]}>
              <TextInput
                style={[styles.input, {flex: 1}]}
                placeholder="Ej: Se agotó el lote, se añadió menos por pH alto..."
                multiline
                value={editNoteInput}
                onChangeText={setEditNoteInput}
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={{flexDirection: 'row', gap: 10, marginTop: 20}}>
              <TouchableOpacity
                style={{flex: 1, backgroundColor: '#f1f5f9', padding: 14, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6}}
                onPress={() => {
                  setEditQtyInput(String(editingIngredient?.required || 0));
                  setEditNoteInput('');
                }}
              >
                <RotateCcw color="#64748b" size={16} />
                <Text style={{color: '#64748b', fontWeight: '700'}}>Restablecer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{flex: 2, backgroundColor: '#10b981', padding: 14, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6}}
                onPress={handleSaveIngredientAdjustment}
              >
                <CheckCircle2 color="#fff" size={18} />
                <Text style={{color: '#fff', fontWeight: '900', fontSize: 15}}>Guardar Ajuste</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL PARA AGREGAR MP EXTRA DE AJUSTE */}
      <Modal visible={addExtraIngModalVisible} transparent animationType="slide" onRequestClose={() => setAddExtraIngModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.calendarContainer, {padding: 24, zIndex: 1000}]}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
              <Text style={{fontSize: 16, fontWeight: '900', color: '#0f172a', flex: 1}}>Agregar MP Extra</Text>
              <TouchableOpacity onPress={() => setAddExtraIngModalVisible(false)} style={{padding: 4}}>
                <X color="#64748b" size={22} />
              </TouchableOpacity>
            </View>

            <Text style={{fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 6, textTransform: 'uppercase'}}>Materia Prima / Insumo</Text>
            <View style={{ zIndex: 2000 }}>
              <AutocompleteInput 
                data={RAW_MATERIALS_LIST}
                value={extraIngName}
                onChangeText={setExtraIngName}
                placeholder="Ej: MONOETALONAMINA"
                icon={<Beaker color="#94a3b8" size={18} />}
                allowCustom={true}
              />
            </View>

            <Text style={{fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 6, marginTop: 14, textTransform: 'uppercase'}}>Cantidad Real (Kg/Lts)</Text>
            <View style={styles.inputWrapper}>
              <Beaker color="#94a3b8" size={18} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={extraIngQty}
                onChangeText={setExtraIngQty}
                placeholderTextColor="#94a3b8"
              />
            </View>

            <Text style={{fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 6, marginTop: 14, textTransform: 'uppercase'}}>Motivo del ajuste</Text>
            <View style={[styles.inputWrapper, {height: 70, alignItems: 'flex-start', paddingTop: 10}]}>
              <TextInput
                style={[styles.input, {flex: 1}]}
                placeholder="Ej: Corrección de pH..."
                multiline
                value={extraIngNote}
                onChangeText={setExtraIngNote}
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={{flexDirection: 'row', gap: 10, marginTop: 20, zIndex: -1}}>
              <TouchableOpacity
                style={{flex: 1, backgroundColor: '#f1f5f9', padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center'}}
                onPress={() => setAddExtraIngModalVisible(false)}
              >
                <Text style={{color: '#64748b', fontWeight: '700'}}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{flex: 2, backgroundColor: '#10b981', padding: 14, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6}}
                onPress={handleSaveExtraIngredient}
              >
                <Plus color="#fff" size={18} />
                <Text style={{color: '#fff', fontWeight: '900', fontSize: 15}}>Añadir a la OP</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', 
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2,
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  headerSub: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: '800', letterSpacing: 0.5 },
  batchBadge: { backgroundColor: '#e0f2fe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginTop: 2 },
  batchBadgeText: { fontSize: 12, color: '#0369a1', fontWeight: '900', letterSpacing: 0.5 },
  
  container: { padding: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#334155', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  newOrderBtn: { backgroundColor: '#0f172a', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 14, marginBottom: 25 },
  newOrderBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, marginLeft: 8, letterSpacing: 0.5 },

  orderCard: { backgroundColor: '#fff', padding: 18, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  orderCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  orderCardTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b', flex: 1, marginRight: 10 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  orderCardSub: { fontSize: 12, color: '#64748b', marginBottom: 4 },

  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
  emptyText: { marginTop: 15, fontSize: 14, color: '#94a3b8', fontWeight: '600' },

  infoBanner: { flexDirection: 'row', backgroundColor: '#eff6ff', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#bfdbfe' },
  iconBox: { backgroundColor: '#dbeafe', padding: 12, borderRadius: 12, marginRight: 15, height: 48, justifyContent: 'center' },
  bannerTitle: { fontSize: 15, fontWeight: '800', color: '#1e3a8a', marginBottom: 4 },
  bannerText: { fontSize: 12, color: '#1e40af', lineHeight: 18 },
  
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 16, elevation: 2, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 15 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, fontSize: 16, color: '#0f172a', fontWeight: '600' },

  calcButton: { backgroundColor: '#3b82f6', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 14, marginTop: 10, gap: 10, elevation: 3 },

  requirementsCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, elevation: 2, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20 },
  reqTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  reqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  ingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8, marginBottom: 8 },
  ingRowAdjusted: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#6ee7b7' },
  editIngBtn: { backgroundColor: '#eff6ff', padding: 8, borderRadius: 10, marginLeft: 10 },
  reqName: { fontSize: 14, fontWeight: '800', color: '#334155' },
  reqDetail: { fontSize: 12, color: '#64748b', marginTop: 2 },
  missingText: { fontSize: 11, color: '#ef4444', fontWeight: '800', marginTop: 2 },
  
  batchesPreview: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  batchLine: { fontSize: 10, color: '#64748b', fontFamily: 'monospace', marginBottom: 2 },

  workflowAlert: { flexDirection: 'row', backgroundColor: '#fffbeb', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#fde68a', marginTop: 20 },
  workflowTitle: { fontSize: 13, fontWeight: '800', color: '#92400e', marginBottom: 2 },
  workflowText: { fontSize: 12, color: '#b45309', lineHeight: 18 },

  mainButton: { backgroundColor: '#10b981', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 14, marginTop: 20, gap: 10, elevation: 4 },
  mainButtonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  calendarContainer: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', elevation: 10 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  calendarTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' }
});
