import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, StatusBar } from 'react-native';
// IMPORTANTE: Cambio de librería para el SafeAreaView
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ChevronLeft, Plus, Calculator, Beaker, Search, AlertTriangle } from 'lucide-react-native';

export default function FormulationScreen({ navigation }) {
  const [formulas, setFormulas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const q = query(collection(db, "Formulas"), orderBy("productName", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFormulas(data);
      setLoading(false);
    }, (error) => {
      console.error("Error al cargar fórmulas: ", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const renderFormula = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.titleContainer}>
          <Beaker size={18} color="#2e4a3b" style={{ marginRight: 8 }} />
          <Text style={styles.productTitle}>{item.productName}</Text>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: item.ph < 7 ? '#ffebee' : '#e8f5e9' }]}>
          <Text style={[styles.typeBadgeText, { color: item.ph < 7 ? '#c62828' : '#2e7d32' }]}>
            {item.ph < 7 ? 'ÁCIDO' : 'ALCALINO'}
          </Text>
        </View>
      </View>

      <View style={styles.specsRow}>
        <View style={styles.specItem}>
          <Text style={styles.specLabel}>pH TEÓRICO</Text>
          <Text style={[styles.specValue, { color: item.ph < 7 ? '#c62828' : '#2e7d32' }]}>{item.ph}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.specItem}>
          <Text style={styles.specLabel}>DENSIDAD (g/cm³)</Text>
          <Text style={styles.specValue}>{item.density}</Text>
        </View>
      </View>

      <Text style={styles.formulaTitle}>Composición Química:</Text>
      <View style={styles.ingredientsList}>
        {item.ingredients.map((ing, index) => (
          <View key={index} style={styles.ingRow}>
            <Text style={styles.ingBullet}>•</Text>
            <Text style={styles.ingText}>{ing.name}</Text>
            <Text style={styles.ingPercentage}>{ing.percentage}%</Text>
          </View>
        ))}
      </View>

      <View style={[styles.warningBox, { backgroundColor: item.ph < 7 ? '#fff3e0' : '#e3f2fd' }]}>
        <AlertTriangle size={14} color={item.ph < 7 ? '#e65100' : '#1565c0'} />
        <Text style={[styles.warningText, { color: item.ph < 7 ? '#e65100' : '#1565c0' }]}>
          PRECAUCIÓN: {item.ph < 7 ? 'Evitar contacto con bases fuertes.' : 'Evitar contacto con ácidos fuertes.'}
        </Text>
      </View>
    </View>
  );

  return (
    // Usamos edges top y bottom para proteger el notch y la zona de gestos de iOS/Android
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#2e4a3b" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Maestro de Fórmulas</Text>
        <TouchableOpacity onPress={() => navigation.navigate('QuarterlyCalculator')} style={styles.calcBtn}>
          <Calculator color="#2e4a3b" size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search color="#888" size={18} />
          <TextInput 
            style={styles.searchInput} 
            placeholder="Buscar por nombre de producto..." 
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2e4a3b" />
          <Text style={styles.loadingText}>Sincronizando laboratorio...</Text>
        </View>
      ) : (
        <FlatList 
          data={formulas.filter(f => f.productName.toLowerCase().includes(searchText.toLowerCase()))}
          keyExtractor={item => item.id}
          renderItem={renderFormula}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No se encontraron fórmulas registradas.</Text>
          }
        />
      )}

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => navigation.navigate('AddFormula')}
      >
        <Plus color="#fff" size={28} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0f2f0' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15, 
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  backBtn: { padding: 5 },
  calcBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#2e4a3b' },
  searchContainer: { paddingHorizontal: 20, paddingTop: 15 },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    paddingHorizontal: 12, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#ddd' 
  },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 10, fontSize: 14, color: '#333' },
  card: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 16, 
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  titleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  productTitle: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  typeBadgeText: { fontSize: 9, fontWeight: 'bold' },
  specsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around',
    marginBottom: 15, 
    backgroundColor: '#f8f9f8', 
    paddingVertical: 12, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee'
  },
  specItem: { alignItems: 'center', flex: 1 },
  divider: { width: 1, height: '80%', backgroundColor: '#ddd' },
  specLabel: { fontSize: 9, color: '#888', fontWeight: 'bold', letterSpacing: 0.5, marginBottom: 4 },
  specValue: { fontSize: 18, fontWeight: 'bold' },
  formulaTitle: { fontSize: 13, fontWeight: 'bold', marginBottom: 8, color: '#2e4a3b', textTransform: 'uppercase' },
  ingredientsList: { marginBottom: 15 },
  ingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  ingBullet: { fontSize: 14, color: '#2e4a3b', marginRight: 8 },
  ingText: { fontSize: 13, color: '#444', flex: 1 },
  ingPercentage: { fontSize: 13, fontWeight: 'bold', color: '#333' },
  warningBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10 },
  warningText: { fontSize: 10, fontWeight: 'bold', flex: 1 },
  fab: { 
    position: 'absolute', 
    bottom: 25, 
    right: 25, 
    backgroundColor: '#2e4a3b', 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#2e4a3b', fontWeight: '500' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#999', fontStyle: 'italic' }
});