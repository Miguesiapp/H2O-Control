import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Alert, StatusBar, ActivityIndicator, FlatList, Modal, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase';
import { collection, query, where, getDocs, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { registerMovement, createOrder, updateOrderStatus, checkTotalStock } from '../services/logisticsService'; 
import { ChevronLeft, Container, Save, CheckCircle2, FlaskConical, AlertCircle, Box, Droplet, Building2, Tag, Plus, ClipboardList, Play, CheckSquare, XCircle, ChevronDown, ChevronUp, Printer, ShieldAlert, FileText, X } from 'lucide-react-native';
import AutocompleteInput from '../components/AutocompleteInput';
import { EQUIVALENCIES_MAP, getBaseLabelName, PRODUCTS_FINAL_LIST, CAJA_BRANDS, BIDON_BRANDS, getCommercialNamesForGranel } from '../config/constants';
import { canCreateOrders, canChangeStatus } from '../config/permissions';
import { printOrder } from '../services/printService';
import Toast from 'react-native-toast-message';

const BIDON_CAPACITIES = ['1000', '20', '10', '5', '1'];
const BIDON_LABELS = { '1000': '1000L (Contenedor)', '20': '20L', '10': '10L', '5': '5L', '1': '1L' };

export default function PackagingOrderScreen({ route, navigation }) {
  const { companyName } = route.params;
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
    // Escuchar órdenes de tipo OE
    const q = query(
      collection(db, "Orders"),
      where("type", "==", "OE")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      const companyOrders = data.filter(o => o.data?.company === companyName);
      setOrders(companyOrders);
      setLoadingOrders(false);
      
      // Actualizar modal de OE
      setSelectedOrder(prev => {
        if (!prev) return null;
        const updated = companyOrders.find(o => o.id === prev.id);
        if (!updated) {
          setOrderModalVisible(false);
          return null;
        }
        return updated;
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

  // ======================================================================
  // ESTADOS DE LA VISTA CREACIÓN
  // ======================================================================
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvedLots, setApprovedLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [commercialName, setCommercialName] = useState('');
  const [expandedGroups, setExpandedGroups] = useState([]);
  
  const toggleGroup = (itemName) => {
    setExpandedGroups(prev => prev.includes(itemName) ? prev.filter(name => name !== itemName) : [...prev, itemName]);
  };
  
  const [formData, setFormData] = useState({
    presentation: '20', 
    unitsProduced: '',  
    brandBidon: 'H2O',
    brandCaja: 'H2O CON LOGO', 
  });

  useEffect(() => {
    const fetchApprovedLots = async () => {
      try {
        const q = query(
          collection(db, "Inventory"),
          where("company", "==", companyName),
          where("stockType", "==", "GRANEL"),
          where("status", "==", "APTO")
        );
        const querySnapshot = await getDocs(q);
        const lots = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(doc => (doc.quantity || 0) > 0);
        setApprovedLots(lots);
      } catch (error) {
        console.error(error);
        Toast.show({ type: 'error', text1: 'Error de Conexión', text2: 'No se pudieron cargar los lotes liberados.' });
      } finally {
        setLoading(false);
      }
    };
    if (viewMode === 'CREATE') {
      fetchApprovedLots();
    }
  }, [companyName, viewMode]);

  useEffect(() => {
    // Si cambia el PT, limpiamos el lote seleccionado porque podría no corresponder
    setSelectedLot(null);
  }, [commercialName]);

  const mappedGranelStr = commercialName ? (EQUIVALENCIES_MAP[commercialName.trim().toUpperCase()] || commercialName.trim().toUpperCase()) : '';
  const synonyms = mappedGranelStr.split('/').map(s => s.trim().toUpperCase());
  const filteredApprovedLots = commercialName ? approvedLots.filter(l => synonyms.some(syn => l.itemName?.toUpperCase().includes(syn))) : [];

  const units = Number(formData.unitsProduced) || 0;
  const presentation = Number(formData.presentation);
  const isContainer = formData.presentation === '1000';
  // Para contenedor: 'units' es directamente en Lts. Para bidones: units * presentacion
  const litersToConsume = isContainer ? units : units * presentation;
  const remainingLiters = selectedLot ? (selectedLot.quantity - litersToConsume) : 0;
  const isOverdraft = selectedLot && remainingLiters < 0;

  // Cajas solo aplican para bidones de 5L y 1L (nunca para contenedor)
  const appliesBox = !isContainer && (presentation === 5 || presentation === 1);
  let requiredBoxes = 0;
  let boxFormat = '';
  
  if (presentation === 5) {
    requiredBoxes = Math.ceil(units / 4);
    boxFormat = 'x5';
  } else if (presentation === 1) {
    requiredBoxes = Math.ceil(units / 12);
    boxFormat = 'x1';
  }

  const handleCreateOrder = async () => {
    if (!selectedLot || units <= 0 || !commercialName.trim()) {
      Toast.show({ type: 'error', text1: 'Atención', text2: 'Selecciona un lote, un nombre comercial, y la cantidad.' });
      return;
    }
    setIsSubmitting(true);

    try {
      const currentUser = auth.currentUser?.email || 'Sistema';
      const batchId = selectedLot.batchInternal; 
      const itemName = selectedLot.itemName?.toUpperCase();

      // Variables de Búsqueda Generalizada (Fuzzy) para usarse después en la deducción
      const capacityKeywords = [`${presentation}L`, `${presentation} L`, `${presentation} LTS`, `${presentation}LTS`];
      const fuzzyBidon = ['BIDON', capacityKeywords, formData.brandBidon];
      
      const boxKeywords = [boxFormat, `${presentation}L`, `${presentation} L`, `X ${presentation}L`, `X${presentation}L`];
      const fuzzyCaja = appliesBox ? ['CAJA', boxKeywords, formData.brandCaja] : null;

      const baseLabelName = getBaseLabelName(commercialName);
      const labelKeywords = [baseLabelName, commercialName];
      const fuzzyEtiqueta = ['ETIQUETA', capacityKeywords, labelKeywords];

      if (isContainer) {
        // === MODO CONTENEDOR: sin bidones, cajas ni etiquetas ===
        // Solo se verifica el granel disponible
        if (units > selectedLot.quantity) {
          setIsSubmitting(false);
          Toast.show({ type: 'error', text1: 'Granel Insuficiente', text2: `Disponible: ${selectedLot.quantity.toFixed(2)} Lts. Solicitado: ${units} Lts.` });
          return;
        }
      } else {
        // === MODO BIDÓN: verificar insumos (Búsqueda Generalizada / Fuzzy) ===
        // 0. VERIFICACIÓN Y CÁLCULO DE ÓRDENES PARCIALES
        
        const bidonStock = await checkTotalStock('STOCK_CENTRAL_INSUMOS', fuzzyBidon);
        const cajaStock = appliesBox ? await checkTotalStock('STOCK_CENTRAL_INSUMOS', fuzzyCaja) : Infinity;
        const etiquetaStock = await checkTotalStock('STOCK_CENTRAL_INSUMOS', fuzzyEtiqueta);

        const maxUnitsGranel = Math.floor(selectedLot.quantity / presentation);
        let maxUnitsCaja = Infinity;
        if (presentation === 5) maxUnitsCaja = cajaStock * 4;
        else if (presentation === 1) maxUnitsCaja = cajaStock * 12;
        const maxPossibleUnits = Math.floor(Math.min(maxUnitsGranel, bidonStock, maxUnitsCaja, etiquetaStock));

        if (units > maxPossibleUnits) {
          setIsSubmitting(false);
          let limitReason = 'el Granel disponible';
          if (maxPossibleUnits === bidonStock) limitReason = `los Bidones disponibles (${bidonStock})`;
          else if (maxPossibleUnits === maxUnitsCaja) limitReason = `las Cajas disponibles (${cajaStock})`;
          else if (maxPossibleUnits === etiquetaStock) limitReason = `las Etiquetas disponibles (${etiquetaStock})`;
          
          if (maxPossibleUnits > 0) {
            if (Platform.OS === 'web') {
              const confirm = window.confirm(`Stock Insuficiente (limitado por ${limitReason}). Puedes envasar máximo ${maxPossibleUnits} unidades.\n\n¿Deseas ajustar la orden a esta cantidad?`);
              if (confirm) setFormData({...formData, unitsProduced: String(maxPossibleUnits)});
            } else {
              Alert.alert(
                'Stock Insuficiente',
                `Limitado por ${limitReason}.\nPuedes envasar como máximo ${maxPossibleUnits} unidades.\n\n¿Deseas ajustar la orden?`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: `Ajustar a ${maxPossibleUnits}`, onPress: () => setFormData({...formData, unitsProduced: String(maxPossibleUnits)}) }
                ]
              );
            }
          } else {
            let missing = [];
            if (maxUnitsGranel <= 0) missing.push('Granel');
            if (bidonStock <= 0) missing.push('Bidones');
            if (appliesBox && cajaStock <= 0) missing.push('Cajas');
            if (etiquetaStock <= 0) missing.push(`Etiquetas (${baseLabelName})`);
            Toast.show({ type: 'error', text1: 'Stock Insuficiente (0 Unidades)', text2: `Falta stock de: ${missing.join(', ')}` });
          }
          return;
        }
        // Guardar para uso posterior
        setIsSubmitting(true); // mantener activo
      }

      // 1. DEDUCCIÓN AUTOMÁTICA DEL LÍQUIDO A GRANEL
      await registerMovement(currentUser, 'CONSUMO_ENVASADO', companyName, {
          itemName: itemName,
          quantity: -Math.abs(litersToConsume), 
          stockType: 'GRANEL',
          batchInternal: batchId,
          unit: 'Lts'
      });

      if (!isContainer) {

        // 2. DEDUCCIÓN DE INSUMOS CENTRALES (BIDONES) - Búsqueda Generalizada FIFO
        await registerMovement(currentUser, 'CONSUMO_ENVASADO_BIDON', 'STOCK_CENTRAL_INSUMOS', {
            itemName: fuzzyBidon,
            quantity: -Math.abs(units),
            stockType: 'INSUMOS',
            batchInternal: batchId,
            unit: 'Uds'
        });

        // 3. DEDUCCIÓN DE INSUMOS CENTRALES (CAJAS) - Búsqueda Generalizada FIFO si aplica
        if (appliesBox && requiredBoxes > 0) {
          await registerMovement(currentUser, 'CONSUMO_ENVASADO_CAJA', 'STOCK_CENTRAL_INSUMOS', {
              itemName: fuzzyCaja,
              quantity: -Math.abs(requiredBoxes),
              stockType: 'INSUMOS',
              batchInternal: batchId,
              unit: 'Uds'
          });
        }

        // 4. DEDUCCIÓN DE INSUMOS CENTRALES (ETIQUETAS) - Búsqueda Generalizada FIFO
        await registerMovement(currentUser, 'CONSUMO_INSUMO', 'STOCK_CENTRAL_INSUMOS', {
            itemName: fuzzyEtiqueta,
            quantity: -Math.abs(units),
            stockType: 'INSUMOS',
            batchInternal: batchId,
            unit: 'Uds'
        });
      } // fin !isContainer

      // Nombre del producto final envasado
      const packagedItemName = isContainer
        ? `${commercialName.trim().toUpperCase()} - CONTENEDOR 1000L`
        : `${commercialName.trim().toUpperCase()} - ${presentation}L`;

      // 4. CREA LA ORDEN EN MÁQUINA DE ESTADOS (Ticket ENVIADO)
      const orderData = {
        itemName: packagedItemName,
        quantity: isContainer ? litersToConsume : units,
        litersConsumed: litersToConsume,
        presentation: isContainer ? 1000 : presentation,
        brandBidon: isContainer ? 'CONTENEDOR' : formData.brandBidon,
        brandCaja: appliesBox ? formData.brandCaja : null,
        requiredBoxes: appliesBox ? requiredBoxes : 0,
        batchInternal: batchId,
        batchProvider: selectedLot.batchProvider || 'S/D',
        expiryDate: selectedLot.expiryDate || 'S/V',
        company: companyName,
        unit: isContainer ? 'Lts' : 'Uds'
      };

      await createOrder('OE', orderData, currentUser);

      Toast.show({
        type: 'success',
        text1: 'OE Emitida con Éxito',
        text2: `Se reservaron ${litersToConsume} Lts de Granel.`
      });

      setViewMode('LIST');
      setSelectedLot(null);
      setCommercialName('');
      setFormData({
        presentation: '20', 
        unitsProduced: '',  
        brandBidon: 'H2O',
        brandCaja: 'H2O CON LOGO', 
      });
    } catch (error) {
      console.error(error);
      Toast.show({ type: 'error', text1: 'Error del Sistema', text2: 'No se pudo emitir la orden.' });
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
      Toast.show({ type: 'info', text1: 'Orden Aceptada', text2: 'El envasado ha comenzado.' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo aceptar la orden.' });
    } finally {
      setProcessingOrder(false);
    }
  };

  const handleFinalizeOrder = async () => {
    if (!selectedOrder) return;
    try {
      setProcessingOrder(true);
      const currentUser = auth.currentUser?.email || 'Sistema';
      
      // 1. Finalizar Ticket
      await updateOrderStatus(selectedOrder.id, 'FINALIZADO', currentUser);

      // 2. Inyectar Producto Terminado (FINAL)
      const orderData = selectedOrder.data;
      await registerMovement(currentUser, 'INGRESO_OE', orderData.company, {
          itemName: orderData.itemName,
          quantity: orderData.quantity,
          stockType: 'FINAL',
          batchInternal: orderData.batchInternal,
          unit: orderData.unit,
          status: 'APTO', 
          batchProvider: orderData.batchProvider,
          expiryDate: orderData.expiryDate 
      });

      Toast.show({ type: 'success', text1: 'Orden Finalizada', text2: 'Inventario final actualizado.' });
      setOrderModalVisible(false);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo finalizar la orden.' });
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
          <Text style={styles.headerTitle}>Órdenes de Envasado</Text>
          <Text style={styles.headerSub}>{companyName}</Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      {viewMode === 'LIST' ? (
        <View style={styles.container}>
          {canCreateOrders(auth.currentUser?.email) && (
            <TouchableOpacity style={styles.newOrderBtn} onPress={() => setViewMode('CREATE')}>
              <Plus color="#fff" size={20} />
              <Text style={styles.newOrderBtnText}>NUEVA OE</Text>
            </TouchableOpacity>
          )}
          
          <Text style={styles.sectionTitle}>Órdenes Recientes</Text>
          
          {loadingOrders ? (
            <ActivityIndicator color="#3b82f6" style={{ marginTop: 40 }} />
          ) : orders.length === 0 ? (
            <View style={styles.emptyBox}>
              <ClipboardList color="#cbd5e1" size={48} />
              <Text style={styles.emptyText}>No hay órdenes de envasado registradas.</Text>
            </View>
          ) : (
            <FlatList maximumZoomScale={1} 
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
                  <Text style={styles.orderCardSub}>Cantidad: <Text style={{fontWeight: '700', color: '#0f172a'}}>{item.data.quantity} {item.data.unit === 'Lts' ? 'Lts' : 'Uds'}</Text></Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      ) : (
        <ScrollView maximumZoomScale={1} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          <View style={styles.infoBanner}>
            <View style={styles.iconBox}>
              <Container color="#3b82f6" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Fraccionamiento y Envasado</Text>
              <Text style={styles.bannerText}>Selecciona el lote de granel (aprobado por calidad) y los insumos utilizados.</Text>
            </View>
          </View>

          {/* 1. SELECCIÓN DE PRODUCTO TERMINADO */}
          <Text style={styles.sectionTitle}>1. Producto a Envasar (PT)</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Nombre Comercial del Producto Final</Text>
            <AutocompleteInput 
              data={PRODUCTS_FINAL_LIST}
              value={commercialName}
              onChangeText={setCommercialName}
              placeholder="Ej: ACTION"
              icon={<Tag color="#94a3b8" size={20} />}
              allowCustom={true}
            />
          </View>

          {/* 2. SELECCIÓN DE LOTE GRANEL */}
          {commercialName ? (
            <>
              <Text style={styles.sectionTitle}>2. Lote de Granel Aprobado</Text>
              <View style={styles.card}>
                {loading ? (
                  <ActivityIndicator color="#3b82f6" size="large" style={{ marginVertical: 20 }} />
                ) : filteredApprovedLots.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <AlertCircle color="#94a3b8" size={32} style={{marginBottom: 10}}/>
                    <Text style={styles.emptyText}>No hay lotes de GRANEL aprobados disponibles para este producto.</Text>
                  </View>
                ) : (
                  (() => {
                    const groupedApprovedLots = filteredApprovedLots.reduce((acc, lot) => {
                      const name = lot.itemName || 'S/N';
                      if (!acc[name]) {
                        acc[name] = {
                          itemName: name,
                          totalQuantity: 0,
                          lots: []
                        };
                      }
                      acc[name].totalQuantity += lot.quantity;
                      acc[name].lots.push(lot);
                      return acc;
                    }, {});

                const sortedGroupedLots = Object.values(groupedApprovedLots).sort((a, b) => a.itemName.localeCompare(b.itemName));

                return sortedGroupedLots.map((group) => {
                  const isExpanded = expandedGroups.includes(group.itemName);
                  return (
                    <View key={group.itemName} style={styles.groupContainer}>
                      <TouchableOpacity 
                        style={styles.groupHeader}
                        onPress={() => toggleGroup(group.itemName)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.groupTitle}>{group.itemName}</Text>
                          <Text style={styles.groupSub}>Disponible: {group.totalQuantity.toFixed(2)} Lts ({group.lots.length} Lote/s)</Text>
                        </View>
                        {isExpanded ? <ChevronUp color="#64748b" size={20} /> : <ChevronDown color="#64748b" size={20} />}
                      </TouchableOpacity>
                      
                      {isExpanded && (
                        <View style={styles.groupContent}>
                          {group.lots.map((lot) => (
                            <TouchableOpacity
                              key={lot.id}
                              style={[styles.lotCard, selectedLot?.id === lot.id && styles.lotCardSelected]}
                              onPress={() => setSelectedLot(lot)}
                            >
                              <View style={styles.lotHeader}>
                                <Text style={[styles.lotName, selectedLot?.id === lot.id && styles.lotNameSelected]}>
                                  {lot.itemName}
                                </Text>
                                {selectedLot?.id === lot.id && <CheckCircle2 color="#3b82f6" size={20} />}
                              </View>
                              <Text style={styles.lotText}>Lote Interno: {lot.batchInternal}</Text>
                              <Text style={styles.lotText}>Disponible: {lot.quantity.toFixed(2)} Lts</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                });
              })()
            )}
          </View>
            </>
          ) : null}

          {/* 3. PARÁMETROS DE ENVASADO E INSUMOS */}
          {selectedLot && (
            <>
              <Text style={styles.sectionTitle}>3. Parámetros de Envasado e Insumos</Text>
              <View style={styles.card}>

                <Text style={styles.label}>Capacidad / Tipo de Envase</Text>
                <View style={styles.chipRow}>
                  {BIDON_CAPACITIES.map(cap => (
                    <TouchableOpacity 
                      key={cap} 
                      style={[styles.chip, formData.presentation === cap && styles.chipActive, cap === 1000 && styles.chipContainer]}
                      onPress={() => setFormData({...formData, presentation: cap})}
                    >
                      <Droplet color={formData.presentation === cap ? '#fff' : (cap === 1000 ? '#7c3aed' : '#64748b')} size={14} style={{marginRight: 4}}/>
                      <Text style={[styles.chipText, formData.presentation === cap && styles.chipTextActive]}>{BIDON_LABELS[cap] || `${cap}L`}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {!isContainer && (
                  <>
                    <Text style={styles.label}>Marca del Bidón</Text>
                    <View style={styles.chipRow}>
                      {BIDON_BRANDS.map(brand => (
                        <TouchableOpacity 
                          key={brand} 
                          style={[styles.chip, formData.brandBidon === brand && styles.chipActive]}
                          onPress={() => setFormData({...formData, brandBidon: brand})}
                        >
                          <Building2 color={formData.brandBidon === brand ? '#fff' : '#64748b'} size={14} style={{marginRight: 4}}/>
                          <Text style={[styles.chipText, formData.brandBidon === brand && styles.chipTextActive]}>{brand}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{isContainer ? 'Litros a Envasar (Contenedor)' : 'Unidades (Bidones) a Envasar'}</Text>
                  <View style={styles.inputWrapper}>
                    <Container color="#94a3b8" size={20} style={styles.inputIcon} />
                    <TextInput 
                      style={styles.input} 
                      placeholder="Ej: 160" 
                      keyboardType="numeric"
                      value={formData.unitsProduced}
                      onChangeText={(txt) => setFormData({...formData, unitsProduced: txt})}
                    />
                  </View>
                </View>

                {appliesBox && (
                  <>
                    <View style={styles.divider} />
                    <Text style={styles.label}>Marca de las Cajas ({boxFormat})</Text>
                    <View style={styles.chipRow}>
                      {CAJA_BRANDS.map(brand => (
                        <TouchableOpacity 
                          key={brand} 
                          style={[styles.chip, formData.brandCaja === brand && styles.chipActive]}
                          onPress={() => setFormData({...formData, brandCaja: brand})}
                        >
                          <Box color={formData.brandCaja === brand ? '#fff' : '#64748b'} size={14} style={{marginRight: 4}}/>
                          <Text style={[styles.chipText, formData.brandCaja === brand && styles.chipTextActive]}>{brand}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.calcHelper}>
                      Se descontarán {requiredBoxes} cajas automáticamente.
                    </Text>
                  </>
                )}

              </View>

              {/* 3. RESUMEN Y CONFIRMACIÓN */}
              <Text style={styles.sectionTitle}>3. Impacto de Stock</Text>
              <View style={styles.impactCard}>
                <View style={styles.impactRow}>
                  <Text style={styles.impactLabel}>Granel a Consumir:</Text>
                  <Text style={[styles.impactValue, isOverdraft && {color: '#ef4444'}]}>
                    -{litersToConsume} Lts
                  </Text>
                </View>
                <View style={styles.impactRow}>
                  <Text style={styles.impactLabel}>Saldo Final en Lote:</Text>
                  <Text style={[styles.impactValue, isOverdraft && {color: '#ef4444'}]}>
                    {remainingLiters.toFixed(2)} Lts
                  </Text>
                </View>
                
                <View style={[styles.divider, { backgroundColor: '#e2e8f0' }]} />
                
                <View style={styles.impactRow}>
                  <Text style={styles.impactLabel}>Prod. Terminado a Generar:</Text>
                  <Text style={[styles.impactValue, {color: '#10b981'}]}>
                    +{units} Bidones de {commercialName.toUpperCase() || '...'} {presentation}L
                  </Text>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.submitBtn, (isSubmitting || isOverdraft || units <= 0) && { opacity: 0.5 }]}
                disabled={isSubmitting || isOverdraft || units <= 0}
                onPress={handleCreateOrder}
              >
                {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <Play color="#fff" size={24} fill="#fff" />
                    <Text style={styles.submitText}>CONFIRMAR Y EMITIR OE</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
          <View style={{height: 50}} />
        </ScrollView>
      )}

      {/* MODAL DETALLES DE ORDEN */}
      <Modal visible={orderModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOrderModalVisible(false)}>
        <SafeAreaView style={{flex: 1, backgroundColor: '#f8fafc'}}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setOrderModalVisible(false)} style={styles.backBtn}>
              <ChevronLeft color="#0f172a" size={28} />
            </TouchableOpacity>
            <View style={{alignItems: 'center'}}>
              <Text style={styles.headerTitle}>Detalle de OE</Text>
              <Text style={styles.headerSub}>{selectedOrder?.data?.batchInternal}</Text>
            </View>
            <TouchableOpacity onPress={() => selectedOrder && printOrder(selectedOrder)} style={{ padding: 8, backgroundColor: '#3b82f6', borderRadius: 8 }}>
              <Printer color="#fff" size={20} />
            </TouchableOpacity>
          </View>
          <ScrollView maximumZoomScale={1} style={{flex: 1, padding: 20}}>
            <View style={styles.card}>
              <Text style={{fontSize: 20, fontWeight: '900', color: '#0f172a', marginBottom: 5}}>{selectedOrder?.data?.itemName}</Text>
              <View style={[styles.statusBadge, { alignSelf: 'flex-start', backgroundColor: getStatusColor(selectedOrder?.status), marginBottom: 15 }]}>
                 <Text style={styles.statusText}>{selectedOrder?.status}</Text>
              </View>
              <Text style={{fontSize: 14, color: '#475569', marginBottom: 5}}>Cantidad: <Text style={{fontWeight: '800', color: '#0f172a'}}>{selectedOrder?.data?.quantity} Bidones ({selectedOrder?.data?.presentation}L)</Text></Text>
              <Text style={{fontSize: 14, color: '#475569', marginBottom: 5}}>Granel Consumido: <Text style={{fontWeight: '800', color: '#0f172a'}}>{selectedOrder?.data?.litersConsumed} Lts</Text></Text>
              <Text style={{fontSize: 14, color: '#475569', marginBottom: 15}}>Lote de Origen: <Text style={{fontWeight: '800', color: '#0f172a'}}>{selectedOrder?.data?.batchInternal}</Text></Text>
              
              <Text style={{fontSize: 14, fontWeight: '800', color: '#334155', marginBottom: 10, textTransform: 'uppercase'}}>Insumos Reservados</Text>
              <View style={{backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8, marginBottom: 8}}>
                <Text style={{fontSize: 13, fontWeight: '800', color: '#1e293b'}}>BIDON {selectedOrder?.data?.presentation}L {selectedOrder?.data?.brandBidon}</Text>
                <Text style={{fontSize: 12, color: '#64748b'}}>Consumo: {selectedOrder?.data?.quantity} Uds</Text>
              </View>
              {selectedOrder?.data?.requiredBoxes > 0 && (
                <View style={{backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8, marginBottom: 8}}>
                  <Text style={{fontSize: 13, fontWeight: '800', color: '#1e293b'}}>CAJA {selectedOrder?.data?.brandCaja}</Text>
                  <Text style={{fontSize: 12, color: '#64748b'}}>Consumo: {selectedOrder?.data?.requiredBoxes} Uds</Text>
                </View>
              )}
              
              {(() => {
                const productName = selectedOrder?.data?.productName || selectedOrder?.data?.formulaName || '';
                const eigDoc = eigDocs.find(e => e.linkedName?.toUpperCase() === productName.toUpperCase());
                if (!eigDoc) return null;
                return (
                  <TouchableOpacity
                    onPress={() => setEigModalDoc(eigDoc)}
                    style={[styles.mainButton, { backgroundColor: '#0f766e', marginTop: 15 }]}
                  >
                    <ShieldAlert color="#fff" size={20} />
                    <Text style={[styles.submitText, { color: '#fff' }]}>⚠️ Info EIG — {eigDoc.title}</Text>
                  </TouchableOpacity>
                );
              })()}
            </View>

            {selectedOrder?.status === 'ENVIADO' && (
              <TouchableOpacity style={[styles.mainButton, {backgroundColor: '#f59e0b'}]} onPress={handleAcceptOrder} disabled={processingOrder}>
                {processingOrder ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <CheckSquare color="#fff" size={20} />
                    <Text style={styles.submitText}>Aceptar Orden (Iniciar)</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {selectedOrder?.status === 'EN_PROCESO' && (
              <TouchableOpacity style={[styles.mainButton, {backgroundColor: '#10b981'}]} onPress={handleFinalizeOrder} disabled={processingOrder}>
                {processingOrder ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <CheckCircle2 color="#fff" size={20} />
                    <Text style={styles.submitText}>Finalizar (Terminado a Stock)</Text>
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2 
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  headerSub: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
  
  container: { padding: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 12, marginLeft: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  newOrderBtn: { backgroundColor: '#0f172a', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 14, marginBottom: 25 },
  newOrderBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, marginLeft: 8, letterSpacing: 0.5 },

  orderCard: { backgroundColor: '#fff', padding: 18, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  orderCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  orderCardTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b', flex: 1, marginRight: 10 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  orderCardSub: { fontSize: 12, color: '#64748b', marginBottom: 4 },

  infoBanner: { flexDirection: 'row', backgroundColor: '#eff6ff', padding: 15, borderRadius: 16, marginBottom: 25, borderWidth: 1, borderColor: '#bfdbfe', alignItems: 'center' },
  iconBox: { backgroundColor: '#fff', padding: 10, borderRadius: 12, marginRight: 15, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  bannerTitle: { fontSize: 15, fontWeight: '800', color: '#1e3a8a', marginBottom: 4 },
  bannerText: { fontSize: 12, color: '#3b82f6', lineHeight: 18, fontWeight: '500' },
  
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 25, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  label: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 8, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  emptyBox: { alignItems: 'center', padding: 20, paddingVertical: 50 },
  emptyText: { color: '#64748b', textAlign: 'center', fontWeight: '500', marginTop: 15 },

  lotCard: { backgroundColor: '#f8fafc', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 16, padding: 15, marginBottom: 10 },
  lotCardSelected: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  lotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  lotName: { fontSize: 15, fontWeight: '800', color: '#334155' },
  lotNameSelected: { color: '#1e3a8a' },
  lotText: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 2 },
  
  groupContainer: { marginBottom: 12, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, backgroundColor: '#f8fafc' },
  groupTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginBottom: 2 },
  groupSub: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  groupContent: { padding: 15, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  chipTextActive: { color: '#fff' },
  chipContainer: { borderColor: '#7c3aed', borderWidth: 1.5 },

  inputGroup: { marginTop: 10 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 15 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, color: '#0f172a', fontSize: 16, fontWeight: '600' },
  
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 15 },
  calcHelper: { fontSize: 12, color: '#10b981', fontWeight: '700', fontStyle: 'italic' },

  impactCard: { backgroundColor: '#f8fafc', padding: 20, borderRadius: 20, marginBottom: 25, borderWidth: 1, borderColor: '#e2e8f0' },
  impactRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  impactLabel: { fontSize: 13, color: '#64748b', fontWeight: '700' },
  impactValue: { fontSize: 14, fontWeight: '800', color: '#334155' },

  submitBtn: { backgroundColor: '#10b981', flexDirection: 'row', padding: 18, borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1, marginLeft: 10 },
  mainButton: { backgroundColor: '#10b981', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 14, marginTop: 20, gap: 10, elevation: 4 },
});