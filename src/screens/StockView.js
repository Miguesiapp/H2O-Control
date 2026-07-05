import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator, StatusBar, TextInput, ScrollView, Modal, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ChevronLeft, Search, PackageOpen, AlertTriangle, ShieldCheck, X, FlaskConical, Droplet, Box, Tag, Printer } from 'lucide-react-native';
import { printMultipleLabels } from '../services/labelService';

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

  useEffect(() => {
    const q = query(
      collection(db, "Inventory"),
      where("company", "==", companyName),
      where("stockType", "==", stockType)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const stockData = [];
      querySnapshot.forEach((doc) => {
        stockData.push({ ...doc.data(), id: doc.id });
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

  const filteredItems = items.filter(item => 
    (item.itemName || item.productName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.batchInternal || '').toLowerCase().includes(searchQuery.toLowerCase()) 
  );

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

  const renderItem = ({ item }) => {
    const status = getStockLevel(item.quantity, item.minStock || 100);
    const StatusIcon = status.icon;

    return (
      <View style={[styles.itemCard, { borderTopColor: status.color }]}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName}>{item.itemName || item.productName}</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <TouchableOpacity 
              style={{padding: 6, backgroundColor: '#f1f5f9', borderRadius: 8, marginRight: 10}}
              onPress={() => {
                setSelectedPrintItem(item);
                setLabelsCount('1');
                setQtyPerLabel(String(item.quantity));
                setPrintModalVisible(true);
              }}
            >
              <Printer color="#3b82f6" size={16} />
            </TouchableOpacity>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <StatusIcon color={status.color} size={12} style={{marginRight: 4}} />
              <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
        </View>

        <View style={styles.contentRow}>
          <View style={styles.qtyBox}>
            <Text style={styles.quantityValue}>{item.quantity}</Text>
            <Text style={styles.quantityUnit}>{item.unit || 'Uds'}</Text>
          </View>
          
          <View style={styles.metaBox}>
            <Text style={styles.metaText}>Mín. Req: <Text style={styles.metaBold}>{item.minStock || 100}</Text></Text>
            <Text style={styles.metaText}>Lote Interno: <Text style={styles.metaBold}>{item.batchInternal || 'S/D'}</Text></Text>
            
            {item.loteProveedor && <Text style={styles.metaText}>Lote Prov: <Text style={styles.metaBold}>{item.loteProveedor}</Text></Text>}
            {item.vencimiento && <Text style={styles.metaText}>Vence: <Text style={styles.metaBold}>{item.vencimiento}</Text></Text>}
            
            {item.status && (
              <View style={styles.labStatusRow}>
                <FlaskConical color={getLabStatusColor(item.status)} size={12} style={{marginRight: 4}} />
                <Text style={styles.metaText}>
                  Calidad: <Text style={[styles.metaBold, { color: getLabStatusColor(item.status) }]}>{item.status}</Text>
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER ENTERPRISE */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
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
        <FlatList
          data={displayedItems}
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
  labStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, backgroundColor: '#f8fafc', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },

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