import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Alert, StatusBar, ActivityIndicator 
} from 'react-native';
// IMPORTANTE: Cambio a la librería recomendada
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { registerMovement, deductStock } from '../services/logisticsService';
import { ChevronLeft, Container, Save, CheckCircle2 } from 'lucide-react-native';

export default function PackagingOrderScreen({ route, navigation }) {
  const { companyName } = route.params;
  const [loading, setLoading] = useState(true);
  const [approvedLots, setApprovedLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [formData, setFormData] = useState({
    presentation: '20',
    unitsProduced: '',
  });

  // 1. Cargar solo lotes aprobados por Laboratorio (BBS)
  useEffect(() => {
    const fetchApprovedLots = async () => {
      try {
        const q = query(
          collection(db, "Inventory"),
          where("company", "==", companyName),
          where("stockType", "==", "PT"),
          where("status", "==", "APTO") // Filtro de calidad innegociable
        );
        const querySnapshot = await getDocs(q);
        const lots = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setApprovedLots(lots);
      } catch (error) {
        console.error(error);
        Alert.alert("Error", "No se pudieron cargar los lotes aptos.");
      } finally {
        setLoading(false);
      }
    };
    fetchApprovedLots();
  }, [companyName]);

  const handleFinishPackaging = async () => {
    if (!selectedLot || !formData.unitsProduced) {
      Alert.alert("Error", "Selecciona un lote e ingresa las unidades envasadas.");
      return;
    }

    const totalLitersNeeded = Number(formData.unitsProduced) * Number(formData.presentation);

    if (totalLitersNeeded > selectedLot.quantity) {
      Alert.alert("Error", `Stock insuficiente. El lote solo tiene ${selectedLot.quantity} Lts disponibles.`);
      return;
    }

    try {
      const batchId = selectedLot.batchInternal;

      // 1. SUMAR al Stock Final (Envasado)
      await registerMovement(auth.currentUser.email, 'ENVASADO_FINAL_EXITO', companyName, {
        itemName: selectedLot.itemName,
        quantity: Number(formData.unitsProduced),
        presentation: formData.presentation,
        stockType: 'FINAL',
        batchInternal: batchId,
        unit: 'Bidones'
      });

      // 2. RESTAR del Granel (Líquido usado)
      await deductStock(companyName, selectedLot.itemName, totalLitersNeeded, batchId, 'PT');

      // 3. RESTAR Insumos (Bidones usados de la Materia Prima)
      await deductStock(companyName, `Bidon ${formData.presentation}L`, Number(formData.unitsProduced), null, 'MP');

      Alert.alert("Proceso Finalizado", "Stock actualizado: Granel descontado y Producto Final sumado.");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Hubo un fallo en la actualización automática de stock.");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#2e4a3b" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Orden de Envasado</Text>
        <Container color="#2e4a3b" size={24} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>1. Selección de Lote Aprobado</Text>
        {loading ? (
          <ActivityIndicator size="small" color="#2e4a3b" />
        ) : approvedLots.length > 0 ? (
          <View style={styles.lotGrid}>
            {approvedLots.map(lot => (
              <TouchableOpacity 
                key={lot.id} 
                style={[styles.lotChip, selectedLot?.id === lot.id && styles.lotChipActive]}
                onPress={() => setSelectedLot(lot)}
              >
                <CheckCircle2 color={selectedLot?.id === lot.id ? "#fff" : "#2e7d32"} size={14} />
                <Text style={[styles.lotText, selectedLot?.id === lot.id && styles.lotTextActive]}>
                  {lot.itemName} (Lote: {lot.batchInternal})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyWarning}>
            <Text style={styles.emptyText}>⚠️ No hay lotes aprobados por Laboratorio para esta empresa.</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.label}>Presentación (Litros)</Text>
          <View style={styles.pickerContainer}>
            {['20', '10', '5', '1'].map(p => (
              <TouchableOpacity 
                key={p} 
                style={[styles.pButton, formData.presentation === p && styles.pButtonActive]}
                onPress={() => setFormData({...formData, presentation: p})}
              >
                <Text style={[styles.pText, formData.presentation === p && styles.pTextActive]}>{p}L</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Bidones Obtenidos</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Cantidad de bidones envasados" 
            keyboardType="numeric"
            value={formData.unitsProduced}
            onChangeText={(txt) => setFormData({...formData, unitsProduced: txt})}
            placeholderTextColor="#bbb"
          />
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, (!selectedLot || !formData.unitsProduced) && styles.buttonDisabled]} 
          onPress={handleFinishPackaging}
          disabled={!selectedLot || !formData.unitsProduced}
        >
          <Save color="#fff" size={20} />
          <Text style={styles.saveButtonText}>Confirmar Envasado</Text>
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>
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
    borderBottomColor: '#eee' 
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#2e4a3b' },
  container: { padding: 20 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#2e4a3b', marginBottom: 10, marginTop: 5 },
  lotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 25 },
  lotChip: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    padding: 10, 
    backgroundColor: '#fff', 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: '#e0e0e0' 
  },
  lotChipActive: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
  lotText: { fontSize: 11, color: '#666', fontWeight: '600' },
  lotTextActive: { color: '#fff' },
  card: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 24, 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)'
  },
  input: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#eee', fontSize: 16, color: '#333' },
  pickerContainer: { flexDirection: 'row', gap: 8, marginTop: 5, marginBottom: 20 },
  pButton: { flex: 1, paddingVertical: 12, backgroundColor: '#f0f0f0', borderRadius: 8, alignItems: 'center' },
  pButtonActive: { backgroundColor: '#2e4a3b' },
  pText: { fontWeight: 'bold', color: '#888', fontSize: 14 },
  pTextActive: { color: '#fff' },
  emptyWarning: { padding: 15, backgroundColor: '#fff5f5', borderRadius: 10, marginBottom: 20 },
  emptyText: { color: '#d32f2f', fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
  saveButton: { 
    backgroundColor: '#2e4a3b', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 18, 
    borderRadius: 15, 
    marginTop: 35, 
    gap: 10,
    elevation: 3
  },
  buttonDisabled: { backgroundColor: '#ccc' },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' }
});