import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  SafeAreaView, 
  ScrollView, 
  ActivityIndicator 
} from 'react-native';
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

  // Forzamos la solicitud de permiso apenas se monta el componente
  useEffect(() => {
    if (!permission || !permission.granted) {
      requestPermission();
    }
  }, []);

  // Manejador del escaneo
  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || loading) return; // Evita escaneos múltiples accidentales
    
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
          `El código QR "${data}" no está registrado en el inventario.`,
          [{ text: "Reintentar", onPress: () => setScanned(false) }]
        );
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo conectar con la base de datos.");
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  // 1. Estado de carga inicial de permisos
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2e4a3b" />
        <Text style={styles.loadingText}>Iniciando cámara...</Text>
      </View>
    );
  }

  // 2. Estado si el permiso fue denegado
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Camera color="#ccc" size={60} style={{ marginBottom: 20 }} />
        <Text style={styles.permissionText}>Se requiere acceso a la cámara para auditar lotes.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Habilitar Cámara</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          <Text style={{ color: '#888' }}>Volver atrás</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft color="#2e4a3b" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Auditoría de Lote QR</Text>
        <View style={{ width: 28 }} />
      </View>

      {!itemData ? (
        <View style={styles.scannerWrapper}>
          <CameraView
            style={styles.scanner}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          >
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
          </CameraView>
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
                <Text style={styles.label}>Cantidad Actual</Text>
                <Text style={styles.subValue}>{itemData.quantity} {itemData.unit}</Text>
              </View>
            </View>
          </View>

          <View style={styles.detailsList}>
            <View style={styles.detailItem}>
              <Calendar color="#888" size={18} />
              <Text style={styles.detailText}>
                Ingreso: {itemData.createdAt?.toDate ? itemData.createdAt.toDate().toLocaleDateString() : 'S/D'}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Beaker color="#888" size={18} />
              <Text style={styles.detailText}>pH Medido: {itemData.measuredPh || 'Pendiente'}</Text>
            </View>
            <View style={styles.detailItem}>
              <User color="#888" size={18} />
              <Text style={styles.detailText}>Empresa: {itemData.company}</Text>
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
    zIndex: 10
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#2e4a3b' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#fff' },
  permissionText: { textAlign: 'center', color: '#666', marginBottom: 20, fontSize: 16 },
  loadingText: { marginTop: 10, color: '#2e4a3b' },
  btn: { backgroundColor: '#2e4a3b', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: 'bold' },
  scannerWrapper: { flex: 1, overflow: 'hidden' },
  scanner: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  unfocusedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  focusedRow: { flexDirection: 'row', height: 220 },
  focusedContainer: { width: 220, height: 220, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  overlayText: { color: '#fff', marginTop: 20, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 5 },
  resultContainer: { padding: 20 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15, borderRadius: 12, marginBottom: 20 },
  statusText: { fontWeight: 'bold', fontSize: 16 },
  infoCard: { backgroundColor: '#fff', padding: 20, borderRadius: 15, elevation: 3, shadowOpacity: 0.1, shadowRadius: 10 },
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