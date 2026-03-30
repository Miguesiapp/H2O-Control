import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator, StatusBar 
} from 'react-native';
// IMPORTANTE: Cambio a la librería recomendada por Expo
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ChevronLeft, Search, Package, Calendar, Tag, AlertTriangle } from 'lucide-react-native';

export default function StockView({ route, navigation }) {
  const { companyName, stockType, title } = route.params;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

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
      setItems(stockData);
      setLoading(false);
    }, (error) => {
      console.error("Error cargando stock: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyName, stockType]);

  // FUNCIÓN DE INTELIGENCIA: Define el estado del stock (Semáforo)
  const getStockLevel = (quantity, minStock = 100) => {
    if (quantity <= 0) return { label: 'SIN STOCK', color: '#d32f2f', bg: '#ffebee' };
    if (quantity <= minStock) return { label: 'REPOSICIÓN URGENTE', color: '#ef6c00', bg: '#fff3e0' };
    return { label: 'STOCK ÓPTIMO', color: '#2e7d32', bg: '#e8f5e9' };
  };

  const renderItem = ({ item }) => {
    const status = getStockLevel(item.quantity, item.minStock || 100);

    return (
      <View style={[styles.itemCard, { borderLeftColor: status.color }]}>
        <View style={styles.itemHeader}>
          <Package color={status.color} size={20} />
          <Text style={styles.itemName}>{item.itemName || item.productName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
             <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.quantityRow}>
           <Text style={styles.quantityValue}>{item.quantity}</Text>
           <Text style={styles.quantityUnit}>{item.unit || 'uds'}</Text>
           {item.quantity <= (item.minStock || 100) && (
             <AlertTriangle size={16} color={status.color} style={{marginLeft: 10}} />
           )}
        </View>
        
        <View style={styles.detailsRow}>
          <View style={styles.detail}>
            <Tag size={12} color="#888" />
            <Text style={styles.detailText}>Lote: {item.batchInternal || 'N/A'}</Text>
          </View>
          <View style={styles.detail}>
            <Calendar size={12} color="#888" />
            <Text style={styles.detailText}>Min. Requerido: {item.minStock || 100}</Text>
          </View>
        </View>

        {item.presentation && (
          <Text style={styles.presentationText}>Presentación: {item.presentation} Lts</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#2e4a3b" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSub}>{companyName}</Text>
        </View>
        <TouchableOpacity style={styles.searchBtn}>
          <Search color="#2e4a3b" size={24} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2e4a3b" />
          <Text style={styles.loadingText}>Analizando niveles de stock...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No hay stock registrado en esta categoría.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FBF9' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20,
    paddingVertical: 15, 
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  backBtn: { padding: 5 },
  searchBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#2e4a3b' },
  headerSub: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  list: { padding: 15, paddingBottom: 50 },
  itemCard: { 
    backgroundColor: '#fff', 
    padding: 18, 
    borderRadius: 20, 
    marginBottom: 15,
    borderLeftWidth: 8, 
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)'
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  itemName: { flex: 1, fontSize: 15, fontWeight: '900', marginLeft: 10, color: '#1A2E24' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText: { fontSize: 9, fontWeight: '900' },
  quantityRow: { flexDirection: 'row', alignItems: 'baseline', marginVertical: 10 },
  quantityValue: { fontSize: 32, fontWeight: '900', color: '#2e4a3b' },
  quantityUnit: { fontSize: 14, color: '#666', marginLeft: 6, fontWeight: '800', textTransform: 'uppercase' },
  detailsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    borderTopWidth: 1, 
    borderTopColor: '#F0F0F0', 
    paddingTop: 12,
    marginTop: 8
  },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 11, color: '#888', fontWeight: '700' },
  presentationText: { fontSize: 10, color: '#2e7d32', marginTop: 10, fontStyle: 'italic', fontWeight: '800' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FBF9' },
  loadingText: { marginTop: 15, color: '#2e4a3b', fontWeight: '800', letterSpacing: 1 },
  emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyText: { color: '#bbb', fontSize: 14, textAlign: 'center', fontWeight: '700', fontStyle: 'italic' }
});