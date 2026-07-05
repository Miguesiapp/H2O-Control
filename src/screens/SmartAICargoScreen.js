import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  SafeAreaView, 
  ActivityIndicator,
  useWindowDimensions 
} from 'react-native';
import { auth } from '../config/firebase';
import { registerMovement } from '../services/logisticsService';
import { analyzeSystemIntelligence } from '../services/aiService'; 
import { 
  ChevronLeft, 
  Sparkles, 
  Send, 
  Trash2, 
  BrainCircuit, 
  ClipboardList,
  Database,
  Beaker,
  Package
} from 'lucide-react-native';

export default function SmartAICargoScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [processedData, setProcessedData] = useState(null);
  const [targetStock, setTargetStock] = useState('MP'); // 'MP' | 'GRANEL' | 'FINAL'
  
  // Siempre será ingreso a STOCK CENTRAL MP o H2O, y la IA puede detectar si es Retiro o Ingreso
  const [opMode, setOpMode] = useState('INGRESO_COMPRA'); 

  const handleAIProcess = async () => {
    if (!rawText.trim()) {
      Alert.alert("Atención", "Pega o escribe el detalle antes de continuar.");
      return;
    }
    setLoading(true);
    try {
      const result = await analyzeSystemIntelligence(rawText);
      setProcessedData(result);
      if (result.operationType) setOpMode(result.operationType);
    } catch (error) {
      Alert.alert("Error de IA", "No se pudo interpretar el texto. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  // FUNCIONES PARA EDITAR DATOS (VALIDACIÓN HUMANA)
  const handleEditItem = (index, field, value) => {
    const newData = { ...processedData };
    newData.items[index][field] = value;
    setProcessedData(newData);
  };

  const confirmAndUpload = async () => {
    if (!processedData || !processedData.items) return;

    try {
      setLoading(true);
      const currentUser = auth.currentUser?.email || 'Usuario Desconocido';
      const fechaStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const batchInternal = `H2O-${fechaStr}-${Date.now().toString().slice(-4)}`;

      const firstItemForQR = processedData.items[0] ? {
        itemName: processedData.items[0].name?.toUpperCase(),
        batchInternal: batchInternal,
        loteProveedor: processedData.items[0].lote || 'N/A',
        expiryDate: processedData.items[0].vencimiento || 'N/A'
      } : null;

      const companyDest = targetStock === 'MP' ? 'STOCK_CENTRAL_MP' : 'H2O';
      const actionName = opMode.includes('INGRESO') ? `INGRESO_MASIVO_IA` : opMode;

      for (const item of processedData.items) {
        let qtyNormalized = parseFloat(String(item.qty || 0).replace(',', '.'));
        if (opMode === 'RETIRO_CASUAL') {
          qtyNormalized = -Math.abs(qtyNormalized);
        } else {
          qtyNormalized = Math.abs(qtyNormalized);
        }

        await registerMovement(currentUser, actionName, companyDest, {
          itemName: item.name?.toUpperCase() || 'DESCONOCIDO',
          quantity: qtyNormalized,
          stockType: targetStock, 
          batchInternal: batchInternal,
          loteProveedor: item.lote || 'N/A',
          vencimiento: item.vencimiento || 'N/A',
          unit: item.unit || (targetStock === 'FINAL' ? 'Uds' : 'Kg/Lts'),
          evidenceUrl: processedData.evidenceUrl || null
        });
      }

      Alert.alert(
        "Operación Exitosa", 
        `El movimiento quedó registrado bajo el usuario: ${currentUser}`,
        [
          { text: "Cerrar", onPress: () => navigation.goBack() },
          { 
            text: opMode.includes('INGRESO') ? "IMPRIMIR QR" : "VER STOCK", 
            onPress: () => {
              if(opMode.includes('INGRESO')) {
                navigation.navigate('QRGenerator', { 
                  itemData: firstItemForQR,
                  companyName: companyDest 
                });
              } else {
                navigation.navigate('StockView', { companyName: companyDest });
              }
            } 
          }
        ]
      );
    } catch (error) {
      Alert.alert("Error", "No se pudo actualizar el inventario.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#fff" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
            <Text style={styles.headerTitle}>Ingreso Inteligente</Text>
            <Text style={styles.headerSub}>Auditoría con IA (Solo MP)</Text>
        </View>
        <BrainCircuit color="#fff" size={24} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        
        <View style={styles.stockSelectorContainer}>
          <TouchableOpacity 
            style={[styles.stockToggleBtn, targetStock === 'MP' && styles.stockToggleBtnActive]}
            onPress={() => setTargetStock('MP')}
          >
            <Database color={targetStock === 'MP' ? '#fff' : '#64748b'} size={18} style={{marginRight: 6}} />
            <Text style={[styles.stockToggleText, targetStock === 'MP' && styles.stockToggleTextActive]}>M. PRIMA</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.stockToggleBtn, targetStock === 'GRANEL' && styles.stockToggleBtnActive]}
            onPress={() => setTargetStock('GRANEL')}
          >
            <Beaker color={targetStock === 'GRANEL' ? '#fff' : '#64748b'} size={18} style={{marginRight: 6}} />
            <Text style={[styles.stockToggleText, targetStock === 'GRANEL' && styles.stockToggleTextActive]}>GRANEL</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.stockToggleBtn, targetStock === 'FINAL' && styles.stockToggleBtnActive]}
            onPress={() => setTargetStock('FINAL')}
          >
            <Package color={targetStock === 'FINAL' ? '#fff' : '#64748b'} size={18} style={{marginRight: 6}} />
            <Text style={[styles.stockToggleText, targetStock === 'FINAL' && styles.stockToggleTextActive]}>PT</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.modeSelector, isLandscape && { justifyContent: 'space-around' }]}>
          <TouchableOpacity style={styles.modeBtn} onPress={() => {setRawText(''); setProcessedData(null); }} disabled={loading}>
            <ClipboardList color="#2e4a3b" size={32} /> 
            <Text style={styles.modeBtnText}>Limpiar Texto</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[styles.textArea, isLandscape && { height: 80 }]}
          multiline
          placeholder="Ej: Ingresaron 200kg de ácido sulfúrico lote 445 vencimiento 12/2026..."
          placeholderTextColor="#999"
          value={rawText}
          onChangeText={setRawText}
          editable={!loading}
        />

        <TouchableOpacity 
          style={[styles.processBtn, (loading || !rawText.trim()) && { opacity: 0.5 }]} 
          onPress={handleAIProcess}
          disabled={loading || !rawText.trim()}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Sparkles color="#fff" size={20} />
              <Text style={styles.btnText}>Cargar Datos con IA</Text>
            </>
          )}
        </TouchableOpacity>

        {/* TARJETA DE RESULTADOS EDITABLES */}
        {processedData && !loading && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Validación Humana</Text>
              <Text style={styles.validationSubtitle}>Puedes corregir si la IA falló</Text>
            </View>

            {processedData.operationalAdvice && (
              <View style={styles.adviceBox}>
                <Sparkles color="#d84315" size={16} />
                <Text style={styles.adviceText}>{processedData.operationalAdvice}</Text>
              </View>
            )}

            {processedData?.items?.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <View style={{ flex: 1, gap: 5 }}>
                    <TextInput 
                      style={styles.inputName} 
                      value={item?.name} 
                      onChangeText={(text) => handleEditItem(index, 'name', text)}
                      placeholder="Nombre del Item"
                    />
                    <View style={styles.rowMeta}>
                      <TextInput 
                        style={styles.inputMeta} 
                        value={item?.lote} 
                        onChangeText={(text) => handleEditItem(index, 'lote', text)}
                        placeholder="Lote"
                      />
                      <TextInput 
                        style={styles.inputMeta} 
                        value={item?.vencimiento} 
                        onChangeText={(text) => handleEditItem(index, 'vencimiento', text)}
                        placeholder="Vencimiento"
                      />
                    </View>
                </View>

                {/* EDITAR CANTIDAD */}
                <View style={styles.qtyContainer}>
                  <Text style={{color: opMode === 'RETIRO_CASUAL' ? '#d32f2f' : '#2e7d32', fontWeight: 'bold'}}>
                    {opMode === 'RETIRO_CASUAL' ? '-' : '+'}
                  </Text>
                  <TextInput 
                    style={[styles.inputQty, opMode === 'RETIRO_CASUAL' && {color: '#d32f2f'}]} 
                    value={String(item?.qty || '')} 
                    onChangeText={(text) => handleEditItem(index, 'qty', text)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <Text style={styles.unitText}>{item?.unit || 'Kg/Lts'}</Text>
                </View>
              </View>
            ))}

            <TouchableOpacity 
              style={[
                styles.confirmBtn, 
                opMode === 'RETIRO_CASUAL' && { backgroundColor: '#d32f2f' }
              ]} 
              onPress={confirmAndUpload}
            >
              <Send color="#fff" size={20} />
              <Text style={styles.confirmBtnText}>
                Confirmar y Registrar en {targetStock === 'MP' ? 'Stock MP' : targetStock === 'GRANEL' ? 'Granel' : 'PT'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setProcessedData(null)}>
              <Trash2 color="#999" size={18} />
              <Text style={styles.cancelBtnText}>Descartar análisis</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7f5' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, paddingVertical: 18, backgroundColor: '#2e4a3b', 
    borderBottomLeftRadius: 25, borderBottomRightRadius: 25 
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1.5 },
  backBtn: { padding: 5 },
  container: { padding: 20 },
  
  modeSelector: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 15, elevation: 2, alignItems: 'center' },
  modeBtn: { flex: 1, alignItems: 'center', gap: 6 },
  modeBtnText: { fontSize: 13, fontWeight: '800', color: '#2e4a3b' },
  
  stockSelectorContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4, marginBottom: 15 },
  stockToggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10 },
  stockToggleBtnActive: { backgroundColor: '#0f172a', elevation: 2 },
  stockToggleText: { fontSize: 12, fontWeight: '800', color: '#64748b' },
  stockToggleTextActive: { color: '#fff' },

  textArea: { backgroundColor: '#fff', padding: 18, borderRadius: 18, height: 100, textAlignVertical: 'top', fontSize: 15, borderWidth: 1, borderColor: '#e0e0e0', color: '#333' },
  processBtn: { backgroundColor: '#2e4a3b', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 18, marginTop: 15, gap: 12, elevation: 3 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  
  resultCard: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginTop: 25, elevation: 4, borderWidth: 1, borderColor: '#eee' },
  resultHeader: { marginBottom: 15 },
  resultTitle: { fontSize: 18, fontWeight: '900', color: '#222' },
  validationSubtitle: { fontSize: 12, color: '#777', marginTop: 2 },
  
  adviceBox: { backgroundColor: '#fff3e0', padding: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 15, borderWidth: 1, borderColor: '#ffe0b2' },
  adviceText: { flex: 1, fontSize: 12, color: '#d84315', fontWeight: '600', fontStyle: 'italic' },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  
  // ESTILOS DE LOS INPUTS EDITABLES
  inputName: { fontSize: 15, color: '#222', fontWeight: '800', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingVertical: 2 },
  rowMeta: { flexDirection: 'row', gap: 10 },
  inputMeta: { flex: 1, fontSize: 12, color: '#555', borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 2 },
  
  qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#eee' },
  inputQty: { fontSize: 18, fontWeight: '900', color: '#2e7d32', minWidth: 40, textAlign: 'center', paddingVertical: 8 },
  unitText: { fontSize: 12, color: '#777', fontWeight: 'bold', marginLeft: 2 },

  confirmBtn: { backgroundColor: '#2e7d32', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 15, marginTop: 10, gap: 10 },
  confirmBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  cancelBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, gap: 6 },
  cancelBtnText: { color: '#777', fontSize: 14, fontWeight: '700' }
});