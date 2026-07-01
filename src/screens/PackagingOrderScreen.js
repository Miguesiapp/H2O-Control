import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Alert, StatusBar, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { registerMovement } from '../services/logisticsService'; 
import { ChevronLeft, Container, Save, CheckCircle2, FlaskConical, AlertCircle, Box, Droplet, Building2 } from 'lucide-react-native';

const BIDON_CAPACITIES = ['20', '10', '5', '1'];
const BIDON_BRANDS = ['H2O', 'AGROCUBE', 'ALIANZA', 'AGROFONTEZUELA'];
const CAJA_BRANDS = ['H2O', 'AGROCUBE', 'AGROFONTEZUELA', 'GENERICAS'];

export default function PackagingOrderScreen({ route, navigation }) {
  const { companyName } = route.params;
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvedLots, setApprovedLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  
  const [formData, setFormData] = useState({
    presentation: '20', // Litros por bidón
    unitsProduced: '',  // Cantidad de bidones
    brandBidon: 'H2O',
    brandCaja: 'H2O', // Solo visible si aplica caja
  });

  // 1. Cargar lotes aprobados por Laboratorio y con stock disponible
  useEffect(() => {
    const fetchApprovedLots = async () => {
      try {
        const q = query(
          collection(db, "Inventory"),
          where("company", "==", companyName),
          where("stockType", "==", "GRANEL"), // Cambio de PT a GRANEL
          where("status", "==", "APTO"),  // Liberado por laboratorio
          where("quantity", ">", 0)       // Con líquido disponible
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

  // Lógica de Cajas
  const appliesBox = presentation === 5 || presentation === 1;
  let requiredBoxes = 0;
  let boxFormat = '';
  
  if (presentation === 5) {
    requiredBoxes = Math.ceil(units / 4);
    boxFormat = 'x5';
  } else if (presentation === 1) {
    requiredBoxes = Math.ceil(units / 12);
    boxFormat = 'x1';
  }

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
      const batchId = selectedLot.batchInternal; // Hereda el ADN
      const itemName = selectedLot.itemName?.toUpperCase();
      const currentUser = auth.currentUser?.email || 'Sistema';

      // 1. DEDUCCIÓN AUTOMÁTICA DEL LÍQUIDO A GRANEL
      await registerMovement(currentUser, 'CONSUMO_ENVASADO', companyName, {
          itemName: itemName,
          quantity: -Math.abs(litersToConsume), 
          stockType: 'GRANEL',
          batchInternal: batchId,
          unit: 'Lts'
      });

      // 2. DEDUCCIÓN DE INSUMOS CENTRALES (BIDONES)
      const bidonName = `BIDON ${presentation}L ${formData.brandBidon}`;
      await registerMovement(currentUser, 'CONSUMO_INSUMO', 'STOCK_CENTRAL_INSUMOS', {
          itemName: bidonName,
          quantity: -Math.abs(units),
          stockType: 'INSUMOS',
          batchInternal: batchId,
          unit: 'Uds'
      });

      // 3. DEDUCCIÓN DE INSUMOS CENTRALES (CAJAS) SI APLICA
      if (appliesBox && requiredBoxes > 0) {
        const cajaName = `CAJA ${boxFormat} ${formData.brandCaja}`;
        await registerMovement(currentUser, 'CONSUMO_INSUMO', 'STOCK_CENTRAL_INSUMOS', {
            itemName: cajaName,
            quantity: -Math.abs(requiredBoxes),
            stockType: 'INSUMOS',
            batchInternal: batchId,
            unit: 'Uds'
        });
      }

      // 4. INYECCIÓN DEL PRODUCTO TERMINADO ENVASADO (FINAL)
      const packagedItemName = `${itemName} - ${presentation}L`;
      await registerMovement(currentUser, 'INGRESO_OE', companyName, {
          itemName: packagedItemName,
          quantity: Math.abs(units),
          stockType: 'FINAL',
          batchInternal: batchId,
          unit: 'Uds',
          status: 'APTO', // Ya está listo para venta
          batchProvider: selectedLot.batchProvider || 'S/D', // Heredamos el lote del proveedor de la OP original
          expiryDate: selectedLot.expiryDate || 'S/V' // Heredamos la fecha de vencimiento de la OP original
      });

      Alert.alert(
        "Orden Completada", 
        `Se envasaron exitosamente ${units} unidades de ${presentation}L.\n\nSe descontaron:\n- ${litersToConsume} Lts de Granel\n- ${units} Bidones (${formData.brandBidon})\n${appliesBox ? `- ${requiredBoxes} Cajas (${formData.brandCaja})` : ''}`,
        [{ text: "Entendido", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error(error);
      Alert.alert("Error del Sistema", "No se pudo emitir la orden de envasado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
          <Text style={styles.headerTitle}>Orden de Envasado</Text>
          <Text style={styles.headerSub}>{companyName}</Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        <View style={styles.infoBanner}>
          <View style={styles.iconBox}>
            <Container color="#3b82f6" size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Fraccionamiento y Envasado</Text>
            <Text style={styles.bannerText}>Selecciona el lote de granel (aprobado por calidad) y los insumos utilizados.</Text>
          </View>
        </View>

        {/* 1. SELECCIÓN DE LOTE GRANEL */}
        <Text style={styles.sectionTitle}>1. Lote de Granel Aprobado</Text>
        <View style={styles.card}>
          {loading ? (
            <ActivityIndicator color="#3b82f6" size="large" style={{ marginVertical: 20 }} />
          ) : approvedLots.length === 0 ? (
            <View style={styles.emptyBox}>
              <AlertCircle color="#94a3b8" size={32} style={{marginBottom: 10}}/>
              <Text style={styles.emptyText}>No hay lotes de GRANEL aprobados disponibles en esta empresa.</Text>
            </View>
          ) : (
            approvedLots.map((lot) => (
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
            ))
          )}
        </View>

        {/* 2. PARÁMETROS DE ENVASADO E INSUMOS */}
        {selectedLot && (
          <>
            <Text style={styles.sectionTitle}>2. Insumos Utilizados</Text>
            <View style={styles.card}>
              
              <Text style={styles.label}>Capacidad del Bidón</Text>
              <View style={styles.chipRow}>
                {BIDON_CAPACITIES.map(cap => (
                  <TouchableOpacity 
                    key={cap} 
                    style={[styles.chip, formData.presentation === cap && styles.chipActive]}
                    onPress={() => setFormData({...formData, presentation: cap})}
                  >
                    <Droplet color={formData.presentation === cap ? '#fff' : '#64748b'} size={14} style={{marginRight: 4}}/>
                    <Text style={[styles.chipText, formData.presentation === cap && styles.chipTextActive]}>{cap}L</Text>
                  </TouchableOpacity>
                ))}
              </View>

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

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Unidades (Bidones) a Envasar</Text>
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
                  +{units} Bidones de {presentation}L
                </Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.submitBtn, (isSubmitting || isOverdraft || units <= 0) && { opacity: 0.5 }]}
              disabled={isSubmitting || isOverdraft || units <= 0}
              onPress={handleFinishPackaging}
            >
              {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <CheckCircle2 color="#fff" size={24} />
                  <Text style={styles.submitText}>CONFIRMAR OE</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
        <View style={{height: 50}} />
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
  headerSub: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
  
  container: { padding: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 12, marginLeft: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  infoBanner: { flexDirection: 'row', backgroundColor: '#eff6ff', padding: 15, borderRadius: 16, marginBottom: 25, borderWidth: 1, borderColor: '#bfdbfe', alignItems: 'center' },
  iconBox: { backgroundColor: '#fff', padding: 10, borderRadius: 12, marginRight: 15, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  bannerTitle: { fontSize: 15, fontWeight: '800', color: '#1e3a8a', marginBottom: 4 },
  bannerText: { fontSize: 12, color: '#3b82f6', lineHeight: 18, fontWeight: '500' },
  
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 25, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  label: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 8, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  emptyBox: { alignItems: 'center', padding: 20 },
  emptyText: { color: '#64748b', textAlign: 'center', fontWeight: '500' },

  lotCard: { backgroundColor: '#f8fafc', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 16, padding: 15, marginBottom: 10 },
  lotCardSelected: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  lotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  lotName: { fontSize: 15, fontWeight: '800', color: '#334155' },
  lotNameSelected: { color: '#1e3a8a' },
  lotText: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 2 },
  
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  chipTextActive: { color: '#fff' },

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
  submitText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1, marginLeft: 10 }
});