import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, 
  ActivityIndicator, ScrollView, TextInput, StatusBar, Modal, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase';
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { ChevronLeft, Calculator, AlertCircle, CheckCircle2, ShoppingCart, Target, Beaker, Factory, ChevronDown, X, ClipboardList, Download } from 'lucide-react-native';

import { EQUIVALENCIES } from '../services/formulaService';
import { PRODUCTS_MADRE_LIST } from '../config/constants';
import AutocompleteInput from '../components/AutocompleteInput';
const normalizeString = (str) => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

export default function QuarterlyCalculatorScreen({ navigation }) {
  const [formulas, setFormulas] = useState([]);
  const [selectedFormula, setSelectedFormula] = useState(null);
  const [productName, setProductName] = useState('');
  const [goal, setGoal] = useState('');
  const [results, setResults] = useState([]);
  const [granelStock, setGranelStock] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const fetchFormulas = async () => {
      try {
        const q = query(collection(db, "Formulas_Maestras"), where("status", "==", "ACTIVA"));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => a.productName.localeCompare(b.productName));
        setFormulas(data);
        if (data.length > 0) {
          setSelectedFormula(data[0]);
          setProductName(data[0].productName);
        }
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
    setGranelStock(null);
    try {
      const inventoryRef = collection(db, "Inventory");
      const calculation = [];

      // AVERIGUAR STOCK ACTUAL DEL GRANEL
      const qGranel = query(
        inventoryRef,
        where("itemName", "==", selectedFormula.productName.toUpperCase()),
        where("stockType", "==", "GRANEL")
      );
      const granelSnap = await getDocs(qGranel);
      let currentGranelStock = 0;
      granelSnap.forEach(doc => {
        if (doc.data().quantity > 0) currentGranelStock += Number(doc.data().quantity);
      });
      setGranelStock(currentGranelStock);

      const density = selectedFormula.densidadObjetivo || selectedFormula.densidad || 1;
      const targetKilos = targetVolume * density;

      // 1. CARGAMOS TODO EL STOCK MP Y GRANEL (para evitar problemas de mayúsculas/tildes de Firebase)
      const qAllMP = query(inventoryRef, where("stockType", "==", "MP"));
      const snapAllMP = await getDocs(qAllMP);
      const allMPStock = snapAllMP.docs.map(doc => doc.data());

      const qAllGranel = query(inventoryRef, where("stockType", "==", "GRANEL"));
      const snapAllGranel = await getDocs(qAllGranel);
      const allGranelStock = snapAllGranel.docs.map(doc => doc.data());

      const allActiveStock = [...allMPStock, ...allGranelStock];

      for (const ing of selectedFormula.ingredients) {
        if (ing.type === 'NOTE') continue;
        const ingNameUpper = ing.name.trim().toUpperCase();
        const ingNameNorm = normalizeString(ing.name);
        
        const amountNeeded = (targetKilos * Number(ing.percentage)) / 100;

        // BÚSQUEDA INTELIGENTE CON SINÓNIMOS
        let searchNamesUpper = [ingNameUpper];
        if (ingNameUpper.includes('/')) {
           searchNamesUpper.push(...ingNameUpper.split('/').map(p => p.trim()));
        }
        
        const allEquivalencies = [];
        searchNamesUpper.forEach(p => {
           if (EQUIVALENCIES[p]) {
              allEquivalencies.push(...EQUIVALENCIES[p]);
           }
        });
        
        searchNamesUpper = [...new Set([...searchNamesUpper, ...allEquivalencies])];
        const searchNamesNorm = searchNamesUpper.map(n => normalizeString(n));

        // Buscar en la memoria
        let totalInStock = 0;
        allActiveStock.forEach(item => {
           const itemNameNorm = normalizeString(item.itemName);
           if (searchNamesNorm.includes(itemNameNorm) && Number(item.quantity) > 0) {
             totalInStock += Number(item.quantity);
           }
        });

        // Buscar fórmulas compartidas
        const sharedFormulas = [];
        formulas.forEach(otherF => {
          if (otherF.id !== selectedFormula.id && otherF.ingredients) {
            const usesIng = otherF.ingredients.some(oi => {
              if (oi.type === 'NOTE') return false;
              let oiUpper = oi.name.trim().toUpperCase();
              let oiParts = [oiUpper];
              if (oiUpper.includes('/')) {
                oiParts.push(...oiUpper.split('/').map(p => p.trim()));
              }
              const oiEquivs = [];
              oiParts.forEach(p => {
                if (EQUIVALENCIES[p]) oiEquivs.push(...EQUIVALENCIES[p]);
              });
              const allOiNames = [...new Set([...oiParts, ...oiEquivs])];
              const oiNorms = allOiNames.map(n => normalizeString(n));
              return oiNorms.some(n => searchNamesNorm.includes(n));
            });
            if (usesIng) {
              sharedFormulas.push(otherF.productName);
            }
          }
        });

        calculation.push({
          name: ingNameUpper,
          needed: amountNeeded,
          stock: totalInStock,
          balance: totalInStock - amountNeeded,
          sharedWith: sharedFormulas
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

  const handleGenerateRequests = () => {
    const missingItems = results.filter(item => item.balance < 0);
    const targetVolume = Number(goal.replace(',', '.'));
    if (missingItems.length === 0) return;

    Alert.alert(
      "Generar Notas de Pedido",
      `¿Deseas enviar ${missingItems.length} faltante(s) al sector de Pedidos?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, Enviar",
          onPress: async () => {
            try {
              for (const item of missingItems) {
                const missingQty = Math.abs(item.balance).toFixed(1);
                await addDoc(collection(db, 'PurchaseRequests'), {
                  title: `COMPRAR: ${missingQty} L/Kg de ${item.name} (Faltante para ${targetVolume}L de ${selectedFormula.productName})`,
                  status: 'PENDING',
                  requestedBy: auth.currentUser?.email || 'Calculadora',
                  createdAt: serverTimestamp()
                });
              }
              Alert.alert("Éxito", "Las notas de pedido han sido creadas. Puedes verlas en la sección de Pedidos.");
            } catch (error) {
              Alert.alert("Error", "No se pudieron crear los pedidos.");
            }
          }
        }
      ]
    );
  };

  const handleDownloadSimulation = () => {
    let text = `SIMULACIÓN DE PRODUCCIÓN\n========================\n`;
    text += `Producto: ${selectedFormula?.productName}\n`;
    text += `Volumen Objetivo: ${goal} Lts\n`;
    text += `Fecha: ${new Date().toLocaleString()}\n\n`;

    const missingItems = results.filter(i => i.balance < 0);
    if (missingItems.length > 0) {
      text += `--- MATERIAS PRIMAS FALTANTES (A COMPRAR) ---\n`;
      missingItems.forEach(i => {
        text += `- ${i.name}: Falta ${Math.abs(i.balance).toFixed(1)} L/Kg\n`;
      });
      text += `\n`;
    }

    text += `--- DESGLOSE COMPLETO DE REQUERIMIENTOS ---\n`;
    results.forEach(i => {
      text += `- ${i.name}: Requiere ${i.needed.toFixed(1)} L/Kg | Físico Real: ${i.stock.toFixed(1)} L/Kg | Proyección: ${i.balance > 0 ? '+' : ''}${i.balance.toFixed(1)}\n`;
    });

    if (Platform.OS === 'web') {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Simulacion_${selectedFormula?.productName?.replace(/ /g, '_')}_${goal}L.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      Alert.alert("Simulación Generada", "La descarga directa solo está disponible en la versión Web (PWA).");
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
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))} style={styles.backBtn}>
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
          <Text style={styles.headerTitle}>Inteligencia Logística</Text>
          <Text style={styles.headerSub}>Proyección de Fabricación</Text>
        </View>
        <Target color="#0f172a" size={24} />
      </View>

      <ScrollView maximumZoomScale={1} 
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoBanner}>
          <Text style={styles.bannerText}>
            Selecciona una fórmula maestra y proyecta un lote de producción. H2O Neural cruzará la receta (y sus sinónimos) con el stock físico global para detectar quiebres.
          </Text>
        </View>

        <Text style={styles.label}>1. Producto a Proyectar</Text>
        
        {formulas.length === 0 ? (
          <View style={styles.emptyFormulasBox}>
            <AlertCircle color="#f59e0b" size={20} />
            <Text style={styles.emptyFormulasText}>
              No hay fórmulas activas. Dirígete a "Formulación" y carga tu primera Receta Maestra.
            </Text>
          </View>
        ) : (
          <View style={{ zIndex: 2000, position: 'relative' }}>
            <AutocompleteInput 
              data={[...new Set([...formulas.map(f => f.productName), ...PRODUCTS_MADRE_LIST])].sort()}
              value={productName}
              onChangeText={(text) => {
                 setProductName(text);
                 // Buscar coincidencia exacta primero
                 let found = formulas.find(f => f.productName === text);
                 
                 // Si no hay coincidencia exacta (ej: tocó algo con " / "), buscar por contención
                 if (!found) {
                   found = formulas.find(f => text.includes(f.productName) || f.productName.includes(text));
                 }
                 
                 setSelectedFormula(found || null);
              }}
              placeholder="Seleccionar o escribir producto..."
              icon={<Beaker color="#94a3b8" size={18} />}
            />
          </View>
        )}

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
          style={[styles.calcBtn, (loading || formulas.length === 0) && { opacity: 0.7 }]} 
          onPress={runCalculation} 
          disabled={loading || formulas.length === 0}
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
            {granelStock !== null && (
              <View style={styles.granelStockBox}>
                <Text style={styles.granelStockLabel}>Stock Actual del Producto (Granel):</Text>
                <Text style={styles.granelStockValue}>{granelStock.toFixed(1)} Lts</Text>
              </View>
            )}
            
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

                {item.sharedWith && item.sharedWith.length > 0 && (
                  <View style={{ backgroundColor: '#fff7ed', padding: 10, borderRadius: 8, marginTop: item.balance < 0 ? 5 : 10, flexDirection: 'row', alignItems: 'center' }}>
                    <AlertCircle color="#ea580c" size={16} />
                    <Text style={{ fontSize: 11, color: '#c2410c', marginLeft: 6, flex: 1 }}>
                      Esta MP también se utiliza para: <Text style={{ fontWeight: 'bold' }}>{item.sharedWith.join(', ')}</Text>
                    </Text>
                  </View>
                )}
              </View>
            ))}

            <View style={styles.actionButtonsRow}>
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#3b82f6' }]}
                onPress={handleDownloadSimulation}
              >
                <Download color="#fff" size={20} />
                <Text style={styles.actionBtnText}>Descargar Cálculo</Text>
              </TouchableOpacity>

              {results.some(item => item.balance < 0) && (
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: '#0f172a' }]}
                  onPress={handleGenerateRequests}
                >
                  <ClipboardList color="#fff" size={20} />
                  <Text style={styles.actionBtnText}>Pedir Faltantes</Text>
                </TouchableOpacity>
              )}
            </View>
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

  granelStockBox: {
    backgroundColor: '#f5f3ff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  granelStockLabel: { color: '#4c1d95', fontWeight: '700', fontSize: 13 },
  granelStockValue: { color: '#6d28d9', fontWeight: '900', fontSize: 18 },

  label: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 10, marginTop: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  emptyFormulasBox: { flexDirection: 'row', backgroundColor: '#fffbeb', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#fde68a', alignItems: 'center', marginBottom: 25 },
  emptyFormulasText: { flex: 1, marginLeft: 10, fontSize: 12, color: '#b45309', fontWeight: '600', lineHeight: 18 },

  formulaList: { flexDirection: 'row', marginBottom: 25 },
  formulaChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#fff', borderRadius: 14, marginRight: 12, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  formulaChipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a', elevation: 4 },
  chipIconBox: { marginRight: 8 },
  formulaChipText: { color: '#64748b', fontWeight: '800', fontSize: 13 },
  formulaChipTextActive: { color: '#fff' },
  
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, paddingHorizontal: 15, zIndex: 1 },
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
  buyText: { fontSize: 12, color: '#b91c1c', fontWeight: '800' },

  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 25
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#0f172a',
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 }
});