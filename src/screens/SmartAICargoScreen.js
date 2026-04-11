import React, { useState, useEffect } from 'react';
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
import * as ImagePicker from 'expo-image-picker'; 
import { db, auth, storage } from '../config/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { registerMovement } from '../services/logisticsService';
// Importamos el nuevo cerebro de IA (Asegurate de exportarlo así en aiService.js)
import { analyzeSystemIntelligence, analyzeLogisticsImage } from '../services/aiService'; 
import { 
  ChevronLeft, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  Trash2, 
  BrainCircuit, 
  Camera, 
  ClipboardList,
  PlusCircle,    // Nuevo icono para Ingreso
  MinusCircle    // Nuevo icono para Retiro
} from 'lucide-react-native';

// LISTA DE EMPRESAS ACTUALIZADA
const COMPANIES = ['Agrocube', 'BioAcker', 'Alianza', 'H2O Control', 'WaterDay', 'AgroFontezuela'];

export default function SmartAICargoScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [processedData, setProcessedData] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [cameraPermission, setCameraPermission] = useState(null);
  
  // NUEVO: Estado para controlar si suma (INGRESO) o resta (RETIRO_CASUAL)
  const [opMode, setOpMode] = useState('INGRESO'); 

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      setCameraPermission(status === 'granted');
    })();
  }, []);

  const handleAIProcess = async () => {
    if (!rawText.trim()) {
      Alert.alert("Atención", "Pega o escribe el detalle antes de continuar.");
      return;
    }

    setLoading(true);
    try {
      // Llamamos al nuevo cerebro
      const result = await analyzeSystemIntelligence(rawText);
      setProcessedData(result);
      
      // Auto-seleccionar empresa si la IA la detecta
      if (result.company && COMPANIES.includes(result.company)) {
        setSelectedCompany(result.company);
      }
      
      // Auto-seleccionar el modo (Ingreso o Retiro) según lo que entendió la IA
      if (result.operationType) {
        setOpMode(result.operationType);
      }
      
    } catch (error) {
      Alert.alert("Error de IA", "No se pudo interpretar el texto. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  const handleImagePick = async () => {
    if (!cameraPermission) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permisos", "Se requiere acceso a la cámara.");
        return;
      }
      setCameraPermission(true);
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0].base64) {
        setLoading(true);
        const fileName = `remitos/REMITO_${Date.now()}.jpg`;
        const storageRef = ref(storage, fileName);
        await uploadString(storageRef, result.assets[0].base64, 'base64');
        const downloadURL = await getDownloadURL(storageRef);

        // OCR de imagen
        const data = await analyzeLogisticsImage(result.assets[0].base64);
        setProcessedData({ ...(data || {}), evidenceUrl: downloadURL });

        if (data.company && COMPANIES.includes(data.company)) {
          setSelectedCompany(data.company);
        }
        if (data.operationType) {
          setOpMode(data.operationType);
        }
      }
    } catch (error) {
      Alert.alert("Error", "La IA no pudo procesar la imagen del remito.");
    } finally {
      setLoading(false);
    }
  };

  const confirmAndUpload = async () => {
    if (!processedData || !processedData.items) return;
    if (!selectedCompany) {
      Alert.alert("Atención", "Debes seleccionar una empresa de destino/origen.");
      return;
    }

    try {
      setLoading(true);
      
      // Trazabilidad Fuerte: H2O - Fecha - ID
      const fechaIngreso = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const batchInternal = `H2O-${fechaIngreso}-${Date.now().toString().slice(-4)}`;

      const firstItemForQR = processedData.items[0] ? {
        itemName: processedData.items[0].name?.toUpperCase(),
        batchInternal: batchInternal,
        loteProveedor: processedData.items[0].lote || 'N/A',
        expiryDate: processedData.items[0].vencimiento || 'N/A'
      } : null;

      for (const item of processedData.items) {
        let qtyNormalized = parseFloat(String(item.qty || 0).replace(',', '.'));
        
        // LÓGICA DE AUDITORÍA: Si es Retiro Casual, lo transformamos en negativo
        if (opMode === 'RETIRO_CASUAL') {
          qtyNormalized = -Math.abs(qtyNormalized);
        } else {
          qtyNormalized = Math.abs(qtyNormalized);
        }

        await registerMovement(auth.currentUser.email, opMode, selectedCompany, {
          itemName: item.name?.toUpperCase() || 'DESCONOCIDO',
          quantity: qtyNormalized,
          stockType: item.type || (item.isInternalMP ? 'MP' : 'PT'), 
          batchInternal: batchInternal,
          loteProveedor: item.lote || 'N/A',
          vencimiento: item.vencimiento || 'N/A',
          unit: item.unit || 'uds',
          evidenceUrl: processedData.evidenceUrl || null
        });
      }

      const mensajeExito = opMode === 'INGRESO' 
        ? `Stock inyectado en ${selectedCompany}. ¿Imprimir etiquetas?` 
        : `Retiro casual descontado de ${selectedCompany}.`;

      Alert.alert(
        "Éxito", 
        mensajeExito,
        [
          { text: "Cerrar", onPress: () => navigation.goBack() },
          { 
            text: opMode === 'INGRESO' ? "IMPRIMIR QR" : "VER STOCK", 
            onPress: () => {
              if(opMode === 'INGRESO') {
                navigation.navigate('QRGenerator', { 
                  itemData: firstItemForQR,
                  companyName: selectedCompany 
                });
              } else {
                navigation.navigate('StockView', { companyName: selectedCompany });
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
            <Text style={styles.headerSub}>H2O control Intelligent</Text>
        </View>
        <BrainCircuit color="#fff" size={24} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        
        {/* NUEVO: SELECTOR DE MODO DE OPERACIÓN */}
        <View style={styles.modeToggleContainer}>
          <TouchableOpacity 
            style={[styles.toggleBtn, opMode === 'INGRESO' && styles.toggleBtnActiveIngreso]} 
            onPress={() => setOpMode('INGRESO')}
          >
            <PlusCircle color={opMode === 'INGRESO' ? '#fff' : '#2e4a3b'} size={18} />
            <Text style={[styles.toggleText, opMode === 'INGRESO' && {color: '#fff'}]}>Ingreso / Compra</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.toggleBtn, opMode === 'RETIRO_CASUAL' && styles.toggleBtnActiveRetiro]} 
            onPress={() => setOpMode('RETIRO_CASUAL')}
          >
            <MinusCircle color={opMode === 'RETIRO_CASUAL' ? '#fff' : '#d32f2f'} size={18} />
            <Text style={[styles.toggleText, opMode === 'RETIRO_CASUAL' && {color: '#fff'}]}>Retiro Casual</Text>
          </TouchableOpacity>
        </View>

        {/* SELECTOR MANUAL DE EMPRESA */}
        <Text style={styles.sectionLabel}>Empresa (Origen/Destino):</Text>
        <View style={styles.companySelector}>
          {COMPANIES.map((comp) => (
            <TouchableOpacity 
              key={comp} 
              style={[styles.companyChip, selectedCompany === comp && styles.companyChipActive]}
              onPress={() => setSelectedCompany(comp)}
            >
              <Text style={[styles.companyChipText, selectedCompany === comp && styles.companyChipTextActive]}>
                {comp}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.modeSelector, isLandscape && { justifyContent: 'space-around' }]}>
          <TouchableOpacity style={styles.modeBtn} onPress={handleImagePick} disabled={loading}>
            <Camera color="#2e4a3b" size={32} />
            <Text style={styles.modeBtnText}>Cámara Remito</Text>
          </TouchableOpacity>
          <View style={styles.modeDivider} />
          <TouchableOpacity style={styles.modeBtn} onPress={() => {setRawText(''); setProcessedData(null); setSelectedCompany(null);}} disabled={loading}>
            <ClipboardList color="#2e4a3b" size={32} /> 
            <Text style={styles.modeBtnText}>Limpiar Todo</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[styles.textArea, isLandscape && { height: 80 }]}
          multiline
          placeholder="Ej: Ingresaron 2 bines de Action... o Se llevaron 5L de muestra de Combate..."
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
              <Text style={styles.btnText}>Auditar con IA</Text>
            </>
          )}
        </TouchableOpacity>

        {processedData && !loading && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Auditoría IA</Text>
              <View style={[styles.companyBadge, opMode === 'RETIRO_CASUAL' && { backgroundColor: '#ffebee', borderColor: '#ffcdd2' }]}>
                <Text style={[styles.companyBadgeText, opMode === 'RETIRO_CASUAL' && { color: '#c62828' }]}>
                  {selectedCompany || 'Pendiente'}
                </Text>
              </View>
            </View>

            {/* AVISOS PREDICTIVOS DEL CEREBRO */}
            {processedData.operationalAdvice && (
              <View style={styles.adviceBox}>
                <Sparkles color="#d84315" size={16} />
                <Text style={styles.adviceText}>{processedData.operationalAdvice}</Text>
              </View>
            )}

            {processedData?.evidenceUrl && (
              <Text style={styles.evidenceLink}>📷 Evidencia fotográfica vinculada</Text>
            )}

            {processedData?.items?.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <CheckCircle2 color={opMode === 'INGRESO' ? "#2e7d32" : "#d32f2f"} size={18} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item?.name || 'Item sin nombre'}</Text>
                    <Text style={styles.itemMeta}>Lote: {item?.lote || 'N/A'} • Vence: {item?.vencimiento || 'N/A'}</Text>
                </View>
                <Text style={[styles.itemQty, opMode === 'RETIRO_CASUAL' && {color: '#d32f2f'}]}>
                  {opMode === 'RETIRO_CASUAL' ? '-' : '+'}{item?.qty} {item?.unit || 'uds'}
                </Text>
              </View>
            ))}

            <TouchableOpacity 
              style={[styles.confirmBtn, opMode === 'RETIRO_CASUAL' && { backgroundColor: '#d32f2f' }]} 
              onPress={confirmAndUpload}
            >
              <Send color="#fff" size={20} />
              <Text style={styles.confirmBtnText}>
                {opMode === 'INGRESO' ? `Confirmar Ingreso a ${selectedCompany || '...'}` : `Confirmar Retiro de ${selectedCompany || '...'}`}
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
  
  // NUEVOS ESTILOS DEL MODO (INGRESO / RETIRO)
  modeToggleContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', elevation: 2 },
  toggleBtnActiveIngreso: { backgroundColor: '#2e4a3b', borderColor: '#2e4a3b' },
  toggleBtnActiveRetiro: { backgroundColor: '#d32f2f', borderColor: '#d32f2f' },
  toggleText: { marginLeft: 8, fontSize: 13, fontWeight: '800', color: '#555' },

  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#666', marginBottom: 10, marginLeft: 5 },
  companySelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  companyChip: { 
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, 
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' 
  },
  companyChipActive: { backgroundColor: '#2e4a3b', borderColor: '#2e4a3b' },
  companyChipText: { fontSize: 11, fontWeight: '700', color: '#666' },
  companyChipTextActive: { color: '#fff' },
  modeSelector: { 
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 20, padding: 20, 
    marginBottom: 20, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, 
    shadowRadius: 10, alignItems: 'center'
  },
  modeBtn: { flex: 1, alignItems: 'center', gap: 6 },
  modeBtnText: { fontSize: 13, fontWeight: '800', color: '#2e4a3b' },
  modeDivider: { width: 1, height: '70%', backgroundColor: '#eee' },
  textArea: { 
    backgroundColor: '#fff', padding: 18, borderRadius: 18, height: 140, 
    textAlignVertical: 'top', fontSize: 16, borderWidth: 1, borderColor: '#e0e0e0', color: '#333'
  },
  processBtn: { 
    backgroundColor: '#2e4a3b', flexDirection: 'row', justifyContent: 'center', 
    alignItems: 'center', padding: 18, borderRadius: 18, marginTop: 15, gap: 12, elevation: 5 
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  resultCard: { 
    backgroundColor: '#fff', padding: 22, borderRadius: 20, marginTop: 25, 
    elevation: 8, borderTopWidth: 6, borderTopColor: '#2e7d32' 
  },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  resultTitle: { fontSize: 18, fontWeight: '800', color: '#222' },
  companyBadge: { backgroundColor: '#e8f5e9', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#c8e6c9' },
  companyBadgeText: { color: '#2e7d32', fontSize: 12, fontWeight: '900' },
  
  // AVISO PREDICTIVO
  adviceBox: { backgroundColor: '#fff3e0', padding: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 15, borderWidth: 1, borderColor: '#ffe0b2' },
  adviceText: { flex: 1, fontSize: 12, color: '#d84315', fontWeight: '600', fontStyle: 'italic' },

  evidenceLink: { fontSize: 12, color: '#2e7d32', fontWeight: '700', marginBottom: 15, fontStyle: 'italic' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  itemName: { flex: 1, fontSize: 15, color: '#333', fontWeight: '800' },
  itemMeta: { fontSize: 12, color: '#777', marginTop: 3 },
  itemQty: { fontWeight: '900', color: '#2e4a3b', fontSize: 18 },
  confirmBtn: { 
    backgroundColor: '#2e7d32', flexDirection: 'row', justifyContent: 'center', 
    alignItems: 'center', padding: 18, borderRadius: 15, marginTop: 15, gap: 10 
  },
  confirmBtnText: { color: '#fff', fontWeight: '900', fontSize: 17 },
  cancelBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 18, gap: 6 },
  cancelBtnText: { color: '#777', fontSize: 14, fontWeight: '700' }
});