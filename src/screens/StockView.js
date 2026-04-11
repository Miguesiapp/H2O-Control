import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator, StatusBar, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ChevronLeft, Search, PackageOpen, AlertTriangle, ShieldCheck, X } from 'lucide-react-native';

export default function StockView({ route, navigation }) {
  const { companyName, stockType, title } = route.params;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  
  // NUEVO: Estado para el buscador
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    // Escucha en tiempo real a Firebase
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

  // FUNCIÓN DE INTELIGENCIA: Semáforo Corporativo
  const getStockLevel = (quantity, minStock = 100) => {
    if (quantity <= 0) return { label: 'QUIEBRE DE STOCK', color: '#ef4444', bg: '#fef2f2', icon: AlertTriangle };
    if (quantity <= minStock) return { label: 'PUNTO DE PEDIDO', color: '#f59e0b', bg: '#fffbeb', icon: AlertTriangle };
    return { label: 'NIVEL ÓPTIMO', color: '#10b981', bg: '#ecfdf5', icon: ShieldCheck };
  };

  // Filtrado local para el buscador
  const filteredItems = items.filter(item => 
    (item.itemName || item.productName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItem = ({ item }) => {
    const status = getStockLevel(item.quantity, item.minStock || 100);
    const StatusIcon = status.icon;

    return (
      <View style={[styles.itemCard, { borderTopColor: status.color }]}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName}>{item.itemName || item.productName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <StatusIcon color={status.color} size={12} style={{marginRight: 4}} />
             <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
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
              placeholder="Buscar producto..."
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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0f172a" />
          <Text style={styles.loadingText}>Auditando inventario...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <PackageOpen color="#cbd5e1" size={48} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No se encontraron coincidencias.' : 'Sin existencias registradas en esta unidad.'}
              </Text>
            </View>
          }
        />
      )}
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
  
  // BUSCADOR ACTIVO
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 15, marginLeft: 10, height: 40 },
  searchInput: { flex: 1, color: '#0f172a', fontSize: 14, fontWeight: '500' },

  list: { padding: 20, paddingBottom: 50 },
  
  // TARJETA ENTERPRISE
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

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 15, color: '#475569', fontWeight: '700', fontSize: 14 },
  emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', fontWeight: '600', marginTop: 15 }
});