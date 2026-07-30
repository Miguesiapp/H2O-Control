import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, ActivityIndicator, Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ChevronLeft, GitMerge, FileText, Package, Droplet, Clock } from 'lucide-react-native';
import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import AutocompleteInput from '../components/AutocompleteInput';
import { PRODUCTS_FINAL_LIST, PRODUCTS_MADRE_LIST } from '../config/constants';

export default function TraceabilityScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchProductName, setSearchProductName] = useState('');
  const [loading, setLoading] = useState(false);
  const [traceData, setTraceData] = useState(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert("Error", "Ingresa un número de lote para buscar.");
      return;
    }

    setLoading(true);
    setTraceData(null);

    try {
      const q = query(
        collection(db, "Orders"),
        where("data.batchInternal", "==", searchQuery.trim().toUpperCase())
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        Alert.alert("Sin resultados", "No se encontró ninguna orden de producción asociada a este lote.");
        setLoading(false);
        return;
      }

      let opOrder = null;
      let oeOrder = null;
      let oemOrder = null;

      const normalizedSearchProduct = searchProductName.trim().toUpperCase();

      snapshot.forEach(doc => {
        const data = doc.data();
        
        if (normalizedSearchProduct) {
           const pName = (data.data.productName || data.data.itemName || '').toUpperCase();
           if (!pName.includes(normalizedSearchProduct)) return; 
        }

        if (data.type === 'OP') opOrder = data;
        if (data.type === 'OE') oeOrder = data;
        if (data.type === 'OEM') oemOrder = data;
      });

      // Preferimos OP, si no hay OP pero hay OEM la tomamos.
      const mainOrder = opOrder || oemOrder;

      if (!mainOrder) {
        Alert.alert("Información Incompleta", "Se encontró el lote pero no su orden de producción origen (OP).");
        setLoading(false);
        return;
      }

      // Extraer ingredientes (MP y GRANEL únicamente)
      let ingredientsRaw = [];
      if (mainOrder.type === 'OP' && mainOrder.data.ingredients) {
        ingredientsRaw = mainOrder.data.ingredients;
      } else if (mainOrder.type === 'OEM') {
        // En OEM (Envasado Directo) el ingrediente principal es el Granel seleccionado
        ingredientsRaw = [{
          name: mainOrder.data.itemName?.split(' - ')[0] || 'GRANEL',
          batchesToConsume: [{
            batchInternal: mainOrder.data.batchInternal,
            batchProvider: mainOrder.data.batchProvider,
            consumed: mainOrder.data.litersConsumed,
            stockType: 'MP' // El líquido a granel que se usó
          }]
        }];
      }

      // Flatten batchesToConsume y filtrar solo MP y GRANEL (omitir INSUMOS)
      const consumedMaterials = [];
      ingredientsRaw.forEach(ing => {
        if (ing.batchesToConsume && ing.batchesToConsume.length > 0) {
          ing.batchesToConsume.forEach(batch => {
            // A veces no se guarda stockType en OP viejo, pero por defecto es MP.
            // Ocultamos si stockType es INSUMOS explícitamente.
            if (batch.stockType !== 'INSUMOS') {
              consumedMaterials.push({
                name: ing.name,
                batchInternal: batch.batchInternal,
                batchProvider: batch.batchProvider,
                consumed: batch.consumed,
                stockType: batch.stockType || 'MP'
              });
            }
          });
        }
      });

      setTraceData({
        batchId: searchQuery.trim().toUpperCase(),
        productName: mainOrder.data.productName || mainOrder.data.itemName,
        date: mainOrder.createdAt ? mainOrder.createdAt.toDate().toLocaleDateString('es-AR') : 'S/D',
        type: mainOrder.type,
        materials: consumedMaterials
      });

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Ocurrió un error al buscar la trazabilidad.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}>
          <ChevronLeft color="#1e293b" size={24} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerSup}>SISTEMA DE CALIDAD</Text>
          <Text style={styles.headerTitle}>Trazabilidad de Lotes</Text>
        </View>
        <View style={{width: 40}}/>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.searchCard, { zIndex: 10 }]}>
          <Text style={styles.searchLabel}>Nombre del Producto</Text>
          <View style={{ marginBottom: 15, zIndex: 20 }}>
            <AutocompleteInput
              data={[...new Set([...PRODUCTS_MADRE_LIST, ...PRODUCTS_FINAL_LIST])].sort()}
              value={searchProductName}
              onChangeText={setSearchProductName}
              placeholder="Ej: MOMENTUM"
            />
          </View>

          <Text style={styles.searchLabel}>Número de Lote (PT o Granel)</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Ej: H2O-28072026"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="characters"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Search color="#fff" size={20} />}
            </TouchableOpacity>
          </View>
        </View>

        {traceData && (
          <View style={styles.treeContainer}>
            {/* NODO PRINCIPAL (PT / GRANEL) */}
            <View style={styles.mainNode}>
              <View style={styles.iconCircle}>
                <Package color="#fff" size={28} />
              </View>
              <View style={styles.mainNodeInfo}>
                <Text style={styles.mainNodeTitle}>{traceData.productName}</Text>
                <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Lote: {traceData.batchId}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: '#f1f5f9' }]}>
                    <Clock color="#64748b" size={12} style={{marginRight: 4}} />
                    <Text style={[styles.badgeText, { color: '#475569' }]}>{traceData.date}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* CONECTOR */}
            <View style={styles.connectorLine} />
            <View style={styles.connectorDot} />

            {/* LISTA DE MATERIAS PRIMAS */}
            <View style={styles.materialsHeader}>
              <GitMerge color="#475569" size={20} />
              <Text style={styles.materialsTitle}>Componentes de la Fórmula</Text>
            </View>

            {traceData.materials.length === 0 ? (
              <View style={styles.emptyMaterials}>
                <Text style={styles.emptyMaterialsText}>No se registraron materias primas consumidas o se trató de un ajuste manual directo.</Text>
              </View>
            ) : (
              traceData.materials.map((mat, index) => (
                <View key={index} style={styles.materialCard}>
                  <View style={styles.materialIcon}>
                    <Droplet color="#3b82f6" size={20} />
                  </View>
                  <View style={styles.materialDetails}>
                    <Text style={styles.materialName}>{mat.name}</Text>
                    <View style={styles.materialLoteRow}>
                      <Text style={styles.materialLoteLabel}>Lote Interno:</Text>
                      <Text style={styles.materialLoteValue}>{mat.batchInternal}</Text>
                    </View>
                    <View style={styles.materialLoteRow}>
                      <Text style={styles.materialLoteLabel}>Lote Proveedor:</Text>
                      <Text style={styles.materialLoteValueProvider}>{mat.batchProvider || 'S/D'}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
        
        <View style={{height: 50}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  headerTitleContainer: { alignItems: 'center' },
  headerSup: { fontSize: 10, fontWeight: '800', color: '#3b82f6', letterSpacing: 1.5, marginBottom: 2 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  
  content: { padding: 20 },
  
  searchCard: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },
  searchLabel: { fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchInput: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 15, fontSize: 16, color: '#0f172a', fontWeight: '600' },
  searchButton: { width: 50, height: 50, backgroundColor: '#3b82f6', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  treeContainer: { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, borderWidth: 1, borderColor: '#e2e8f0' },
  
  mainNode: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  iconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', marginRight: 15, shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  mainNodeInfo: { flex: 1 },
  mainNodeTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginBottom: 6 },
  badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#d1fae5' },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#059669' },

  connectorLine: { width: 2, height: 30, backgroundColor: '#cbd5e1', marginLeft: 39 },
  connectorDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#cbd5e1', marginLeft: 35, marginBottom: 20 },

  materialsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, marginLeft: 15 },
  materialsTitle: { fontSize: 15, fontWeight: '800', color: '#334155', marginLeft: 8 },

  materialCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 },
  materialIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  materialDetails: { flex: 1 },
  materialName: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
  materialLoteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  materialLoteLabel: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  materialLoteValue: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  materialLoteValueProvider: { fontSize: 12, fontWeight: '800', color: '#f59e0b' },

  emptyMaterials: { padding: 20, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12 },
  emptyMaterialsText: { fontSize: 13, color: '#64748b', textAlign: 'center', fontWeight: '500' }
});
