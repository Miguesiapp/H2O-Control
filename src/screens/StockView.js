import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator, StatusBar, TextInput, ScrollView, Modal, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { ChevronLeft, Search, PackageOpen, AlertTriangle, ShieldCheck, X, FlaskConical, Droplet, Box, Tag, Printer, ChevronDown, ChevronUp, Edit2 } from 'lucide-react-native';
import { printMultipleLabels } from '../services/labelService';
import { RAW_MATERIALS_LIST, PRODUCTS_MADRE_LIST } from '../config/constants';

const normalizeString = (str) => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

export default function StockView({ route, navigation }) {
  const { companyName, stockType, title } = route.params;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [selectedPrintItem, setSelectedPrintItem] = useState(null);
  const [labelsCount, setLabelsCount] = useState('1');
  const [qtyPerLabel, setQtyPerLabel] = useState('');

  // Tab activo para Insumos (Bidones, Cajas, Etiquetas)
  const [activeInsumoTab, setActiveInsumoTab] = useState('BIDONES');

  // Estado para los acordeones
  const [expandedItems, setExpandedItems] = useState([]);

  const toggleExpand = (id) => {
    setExpandedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const [minStockModalVisible, setMinStockModalVisible] = useState(false);
  const [selectedMinStockItem, setSelectedMinStockItem] = useState(null);
  const [newMinStock, setNewMinStock] = useState('');
  const [isUpdatingMin, setIsUpdatingMin] = useState(false);

  const handleSaveMinStock = async () => {
    if (!selectedMinStockItem) return;
    const val = Number(newMinStock);
    if (isNaN(val) || val < 0) {
      Alert.alert("Error", "Ingrese una cantidad válida.");
      return;
    }
    try {
      setIsUpdatingMin(true);
      const batch = writeBatch(db);
      selectedMinStockItem.lotes.forEach(lote => {
        lote.rawDocs.forEach(docId => {
          batch.update(doc(db, "Inventory", docId), { minStock: val });
        });
      });
      await batch.commit();
      setMinStockModalVisible(false);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "No se pudo actualizar el mínimo.");
    } finally {
      setIsUpdatingMin(false);
    }
  };

  useEffect(() => {
    const q = query(
      collection(db, "Inventory"),
      where("company", "==", companyName),
      where("stockType", "==", stockType)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const stockData = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // CUARENTENA: Excluir lotes pendientes de aprobación BBS Calidad del stock disponible
        const pendingStatuses = ['PENDIENTE', 'PENDIENTE_LABORATORIO'];
        if (!pendingStatuses.includes(data.status)) {
          stockData.push({ ...data, id: doc.id });
        }
      });
      
      // Ordenamos alfabéticamente
      stockData.sort((a, b) => (a.itemName || '').localeCompare(b.itemName || ''));
      setItems(stockData);
      setLoading(false);
    }, (error) => {
      console.error("Error cargando stock: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyName, stockType]);

  const getStockLevel = (quantity, minStock = 100) => {
    if (quantity <= 0) return { label: 'QUIEBRE DE STOCK', color: '#ef4444', bg: '#fef2f2', icon: AlertTriangle };
    if (quantity <= minStock) return { label: 'PUNTO DE PEDIDO', color: '#f59e0b', bg: '#fffbeb', icon: AlertTriangle };
    return { label: 'NIVEL ÓPTIMO', color: '#10b981', bg: '#ecfdf5', icon: ShieldCheck };
  };

  const getLabStatusColor = (status) => {
    if (status === 'APTO') return '#10b981'; 
    if (status === 'RECHAZADO') return '#ef4444'; 
    return '#f59e0b'; 
  };

  const filteredItems = items.filter(item => {
    const searchNormalized = normalizeString(searchQuery);
    const itemName = item.itemName || item.productName || '';
    
    // Buscar si el itemName está en alguna de las listas con sinónimos
    let fullAliases = itemName;
    if (stockType === 'MP') {
      const foundInList = RAW_MATERIALS_LIST.find(rm => rm.startsWith(itemName));
      if (foundInList) fullAliases = foundInList;
    } else if (stockType === 'GRANEL') {
      const foundInList = PRODUCTS_MADRE_LIST.find(pm => pm.startsWith(itemName));
      if (foundInList) fullAliases = foundInList;
    }

    return normalizeString(fullAliases).includes(searchNormalized) ||
           normalizeString(item.batchInternal).includes(searchNormalized) ||
           normalizeString(item.providerName).includes(searchNormalized);
  });

  // Lógica específica para INSUMOS (Agrupar)
  const isCentralInsumos = stockType === 'INSUMOS';
  
  let displayedItems = filteredItems;
  if (isCentralInsumos) {
    if (activeInsumoTab === 'BIDONES') {
      displayedItems = filteredItems.filter(item => (item.itemName || '').toUpperCase().includes('BIDON'));
    } else if (activeInsumoTab === 'CAJAS') {
      displayedItems = filteredItems.filter(item => (item.itemName || '').toUpperCase().includes('CAJA'));
    } else if (activeInsumoTab === 'ETIQUETAS') {
      displayedItems = filteredItems.filter(item => (item.itemName || '').toUpperCase().includes('ETIQUETA'));
    }
  }

  // Agrupar items por nombre (Insensible a mayúsculas y tildes)
  const groupedItemsMap = displayedItems.reduce((acc, item) => {
    const rawName = item.itemName || item.productName || 'Desconocido';
    const groupKey = normalizeString(rawName); // Llave unificada

    const rawBatch = item.batchInternal || 'S/D';
    const batchKey = normalizeString(rawBatch);

    if (!acc[groupKey]) {
      acc[groupKey] = {
        id: groupKey, 
        itemName: rawName, // Guardamos el nombre original con mayúsculas para mostrar en UI
        quantity: 0,
        unit: item.unit || 'Uds',
        minStock: item.minStock || 100,
        lotesMap: {} 
      };
    }
    acc[groupKey].quantity += Number(item.quantity) || 0;

    // Unificar lotes iguales
    if (!acc[groupKey].lotesMap[batchKey]) {
      acc[groupKey].lotesMap[batchKey] = { ...item, quantity: 0, rawDocs: [] };
    }
    acc[groupKey].lotesMap[batchKey].quantity += Number(item.quantity) || 0;
    acc[groupKey].lotesMap[batchKey].rawDocs.push(item.id);

    return acc;
  }, {});

  const groupedItems = Object.values(groupedItemsMap).map(group => {
    return {
      ...group,
      quantity: parseFloat(Number(group.quantity).toFixed(2)),
      lotes: Object.values(group.lotesMap).map(lote => ({
         ...lote,
         quantity: parseFloat(Number(lote.quantity).toFixed(2))
      }))
    };
  }).sort((a, b) => a.itemName.localeCompare(b.itemName));

  const renderItem = ({ item }) => {
    const status = getStockLevel(item.quantity, item.minStock || 100);
    const StatusIcon = status.icon;

    const isExpanded = expandedItems.includes(item.id);

    return (
      <View style={[styles.itemCard, { backgroundColor: status.bg, borderColor: status.color, borderWidth: 1 }]}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => toggleExpand(item.id)}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemName}>{item.itemName}</Text>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <TouchableOpacity 
                style={[styles.statusBadge, { backgroundColor: '#fff', borderWidth: 1, borderColor: status.color }]}
                onPress={() => {
                  setSelectedMinStockItem(item);
                  setNewMinStock(String(item.minStock));
                  setMinStockModalVisible(true);
                }}
              >
                <Edit2 color={status.color} size={12} style={{marginRight: 4}} />
                <Text style={[styles.statusBadgeText, { color: status.color }]}>EDITAR MÍNIMO</Text>
              </TouchableOpacity>
              {isExpanded ? <ChevronUp color="#64748b" size={20} style={{marginLeft: 10}} /> : <ChevronDown color="#64748b" size={20} style={{marginLeft: 10}} />}
            </View>
          </View>

          <View style={styles.contentRow}>
            <View style={styles.qtyBox}>
              <Text style={styles.quantityValue}>{item.quantity}</Text>
              <Text style={styles.quantityUnit}>{item.unit}</Text>
            </View>
            
            <View style={styles.metaBox}>
              <Text style={styles.metaText}>Lotes Disponibles: <Text style={styles.metaBold}>{item.lotes.length}</Text></Text>
              <Text style={styles.metaText}>Mínimo Req: <Text style={styles.metaBold}>{item.minStock}</Text></Text>
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContainer}>
            <Text style={styles.expandedTitle}>Detalle de Lotes:</Text>
            {item.lotes.map((lote, index) => (
              <View key={lote.id || index.toString()} style={styles.loteCard}>
                <View style={styles.loteHeader}>
                  <Text style={styles.loteTitle}>
                    Ingreso: {lote.createdAt && typeof lote.createdAt.toDate === 'function' ? lote.createdAt.toDate().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : (lote.createdAt ? new Date(lote.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : 'S/F')}
                  </Text>
                  <Text style={styles.loteQty}>{lote.quantity} {lote.unit}</Text>
                </View>
                
                <Text style={styles.loteSub}>Lote Prov: <Text style={{fontWeight: '700'}}>{lote.batchProvider || lote.loteProveedor || 'S/D'}</Text></Text>
                {lote.providerName && <Text style={styles.loteSub}>Proveedor: <Text style={{fontWeight: '700'}}>{lote.providerName}</Text></Text>}
                {lote.vencimiento && <Text style={styles.loteSub}>Vence: <Text style={{fontWeight: '700'}}>{lote.vencimiento}</Text></Text>}
                
                <View style={styles.loteActions}>
                  <TouchableOpacity 
                    style={styles.printMiniBtn}
                    onPress={() => {
                      setSelectedPrintItem(lote);
                      setLabelsCount('1');
                      setQtyPerLabel(String(lote.quantity));
                      setPrintModalVisible(true);
                    }}
                  >
                    <Printer color="#3b82f6" size={14} style={{marginRight: 4}} />
                    <Text style={{color: '#3b82f6', fontSize: 11, fontWeight: '700'}}>Imprimir</Text>
                  </TouchableOpacity>
                  
                  {lote.status && (
                    <View style={styles.labStatusRow}>
                      <FlaskConical color={getLabStatusColor(lote.status)} size={12} style={{marginRight: 4}} />
                      <Text style={[styles.metaBold, { fontSize: 10, color: getLabStatusColor(lote.status) }]}>{lote.status}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER ENTERPRISE */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))} style={styles.backBtn}>
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
        
        {isSearching ? (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar producto o lote..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setIsSearching(false); setSearchQuery(''); }}>
              <X color="#64748b" size={20} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={{flex: 1, marginLeft: 10}}>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSub}>{companyName} • Categ: {stockType}</Text>
            </View>
            <TouchableOpacity style={styles.searchBtn} onPress={() => setIsSearching(true)}>
              <Search color="#0f172a" size={24} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* TABS DE INSUMOS SI CORRESPONDE */}
      {isCentralInsumos && (
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeInsumoTab === 'BIDONES' && styles.tabActive]}
            onPress={() => setActiveInsumoTab('BIDONES')}
          >
            <Droplet color={activeInsumoTab === 'BIDONES' ? '#fff' : '#64748b'} size={16} />
            <Text style={[styles.tabText, activeInsumoTab === 'BIDONES' && styles.tabTextActive]}>BIDONES</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabBtn, activeInsumoTab === 'CAJAS' && styles.tabActive]}
            onPress={() => setActiveInsumoTab('CAJAS')}
          >
            <Box color={activeInsumoTab === 'CAJAS' ? '#fff' : '#64748b'} size={16} />
            <Text style={[styles.tabText, activeInsumoTab === 'CAJAS' && styles.tabTextActive]}>CAJAS</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabBtn, activeInsumoTab === 'ETIQUETAS' && styles.tabActive]}
            onPress={() => setActiveInsumoTab('ETIQUETAS')}
          >
            <Tag color={activeInsumoTab === 'ETIQUETAS' ? '#fff' : '#64748b'} size={16} />
            <Text style={[styles.tabText, activeInsumoTab === 'ETIQUETAS' && styles.tabTextActive]}>ETIQUETAS</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0f172a" />
          <Text style={styles.loadingText}>Auditando inventario...</Text>
        </View>
      ) : (
        <FlatList maximumZoomScale={1}
          data={groupedItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <PackageOpen color="#cbd5e1" size={48} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No se encontraron coincidencias.' : 'Sin existencias registradas en esta sección.'}
              </Text>
            </View>
          }
        />
      )}

      {/* MODAL DE IMPRESION */}
      <Modal visible={printModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Imprimir Etiquetas</Text>
              <TouchableOpacity onPress={() => setPrintModalVisible(false)}>
                <X color="#64748b" size={24} />
              </TouchableOpacity>
            </View>
            
            {selectedPrintItem && (
              <>
                <Text style={{fontSize: 16, fontWeight: 'bold', marginBottom: 5}}>{selectedPrintItem.itemName}</Text>
                <Text style={{color: '#64748b', marginBottom: 20}}>Stock total registrado: {selectedPrintItem.quantity} {selectedPrintItem.unit || 'Uds'}</Text>
                
                <Text style={{fontWeight: '600', marginBottom: 5}}>Cantidad por envase (Se mostrará en la etiqueta)</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={qtyPerLabel}
                  onChangeText={setQtyPerLabel}
                />
                
                <Text style={{fontWeight: '600', marginBottom: 5, marginTop: 15}}>¿Cuántas etiquetas idénticas imprimir?</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={labelsCount}
                  onChangeText={setLabelsCount}
                  maxLength={2}
                />
                
                <TouchableOpacity 
                  style={styles.printConfirmBtn}
                  onPress={async () => {
                    const count = parseInt(labelsCount) || 1;
                    if(count > 20) {
                      Alert.alert("Límite", "Máximo 20 etiquetas por lote.");
                      return;
                    }
                    try {
                      await printMultipleLabels({
                        type: stockType,
                        name: selectedPrintItem.itemName,
                        batch: selectedPrintItem.batchInternal || selectedPrintItem.loteProveedor || 'S/D',
                        expiration: selectedPrintItem.vencimiento || 'N/A',
                        quantity: qtyPerLabel,
                        unit: selectedPrintItem.unit || 'Uds'
                      }, count);
                      setPrintModalVisible(false);
                    } catch (e) {
                      Alert.alert("Error", "No se pudo generar el documento.");
                    }
                  }}
                >
                  <Text style={{color: '#fff', fontWeight: 'bold', textAlign: 'center'}}>Generar PDF de Etiquetas</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL EDITAR MINIMO */}
      <Modal visible={minStockModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Stock Mínimo</Text>
              <TouchableOpacity onPress={() => setMinStockModalVisible(false)}>
                <X color="#64748b" size={24} />
              </TouchableOpacity>
            </View>
            
            <View>
              <Text style={{fontSize: 14, color: '#475569', marginBottom: 15}}>
                {selectedMinStockItem?.itemName}
              </Text>
              
              <Text style={{fontWeight: '600', marginBottom: 5}}>Mínimo Requerido ({selectedMinStockItem?.unit}):</Text>
              <TextInput 
                style={styles.modalInput}
                keyboardType="decimal-pad"
                value={newMinStock}
                onChangeText={setNewMinStock}
                autoFocus
              />

              <TouchableOpacity 
                style={[styles.printConfirmBtn, isUpdatingMin && {opacity: 0.7}]} 
                onPress={handleSaveMinStock}
                disabled={isUpdatingMin}
              >
                <Text style={{color: '#fff', fontWeight: 'bold', textAlign: 'center'}}>{isUpdatingMin ? 'Guardando...' : 'GUARDAR'}</Text>
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
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, 
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5
  },
  backBtn: { padding: 5 },
  searchBtn: { padding: 10, backgroundColor: '#f1f5f9', borderRadius: 12 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  headerSub: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700', marginTop: 2 },
  
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 15, marginLeft: 10, height: 40 },
  searchInput: { flex: 1, color: '#0f172a', fontSize: 14, fontWeight: '500' },

  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    justifyContent: 'space-between',
  },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 20, backgroundColor: '#f1f5f9', gap: 6, flex: 1, justifyContent: 'center', marginHorizontal: 4
  },
  tabActive: { backgroundColor: '#3b82f6' },
  tabText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  tabTextActive: { color: '#fff' },

  list: { padding: 20, paddingBottom: 50 },
  
  itemCard: { 
    backgroundColor: '#fff', borderRadius: 16, marginBottom: 15, padding: 20,
    borderWidth: 1, borderColor: '#e2e8f0', borderTopWidth: 4,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  itemName: { flex: 1, fontSize: 16, fontWeight: '800', color: '#1e293b', marginRight: 10 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  statusBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  
  contentRow: { flexDirection: 'row', alignItems: 'center' },
  qtyBox: { paddingRight: 20, borderRightWidth: 1, borderRightColor: '#f1f5f9', minWidth: 100 },
  quantityValue: { fontSize: 32, fontWeight: '900', color: '#0f172a', lineHeight: 35 },
  quantityUnit: { fontSize: 12, color: '#64748b', fontWeight: '800', textTransform: 'uppercase' },
  
  metaBox: { flex: 1, paddingLeft: 20 },
  metaText: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  metaBold: { fontWeight: '700', color: '#334155' },
  labStatusRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  
  expandedContainer: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  expandedTitle: { fontSize: 12, fontWeight: '800', color: '#475569', marginBottom: 10, textTransform: 'uppercase' },
  loteCard: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  loteHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  loteTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  loteQty: { fontSize: 13, fontWeight: '900', color: '#3b82f6' },
  loteSub: { fontSize: 11, color: '#64748b', marginBottom: 2 },
  loteActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  printMiniBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 15, color: '#475569', fontWeight: '700', fontSize: 14 },
  emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', fontWeight: '600', marginTop: 15 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  modalInput: { backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  printConfirmBtn: { backgroundColor: '#3b82f6', borderRadius: 12, paddingVertical: 15, marginTop: 25, elevation: 2, shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 5 }
});