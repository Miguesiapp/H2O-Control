import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Alert, ActivityIndicator, StatusBar 
} from 'react-native';
// IMPORTANTE: Cambio a la librería recomendada para evitar warnings
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ChevronLeft, Calculator, AlertCircle, CheckCircle2, ShoppingCart, Target } from 'lucide-react-native';

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
        const snap = await getDocs(collection(db, "Formulas"));
        setFormulas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        Alert.alert("Error", "No se pudo conectar con el laboratorio.");
      } finally {
        setInitialLoading(false);
      }
    };
    fetchFormulas();
  }, []);

  const runCalculation = async () => {
    if (!selectedFormula || !goal) {
      Alert.alert("Atención", "Selecciona una fórmula y define el volumen de producción deseado.");
      return;
    }

    setLoading(true);
    try {
      const inventoryRef = collection(db, "Inventory");
      const calculation = [];

      for (const ing of selectedFormula.ingredients) {
        const amountNeeded = (Number(goal) * Number(ing.percentage)) / 100;

        const q = query(inventoryRef, where("itemName", "==", ing.name), where("stockType", "==", "MP"));
        const stockSnap = await getDocs(q);
        
        let totalInStock = 0;
        stockSnap.forEach(doc => totalInStock += Number(doc.data().quantity));

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
      Alert.alert("Error", "Error al procesar el balance de inventario.");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2e4a3b" />
        <Text style={styles.loadingText}>Cargando base de datos...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#2e4a3b" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
            <Text style={styles.headerTitle}>H2O Intelligence</Text>
            <Text style={styles.headerSub}>Calculador de Abastecimiento</Text>
        </View>
        <Target color="#2e4a3b" size={24} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>1. Seleccionar Producto a Fabricar</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.formulaList}>
          {formulas.map(f => (
            <TouchableOpacity 
              key={f.id} 
              style={[styles.formulaChip, selectedFormula?.id === f.id && styles.formulaChipActive]}
              onPress={() => setSelectedFormula(f)}
            >
              <Text style={[styles.formulaChipText, selectedFormula?.id === f.id && styles.formulaChipTextActive]}>
                {f.productName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>2. Volumen de Producción (Lts)</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Ej: 5000" 
          keyboardType="numeric"
          placeholderTextColor="#aaa"
          value={goal}
          onChangeText={setGoal}
        />

        <TouchableOpacity style={styles.calcBtn} onPress={runCalculation} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Calculator color="#fff" size={20} />
              <Text style={styles.calcBtnText}>Analizar Necesidad de Compra</Text>
            </>
          )}
        </TouchableOpacity>

        {results.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Balance de Materias Primas</Text>
            {results.map((item, index) => (
              <View key={index} style={[styles.resultCard, item.balance < 0 ? styles.borderError : styles.borderSuccess]}>
                <View style={styles.resultHeader}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.balance < 0 ? <AlertCircle color="#d32f2f" size={20} /> : <CheckCircle2 color="#2e7d32" size={20} />}
                </View>
                
                <View style={styles.dataRow}>
                  <View>
                    <Text style={styles.dataLabel}>Requerido</Text>
                    <Text style={styles.dataValue}>{item.needed.toFixed(1)} L/K</Text>
                  </View>
                  <View>
                    <Text style={styles.dataLabel}>En Depósito</Text>
                    <Text style={styles.dataValue}>{item.stock.toFixed(1)} L/K</Text>
                  </View>
                  <View>
                    <Text style={styles.dataLabel}>Diferencia</Text>
                    <Text style={[styles.dataValue, { color: item.balance < 0 ? '#d32f2f' : '#2e7d32' }]}>
                      {item.balance.toFixed(1)}
                    </Text>
                  </View>
                </View>

                {item.balance < 0 && (
                  <View style={styles.buyWarning}>
                    <ShoppingCart color="#d32f2f" size={14} />
                    <Text style={styles.buyText}>REPOSICIÓN: Faltan {Math.abs(item.balance).toFixed(1)} unidades</Text>
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
  safe: { flex: 1, backgroundColor: '#f0f2f0' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#e0e0e0',
    elevation: 4
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#2e4a3b' },
  headerSub: { fontSize: 10, color: '#888', textTransform: 'uppercase' },
  container: { padding: 20 },
  label: { fontSize: 12, fontWeight: '800', color: '#2e4a3b', marginBottom: 12, marginTop: 10, textTransform: 'uppercase', letterSpacing: 1 },
  formulaList: { flexDirection: 'row', marginBottom: 20 },
  formulaChip: { paddingHorizontal: 18, paddingVertical: 12, backgroundColor: '#fff', borderRadius: 25, marginRight: 12, borderWidth: 1, borderColor: '#ddd', elevation: 2 },
  formulaChipActive: { backgroundColor: '#2e4a3b', borderColor: '#2e4a3b', elevation: 5 },
  formulaChipText: { color: '#666', fontWeight: '800', fontSize: 13 },
  formulaChipTextActive: { color: '#fff' },
  input: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 18, 
    borderWidth: 1, 
    borderColor: '#ddd', 
    fontSize: 24, 
    fontWeight: '900',
    color: '#333',
    elevation: 2
  },
  calcBtn: { 
    backgroundColor: '#2e4a3b', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20, 
    borderRadius: 18, 
    marginTop: 25, 
    gap: 12,
    elevation: 6
  },
  calcBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  resultsContainer: { marginTop: 30, paddingBottom: 50 },
  resultsTitle: { fontSize: 14, fontWeight: '900', color: '#888', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1.5 },
  resultCard: { 
    backgroundColor: '#fff', 
    padding: 18, 
    borderRadius: 20, 
    marginBottom: 15, 
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)'
  },
  borderError: { borderLeftWidth: 6, borderLeftColor: '#d32f2f' },
  borderSuccess: { borderLeftWidth: 6, borderLeftColor: '#2e7d32' },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  itemName: { fontSize: 15, fontWeight: '900', color: '#1A2E24' },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F9FBF9', padding: 12, borderRadius: 12 },
  dataLabel: { fontSize: 8, color: '#888', textTransform: 'uppercase', fontWeight: '900', letterSpacing: 0.5 },
  dataValue: { fontSize: 14, fontWeight: '800', marginTop: 4, color: '#333' },
  buyWarning: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginTop: 15, 
    backgroundColor: '#FFF5F5', 
    padding: 12, 
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFCDD2'
  },
  buyText: { fontSize: 11, color: '#d32f2f', fontWeight: '900' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FBF9' },
  loadingText: { marginTop: 15, color: '#2e4a3b', fontWeight: '900', letterSpacing: 1 }
});