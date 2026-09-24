import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Alert, StatusBar, ActivityIndicator, FlatList, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { registerMovement, createOrder, updateOrderStatus } from '../services/logisticsService';
import { ChevronLeft, Truck, Send, PackageMinus, MapPin, Hash, ClipboardType, Plus, ClipboardList, CheckSquare, CheckCircle2, Play, Droplet, ChevronDown, X, Printer } from 'lucide-react-native';
import { canCreateOrders } from '../config/permissions';
import { printOrder } from '../services/printService';

const BIDON_CAPACITIES = ['1000', '20', '10', '5', '1'];
const BIDON_LABELS = { '1000': '1000L (Contenedor)', '20': '20L', '10': '10L', '5': '5L', '1': '1L' };

export default function OutgoingInventoryScreen({ route, navigation }) {
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

  useEffect(() => {
    // Escuchar órdenes de tipo OD (Orden de Despacho)
    const q = query(
      collection(db, "Orders"),
      where("type", "==", "OD")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() : Date.now()) - (typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() : Date.now()));
      const companyOrders = data.filter(o => o.data?.company === companyName);
      setOrders(companyOrders);
      setLoadingOrders(false);
      
      if (selectedOrder) {
        const updated = companyOrders.find(o => o.id === selectedOrder.id);
        if (updated) setSelectedOrder(updated);
        else setOrderModalVisible(false);
      }
    }, (error) => {
      console.error(error);
      setLoadingOrders(false);
    });
    return () => unsubscribe();
  }, [companyName, selectedOrder]);

  // ======================================================================
  // ESTADOS DE LA VISTA CREACIÓN
  // ======================================================================
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [availableBatches, setAvailableBatches] = useState([]);
  const [availablePresentations, setAvailablePresentations] = useState({}); // { '20': 48, '1': 26, ... }
  const [allFinalStock, setAllFinalStock] = useState([]);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  
  const [formData, setFormData] = useState({
    productName: '',
    presentation: '20',
    quantity: '',
    batchInternal: '',
    clientName: ''
  });

  useEffect(() => {
    if (viewMode !== 'CREATE') return;
    const inventoryRef = collection(db, 'Inventory');
    const qStock = query(
      inventoryRef,
      where('company', '==', companyName),
      where('stockType', '==', 'FINAL'),
      where('quantity', '>', 0)
    );
    const unsubStock = onSnapshot(qStock, (snap) => {
      const stockItems = snap.docs.map(doc => doc.data());
      setAllFinalStock(stockItems);
      const products = [...new Set(stockItems.map(item => item.itemName ? item.itemName.split(' - ')[0] : ''))].filter(name => name !== '').sort();
      setAvailableProducts(products);
    }, (error) => {
      console.error("Error cargando stock", error);
    });
    return () => unsubStock();
  }, [companyName, viewMode]);

  // Cuando cambia el producto, calcular qué presentaciones tienen stock y auto-seleccionar
  useEffect(() => {
    if (!formData.productName) {
      setAvailablePresentations({});
      return;
    }
    const productUpper = formData.productName.toUpperCase();
    const presMap = {}; // { '1': totalQty, '20': totalQty, '1000': totalQty }
    allFinalStock.forEach(item => {
      if (!item.itemName) return;
      const itemUpper = item.itemName.toUpperCase();
      if (!itemUpper.startsWith(productUpper + ' - ')) return;
      const suffix = itemUpper.slice(productUpper.length + 3); // e.g. '20L' o 'CONTENEDOR 1000L'
      let pres = null;
      if (suffix === 'CONTENEDOR 1000L') pres = '1000';
      else {
        const match = suffix.match(/^(\d+)L$/);
        if (match) pres = match[1];
      }
      if (pres) presMap[pres] = (presMap[pres] || 0) + (item.quantity || 0);
    });
    setAvailablePresentations(presMap);
    // Auto-seleccionar la primera presentación con stock si la actual no tiene
    const orderedPres = ['20', '10', '5', '1', '1000'];
    const currentHasStock = presMap[formData.presentation] > 0;
    if (!currentHasStock) {
      const firstWithStock = orderedPres.find(p => (presMap[p] || 0) > 0);
      if (firstWithStock) {
        setFormData(prev => ({ ...prev, presentation: firstWithStock, batchInternal: '' }));
      }
    }
  }, [formData.productName, allFinalStock]);

  useEffect(() => {
    if (formData.productName && formData.presentation) {
      const isContainer = formData.presentation === '1000';
      const targetItemName = isContainer
        ? `${formData.productName.toUpperCase()} - CONTENEDOR 1000L`
        : `${formData.productName.toUpperCase()} - ${formData.presentation}L`;
      const batches = allFinalStock
        .filter(item => item.itemName && item.itemName.toUpperCase() === targetItemName)
        .map(item => ({
          batchInternal: item.batchInternal,
          quantity: item.quantity || 0,
          batchProvider: item.batchProvider || 'S/D'
        }))
        .filter((b, i, arr) => arr.findIndex(x => x.batchInternal === b.batchInternal) === i)
        .sort((a, b) => b.quantity - a.quantity);
      setAvailableBatches(batches);
    } else {
      setAvailableBatches([]);
    }
  }, [formData.productName, formData.presentation, allFinalStock]);


  const handleCreateOrder = async () => {
    const qtyNormalized = Number(formData.quantity.replace(',', '.'));

    if (!formData.productName.trim() || isNaN(qtyNormalized) || qtyNormalized <= 0 || !formData.batchInternal.trim()) {
      Alert.alert("Atención", "Verifica que el Producto, el Lote y una cantidad válida mayor a 0 estén ingresados.");
      return;
    }

    try {
      setIsSubmitting(true);
      const isContainer = formData.presentation === '1000';
      const itemName = isContainer
        ? `${formData.productName.trim().toUpperCase()} - CONTENEDOR 1000L`
        : `${formData.productName.trim().toUpperCase()} - ${formData.presentation}L`;
      const batchId = formData.batchInternal.trim().toUpperCase();
      const currentUser = auth.currentUser?.email || 'Sistema';
      const dispatchUnit = isContainer ? 'Lts' : 'Uds';

      // 1. VERIFICACIÓN PREVIA DE STOCK
      const inventoryRef = collection(db, 'Inventory');
      const qStock = query(
        inventoryRef, 
        where('company', '==', companyName),
        where('itemName', '==', itemName),
        where('batchInternal', '==', batchId),
        where('stockType', '==', 'FINAL')
      );
      const stockSnap = await getDocs(qStock);
      
      let currentStock = 0;
      let batchProvider = 'S/D';
      
      if (!stockSnap.empty) {
        const itemDoc = stockSnap.docs[0].data();
        currentStock = itemDoc.quantity || 0;
        batchProvider = itemDoc.batchProvider || 'S/D';
      }

      if (currentStock < qtyNormalized) {
         Alert.alert(
           "Stock Insuficiente",
           `Solo hay ${currentStock} unidades del lote ${batchId}. No puedes despachar ${qtyNormalized}.`
         );
         setIsSubmitting(false);
         return;
      }

      // 2. REGISTRAR EL EGRESO (RESERVA FÍSICA INMEDIATA)
      await registerMovement(
        currentUser,
        'EGRESO_DESPACHO_CLIENTE',
        companyName,
        {
          itemName: itemName,
          quantity: -Math.abs(qtyNormalized), 
          batchInternal: batchId,
          loteProveedor: batchProvider,
          stockType: 'FINAL', 
          unit: dispatchUnit,
          clientName: formData.clientName.trim()
        }
      );

      // 3. CREAR EL TICKET OD
      const orderData = {
        itemName: itemName,
        quantity: qtyNormalized,
        batchInternal: batchId,
        batchProvider: batchProvider,
        company: companyName,
        clientName: formData.clientName.trim(),
        unit: dispatchUnit
      };

      await createOrder('OD', orderData, currentUser);

      Alert.alert(
        "Orden de Despacho Emitida", 
        `Se ha reservado stock y enviado a la cola de despacho.\nLote: ${batchId}\nCantidad: ${qtyNormalized} ${dispatchUnit}.`,
        [{ text: "Entendido", onPress: () => {
          setViewMode('LIST');
          setFormData({
            productName: '',
            presentation: '20',
            quantity: '',
            batchInternal: '',
            clientName: ''
          });
        }}]
      );
      
    } catch (error) {
      console.error(error);
      Alert.alert("Error de Sistema", "No se pudo emitir la orden de despacho.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ======================================================================
  // FUNCIONES DE ESTADO DE ÓRDEN
  // ======================================================================
  const handleAcceptOrder = async () => {
    if (!selectedOrder) return;
    try {
      setProcessingOrder(true);
      const currentUser = auth.currentUser?.email || 'Sistema';
      await updateOrderStatus(selectedOrder.id, 'EN_PROCESO', currentUser);
      Alert.alert("Carga Iniciada", "El transporte está siendo cargado.");
    } catch (error) {
      Alert.alert("Error", "No se pudo actualizar la orden.");
    } finally {
      setProcessingOrder(false);
    }
  };

  const handleFinalizeOrder = async () => {
    if (!selectedOrder) return;
    try {
      setProcessingOrder(true);
      const currentUser = auth.currentUser?.email || 'Sistema';
      await updateOrderStatus(selectedOrder.id, 'FINALIZADO', currentUser);
      Alert.alert("Despacho Finalizado", "El transporte ha partido con la mercadería.");
      setOrderModalVisible(false);
    } catch (error) {
      Alert.alert("Error", "No se pudo finalizar el despacho.");
    } finally {
      setProcessingOrder(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ENVIADO': return '#ef4444'; // Rojo para despacho pendiente
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
          <Text style={styles.headerTitle}>Órdenes de Despacho</Text>
          <Text style={styles.headerSub}>{companyName}</Text>
        </View>
        <Truck color="#0f172a" size={24} />
      </View>

      {viewMode === 'LIST' ? (
        <View style={styles.container}>
          {canCreateOrders(auth.currentUser?.email) && (
            <TouchableOpacity style={[styles.newOrderBtn, { backgroundColor: '#ef4444' }]} onPress={() => setViewMode('CREATE')}>
              <Plus color="#fff" size={20} />
              <Text style={styles.newOrderBtnText}>NUEVA OD</Text>
            </TouchableOpacity>
          )}
          
          <Text style={styles.sectionTitle}>Órdenes Recientes</Text>
          
          {loadingOrders ? (
            <ActivityIndicator color="#ef4444" style={{ marginTop: 40 }} />
          ) : orders.length === 0 ? (
            <View style={styles.emptyBox}>
              <ClipboardList color="#cbd5e1" size={48} />
              <Text style={styles.emptyText}>No hay órdenes de despacho registradas.</Text>
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
                  <Text style={styles.orderCardSub}>Cantidad: <Text style={{fontWeight: '700', color: '#ef4444'}}>{item.data.quantity} {item.data.unit}</Text></Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      ) : (
        <ScrollView maximumZoomScale={1} 
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* BANNER DE ADVERTENCIA */}
          <View style={styles.infoBanner}>
            <Text style={styles.bannerText}>
              Toda salida de mercadería queda vinculada al usuario <Text style={{fontWeight: '800'}}>{auth.currentUser?.email}</Text> para auditoría.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Identificación de Mercadería</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Producto a Despachar</Text>
            <TouchableOpacity 
              style={[styles.inputWrapper, { paddingVertical: 15 }]} 
              onPress={() => setProductModalVisible(true)}
            >
              <PackageMinus color="#94a3b8" size={18} style={styles.inputIcon} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: formData.productName ? '#0f172a' : '#94a3b8', fontWeight: '800' }}>
                  {formData.productName || 'Seleccionar Producto'}
                </Text>
              </View>
              <ChevronDown color="#94a3b8" size={20} />
            </TouchableOpacity>

            <Text style={styles.label}>Presentación</Text>
            <View style={styles.chipRow}>
              {BIDON_CAPACITIES.map(cap => {
                const stockQty = availablePresentations[cap] || 0;
                const hasStock = stockQty > 0;
                const isActive = formData.presentation === cap;
                const noProduct = !formData.productName;
                return (
                  <TouchableOpacity
                    key={cap}
                    style={[
                      styles.chip,
                      isActive && styles.chipActive,
                      cap === '1000' && styles.chipContainer,
                      !noProduct && !hasStock && { opacity: 0.35 }
                    ]}
                    onPress={() => setFormData({...formData, presentation: cap, batchInternal: ''})}
                  >
                    <Droplet color={isActive ? '#fff' : (cap === '1000' ? '#7c3aed' : '#64748b')} size={14} style={{marginRight: 4}}/>
                    <View>
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{BIDON_LABELS[cap] || `${cap}L`}</Text>
                      {!noProduct && hasStock && (
                        <Text style={{ fontSize: 9, color: isActive ? '#bbf7d0' : '#10b981', fontWeight: '800' }}>{stockQty} uds</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.label}>{formData.presentation === '1000' ? 'Cant. Lts (Contenedor)' : 'Cant. Unidades'}</Text>
                <TextInput 
                  style={styles.inputPlain} 
                  placeholder="Ej: 48" 
                  keyboardType="numeric"
                  placeholderTextColor="#94a3b8"
                  value={formData.quantity}
                  onChangeText={(txt) => setFormData({...formData, quantity: txt})}
                />
              </View>
              <View style={{ flex: 1.5 }}>
                <Text style={styles.label}>Lote de Salida</Text>
                <TouchableOpacity 
                  style={[styles.inputWrapper, { paddingVertical: 15 }]} 
                  onPress={() => setBatchModalVisible(true)}
                  disabled={availableBatches.length === 0}
                >
                  <Hash color="#94a3b8" size={18} style={styles.inputIcon} />
                  <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: formData.batchInternal ? '#0f172a' : '#94a3b8', fontWeight: '800' }}>
                    {formData.batchInternal 
                      ? `${formData.batchInternal} (${availableBatches.find(b => b.batchInternal === formData.batchInternal)?.quantity ?? '?'} disp.)`
                      : (availableBatches.length === 0 ? 'Sin lotes disponibles' : 'Seleccionar Lote')
                    }
                  </Text>
                  </View>
                  <ChevronDown color="#94a3b8" size={20} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.row, { marginTop: 15 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Cliente Destino (Opcional)</Text>
                <TextInput 
                  style={[styles.inputPlain, { paddingVertical: 12 }]} 
                  placeholder="Ej: Agropecuaria Del Sur S.A." 
                  placeholderTextColor="#94a3b8"
                  value={formData.clientName}
                  onChangeText={(txt) => setFormData({...formData, clientName: txt})}
                />
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.dispatchButton, isSubmitting && { opacity: 0.7 }]} 
            onPress={handleCreateOrder}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Send color="#fff" size={20} />
                <Text style={styles.dispatchButtonText}>Confirmar y Emitir OD</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* MODAL DE SELECCIÓN DE PRODUCTO */}
      <Modal visible={productModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Producto</Text>
              <TouchableOpacity onPress={() => setProductModalVisible(false)}>
                <X color="#64748b" size={24} />
              </TouchableOpacity>
            </View>
            <FlatList maximumZoomScale={1}
              data={availableProducts}
              keyExtractor={(item, index) => index.toString()}
              contentContainerStyle={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.modalItem, formData.productName === item && styles.modalItemActive]}
                  onPress={() => {
                    setFormData({...formData, productName: item, batchInternal: ''});
                    setProductModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalItemText, formData.productName === item && styles.modalItemTextActive]}>
                    {item}
                  </Text>
                  {formData.productName === item && <CheckCircle2 color="#1e3a8a" size={20} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* MODAL DE SELECCIÓN DE LOTE */}
      <Modal visible={batchModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Lote de Salida</Text>
              <TouchableOpacity onPress={() => setBatchModalVisible(false)}>
                <X color="#64748b" size={24} />
              </TouchableOpacity>
            </View>
            <FlatList maximumZoomScale={1}
              data={availableBatches}
              keyExtractor={(item, index) => index.toString()}
              contentContainerStyle={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.modalItem, formData.batchInternal === item.batchInternal && styles.modalItemActive]}
                  onPress={() => {
                    setFormData({...formData, batchInternal: item.batchInternal});
                    setBatchModalVisible(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalItemText, formData.batchInternal === item.batchInternal && styles.modalItemTextActive]}>
                      {item.batchInternal}
                    </Text>
                    <Text style={{ fontSize: 12, color: formData.batchInternal === item.batchInternal ? '#93c5fd' : '#64748b', marginTop: 2 }}>
                      Stock disponible: <Text style={{ fontWeight: '800' }}>{item.quantity} Uds</Text>{item.batchProvider && item.batchProvider !== 'S/D' ? `  •  Prov: ${item.batchProvider}` : ''}
                    </Text>
                  </View>
                  {formData.batchInternal === item.batchInternal && <CheckCircle2 color="#1e3a8a" size={20} />}
                </TouchableOpacity>
              )}
            />
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
              <Text style={styles.headerTitle}>Detalle de OD</Text>
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
              <Text style={{fontSize: 14, color: '#475569', marginBottom: 5}}>Cantidad: <Text style={{fontWeight: '800', color: '#0f172a'}}>{selectedOrder?.data?.quantity} {selectedOrder?.data?.unit}</Text></Text>
              <Text style={{fontSize: 14, color: '#475569', marginBottom: 15}}>Lote de Origen: <Text style={{fontWeight: '800', color: '#0f172a'}}>{selectedOrder?.data?.batchInternal}</Text></Text>
              
              <Text style={{fontSize: 14, fontWeight: '800', color: '#334155', marginBottom: 10, textTransform: 'uppercase'}}>Datos de Envío</Text>
              <View style={{backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8, marginBottom: 8}}>
                <Text style={{fontSize: 12, color: '#64748b'}}>Destino</Text>
                <Text style={{fontSize: 14, fontWeight: '800', color: '#1e293b'}}>{selectedOrder?.data?.destination}</Text>
              </View>
              <View style={{backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8, marginBottom: 8}}>
                <Text style={{fontSize: 12, color: '#64748b'}}>Transporte</Text>
                <Text style={{fontSize: 14, fontWeight: '800', color: '#1e293b'}}>{selectedOrder?.data?.transportName}</Text>
              </View>
              
              <TouchableOpacity onPress={() => selectedOrder && printOrder(selectedOrder)} style={[styles.mainButton, { backgroundColor: '#3b82f6', marginTop: 15 }]}>
                <Printer color="#fff" size={20} />
                <Text style={[styles.mainButtonText, { color: '#fff' }]}>Imprimir / Exportar PDF</Text>
              </TouchableOpacity>
            </View>

            {selectedOrder?.status === 'ENVIADO' && (
              <TouchableOpacity style={[styles.mainButton, {backgroundColor: '#f59e0b'}]} onPress={handleAcceptOrder} disabled={processingOrder}>
                {processingOrder ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <CheckSquare color="#fff" size={20} />
                    <Text style={styles.mainButtonText}>Iniciar Carga</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {selectedOrder?.status === 'EN_PROCESO' && (
              <TouchableOpacity style={[styles.mainButton, {backgroundColor: '#10b981'}]} onPress={handleFinalizeOrder} disabled={processingOrder}>
                {processingOrder ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Truck color="#fff" size={20} />
                    <Text style={styles.mainButtonText}>Confirmar Salida</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <View style={{height: 40}}/>
          </ScrollView>
        </SafeAreaView>
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
  headerSub: { fontSize: 11, color: '#ef4444', textTransform: 'uppercase', fontWeight: '800', letterSpacing: 0.5 },
  
  container: { padding: 20 },
  
  newOrderBtn: { backgroundColor: '#ef4444', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 14, marginBottom: 25 },
  newOrderBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, marginLeft: 8, letterSpacing: 0.5 },

  orderCard: { backgroundColor: '#fff', padding: 18, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  orderCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  orderCardTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b', flex: 1, marginRight: 10 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  orderCardSub: { fontSize: 12, color: '#64748b', marginBottom: 4 },

  infoBanner: { backgroundColor: '#fef2f2', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#fca5a5' },
  bannerText: { color: '#b91c1c', fontSize: 12, textAlign: 'center', lineHeight: 18 },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 12, marginLeft: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  card: { 
    backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 25, 
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, 
    borderWidth: 1, borderColor: '#e2e8f0' 
  },
  label: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 8, textTransform: 'uppercase' },
  
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  chipTextActive: { color: '#fff' },
  chipContainer: { borderColor: '#7c3aed', borderWidth: 1.5 },

  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, marginBottom: 15 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#0f172a', fontWeight: '600' },
  inputPlain: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 15, color: '#0f172a', fontWeight: '600', marginBottom: 15 },
  
  row: { flexDirection: 'row' },
  
  dispatchButton: { 
    backgroundColor: '#ef4444', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', 
    padding: 18, borderRadius: 14, marginTop: 10, gap: 10, elevation: 4, 
    shadowColor: '#ef4444', shadowOpacity: 0.3, shadowRadius: 8 
  },
  dispatchButtonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  mainButton: { backgroundColor: '#10b981', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 14, marginTop: 20, gap: 10, elevation: 4 },
  mainButtonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1, marginLeft: 10 },
  emptyBox: { alignItems: 'center', padding: 20, paddingVertical: 50 },
  emptyText: { color: '#64748b', textAlign: 'center', fontWeight: '500', marginTop: 15 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#fff', borderRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  modalList: { paddingBottom: 20 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalItemActive: { backgroundColor: '#f8fafc', paddingHorizontal: 10, borderRadius: 10, borderBottomWidth: 0 },
  modalItemText: { fontSize: 16, color: '#475569', fontWeight: '600' },
  modalItemTextActive: { color: '#1e3a8a', fontWeight: '800' }
});