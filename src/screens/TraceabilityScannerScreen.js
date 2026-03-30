import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  ScrollView, 
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // Importación correcta
import { CameraView, useCameraPermissions } from 'expo-camera';
import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { 
  ChevronLeft, 
  Search, 
  Beaker, 
  Calendar, 
  User, 
  ShieldCheck, 
  AlertTriangle,
  Camera
} from 'lucide-react-native';

export default function TraceabilityScannerScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [itemData, setItemData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!permission || !permission.granted) {
      requestPermission();
    }
  }, []);

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || loading) return; 
    
    setScanned(true);
    setLoading(true);
    
    try {
      const q = query(collection(db, "Inventory"), where("batchInternal", "==", data));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setItemData(querySnapshot.docs[0].data());
      } else {
        Alert.alert(
          "No Encontrado", 
          `El lote "${data}" no existe en el sistema.`,
          [{ text: "Reintentar", onPress: () => setScanned(false) }]
        );
      }
    } catch (error) {
      Alert.alert("Error", "Problema de conexión con la base de datos.");
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  if (!permission) return <View style={styles.center}><ActivityIndicator size="large" color="#2e4a3b" /></View>;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Camera color="#ccc" size={60} style={{ marginBottom: 20 }} />
        <Text style={styles.permissionText}>Acceso denegado a la cámara.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Habilitar Cámara</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft color="#2e4a3b" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Auditoría de Lote QR</Text>
        <View style={{ width: 28 }} />
      </View>

      {!itemData ? (
        <View style={styles.scannerWrapper}>
          {/* LA CÁMARA VA SOLA */}
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />
          
          {/* EL VISOR VA AFUERA, FLOTANDO ENCIMA */}
          <View style={styles.overlay}>
            <View style={styles.unfocusedContainer} />
            <View style={styles.focusedRow}>
              <View style={styles.unfocusedContainer} />
              <View style={styles.focusedContainer}>
                <View style={styles.cornerTopLeft} />
                <View style={styles.cornerTopRight} />
                <View style={styles.cornerBottomLeft} />
                <View style={styles.cornerBottomRight} />
                {loading && <ActivityIndicator size="large" color="#fff" />}
              </View>
              <View style={styles.unfocusedContainer} />
            </View>
            <View style={styles.unfocusedContainer}>
              <Text style={styles.overlayText}>Centra el QR del bidón aquí</Text>
            </View>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.resultContainer}>
          <View style={[styles.statusBanner, { backgroundColor: itemData.status === 'APTO' ? '#e8f5e9' : '#fff3e0' }]}>
            {itemData.status === 'APTO' ? <ShieldCheck color="#2e7d32" size={24} /> : <AlertTriangle color="#ef6c00" size={24} />}
            <Text style={[styles.statusText, { color: itemData.status === 'APTO' ? '#2e7d32' : '#ef6c00' }]}>
              ESTADO: {itemData.status || 'PENDIENTE'}
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.label}>Producto</Text>
            <Text style={styles.value}>{itemData.itemName}</Text>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Lote Interno</Text>
                <Text style={styles.subValue}>{itemData.batchInternal}</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Stock Actual</Text>
                <Text style={styles.subValue}>{itemData.quantity} {itemData.unit}</Text>
              </View>
            </View>
          </View>

          <View style={styles.detailsList}>
            <View style={styles.detailItem}>
              <Calendar color="#888" size={18} />
              <Text style={styles.detailText}>Empresa: {itemData.company}</Text>
            </View>
            <View style={styles.detailItem}>
              <Beaker color="#888" size={18} />
              <Text style={styles.detailText}>pH Medido: {itemData.measuredPh || 'Pendiente'}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.resetBtn} onPress={() => { setItemData(null); setScanned(false); }}>
            <Search color="#fff" size={20} />
            <Text style={styles.resetBtnText}>Escanear otro bidón</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7f5' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    backgroundColor: '#fff',
    elevation: 4,
    shadowOpacity: 0.1
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#2e4a3b' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#fff' },
  permissionText: { textAlign: 'center', color: '#666', marginBottom: 20, fontSize: 16 },
  btn: { backgroundColor: '#2e4a3b', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: 'bold' },
  scannerWrapper: { flex: 1, position: 'relative' }, // Crucial para el overlay
  overlay: { 
    ...StyleSheet.absoluteFillObject, // Cubre toda la cámara
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center'
  },
  unfocusedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  focusedRow: { flexDirection: 'row', height: 240 },
  focusedContainer: { width: 240, height: 240, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  overlayText: { color: '#fff', marginTop: 20, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.6)', padding: 12, borderRadius: 8 },
  resultContainer: { padding: 20 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15, borderRadius: 12, marginBottom: 20 },
  statusText: { fontWeight: 'bold', fontSize: 16 },
  infoCard: { backgroundColor: '#fff', padding: 20, borderRadius: 15, elevation: 3 },
  label: { fontSize: 10, color: '#aaa', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 5 },
  value: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { flex: 1 },
  subValue: { fontSize: 16, fontWeight: 'bold', color: '#2e4a3b' },
  detailsList: { marginTop: 20, gap: 12 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#eee' },
  detailText: { fontSize: 14, color: '#666' },
  resetBtn: { backgroundColor: '#2e4a3b', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 15, marginTop: 30, gap: 10 },
  resetBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cornerTopLeft: { position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTopWidth: 5, borderLeftWidth: 5, borderColor: '#fff' },
  cornerTopRight: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderTopWidth: 5, borderRightWidth: 5, borderColor: '#fff' },
  cornerBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 5, borderLeftWidth: 5, borderColor: '#fff' },
  cornerBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 5, borderRightWidth: 5, borderColor: '#fff' },
});