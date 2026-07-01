import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Alert, StatusBar, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase'; 
import { collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { registerMovement } from '../services/logisticsService';
import { ChevronLeft, Play, Beaker, FileText, Factory, AlertCircle, Calculator, CheckCircle2, XCircle } from 'lucide-react-native';
import { EQUIVALENCIES } from '../services/formulaService';

export default function ProductionOrderScreen({ route, navigation }) {
  const { companyName } = route.params;
  const [productName, setProductName] = useState('');
  const [targetQuantity, setTargetQuantity] = useState('');
  const [batchProvider, setBatchProvider] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Nuevo estado para guardar el cruce de Fórmulas vs Stock
  const [requirements, setRequirements] = useState(null);

  // Generador de Lote Único
  const generateUniqueBatch = () => {
    const fecha = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const idUnico = Date.now().toString().slice(-4);
    return `OP-${fecha}-${idUnico}`; // Cambiado a OP (Orden Producción)
  };

  // PASO 1: Calcular Requerimientos cruzando la Fórmula con el Stock Actual
  const handleCalculateNeeds = async () => {
    if (!productName.trim() || !targetQuantity.trim()) {
      Alert.alert("Atención", "Especifica el producto y el volumen a fabricar.");
      return;
    }

    const qty = Number(targetQuantity.replace(',', '.'));
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Error", "El volumen debe ser un número mayor a 0.");
      return;
    }

    setIsCalculating(true);
    try {
      // 1. Buscar la Receta en la colección "Formulas_Maestras"
      const formulasRef = collection(db, 'Formulas_Maestras');
      const eqNames = EQUIVALENCIES[productName.trim().toUpperCase()] || [];
      const possibleFormulaNames = [productName.trim().toUpperCase(), ...eqNames];
      
      const qFormula = query(formulasRef, where('productName', 'in', possibleFormulaNames));
      const formulaSnap = await getDocs(qFormula);

      if (formulaSnap.empty) {
        Alert.alert("Fórmula no encontrada", "No existe una receta maestra para este producto ni sus equivalencias en la base de datos.");
        setIsCalculating(false);
        return;
      }

      const formulaData = formulaSnap.docs[0].data();
      const calculatedNeeds = [];

      // 2. Iterar sobre los ingredientes de la receta y cruzar con el Inventario
      for (const ingredient of formulaData.ingredients) {
        // percentage viene como entero (ej. 15 para 15%), dividimos por 100
        const percentageValue = ingredient.percentage !== undefined ? ingredient.percentage / 100 : (ingredient.qtyPerLiter || 0);
        const requiredQty = qty * percentageValue;
        
        // Buscar stock actual de esta materia prima
        const ingUpper = ingredient.name.trim().toUpperCase();
        const eqIngs = EQUIVALENCIES[ingUpper] || [];
        const possibleIngredients = [ingUpper, ...eqIngs];

        const inventoryRef = collection(db, 'Inventory');
        const qStock = query(inventoryRef, where('itemName', 'in', possibleIngredients));
        const stockSnap = await getDocs(qStock);
        
        let currentStock = 0;
        stockSnap.forEach(doc => {
            currentStock += doc.data().quantity || 0;
        });

        calculatedNeeds.push({
          name: ingredient.name,
          required: requiredQty,
          stock: currentStock,
          isSufficient: currentStock >= requiredQty,
          missing: currentStock >= requiredQty ? 0 : requiredQty - currentStock
        });
      }

      setRequirements(calculatedNeeds);

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Hubo un problema al calcular los requerimientos.");
    } finally {
      setIsCalculating(false);
    }
  };

  // PASO 2: Confirmar OP y afectar inventarios
  const handleStartProduction = async () => {
    // Validar que el cálculo previo exista
    if (!requirements) return;

    // Opcional: Bloquear si falta stock (Puedes quitar esta validación si prefieres permitir stock negativo temporalmente)
    const hasMissingStock = requirements.some(req => !req.isSufficient);
    if (hasMissingStock) {
      Alert.alert(
        "Falta de Stock", 
        "Existen materias primas en rojo. Te recomendamos generar primero un Ingreso de Compras. ¿Deseas forzar la OP de todos modos?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Forzar OP", style: "destructive", onPress: executeProductionOrder }
        ]
      );
      return;
    }

    executeProductionOrder();
  };

  const executeProductionOrder = async () => {
    try {
      setIsSubmitting(true);
      const batchId = generateUniqueBatch();
      const currentUser = auth.currentUser?.email || 'Sistema';
      const qty = Number(targetQuantity.replace(',', '.'));

      if (!expiryDate.trim()) {
        Alert.alert("Error", "Debes especificar la fecha de vencimiento del lote a granel.");
        setIsSubmitting(false);
        return;
      }

      // 1. DESCONTAR LAS MATERIAS PRIMAS (Ciclo sobre requirements)
      for (const req of requirements) {
        await registerMovement(currentUser, 'RETIRO_PRODUCCION', companyName, {
          itemName: req.name,
          quantity: -Math.abs(req.required), // Negativo porque se consume
          stockType: 'MP',
          batchInternal: batchId,
          unit: 'Kg/Lts'
        });
      }

      // 2. REGISTRAR EL INGRESO DEL PRODUCTO A GRANEL
      const productionData = {
        itemName: productName.trim().toUpperCase(),
        quantity: qty,
        stockType: 'GRANEL', 
        batchInternal: batchId,
        batchProvider: batchProvider.trim() || 'S/D',
        expiryDate: expiryDate.trim(),
        unit: 'Lts',
        company: companyName,
        status: 'PENDIENTE', 
        lastUpdate: serverTimestamp()
      };

      await registerMovement(currentUser, 'INGRESO_OP', companyName, productionData);

      Alert.alert(
        "Orden Emitida con Éxito", 
        `Lote Asignado: ${batchId}\n\nLas materias primas han sido descontadas y el producto figura en estado PENDIENTE de liberación por Laboratorio.`,
        [{ text: "Entendido", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error(error);
      Alert.alert("Error del Sistema", "No se pudo emitir la orden de producción.");
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
          <Text style={styles.headerTitle}>Orden de Producción</Text>
          <Text style={styles.headerSub}>{companyName}</Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoBanner}>
          <View style={styles.iconBox}>
            <Factory color="#3b82f6" size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Emisión de Nueva Tanda</Text>
            <Text style={styles.bannerText}>
              Esta acción verificará el stock, descontará las materias primas y generará un Lote para el producto terminado.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Producto a Formular</Text>
            <View style={styles.inputWrapper}>
              <FileText color="#94a3b8" size={20} style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="Ej: ACTION" 
                value={productName}
                onChangeText={(text) => { setProductName(text); setRequirements(null); }} // Resetea cálculo si cambia
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Volumen Objetivo (Litros / Kg)</Text>
            <View style={styles.inputWrapper}>
              <Beaker color="#94a3b8" size={20} style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="Ej: 1000" 
                keyboardType="numeric"
                value={targetQuantity}
                onChangeText={(text) => { setTargetQuantity(text); setRequirements(null); }}
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Lotes de Proveedor MP Usados</Text>
            <View style={styles.inputWrapper}>
              <FileText color="#94a3b8" size={20} style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="Ej: BCK-990, L-445" 
                value={batchProvider}
                onChangeText={setBatchProvider}
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Fecha Vencimiento del Granel *</Text>
            <View style={styles.inputWrapper}>
              <Beaker color="#94a3b8" size={20} style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="MM/AAAA" 
                value={expiryDate}
                onChangeText={setExpiryDate}
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          {/* BOTÓN PASO 1: Calcular */}
          {!requirements && (
            <TouchableOpacity 
              style={[styles.calcButton, isCalculating && { opacity: 0.7 }]} 
              onPress={handleCalculateNeeds}
              disabled={isCalculating}
            >
              {isCalculating ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Calculator color="#fff" size={20} />
                  <Text style={styles.mainButtonText}>Calcular Requerimientos</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* PASO 2: MOSTRAR RESULTADOS DEL CRUCE DE STOCK */}
        {requirements && (
          <View style={styles.requirementsCard}>
            <Text style={styles.reqTitle}>Proyección de Materias Primas</Text>
            
            {requirements.map((req, index) => (
              <View key={index} style={styles.reqRow}>
                <View style={{flex: 1}}>
                  <Text style={styles.reqName}>{req.name}</Text>
                  <Text style={styles.reqDetail}>
                    Requerido: {req.required.toFixed(2)} | En Stock: {req.stock.toFixed(2)}
                  </Text>
                </View>
                {req.isSufficient ? (
                  <CheckCircle2 color="#10b981" size={24} />
                ) : (
                  <View style={{alignItems: 'flex-end'}}>
                    <XCircle color="#ef4444" size={20} />
                    <Text style={styles.missingText}>Faltan {req.missing.toFixed(2)}</Text>
                  </View>
                )}
              </View>
            ))}

            <View style={styles.workflowAlert}>
              <AlertCircle color="#f59e0b" size={20} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.workflowTitle}>Siguiente Paso</Text>
                <Text style={styles.workflowText}>
                  Al confirmar, estas materias primas se descontarán automáticamente. El Laboratorio deberá liberar el Lote luego.
                </Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.mainButton, isSubmitting && { opacity: 0.7 }]} 
              onPress={handleStartProduction}
              disabled={isSubmitting}
            >
              {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Play color="#fff" size={20} fill="#fff" />
                  <Text style={styles.mainButtonText}>Confirmar y Emitir Orden</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
        
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
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2,
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  headerSub: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: '800', letterSpacing: 0.5 },
  
  container: { padding: 20 },
  
  infoBanner: { flexDirection: 'row', backgroundColor: '#eff6ff', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#bfdbfe' },
  iconBox: { backgroundColor: '#dbeafe', padding: 12, borderRadius: 12, marginRight: 15, height: 48, justifyContent: 'center' },
  bannerTitle: { fontSize: 15, fontWeight: '800', color: '#1e3a8a', marginBottom: 4 },
  bannerText: { fontSize: 12, color: '#1e40af', lineHeight: 18 },

  card: { 
    backgroundColor: '#fff', padding: 20, borderRadius: 16, elevation: 2, 
    borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20
  },
  
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 15 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, fontSize: 16, color: '#0f172a', fontWeight: '600' },

  calcButton: {
    backgroundColor: '#3b82f6', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', 
    padding: 16, borderRadius: 14, marginTop: 10, gap: 10, elevation: 3,
  },

  requirementsCard: {
    backgroundColor: '#fff', padding: 20, borderRadius: 16, elevation: 2, 
    borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20
  },
  reqTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a', marginBottom: 15 },
  reqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  reqName: { fontSize: 14, fontWeight: '800', color: '#334155' },
  reqDetail: { fontSize: 12, color: '#64748b', marginTop: 2 },
  missingText: { fontSize: 11, color: '#ef4444', fontWeight: '800', marginTop: 2 },

  workflowAlert: { flexDirection: 'row', backgroundColor: '#fffbeb', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#fde68a', marginTop: 20 },
  workflowTitle: { fontSize: 13, fontWeight: '800', color: '#92400e', marginBottom: 2 },
  workflowText: { fontSize: 12, color: '#b45309', lineHeight: 18 },

  mainButton: { 
    backgroundColor: '#10b981', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', 
    padding: 18, borderRadius: 14, marginTop: 20, gap: 10, elevation: 4,
  },
  mainButtonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }
});