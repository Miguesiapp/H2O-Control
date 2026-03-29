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
  Platform 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker'; 
import { db, auth, storage } from '../config/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { registerMovement } from '../services/logisticsService';
import { analyzeLogisticsText, analyzeLogisticsImage } from '../services/aiService'; 
import { 
  ChevronLeft, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  Trash2, 
  BrainCircuit, 
  Camera, 
  ClipboardText 
} from 'lucide-react-native';

export default function SmartAICargoScreen({ navigation }) {
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [processedData, setProcessedData] = useState(null);
  const [cameraPermission, setCameraPermission] = useState(null);

  // --- SOLICITUD DE PERMISOS AL INICIAR ---
  useEffect(() => {
    (async () => {
      try {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        setCameraPermission(status === 'granted');
      } catch (e) {
        console.log("Error al pedir permisos:", e);
      }
    })();
  }, []);

  // --- PROCESAR TEXTO ---
  const handleAIProcess = async () => {
    if (!rawText.trim()) {
      Alert.alert("Atención", "Pega el detalle antes de continuar.");
      return;
    }

    setLoading(true);
    try {
      const result = await analyzeLogisticsText(rawText);
      setProcessedData(result);
    } catch (error) {
      Alert.alert("Error de IA", "No se pudo interpretar el texto.");
    } finally {
      setLoading(false);
    }
  };

  // --- FOTO + STORAGE + IA ---
  const handleImagePick = async () => {
    if (!cameraPermission) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      setCameraPermission(status === 'granted');
      if (status !== 'granted') {
        Alert.alert("Permisos", "Se requiere acceso a la cámara.");
        return;
      }
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.4, // Bajamos un poco la calidad para que la PWA no pese tanto al subir
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0].base64) {
        setLoading(true);
        // 1. Guardar respaldo en Storage
        const fileName = `remitos/REMITO_${Date.now()}.jpg`;
        const storageRef = ref(storage, fileName);
        await uploadString(storageRef, result.assets[0].base64, 'base64');
        const downloadURL = await getDownloadURL(storageRef);

        // 2. Analizar con Gemini
        const data = await analyzeLogisticsImage(result.assets[0].base64);
        
        // 3. Vincular URL (Usamos spread para no perder datos si data viene incompleto)
        setProcessedData({ ...(data || {}), evidenceUrl: downloadURL });
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "La IA no pudo procesar la imagen.");
    } finally {
      setLoading(false);
    }
  };

  // --- INYECCIÓN FINAL ---
  const confirmAndUpload = async () => {
    if (!processedData || !processedData.items) return;

    try {
      setLoading(true);
      const batchInternal = "IA-" + new Date().getTime().toString().slice(-6);

      // Datos para el QR (Primer item)
      const firstItemForQR = processedData.items[0] ? {
        itemName: processedData.items[0].name?.toUpperCase(),
        batchInternal: batchInternal,
        expiryDate: processedData.items[0].vencimiento || 'N/A'
      } : null;

      for (const item of processedData.items) {
        const qtyNormalized = parseFloat(String(item.qty || 0).replace(',', '.'));

        await registerMovement(auth.currentUser.email, 'INGRESO_IA_INTELIGENTE', processedData.company || 'General', {
          itemName: item.name?.toUpperCase() || 'DESCONOCIDO',
          quantity: qtyNormalized,
          stockType: item.type || 'MP', 
          batchInternal: batchInternal,
          loteProveedor: item.lote || 'N/A',
          vencimiento: item.vencimiento || 'N/A',
          unit: item.unit || 'uds',
          evidenceUrl: processedData.evidenceUrl || null
        });
      }

      Alert.alert(
        "Proceso Exitoso", 
        "¿Deseas imprimir las etiquetas QR ahora?",
        [
          { text: "Ahora no", onPress: () => navigation.goBack() },
          { 
            text: "IMPRIMIR QR", 
            onPress: () => navigation.navigate('QRGenerator', { 
              itemData: firstItemForQR,
              companyName: processedData.company 
            }) 
          }
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Error al inyectar datos en Firestore.");
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
            <Text style={styles.headerTitle}>Carga Inteligente</Text>
            <Text style={styles.headerSub}>H2O Control Neural</Text>
        </View>
        <BrainCircuit color="#fff" size={24} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        
        <View style={styles.modeSelector}>
          <TouchableOpacity style={styles.modeBtn} onPress={handleImagePick} disabled={loading}>
            <Camera color="#2e4a3b" size={30} />
            <Text style={styles.modeBtnText}>Foto Remito</Text>
          </TouchableOpacity>
          <View style={styles.modeDivider} />
          <TouchableOpacity style={styles.modeBtn} onPress={() => {setRawText(''); setProcessedData(null);}} disabled={loading}>
            <ClipboardText color="#2e4a3b" size={30} />
            <Text style={styles.modeBtnText}>Limpiar</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.textArea}
          multiline
          placeholder="Pega aquí el detalle del remito o WhatsApp..."
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
              <Text style={styles.btnText}>Analizar con IA Gemini</Text>
            </>
          )}
        </TouchableOpacity>

        {processedData && !loading && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Detección de IA</Text>
              <View style={styles.companyBadge}>
                <Text style={styles.companyBadgeText}>{processedData?.company || 'Gral'}</Text>
              </View>
            </View>

            {processedData?.evidenceUrl && (
              <Text style={styles.evidenceLink}>📷 Foto de respaldo vinculada</Text>
            )}

            {processedData?.items?.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <CheckCircle2 color="#2e7d32" size={18} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item?.name || 'Item sin nombre'}</Text>
                    <Text style={styles.itemMeta}>Lote: {item?.lote || 'S/D'} • Vence: {item?.vencimiento || 'S/D'}</Text>
                </View>
                <Text style={styles.itemQty}>{item?.qty} {item?.unit || 'uds'}</Text>
              </View>
            ))}

            <TouchableOpacity style={styles.confirmBtn} onPress={confirmAndUpload}>
              <Send color="#fff" size={20} />
              <Text style={styles.confirmBtnText}>Confirmar e Inyectar Stock</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setProcessedData(null)}>
              <Trash2 color="#d32f2f" size={18} />
              <Text style={styles.cancelBtnText}>Descartar análisis</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 50 }} />
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
    backgroundColor: '#2e4a3b', 
    borderBottomLeftRadius: 20, 
    borderBottomRightRadius: 20 
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerSub: { fontSize: 10, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1 },
  backBtn: { padding: 5 },
  container: { padding: 20 },
  modeSelector: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    borderRadius: 15, 
    padding: 15, 
    marginBottom: 20,
    elevation: 2,
    alignItems: 'center'
  },
  modeBtn: { flex: 1, alignItems: 'center', gap: 5 },
  modeBtnText: { fontSize: 12, fontWeight: 'bold', color: '#2e4a3b' },
  modeDivider: { width: 1, height: '80%', backgroundColor: '#eee' },
  textArea: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 15, 
    height: 120, 
    textAlignVertical: 'top', 
    fontSize: 16, 
    borderWidth: 1, 
    borderColor: '#ddd',
    color: '#333'
  },
  processBtn: { 
    backgroundColor: '#2e4a3b', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 18, 
    borderRadius: 15, 
    marginTop: 15, 
    gap: 10, 
    elevation: 3 
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  resultCard: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 15, 
    marginTop: 25, 
    elevation: 5, 
    borderTopWidth: 5, 
    borderTopColor: '#2e7d32' 
  },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  resultTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  companyBadge: { backgroundColor: '#f1f8f4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#c8e6c9' },
  companyBadgeText: { color: '#2e7d32', fontSize: 11, fontWeight: 'bold' },
  evidenceLink: { fontSize: 11, color: '#2e7d32', fontWeight: 'bold', marginBottom: 15, fontStyle: 'italic' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  itemName: { flex: 1, fontSize: 14, color: '#333', fontWeight: 'bold' },
  itemMeta: { fontSize: 11, color: '#666', marginTop: 2 },
  itemQty: { fontWeight: 'bold', color: '#2e4a3b', fontSize: 16 },
  confirmBtn: { 
    backgroundColor: '#2e7d32', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 16, 
    borderRadius: 12, 
    marginTop: 15, 
    gap: 10 
  },
  confirmBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 15, gap: 5 },
  cancelBtnText: { color: '#d32f2f', fontSize: 13, fontWeight: '600' }
});