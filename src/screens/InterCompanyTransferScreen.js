import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Alert, StatusBar, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebase';
import { deductStock, registerMovement } from '../services/logisticsService';
import { ChevronLeft, ArrowRightLeft, Package, Database, CheckCircle2, Box } from 'lucide-react-native';

const COMPANIES = ["H2Ocontrol", "WaterDay", "Alianza", "Agrocube", "BioAcker", "AgroFontezuela"];
const STOCK_TYPES = [
  { id: 'MP', label: 'Mat. Prima' },
  { id: 'FINAL', label: 'Envasado' },
  { id: 'PT', label: 'Granel' },
  { id: 'INSUMOS', label: 'Bidones/Cajas' } // NUEVO
];

export default function InterCompanyTransferScreen({ navigation }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    sourceCompany: '',
    destinationCompany: 'H2Ocontrol',
    itemName: '',
    quantity: '',
    batchInternal: '',
    stockType: 'MP'
  });

  const handleClearing = async () => {
    const qtyNormalized = Number(formData.quantity.replace(',', '.'));

    if (!formData.sourceCompany || !formData.destinationCompany) {
      Alert.alert("Error de Origen/Destino", "Debes seleccionar de dónde sale y hacia dónde va la mercadería.");
      return;
    }

    if (formData.sourceCompany === formData.destinationCompany) {
      Alert.alert("Movimiento Inválido", "La empresa de origen y destino no pueden ser la misma.");
      return;
    }

    // Validación diferente si es INSUMO (no exigimos Lote)
    const isInsumo = formData.stockType === 'INSUMOS';
    if (!formData.itemName.trim() || isNaN(qtyNormalized) || qtyNormalized <= 0 || (!isInsumo && !formData.batchInternal.trim())) {
      Alert.alert("Datos Incompletos", `Verifica el producto, una cantidad válida ${!isInsumo ? 'y el lote exacto' : ''}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      const itemName = formData.itemName.trim().toUpperCase();
      const batchId = formData.batchInternal.trim().toUpperCase() || 'S/D';

      // Adaptamos el tipo de stock interno para la base de datos si es INSUMO
      // Asumo que los bidones vacíos los guardan bajo 'MP' o 'INSUMOS'. Lo dejo como 'MP' por defecto operativo.
      const dbStockType = formData.stockType === 'INSUMOS' ? 'MP' : formData.stockType;

      const success = await deductStock(
        formData.sourceCompany, 
        itemName, 
        qtyNormalized, 
        isInsumo ? null : batchId, // Si es insumo, pasamos null para que la BD no busque por lote
        dbStockType
      );

      if (!success) {
        Alert.alert("Quiebre de Stock", `La empresa ${formData.sourceCompany} no tiene suficiente stock de ${itemName} para prestar.`);
        setIsSubmitting(false);
        return;
      }

      await registerMovement(
        auth.currentUser?.email || 'Sistema',
        'EGRESO_CLEARING',
        formData.sourceCompany,
        {
          itemName: itemName,
          quantity: -Math.abs(qtyNormalized),
          batchInternal: batchId,
          stockType: dbStockType,
          details: `Transferencia hacia ${formData.destinationCompany}`
        }
      );

      await registerMovement(
        auth.currentUser?.email || 'Sistema',
        'INGRESO_CLEARING',
        formData.destinationCompany,
        {
          itemName: itemName,
          quantity: Math.abs(qtyNormalized),
          batchInternal: batchId,
          stockType: dbStockType,
          unit: (formData.stockType === 'FINAL' || isInsumo) ? 'Uds' : 'Kg/Lts',
          details: `Recepción desde ${formData.sourceCompany}`
        }
      );

      Alert.alert(
        "Clearing Exitoso", 
        `Se transfirieron ${qtyNormalized} ${isInsumo ? 'unidades' : 'Lts/Kg'} de ${formData.sourceCompany} a ${formData.destinationCompany}.`,
        [{ text: "Entendido", onPress: () => navigation.goBack() }]
      );

    } catch (error) {
      console.error(error);
      Alert.alert("Error de Sistema", "Fallo en la transacción de clearing inter-empresas.");
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
          <Text style={styles.headerTitle}>Clearing Inter-Empresas</Text>
          <Text style={styles.headerSub}>Transferencia de Activos</Text>
        </View>
        <ArrowRightLeft color="#0f172a" size={24} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        
        {/* PANEL DE ORIGEN Y DESTINO */}
        <View style={styles.flowCard}>
          <Text style={styles.sectionLabel}>1. Dirección del Movimiento</Text>
          
          <Text style={styles.inputLabel}>EMPRESA ORIGEN (PRESTA STOCK)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {COMPANIES.map(comp => (
              <TouchableOpacity 
                key={`src-${comp}`}
                style={[styles.chip, formData.sourceCompany === comp && styles.chipActiveSrc]}
                onPress={() => setFormData({...formData, sourceCompany: comp})}
              >
                <Text style={[styles.chipText, formData.sourceCompany === comp && styles.chipTextActive]}>{comp}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.flowArrowBox}>
            <ArrowRightLeft color="#cbd5e1" size={24} style={{ transform: [{ rotate: '90deg' }] }} />
          </View>

          <Text style={styles.inputLabel}>EMPRESA DESTINO (RECIBE STOCK)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {COMPANIES.map(comp => (
              <TouchableOpacity 
                key={`dst-${comp}`}
                style={[styles.chip, formData.destinationCompany === comp && styles.chipActiveDst]}
                onPress={() => setFormData({...formData, destinationCompany: comp})}
              >
                <Text style={[styles.chipText, formData.destinationCompany === comp && styles.chipTextActive]}>{comp}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* DETALLE DEL PRODUCTO */}
        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>2. Identificación del Activo</Text>

          <Text style={styles.inputLabel}>TIPO DE INVENTARIO</Text>
          <View style={styles.typeRow}>
            {STOCK_TYPES.map(type => (
              <TouchableOpacity 
                key={type.id}
                style={[styles.typeBtn, formData.stockType === type.id && styles.typeBtnActive]}
                onPress={() => {
                  // Si cambia de tipo, borramos el nombre para evitar confusiones
                  setFormData({...formData, stockType: type.id, itemName: ''});
                }}
              >
                <Text style={[styles.typeBtnText, formData.stockType === type.id && styles.whiteText]}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* LÓGICA DINÁMICA: BIDONES VS QUÍMICOS */}
          {formData.stockType === 'INSUMOS' ? (
            <>
              <Text style={styles.inputLabel}>SELECCIONE EL ENVASE</Text>
              <View style={styles.insumosGrid}>
                {['BIDON 20L', 'BIDON 10L', 'BIDON 5L', 'BIDON 1L'].map(bidon => (
                  <TouchableOpacity 
                    key={bidon}
                    style={[styles.insumoBtn, formData.itemName === bidon && styles.insumoBtnActive]}
                    onPress={() => setFormData({...formData, itemName: bidon})}
                  >
                    <Box color={formData.itemName === bidon ? "#fff" : "#64748b"} size={16} />
                    <Text style={[styles.insumoBtnText, formData.itemName === bidon && styles.whiteText]}>{bidon}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.inputLabel}>PRODUCTO / MATERIA PRIMA</Text>
              <View style={styles.inputBox}>
                <Package color="#94a3b8" size={20} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Ej: ÁCIDO SULFÚRICO" 
                  placeholderTextColor="#94a3b8"
                  value={formData.itemName}
                  onChangeText={(t) => setFormData({...formData, itemName: t})}
                  autoCapitalize="characters"
                />
              </View>
            </>
          )}

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.inputLabel}>CANTIDAD</Text>
              <TextInput 
                style={styles.inputPlain} 
                placeholder="Ej: 100" 
                keyboardType="numeric"
                placeholderTextColor="#94a3b8"
                value={formData.quantity}
                onChangeText={(t) => setFormData({...formData, quantity: t})}
              />
            </View>
            
            {/* Si son Insumos/Bidones, el lote a veces no existe, lo hacemos opcional */}
            <View style={{ flex: 1.5 }}>
              <Text style={styles.inputLabel}>{formData.stockType === 'INSUMOS' ? 'LOTE (OPCIONAL)' : 'LOTE EXACTO'}</Text>
              <TextInput 
                style={styles.inputPlain} 
                placeholder={formData.stockType === 'INSUMOS' ? 'S/D' : "Lote a descontar"} 
                placeholderTextColor="#94a3b8"
                value={formData.batchInternal}
                onChangeText={(t) => setFormData({...formData, batchInternal: t})}
                autoCapitalize="characters"
              />
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]} 
          onPress={handleClearing}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <CheckCircle2 color="#fff" size={20} />
              <Text style={styles.submitBtnText}>EJECUTAR CLEARING</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  headerSub: { fontSize: 11, color: '#3b82f6', textTransform: 'uppercase', fontWeight: '800', letterSpacing: 0.5 },
  
  container: { padding: 20 },
  sectionLabel: { fontSize: 14, fontWeight: '900', color: '#0f172a', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 },
  
  flowCard: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 20, elevation: 2, borderWidth: 1, borderColor: '#e2e8f0' },
  inputLabel: { fontSize: 10, fontWeight: '800', color: '#64748b', marginBottom: 8, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  chipScroll: { flexDirection: 'row', marginBottom: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f8fafc', borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  chipActiveSrc: { backgroundColor: '#ef4444', borderColor: '#ef4444' }, 
  chipActiveDst: { backgroundColor: '#10b981', borderColor: '#10b981' }, 
  chipText: { fontSize: 13, color: '#475569', fontWeight: '700' },
  chipTextActive: { color: '#fff', fontWeight: '900' },
  
  flowArrowBox: { alignItems: 'center', marginVertical: 5 },

  formCard: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 25, elevation: 2, borderWidth: 1, borderColor: '#e2e8f0' },
  
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeBtn: { flex: 1, minWidth: '45%', alignItems: 'center', backgroundColor: '#f8fafc', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  typeBtnActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  typeBtnText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  whiteText: { color: '#fff' },

  insumosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  insumoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '48%', backgroundColor: '#f8fafc', paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  insumoBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  insumoBtnText: { fontSize: 12, fontWeight: '800', color: '#475569' },

  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 15 },
  input: { flex: 1, paddingVertical: 14, marginLeft: 10, color: '#0f172a', fontSize: 15, fontWeight: '700' },
  
  row: { flexDirection: 'row' },
  inputPlain: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 15, color: '#0f172a', fontWeight: '700' },

  submitBtn: { backgroundColor: '#3b82f6', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 16, elevation: 4, shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 8, gap: 10 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1 }
});