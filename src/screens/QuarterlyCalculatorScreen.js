import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, 
  ActivityIndicator, ScrollView, TextInput, StatusBar 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ChevronLeft, Calculator, AlertCircle, CheckCircle2, ShoppingCart, Target, Beaker, Factory } from 'lucide-react-native';

export default function QuarterlyCalculatorScreen({ navigation }) {
  const [formulas, setFormulas] = useState([]);
  const [selectedFormula, setSelectedFormula] = useState(null);
  const [goal, setGoal] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const fetchFormulas = async () => {
      try {
        // ACTUALIZACIÓN: Ahora buscamos en Formulas_Maestras (Solo las Activas)
        const q = query(collection(db, "Formulas_Maestras"), where("status", "==", "ACTIVA"));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Orden alfabético
        data.sort((a, b) => a.productName.localeCompare(b.productName));
        setFormulas(data);
      } catch (error) {
        Alert.alert("Error de Conexión", "No se pudo sincronizar el catálogo de fórmulas.");
      } finally {
        setInitialLoading(false);
      }
    };
    fetchFormulas();
  }, []);

  const runCalculation = async () => {
    const targetVolume = Number(goal.replace(',', '.'));

    if (!selectedFormula || isNaN(targetVolume) || targetVolume <= 0) {
      Alert.alert("Datos Incompletos", "Por favor selecciona un producto técnico e ingresa un volumen válido.");
      return;
    }

    setLoading(true);
    try {
      const inventoryRef = collection(db, "Inventory");
      const calculation = [];

      // Utilizamos el peso/densidad si existe para mayor precisión
      const density = selectedFormula.densidadObjetivo || 1;
      const targetKilos = targetVolume * density;

      for (const ing of selectedFormula.ingredients) {
        const amountNeeded = (targetKilos * Number(ing.percentage)) / 100;

        // Buscamos cuánto stock tenemos de esta materia prima en general (sin importar en qué tanque esté)
        const q = query(inventoryRef, where("itemName", "==", ing.name), where("stockType", "==", "MP"));
        const stockSnap = await getDocs(q);
        
        let totalInStock = 0;
        stockSnap.forEach(doc => {
          // Aseguramos que la cantidad sea un número válido y mayor a cero (por si hay lotes en negativo por error)
          const qty = Number(doc.data().quantity);
          if (qty > 0) totalInStock += qty;
        });

        calculation.push({
          name: ing.name,
          needed: amountNeeded,
          stock: totalInStock,
          balance: totalInStock - amountNeeded
        });
      }
      setResults(calculation);
    } catch (error) {
      console.error(error);
      Alert.alert("Fallo de Cálculo", "Ocurrió un error al procesar el balance de inventario.");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0f172a" />
        <Text style={styles.loadingText}>Sincronizando recetas maestras...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER ENTERPRISE */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
          <Text style={styles.headerTitle}>Inteligencia Logística</Text>
          <Text style={styles.headerSub}>Calculadora de Reposición</Text>
        </View>
        <Target color="#0f172a" size={24} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* BANNER EXPLICATIVO */}
        <View style={styles.infoBanner}>
          <Text style={styles.bannerText}>
            Selecciona una fórmula maestra y proyecta un lote de producción. H2O Neural cruzará la receta con el stock físico disponible para detectar quiebres y generar órdenes de compra.
          </Text>
        </View>

        <Text style={styles.label}>1. Producto a Proyectar</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.formulaList}>
          {formulas.map(f => (
            <TouchableOpacity 
              key={f.id} 
              activeOpacity={0.7}
              style={[styles.formulaChip, selectedFormula?.id === f.id && styles.formulaChipActive]}
              onPress={() => setSelectedFormula(f)}
            >
              <View style={styles.chipIconBox}>
                <Beaker color={selectedFormula?.id === f.id ? "#fff" : "#64748b"} size={16} />
              </View>
              <Text style={[styles.formulaChipText, selectedFormula?.id === f.id && styles.formulaChipTextActive]}>
                {f.productName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>2. Volumen Deseado (Litros)</Text>
        <View style={styles.inputWrapper}>
          <Factory color="#94a3b8" size={20} style={{ marginRight: 10 }} />
          <TextInput 
            style={styles.input} 
            placeholder="Ej: 5000" 
            keyboardType="numeric"
            placeholderTextColor="#94a3b8"
            value={goal}
            onChangeText={setGoal}
          />
        </View>

        <TouchableOpacity 
          style={[styles.calcBtn, loading && { opacity: 0.7 }]} 
          onPress={runCalculation} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Calculator color="#fff" size={20} />
              <Text style={styles.calcBtnText}>Ejecutar Análisis de Stock</Text>
            </>
          )}
        </TouchableOpacity>

        {results.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Balance Operativo de Materias Primas</Text>
            {results.map((item, index) => (
              <View key={index} style={[styles.resultCard, item.balance < 0 ? styles.borderError : styles.borderSuccess]}>
                <View style={styles.resultHeader}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.balance < 0 ? <AlertCircle color="#ef4444" size={20} /> : <CheckCircle2 color="#10b981" size={20} />}
                </View>
                
                <View style={styles.dataRow}>
                  <View style={styles.dataCol}>
                    <Text style={styles.dataLabel}>Requerido</Text>
                    <Text style={styles.dataValue}>{item.needed.toFixed(1)} <Text style={styles.dataUnit}>L/K</Text></Text>
                  </View>
                  <View style={styles.dataColCenter}>
                    <Text style={styles.dataLabel}>Físico Real</Text>
                    <Text style={styles.dataValue}>{item.stock.toFixed(1)} <Text style={styles.dataUnit}>L/K</Text></Text>
                  </View>
                  <View style={styles.dataColRight}>
                    <Text style={styles.dataLabel}>Proyección</Text>
                    <Text style={[styles.dataValue, { color: item.balance < 0 ? '#ef4444' : '#10b981' }]}>
                      {item.balance > 0 ? '+' : ''}{item.balance.toFixed(1)}
                    </Text>
                  </View>
                </View>

                {item.balance < 0 && (
                  <View style={styles.buyWarning}>
                    <View style={styles.buyIconBox}>
                       <ShoppingCart color="#b91c1c" size={16} />
                    </View>
                    <Text style={styles.buyText}>REPOSICIÓN CRÍTICA: Faltan {Math.abs(item.balance).toFixed(1)} Kg/Lts</Text>
                  </View>
                )}
              </View>
            ))}
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
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2 
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  headerSub: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: '800', letterSpacing: 0.5 },
  
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 15, color: '#475569', fontWeight: '700', fontSize: 14 },
  
  container: { padding: 20 },
  infoBanner: { backgroundColor: '#eff6ff', padding: 15, borderRadius: 12, marginBottom: 25, borderWidth: 1, borderColor: '#bfdbfe' },
  bannerText: { color: '#1e3a8a', fontSize: 12, textAlign: 'center', lineHeight: 18, fontWeight: '500' },

  label: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 10, marginTop: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  formulaList: { flexDirection: 'row', marginBottom: 25 },
  formulaChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#fff', borderRadius: 14, marginRight: 12, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  formulaChipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a', elevation: 4 },
  chipIconBox: { marginRight: 8 },
  formulaChipText: { color: '#64748b', fontWeight: '800', fontSize: 13 },
  formulaChipTextActive: { color: '#fff' },
  
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, paddingHorizontal: 15, elevation: 1 },
  input: { flex: 1, paddingVertical: 18, fontSize: 22, color: '#0f172a', fontWeight: '900' },
  
  calcBtn: { backgroundColor: '#3b82f6', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 20, borderRadius: 16, marginTop: 30, gap: 12, elevation: 4, shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 8 },
  calcBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  
  resultsContainer: { marginTop: 40, paddingBottom: 50 },
  resultsTitle: { fontSize: 13, fontWeight: '800', color: '#64748b', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
  
  resultCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  borderError: { borderLeftWidth: 6, borderLeftColor: '#ef4444' },
  borderSuccess: { borderLeftWidth: 6, borderLeftColor: '#10b981' },
  
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  itemName: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  dataCol: { flex: 1 },
  dataColCenter: { flex: 1, alignItems: 'center', borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10 },
  dataColRight: { flex: 1, alignItems: 'flex-end' },
  dataLabel: { fontSize: 9, color: '#64748b', textTransform: 'uppercase', fontWeight: '800', letterSpacing: 0.5 },
  dataValue: { fontSize: 15, fontWeight: '900', marginTop: 4, color: '#1e293b' },
  dataUnit: { fontSize: 10, color: '#94a3b8', fontWeight: '700' },
  
  buyWarning: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 15, backgroundColor: '#fef2f2', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#fca5a5' },
  buyIconBox: { backgroundColor: '#fee2e2', padding: 6, borderRadius: 8 },
  buyText: { fontSize: 12, color: '#b91c1c', fontWeight: '800' }
});