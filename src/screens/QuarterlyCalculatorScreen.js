import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, 
  ActivityIndicator, ScrollView, TextInput, StatusBar, Modal, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase';
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { ChevronLeft, Calculator, AlertCircle, CheckCircle2, ShoppingCart, Target, Beaker, Factory, ChevronDown, X, ClipboardList, Download, Plus, Trash2, Printer } from 'lucide-react-native';

import { EQUIVALENCIES } from '../services/formulaService';
import { PRODUCTS_MADRE_LIST } from '../config/constants';
import AutocompleteInput from '../components/AutocompleteInput';

const normalizeString = (str) => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

export default function QuarterlyCalculatorScreen({ navigation }) {
  const [formulas, setFormulas] = useState([]);
  const [targets, setTargets] = useState([{ key: Date.now().toString(), selectedFormula: null, productName: '', goal: '' }]);
  const [results, setResults] = useState([]);
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
          setTargets([{ key: Date.now().toString(), selectedFormula: data[0], productName: data[0].productName, goal: '' }]);
        }
      } catch (error) {
        Alert.alert("Error de Conexión", "No se pudo sincronizar el catálogo de fórmulas.");
      } finally {
        setInitialLoading(false);
      }
    };
    fetchFormulas();
  }, []);

  const handleAddTarget = () => {
    setTargets([...targets, { key: Date.now().toString(), selectedFormula: null, productName: '', goal: '' }]);
  };

  const handleRemoveTarget = (keyToRemove) => {
    if (targets.length === 1) return;
    setTargets(targets.filter(t => t.key !== keyToRemove));
  };

  const updateTarget = (key, field, value) => {
    setTargets(targets.map(t => {
      if (t.key !== key) return t;
      const updated = { ...t, [field]: value };
      
      if (field === 'productName') {
        let found = formulas.find(f => f.productName === value);
        if (!found) {
          found = formulas.find(f => value.includes(f.productName) || f.productName.includes(value));
        }
        updated.selectedFormula = found || null;
      }
      return updated;
    }));
  };

  const runCalculation = async () => {
    const validTargets = targets.filter(t => {
      const vol = Number(t.goal.replace(',', '.'));
      return t.selectedFormula && !isNaN(vol) && vol > 0;
    });

    if (validTargets.length === 0) {
      Alert.alert("Datos Incompletos", "Por favor completa correctamente al menos un granel con un volumen mayor a cero.");
      return;
    }

    setLoading(true);
    try {
      const inventoryRef = collection(db, "Inventory");
      
      // CARGAMOS TODO EL STOCK MP
      const qAllMP = query(inventoryRef, where("stockType", "==", "MP"));
      const snapAllMP = await getDocs(qAllMP);
      const allMPStock = snapAllMP.docs.map(doc => doc.data());

      // Usaremos un mapa para acumular requerimientos por MP (agrupados por nombre normalizado base)
      const mpRequirements = {};

      validTargets.forEach(target => {
        const targetVolume = Number(target.goal.replace(',', '.'));
        const density = target.selectedFormula.densidadObjetivo || target.selectedFormula.densidad || 1;
        const targetKilos = targetVolume * density;

        target.selectedFormula.ingredients.forEach(ing => {
          if (ing.type === 'NOTE') return;
          
          const ingNameUpper = ing.name.trim().toUpperCase();
          const amountNeeded = (targetKilos * Number(ing.percentage)) / 100;
          
          // BÚSQUEDA INTELIGENTE
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

          // El primaryKey será el primer nombre normalizado, o podemos usar el ingNameUpper para mostrar.
          // Para agrupar bien, buscamos si ya existe una key en mpRequirements que comparta sinónimos
          let existingKey = Object.keys(mpRequirements).find(key => {
             return mpRequirements[key].searchNamesNorm.some(n => searchNamesNorm.includes(n));
          });

          if (existingKey) {
            mpRequirements[existingKey].needed += amountNeeded;
            mpRequirements[existingKey].usedIn.push({
              formulaName: target.selectedFormula.productName,
              amount: amountNeeded
            });
          } else {
            existingKey = ingNameUpper;
            mpRequirements[existingKey] = {
              name: ingNameUpper,
              searchNamesNorm: searchNamesNorm,
              needed: amountNeeded,
              usedIn: [{
                formulaName: target.selectedFormula.productName,
                amount: amountNeeded
              }],
              stock: 0, // se calcula después
              sharedWithOthers: [] // para otras fórmulas fuera del cálculo
            };
          }
        });
      });

      const calculation = [];
      
      // Ahora cruzamos con el stock real y buscamos sharedFormulas
      const formulaNamesInCalc = validTargets.map(t => t.selectedFormula.productName);

      Object.keys(mpRequirements).forEach(key => {
        const mp = mpRequirements[key];
        
        let totalInStock = 0;
        allMPStock.forEach(item => {
           const itemNameNorm = normalizeString(item.itemName);
           if (mp.searchNamesNorm.includes(itemNameNorm) && Number(item.quantity) > 0) {
             totalInStock += Number(item.quantity);
           }
        });
        mp.stock = totalInStock;
        mp.balance = totalInStock - mp.needed;

        // Buscar fórmulas compartidas que NO estén en esta proyección
        const sharedFormulas = [];
        formulas.forEach(otherF => {
          if (!formulaNamesInCalc.includes(otherF.productName) && otherF.ingredients) {
            const usesIng = otherF.ingredients.some(oi => {
              if (oi.type === 'NOTE') return false;
              let oiUpper = oi.name.trim().toUpperCase();
              let oiParts = [oiUpper];
              if (oiUpper.includes('/')) oiParts.push(...oiUpper.split('/').map(p => p.trim()));
              
              const oiEquivs = [];
              oiParts.forEach(p => {
                if (EQUIVALENCIES[p]) oiEquivs.push(...EQUIVALENCIES[p]);
              });
              const allOiNames = [...new Set([...oiParts, ...oiEquivs])];
              const oiNorms = allOiNames.map(n => normalizeString(n));
              
              return oiNorms.some(n => mp.searchNamesNorm.includes(n));
            });
            if (usesIng) {
              sharedFormulas.push(otherF.productName);
            }
          }
        });
        mp.sharedWithOthers = sharedFormulas;

        calculation.push(mp);
      });

      // Ordenar por balance negativo primero
      calculation.sort((a, b) => a.balance - b.balance);
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
                // Construir descripción de uso
                const usedInDesc = item.usedIn.map(u => u.formulaName).join(', ');
                
                await addDoc(collection(db, 'PurchaseRequests'), {
                  title: `COMPRAR: ${missingQty} L/Kg de ${item.name} (Faltante para proyección multi-granel)`,
                  description: `Requerido para: ${usedInDesc}`,
                  status: 'PENDING',
                  requestedBy: auth.currentUser?.email || 'Calculadora',
                  createdAt: serverTimestamp()
                });
              }
              Alert.alert("Éxito", "Las notas de pedido han sido creadas.");
            } catch (error) {
              Alert.alert("Error", "No se pudieron crear los pedidos.");
            }
          }
        }
      ]
    );
  };

  const handleDownloadSimulation = () => {
    if (Platform.OS !== 'web') {
      Alert.alert("Impresión", "La impresión de reportes A4 solo está disponible en la versión Web.");
      return;
    }

    const today = new Date().toLocaleString();
    let html = `
      <html>
        <head>
          <title>Simulacion_MultiGranel</title>
          <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.5; }
            .header { display: flex; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px; }
            .h2o-logo { width: 55px; height: 55px; border-radius: 12px; border: 3px solid #2563eb !important; background-color: white !important; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-right: 15px; box-shadow: 0 4px 6px rgba(37,99,235,0.2) !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
            .h2o-logo-title { font-size: 18px; font-weight: 900; color: #2563eb !important; line-height: 1; letter-spacing: 1px; }
            .h2o-logo-sub { font-size: 7px; font-weight: 700; color: #2563eb !important; letter-spacing: 2px; margin-top: 1px; }
            .header-text h1 { margin: 0; font-size: 20px; color: #0f172a; }
            .header-text p { margin: 0; font-size: 12px; color: #64748b; }
            h2 { font-size: 14px; color: #2563eb; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-top: 25px; text-transform: uppercase; letter-spacing: 1px;}
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { padding: 8px; border: 1px solid #e2e8f0; text-align: left; }
            th { background-color: #f8fafc; font-weight: bold; color: #475569; }
            .alert { color: #ef4444; font-weight: bold; }
            .success { color: #10b981; }
            .sub-text { font-size: 10px; color: #64748b; }
            .missing-box { border: 1px solid #fecaca; background-color: #fef2f2; padding: 10px; border-radius: 6px; margin-top: 15px; }
            .missing-box h3 { margin: 0 0 5px 0; color: #b91c1c; font-size: 13px; }
            .missing-box ul { margin: 0; padding-left: 20px; font-size: 12px; color: #991b1b; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="h2o-logo">
              <span class="h2o-logo-title">H₂O</span>
              <span class="h2o-logo-sub">CONTROL</span>
            </div>
            <div class="header-text">
              <h1>Proyección Consolidada de Producción</h1>
              <p>Generado: ${today}</p>
            </div>
          </div>
          
          <h2>1. Objetivos de Producción</h2>
          <table>
            <tr><th>Producto (Granel)</th><th style="width: 120px; text-align:right;">Volumen (Lts)</th></tr>
            ${targets.filter(t => t.selectedFormula && t.goal).map(t => `
              <tr><td>${t.selectedFormula.productName}</td><td style="text-align:right;"><b>${t.goal}</b></td></tr>
            `).join('')}
          </table>
    `;

    const missingItems = results.filter(i => i.balance < 0);
    if (missingItems.length > 0) {
      html += `
          <div class="missing-box">
            <h3>⚠️ Alerta de Quiebre de Stock (A Comprar)</h3>
            <ul>
              ${missingItems.map(i => `<li><b>${i.name}</b>: Faltan ${Math.abs(i.balance).toFixed(1)} L/Kg</li>`).join('')}
            </ul>
          </div>
      `;
    }

    html += `
          <h2>2. Balance de Materias Primas</h2>
          <table>
            <tr>
              <th>Materia Prima</th>
              <th style="width: 80px; text-align:right;">Requerido</th>
              <th style="width: 80px; text-align:right;">Físico</th>
              <th style="width: 80px; text-align:right;">Balance</th>
            </tr>
            ${results.map(i => `
              <tr>
                <td>
                  <b>${i.name}</b><br/>
                  <span class="sub-text">Uso: ${i.usedIn.map(u => `${u.formulaName} (${u.amount.toFixed(1)}L)`).join(', ')}</span>
                </td>
                <td style="text-align:right;">${i.needed.toFixed(1)}</td>
                <td style="text-align:right;">${i.stock.toFixed(1)}</td>
                <td style="text-align:right;" class="${i.balance < 0 ? 'alert' : 'success'}">${i.balance > 0 ? '+' : ''}${i.balance.toFixed(1)}</td>
              </tr>
            `).join('')}
          </table>
          
          <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8;">
            Documento generado automáticamente por H2O Neural Control
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } else {
      Alert.alert("Bloqueo de Pop-up", "Por favor permite las ventanas emergentes (pop-ups) para generar el PDF.");
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
          <Text style={styles.headerTitle}>Proyección Consolidada</Text>
          <Text style={styles.headerSub}>Logística Multi-Granel</Text>
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
            Añade múltiples graneles para proyectar una fabricación conjunta. El sistema sumará los requerimientos de MP compartidas y cruzará el total contra el stock físico.
          </Text>
        </View>

        <View style={styles.targetsHeader}>
          <Text style={styles.label}>Graneles a Proyectar</Text>
          <TouchableOpacity onPress={handleAddTarget} style={styles.addBtn}>
            <Plus color="#3b82f6" size={16} />
            <Text style={styles.addBtnText}>Agregar</Text>
          </TouchableOpacity>
        </View>
        
        {formulas.length === 0 ? (
          <View style={styles.emptyFormulasBox}>
            <AlertCircle color="#f59e0b" size={20} />
            <Text style={styles.emptyFormulasText}>
              No hay fórmulas activas. Dirígete a "Formulación".
            </Text>
          </View>
        ) : (
          targets.map((target, index) => (
            <View key={target.key} style={styles.targetCard}>
              <View style={{ zIndex: 3000 - index, position: 'relative' }}>
                <AutocompleteInput 
                  data={[...new Set([...formulas.map(f => f.productName), ...PRODUCTS_MADRE_LIST])].sort()}
                  value={target.productName}
                  onChangeText={(text) => updateTarget(target.key, 'productName', text)}
                  placeholder="Seleccionar producto..."
                  icon={<Beaker color="#94a3b8" size={18} />}
                />
              </View>
              
              <View style={styles.targetRowBottom}>
                <View style={styles.inputWrapper}>
                  <Factory color="#94a3b8" size={18} style={{ marginRight: 8 }} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="Volumen (Lts)" 
                    keyboardType="numeric"
                    placeholderTextColor="#94a3b8"
                    value={target.goal}
                    onChangeText={(text) => updateTarget(target.key, 'goal', text)}
                  />
                </View>
                {targets.length > 1 && (
                  <TouchableOpacity onPress={() => handleRemoveTarget(target.key)} style={styles.removeBtn}>
                    <Trash2 color="#ef4444" size={20} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}

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
              <Text style={styles.calcBtnText}>Consolidar Stock y Calcular</Text>
            </>
          )}
        </TouchableOpacity>

        {results.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Balance Operativo Consolidado</Text>
            
            {results.map((item, index) => (
              <View key={index} style={[styles.resultRow, item.balance < 0 ? styles.borderError : styles.borderSuccess]}>
                <View style={styles.resultHeader}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.balance < 0 ? <AlertCircle color="#ef4444" size={18} /> : <CheckCircle2 color="#10b981" size={18} />}
                </View>
                
                <View style={styles.compactDataRow}>
                  <Text style={styles.compactDataText}>Req: <Text style={{fontWeight:'800', color:'#0f172a'}}>{item.needed.toFixed(1)}</Text></Text>
                  <Text style={styles.compactDataText}>|</Text>
                  <Text style={styles.compactDataText}>Stock: <Text style={{fontWeight:'800', color:'#0f172a'}}>{item.stock.toFixed(1)}</Text></Text>
                  <Text style={styles.compactDataText}>|</Text>
                  <Text style={styles.compactDataText}>Bal: <Text style={{fontWeight:'900', color: item.balance < 0 ? '#ef4444' : '#10b981'}}>{item.balance > 0 ? '+' : ''}{item.balance.toFixed(1)}</Text></Text>
                </View>

                {item.usedIn.length > 0 && (
                  <View style={styles.usedInBox}>
                    <Text style={styles.usedInText}>
                      Uso en proyecciones: {item.usedIn.map(u => `${u.formulaName} (${u.amount.toFixed(1)}L)`).join(', ')}
                    </Text>
                  </View>
                )}

                {item.sharedWithOthers && item.sharedWithOthers.length > 0 && (
                  <View style={styles.warningBox}>
                    <AlertCircle color="#ea580c" size={14} />
                    <Text style={styles.warningText}>
                      Ojo, también es requerida por fórmulas no proyectadas aquí: <Text style={{ fontWeight: 'bold' }}>{item.sharedWithOthers.join(', ')}</Text>
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
                <Printer color="#fff" size={20} />
                <Text style={styles.actionBtnText}>Imprimir / PDF</Text>
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
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  headerSub: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: '800', letterSpacing: 0.5 },
  
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 15, color: '#475569', fontWeight: '700', fontSize: 14 },
  
  container: { padding: 15 },
  infoBanner: { backgroundColor: '#eff6ff', padding: 12, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#bfdbfe' },
  bannerText: { color: '#1e3a8a', fontSize: 11, textAlign: 'center', lineHeight: 16, fontWeight: '500' },

  targetsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 5 },
  label: { fontSize: 12, fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
  
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe' },
  addBtnText: { color: '#3b82f6', fontSize: 12, fontWeight: '800', marginLeft: 4 },

  targetCard: { backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  targetRowBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, zIndex: 1 },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#0f172a', fontWeight: '800' },
  
  removeBtn: { marginLeft: 10, padding: 10, backgroundColor: '#fef2f2', borderRadius: 10, borderWidth: 1, borderColor: '#fecaca' },

  emptyFormulasBox: { flexDirection: 'row', backgroundColor: '#fffbeb', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#fde68a', alignItems: 'center', marginBottom: 25 },
  emptyFormulasText: { flex: 1, marginLeft: 10, fontSize: 12, color: '#b45309', fontWeight: '600', lineHeight: 18 },

  calcBtn: { backgroundColor: '#0f172a', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 12, marginTop: 15, gap: 10, elevation: 2 },
  calcBtnText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  
  resultsContainer: { marginTop: 30, paddingBottom: 20 },
  resultsTitle: { fontSize: 13, fontWeight: '900', color: '#475569', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
  
  resultRow: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 12, elevation: 1, borderWidth: 1, borderColor: '#e2e8f0' },
  borderError: { borderLeftWidth: 5, borderLeftColor: '#ef4444' },
  borderSuccess: { borderLeftWidth: 5, borderLeftColor: '#10b981' },
  
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemName: { fontSize: 14, fontWeight: '900', color: '#0f172a' },
  
  compactDataRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  compactDataText: { fontSize: 12, color: '#64748b', fontWeight: '600' },

  usedInBox: { backgroundColor: '#f1f5f9', padding: 8, borderRadius: 6, marginBottom: 6 },
  usedInText: { fontSize: 10, color: '#475569', fontWeight: '500' },

  warningBox: { backgroundColor: '#fff7ed', padding: 8, borderRadius: 6, flexDirection: 'row', alignItems: 'center' },
  warningText: { fontSize: 10, color: '#c2410c', marginLeft: 6, flex: 1, lineHeight: 14 },

  actionButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 20 },
  actionBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 14, borderRadius: 10, elevation: 2 },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }
});