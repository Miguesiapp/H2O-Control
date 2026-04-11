import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Alert, StatusBar, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { registerMovement, deductStockFIFO } from '../services/logisticsService';
import { ChevronLeft, Container, Save, CheckCircle2, FlaskConical, AlertCircle, Box } from 'lucide-react-native';

export default function PackagingOrderScreen({ route, navigation }) {
  const { companyName } = route.params;
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvedLots, setApprovedLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [formData, setFormData] = useState({
    presentation: '20', // Litros por bidón
    unitsProduced: '',  // Cantidad de bidones
  });

  // 1. Cargar lotes aprobados por Laboratorio y con stock disponible
  useEffect(() => {
    const fetchApprovedLots = async () => {
      try {
        // En tu DB, los PT están en Produccion_Lotes o en Inventory?
        // Según tu estructura actual, están en Produccion_Lotes luego de la orden, 
        // o en Inventory si se cargaron manual. Asumimos Inventory por tu código previo:
        const q = query(
          collection(db, "Inventory"),
          where("company", "==", companyName),
          where("stockType", "==", "PT"),
          where("status", "==", "APTO"),
          where("quantity", ">", 0) // Solo traer los que tienen líquido para envasar
        );
        const querySnapshot = await getDocs(q);
        const lots = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setApprovedLots(lots);
      } catch (error) {
        console.error(error);
        Alert.alert("Error de Conexión", "No se pudieron cargar los lotes liberados.");
      } finally {
        setLoading(false);
      }
    };
    fetchApprovedLots();
  }, [companyName]);

  // Cálculos Automáticos para la UI
  const units = Number(formData.unitsProduced) || 0;
  const presentation = Number(formData.presentation);
  const litersToConsume = units * presentation;
  const remainingLiters = selectedLot ? (selectedLot.quantity - litersToConsume) : 0;
  const isOverdraft = selectedLot && remainingLiters < 0;

  const handleFinishPackaging = async () => {
    if (!selectedLot || units <= 0) {
      Alert.alert("Atención", "Selecciona un lote e indica la cantidad de unidades obtenidas.");
      return;
    }

    if (isOverdraft) {
      Alert.alert("Quiebre de Stock", `Intentas envasar ${litersToConsume} Lts, pero el lote solo cuenta con ${selectedLot.quantity} Lts.`);
      return;
    }

    try {
      setIsSubmitting(true);
      const batchId = selectedLot.batchInternal;
      const itemName = selectedLot.itemName?.toUpperCase();

      // 1. DEDUCCIÓN AUTOMÁTICA DEL LÍQUIDO A GRANEL (PT)
      // Como usamos FIFO en el servicio logístico, solo pasamos nombre y cantidad
      await deductStockFIFO(companyName, itemName, litersToConsume);

      // 2. INYECCIÓN DEL PRODUCTO TERMINADO ENVASADO (FINAL)
      const packagedItemName = `${itemName} - ${presentation}L`;
      await registerMovement(
        auth.currentUser?.email || 'Sistema', 
        'ENVASADO_FINAL', 
        companyName, 
        {
          itemName: packagedItemName,
          quantity: units,
          stockType: 'FINAL',
          batchInternal: batchId, // Mantenemos el ADN del lote original
          unit: 'Uds'
        }
      );

      // 3. DEDUCCIÓN DE INSUMOS AUTOMÁTICA (Opcional - Requiere que los nombres coincidan exactos)
      // await deductStockFIFO(companyName, `BIDON ${presentation}L`, units);
      // await deductStockFIFO(companyName, `ETIQUETA ${itemName}`, units);

      Alert.alert(
        "Envasado Exitoso", 
        `Se han ingresado ${units} unidades de ${presentation}L.\nSe descontaron ${litersToConsume} Lts del granel.`,
        [{ text: "Entendido", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error(error);
      Alert.alert("Error de Sistema", "Fallo en la sincronización de inventarios.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER ENTERPRISE */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Orden de Envasado</Text>
          <Text style={styles.headerSub}>{companyName}</Text>
        </View>
        <Container color="#0f172a" size={24} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>1. Selección de Lote Aprobado</Text>
        
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={styles.loadingText}>Buscando lotes liberados...</Text>
          </View>
        ) : approvedLots.length > 0 ? (
          <View style={styles.lotList}>
            {approvedLots.map(lot => (
              <TouchableOpacity 
                key={lot.id} 
                style={[styles.lotCard, selectedLot?.id === lot.id && styles.lotCardActive]}
                onPress={() => setSelectedLot(lot)}
                activeOpacity={0.7}
              >
                <View style={styles.lotHeader}>
                  <CheckCircle2 color={selectedLot?.id === lot.id ? "#10b981" : "#cbd5e1"} size={20} />
                  <Text style={[styles.lotTitle, selectedLot?.id === lot.id && {color: '#0f172a'}]}>
                    {lot.itemName}
                  </Text>
                  <View style={styles.stockBadge}>
                    <Text style={styles.stockBadgeText}>{lot.quantity} Lts</Text>
                  </View>
                </View>
                <View style={styles.lotFooter}>
                  <FlaskConical color="#64748b" size={14} />
                  <Text style={styles.lotMetaText}>ID: {lot.batchInternal}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyWarning}>
            <AlertCircle color="#f59e0b" size={24} />
            <Text style={styles.emptyText}>No existen lotes en estado APTO con líquido disponible para esta unidad de negocio.</Text>
          </View>
        )}

        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>2. Formato de Envasado</Text>
          <View style={styles.pickerContainer}>
            {['20', '10', '5', '1'].map(p => (
              <TouchableOpacity 
                key={p} 
                style={[styles.pButton, formData.presentation === p && styles.pButtonActive]}
                onPress={() => setFormData({...formData, presentation: p})}
              >
                <Text style={[styles.pText, formData.presentation === p && styles.pTextActive]}>{p} Lts</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>3. Unidades Obtenidas (Bidones)</Text>
          <View style={styles.inputWrapper}>
            <Box color="#94a3b8" size={20} style={{ marginRight: 10 }} />
            <TextInput 
              style={styles.input} 
              placeholder="0" 
              keyboardType="numeric"
              value={formData.unitsProduced}
              onChangeText={(txt) => setFormData({...formData, unitsProduced: txt})}
              placeholderTextColor="#94a3b8"
              editable={!!selectedLot}
            />
            <Text style={styles.inputSuffix}>Uds.</Text>
          </View>
        </View>

        {/* ASISTENTE DE CÁLCULO (H2O Neural UI) */}
        {selectedLot && units > 0 && (
          <View style={[styles.calcBox, isOverdraft && styles.calcBoxError]}>
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Consumo de Granel:</Text>
              <Text style={[styles.calcValue, isOverdraft && {color: '#ef4444'}]}>{litersToConsume} Lts</Text>
            </View>
            <View style={styles.calcDivider} />
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Stock Restante en Lote:</Text>
              <Text style={[styles.calcValue, isOverdraft && {color: '#ef4444'}]}>{remainingLiters} Lts</Text>
            </View>
            {isOverdraft && (
              <Text style={styles.errorText}>⚠️ El consumo supera el líquido disponible.</Text>
            )}
          </View>
        )}

        <TouchableOpacity 
          style={[styles.saveButton, (!selectedLot || units <= 0 || isOverdraft) && styles.buttonDisabled]} 
          onPress={handleFinishPackaging}
          disabled={!selectedLot || units <= 0 || isOverdraft || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Save color="#fff" size={20} />
              <Text style={styles.saveButtonText}>Confirmar y Actualizar Stock</Text>
            </>
          )}
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>
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
  headerSub: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: '800', letterSpacing: 0.5 },
  
  container: { padding: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  loadingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe' },
  loadingText: { marginLeft: 10, color: '#1e3a8a', fontWeight: '600', fontSize: 13 },
  
  emptyWarning: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#fde68a' },
  emptyText: { flex: 1, marginLeft: 15, color: '#b45309', fontSize: 13, fontWeight: '600', lineHeight: 18 },

  lotList: { gap: 10, marginBottom: 25 },
  lotCard: { backgroundColor: '#fff', padding: 15, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  lotCardActive: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  lotHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  lotTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#475569', marginLeft: 10 },
  stockBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  stockBadgeText: { fontSize: 11, fontWeight: '800', color: '#334155' },
  lotFooter: { flexDirection: 'row', alignItems: 'center', marginLeft: 30, gap: 6 },
  lotMetaText: { fontSize: 11, color: '#64748b', fontWeight: '500' },

  formCard: { backgroundColor: '#fff', padding: 20, borderRadius: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  
  pickerContainer: { flexDirection: 'row', gap: 10, marginBottom: 25 },
  pButton: { flex: 1, paddingVertical: 14, backgroundColor: '#f1f5f9', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  pButtonActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  pText: { fontWeight: '800', color: '#64748b', fontSize: 14 },
  pTextActive: { color: '#f8fafc' },
  
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 15 },
  input: { flex: 1, paddingVertical: 15, fontSize: 20, color: '#0f172a', fontWeight: '900' },
  inputSuffix: { fontSize: 14, fontWeight: '800', color: '#94a3b8' },

  calcBox: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, marginTop: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  calcBoxError: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calcLabel: { fontSize: 12, color: '#475569', fontWeight: '600' },
  calcValue: { fontSize: 14, fontWeight: '900', color: '#0f172a' },
  calcDivider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 8 },
  errorText: { color: '#ef4444', fontSize: 11, fontWeight: '800', marginTop: 10, textAlign: 'right' },

  saveButton: { backgroundColor: '#10b981', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 14, marginTop: 30, gap: 10, elevation: 4 },
  buttonDisabled: { backgroundColor: '#cbd5e1', elevation: 0 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }
});