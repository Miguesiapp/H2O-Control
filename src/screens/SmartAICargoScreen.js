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
import { analyzeSystemIntelligence, analyzeLogisticsImage } from '../services/aiService'; 
import { 
  ChevronLeft, 
  Sparkles, 
  Send, 
  Trash2, 
  BrainCircuit, 
  Camera, 
  ClipboardList,
  PlusCircle, 
  MinusCircle,
  Factory,     // Icono para OP
  PackageSearch // Icono para OE
} from 'lucide-react-native';

const COMPANIES = ['Agrocube', 'BioAcker', 'Alianza', 'H2O Control', 'WaterDay', 'AgroFontezuela'];

export default function SmartAICargoScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [processedData, setProcessedData] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [cameraPermission, setCameraPermission] = useState(null);
  
  // MODOS ACTUALIZADOS: Incluye OP y OE
  const [opMode, setOpMode] = useState('INGRESO_COMPRA'); 

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
      const result = await analyzeSystemIntelligence(rawText);
      setProcessedData(result);
      if (result.company && COMPANIES.includes(result.company)) setSelectedCompany(result.company);
      if (result.operationType) setOpMode(result.operationType);
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
        const fileName = `documentos_ia/DOC_${Date.now()}.jpg`;
        const storageRef = ref(storage, fileName);
        await uploadString(storageRef, result.assets[0].base64, 'base64');
        const downloadURL = await getDownloadURL(storageRef);

        const data = await analyzeLogisticsImage(result.assets[0].base64);
        setProcessedData({ ...(data || {}), evidenceUrl: downloadURL });

        if (data.company && COMPANIES.includes(data.company)) setSelectedCompany(data.company);
        if (data.operationType) setOpMode(data.operationType);
      }
    } catch (error) {
      Alert.alert("Error", "La IA no pudo procesar la imagen.");
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
    if (!selectedCompany) {
      Alert.alert("Atención", "Debes seleccionar una empresa de destino/origen.");
      return;
    }

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

      for (const item of processedData.items) {
        let qtyNormalized = parseFloat(String(item.qty || 0).replace(',', '.'));
        if (opMode === 'RETIRO_CASUAL') {
          qtyNormalized = -Math.abs(qtyNormalized);
        } else {
          qtyNormalized = Math.abs(qtyNormalized);
        }

        await registerMovement(currentUser, opMode, selectedCompany, {
          itemName: item.name?.toUpperCase() || 'DESCONOCIDO',
          quantity: qtyNormalized,
          stockType: item.type || 'PT', 
          batchInternal: batchInternal,
          loteProveedor: item.lote || 'N/A',
          vencimiento: item.vencimiento || 'N/A',
          unit: item.unit || 'uds',
          evidenceUrl: processedData.evidenceUrl || null
        });
      }

      // ------------------------------------------------------------------
      // AQUÍ DISPARAMOS LA NOTIFICACIÓN PARA TODOS LOS USUARIOS (15-20)
      // ------------------------------------------------------------------
      if (opMode === 'INGRESO_OP') {
         // Lógica futura: sendPushNotification("Nueva OP Terminada", `${currentUser} ha ingresado stock de OP.`);
         // Lógica futura: Si requiere BBS, cambiar estado a 'CUARENTENA' y notificar a BBS.
      } else if (opMode === 'INGRESO_OE') {
         // Lógica futura: sendPushNotification("Envasado Completado", `OE registrada por ${currentUser}`);
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
            <Text style={styles.headerSub}>Auditoría con IA</Text>
        </View>
        <BrainCircuit color="#fff" size={24} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        
        {/* SELECTOR AMPLIADO: COMPRA, OP, OE, RETIRO */}
        <Text style={styles.sectionLabel}>Contexto de la Operación:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeToggleContainer}>
          <TouchableOpacity 
            style={[styles.toggleBtn, opMode === 'INGRESO_COMPRA' && styles.toggleBtnActiveIngreso]} 
            onPress={() => setOpMode('INGRESO_COMPRA')}
          >
            <PlusCircle color={opMode === 'INGRESO_COMPRA' ? '#fff' : '#2e4a3b'} size={16} />
            <Text style={[styles.toggleText, opMode === 'INGRESO_COMPRA' && {color: '#fff'}]}>Compra / Remito</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.toggleBtn, opMode === 'INGRESO_OP' && styles.toggleBtnActiveOP]} 
            onPress={() => setOpMode('INGRESO_OP')}
          >
            <Factory color={opMode === 'INGRESO_OP' ? '#fff' : '#0284c7'} size={16} />
            <Text style={[styles.toggleText, opMode === 'INGRESO_OP' && {color: '#fff'}]}>Cierre de OP</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.toggleBtn, opMode === 'INGRESO_OE' && styles.toggleBtnActiveOE]} 
            onPress={() => setOpMode('INGRESO_OE')}
          >
            <PackageSearch color={opMode === 'INGRESO_OE' ? '#fff' : '#d97706'} size={16} />
            <Text style={[styles.toggleText, opMode === 'INGRESO_OE' && {color: '#fff'}]}>Cierre de OE</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.toggleBtn, opMode === 'RETIRO_CASUAL' && styles.toggleBtnActiveRetiro]} 
            onPress={() => setOpMode('RETIRO_CASUAL')}
          >
            <MinusCircle color={opMode === 'RETIRO_CASUAL' ? '#fff' : '#d32f2f'} size={16} />
            <Text style={[styles.toggleText, opMode === 'RETIRO_CASUAL' && {color: '#fff'}]}>Retiro Casual</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* SELECTOR DE EMPRESA */}
        <Text style={styles.sectionLabel}>Empresa Propietaria:</Text>
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
            <Text style={styles.modeBtnText}>Cámara Documento</Text>
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
          placeholder="Ej: Ingresaron 2 bines de Action... o Se cerró la OP de 500L de Combate..."
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
              <Text style={styles.btnText}>Auditar Documento con IA</Text>
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
                  <Text style={styles.unitText}>{item?.unit || 'uds'}</Text>
                </View>
              </View>
            ))}

            <TouchableOpacity 
              style={[
                styles.confirmBtn, 
                opMode === 'RETIRO_CASUAL' && { backgroundColor: '#d32f2f' },
                opMode === 'INGRESO_OP' && { backgroundColor: '#0284c7' },
                opMode === 'INGRESO_OE' && { backgroundColor: '#d97706' },
              ]} 
              onPress={confirmAndUpload}
            >
              <Send color="#fff" size={20} />
              <Text style={styles.confirmBtnText}>
                Confirmar y Registrar
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
  
  sectionLabel: { fontSize: 13, fontWeight: '800', color: '#555', marginBottom: 10, marginLeft: 5, textTransform: 'uppercase' },
  
  modeToggleContainer: { flexDirection: 'row', gap: 10, marginBottom: 25, paddingRight: 20 },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', elevation: 1 },
  toggleBtnActiveIngreso: { backgroundColor: '#2e4a3b', borderColor: '#2e4a3b' },
  toggleBtnActiveOP: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  toggleBtnActiveOE: { backgroundColor: '#d97706', borderColor: '#d97706' },
  toggleBtnActiveRetiro: { backgroundColor: '#d32f2f', borderColor: '#d32f2f' },
  toggleText: { marginLeft: 8, fontSize: 13, fontWeight: '800', color: '#555' },

  companySelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 25 },
  companyChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' },
  companyChipActive: { backgroundColor: '#2e4a3b', borderColor: '#2e4a3b' },
  companyChipText: { fontSize: 12, fontWeight: '700', color: '#666' },
  companyChipTextActive: { color: '#fff' },
  
  modeSelector: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, elevation: 2, alignItems: 'center' },
  modeBtn: { flex: 1, alignItems: 'center', gap: 6 },
  modeBtnText: { fontSize: 13, fontWeight: '800', color: '#2e4a3b' },
  modeDivider: { width: 1, height: '70%', backgroundColor: '#eee' },
  
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