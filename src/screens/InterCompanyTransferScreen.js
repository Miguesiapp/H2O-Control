import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Alert, StatusBar, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { registerMovement } from '../services/logisticsService';
import { ChevronLeft, ArrowRightLeft, Package, CheckCircle2, Box } from 'lucide-react-native';

const COMPANIES = ["H2Ocontrol", "WaterDay", "Alianza", "Agrocube", "BioAcker", "AgroFontezuela"];
const STOCK_TYPES = [
  { id: 'FINAL', label: 'Envasado' },
  { id: 'PT', label: 'Granel' },
  { id: 'INSUMOS', label: 'Bidones/Cajas' }
];

export default function InterCompanyTransferScreen({ navigation }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    sourceCompany: '',
    destinationCompany: 'H2Ocontrol',
    itemName: '',
    quantity: '',
    batchInternal: '',
    stockType: 'FINAL'
  });

  const handleClearing = async () => {
    // ... [Misma LÓGICA DE PROGRAMACIÓN que ya tenías, no se cambia nada] ...
    const qtyNormalized = Number(formData.quantity.replace(',', '.'));

    if (!formData.sourceCompany || !formData.destinationCompany) {
      Alert.alert("Error", "Debes seleccionar empresa de origen y destino.");
      return;
    }

    if (formData.sourceCompany === formData.destinationCompany) {
      Alert.alert("Error", "El origen y destino deben ser diferentes.");
      return;
    }

    const isInsumo = formData.stockType === 'INSUMOS';
    if (!formData.itemName.trim() || isNaN(qtyNormalized) || qtyNormalized <= 0 || (!isInsumo && !formData.batchInternal.trim())) {
      Alert.alert("Datos Incompletos", "Verifica el producto, cantidad y lote.");
      return;
    }

    try {
      setIsSubmitting(true);
      const itemName = formData.itemName.trim().toUpperCase();
      const batchId = formData.batchInternal.trim().toUpperCase() || 'S/D';
      const dbStockType = formData.stockType === 'INSUMOS' ? 'MP' : formData.stockType;
      const currentUser = auth.currentUser?.email || 'Sistema';

      const q = query(
        collection(db, "Inventory"),
        where("company", "==", formData.sourceCompany),
        where("itemName", "==", itemName),
        where("stockType", "==", dbStockType)
      );
      const snap = await getDocs(q);
      
      let totalStock = 0;
      snap.forEach(doc => totalStock += doc.data().quantity || 0);

      if (totalStock < qtyNormalized) {
        Alert.alert("Quiebre de Stock", `La empresa origen solo tiene ${totalStock} unidades. No puedes transferir ${qtyNormalized}.`);
        setIsSubmitting(false);
        return;
      }

      await registerMovement(currentUser, 'EGRESO_CLEARING', formData.sourceCompany, {
        itemName: itemName,
        quantity: -Math.abs(qtyNormalized),
        batchInternal: batchId,
        stockType: dbStockType,
        details: `Transferencia hacia ${formData.destinationCompany}`
      });

      await registerMovement(currentUser, 'INGRESO_CLEARING', formData.destinationCompany, {
        itemName: itemName,
        quantity: Math.abs(qtyNormalized),
        batchInternal: batchId,
        stockType: dbStockType,
        unit: (formData.stockType === 'FINAL' || isInsumo) ? 'Uds' : 'Kg/Lts',
        details: `Recepción desde ${formData.sourceCompany}`
      });

      Alert.alert("Clearing Exitoso", "Transferencia completada y auditada.");
      (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'));

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Fallo en la transacción de clearing.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Ajuste de status bar para fondo oscuro */}
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* HEADER REDISEÑADO: Fondo oscuro, texto claro */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))} style={styles.backBtn}>
          <ChevronLeft color="#f8fafc" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
          <Text style={styles.headerTitle}>Clearing Inter-Empresas</Text>
          <Text style={styles.headerSub}>Transferencia de Activos</Text>
        </View>
        <ArrowRightLeft color="#f8fafc" size={24} />
      </View>

      <ScrollView maximumZoomScale={1} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        <View style={styles.flowCard}>
          <Text style={styles.sectionLabel}>1. Dirección del Movimiento</Text>
          
          <Text style={styles.inputLabel}>EMPRESA ORIGEN</Text>
          <ScrollView maximumZoomScale={1} horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {COMPANIES.map(comp => (
              <TouchableOpacity key={comp} style={[styles.chip, formData.sourceCompany === comp && styles.chipActiveSrc]} onPress={() => setFormData({...formData, sourceCompany: comp})}>
                <Text style={[styles.chipText, formData.sourceCompany === comp && styles.chipTextActive]}>{comp}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Separador estético rediseñado */}
          <View style={styles.flowArrowBox}>
            <View style={styles.lineStyle} />
            <View style={styles.circleIcon}>
              <ArrowRightLeft color="#cbd5e1" size={20} style={{ transform: [{ rotate: '90deg' }] }} />
            </View>
            <View style={styles.lineStyle} />
          </View>

          <Text style={styles.inputLabel}>EMPRESA DESTINO</Text>
          <ScrollView maximumZoomScale={1} horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {COMPANIES.map(comp => (
              <TouchableOpacity key={comp} style={[styles.chip, formData.destinationCompany === comp && styles.chipActiveDst]} onPress={() => setFormData({...formData, destinationCompany: comp})}>
                <Text style={[styles.chipText, formData.destinationCompany === comp && styles.chipTextActive]}>{comp}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>2. Identificación del Activo</Text>
          <View style={styles.typeRow}>
            {STOCK_TYPES.map(type => (
              <TouchableOpacity key={type.id} style={[styles.typeBtn, formData.stockType === type.id && styles.typeBtnActive]} onPress={() => setFormData({...formData, stockType: type.id, itemName: ''})}>
                <Text style={[styles.typeBtnText, formData.stockType === type.id && styles.whiteText]}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>PRODUCTO / MATERIA PRIMA</Text>
          <View style={styles.inputBox}>
            <Package color="#94a3b8" size={20} />
            <TextInput style={styles.input} placeholder="Ej: ÁCIDO SULFÚRICO" placeholderTextColor="#94a3b8" value={formData.itemName} onChangeText={(t) => setFormData({...formData, itemName: t})} autoCapitalize="characters" />
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.inputLabel}>CANTIDAD</Text>
              <TextInput style={styles.inputPlain} placeholder="0" placeholderTextColor="#94a3b8" keyboardType="numeric" value={formData.quantity} onChangeText={(t) => setFormData({...formData, quantity: t})} />
            </View>
            <View style={{ flex: 1.5 }}>
              <Text style={styles.inputLabel}>LOTE EXACTO</Text>
              <TextInput style={styles.inputPlain} placeholder="Lote" placeholderTextColor="#94a3b8" value={formData.batchInternal} onChangeText={(t) => setFormData({...formData, batchInternal: t})} autoCapitalize="characters" />
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleClearing} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>EJECUTAR CLEARING</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' }, // Fondo oscuro para emparejar con el header
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, paddingVertical: 20, backgroundColor: '#0f172a', // Fondo oscuro
    elevation: 0 
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#f8fafc' }, // Texto claro
  headerSub: { fontSize: 11, color: '#3b82f6', textTransform: 'uppercase', fontWeight: '800', letterSpacing: 0.5 },
  
  container: { 
    flexGrow: 1, 
    backgroundColor: '#f8fafc', // Contenido en blanco sucio
    borderTopLeftRadius: 24, // Curvatura superior
    borderTopRightRadius: 24,
    padding: 20 
  },

  sectionLabel: { fontSize: 14, fontWeight: '900', color: '#0f172a', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 },
  flowCard: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 20, elevation: 1, borderWidth: 1, borderColor: '#e2e8f0' },
  inputLabel: { fontSize: 10, fontWeight: '800', color: '#64748b', marginBottom: 8, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipScroll: { flexDirection: 'row', marginBottom: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f8fafc', borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  chipActiveSrc: { backgroundColor: '#ef4444', borderColor: '#ef4444' }, 
  chipActiveDst: { backgroundColor: '#10b981', borderColor: '#10b981' }, 
  chipText: { fontSize: 13, color: '#475569', fontWeight: '700' },
  chipTextActive: { color: '#fff', fontWeight: '900' },
  
  // REDISEÑO DEL SEPARADOR
  flowArrowBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
  lineStyle: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  circleIcon: { padding: 8, backgroundColor: '#f8fafc', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', marginHorizontal: 10 },

  formCard: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 25, elevation: 1, borderWidth: 1, borderColor: '#e2e8f0' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeBtn: { flex: 1, minWidth: '45%', alignItems: 'center', backgroundColor: '#f8fafc', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  typeBtnActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  typeBtnText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  whiteText: { color: '#fff' },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 15 },
  input: { flex: 1, paddingVertical: 16, marginLeft: 10, color: '#0f172a', fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row' },
  inputPlain: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 15, color: '#0f172a', fontWeight: '600', marginBottom: 15 },
  submitBtn: { backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 16, marginTop: 10, elevation: 4, shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 }
});