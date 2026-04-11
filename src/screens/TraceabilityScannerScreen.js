import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, 
  ScrollView, ActivityIndicator, StatusBar, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { CameraView, useCameraPermissions } from 'expo-camera';
import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { 
  ChevronLeft, Search, Beaker, Calendar, User, 
  ShieldCheck, AlertTriangle, Camera, Layers, Package, Factory
} from 'lucide-react-native';

export default function TraceabilityScannerScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [itemData, setItemData] = useState(null);
  const [isPT, setIsPT] = useState(false); // Define si es Producto Terminado o Materia Prima
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
      let foundData = null;
      let isProductTerminado = false;

      // 1. INTELIGENCIA DE ENRUTAMIENTO: ¿Es un Lote de Producción?
      if (data.startsWith('PT-')) {
        const qPT = query(collection(db, "Produccion_Lotes"), where("batchInternal", "==", data));
        const snapPT = await getDocs(qPT);
        
        if (!snapPT.empty) {
          foundData = snapPT.docs[0].data();
          isProductTerminado = true;
        }
      }

      // 2. Si no es producción (o no lo encontró), buscamos en el Inventario General (Materias Primas)
      if (!foundData) {
        const qInv = query(collection(db, "Inventory"), where("batchInternal", "==", data));
        const snapInv = await getDocs(qInv);
        
        if (!snapInv.empty) {
          foundData = snapInv.docs[0].data();
          isProductTerminado = false;
        }
      }

      if (foundData) {
        setItemData(foundData);
        setIsPT(isProductTerminado);
      } else {
        Alert.alert(
          "Lote Huérfano", 
          `El código "${data}" no está registrado en el sistema.`,
          [{ text: "Reintentar Escaneo", onPress: () => setScanned(false) }]
        );
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Fallo de conexión con el servidor central.");
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  if (!permission) return <View style={styles.center}><ActivityIndicator size="large" color="#0f172a" /></View>;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Camera color="#94a3b8" size={60} style={{ marginBottom: 20 }} />
        <Text style={styles.permissionText}>El escáner requiere acceso a la cámara para operar.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Habilitar Hardware</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER ENTERPRISE */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Auditor QR</Text>
          <Text style={styles.headerSub}>Trazabilidad Activa</Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      {!itemData ? (
        <View style={styles.scannerWrapper}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />
          
          <View style={styles.overlay}>
            <View style={styles.unfocusedContainer} />
            <View style={styles.focusedRow}>
              <View style={styles.unfocusedContainer} />
              <View style={styles.focusedContainer}>
                <View style={styles.cornerTopLeft} />
                <View style={styles.cornerTopRight} />
                <View style={styles.cornerBottomLeft} />
                <View style={styles.cornerBottomRight} />
                {loading && <ActivityIndicator size="large" color="#38bdf8" style={{ transform: [{ scale: 1.5 }] }} />}
              </View>
              <View style={styles.unfocusedContainer} />
            </View>
            <View style={styles.unfocusedContainer}>
              <View style={styles.instructionBadge}>
                <Text style={styles.overlayText}>Centra el QR en el recuadro</Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.resultContainer} showsVerticalScrollIndicator={false}>
          
          {/* BANNER DE ESTADO */}
          <View style={[styles.statusBanner, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
            <ShieldCheck color="#10b981" size={24} />
            <Text style={[styles.statusText, { color: '#047857' }]}>
              LOTE AUDITADO Y VERIFICADO
            </Text>
          </View>

          {/* TARJETA PRINCIPAL DEL PRODUCTO */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.label}>Identificación</Text>
                <Text style={styles.value}>{itemData.itemName || itemData.productName}</Text>
              </View>
              <View style={[styles.typeBadge, { backgroundColor: isPT ? '#f5f3ff' : '#f0fdf4', borderColor: isPT ? '#ddd6fe' : '#bbf7d0' }]}>
                <Text style={[styles.typeBadgeText, { color: isPT ? '#7c3aed' : '#16a34a' }]}>
                  {isPT ? 'PRODUCTO TERMINADO' : 'MATERIA PRIMA'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Lote Interno (ID)</Text>
                <Text style={styles.subValue}>{itemData.batchInternal}</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>{isPT ? 'Cliente Destino' : 'Stock Actual'}</Text>
                <Text style={styles.subValue}>
                  {isPT ? (itemData.companyTarget || 'General') : `${itemData.quantity} ${itemData.unit}`}
                </Text>
              </View>
            </View>
          </View>

          {/* RENDERIZADO DINÁMICO SEGÚN TIPO (PT o MP) */}
          {isPT ? (
            // ================= VISTA DE PRODUCTO TERMINADO (FABRICACIÓN) =================
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Datos de Formulación</Text>
              
              <View style={styles.gridBlock}>
                <View style={styles.gridItem}>
                  <Beaker color="#64748b" size={16} />
                  <Text style={styles.gridText}>pH: <Text style={styles.gridBold}>{itemData.ph}</Text></Text>
                </View>
                <View style={styles.gridItem}>
                  <Layers color="#64748b" size={16} />
                  <Text style={styles.gridText}>Densidad: <Text style={styles.gridBold}>{itemData.density}</Text></Text>
                </View>
                <View style={styles.gridItem}>
                  <User color="#64748b" size={16} />
                  <Text style={styles.gridText}>Autorizó: <Text style={styles.gridBold}>{itemData.responsable?.split('@')[0]}</Text></Text>
                </View>
                <View style={styles.gridItem}>
                  <Calendar color="#64748b" size={16} />
                  <Text style={styles.gridText}>Fecha: <Text style={styles.gridBold}>
                    {itemData.fechaFabricacion?.toDate ? itemData.fechaFabricacion.toDate().toLocaleDateString() : 'Registrada'}
                  </Text></Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Trazabilidad de Materias Primas</Text>
              {itemData.ingredients?.map((ing, idx) => (
                <View key={idx} style={styles.ingredientCard}>
                  <View style={styles.ingHeader}>
                    <Package color="#475569" size={16} />
                    <Text style={styles.ingName}>{ing.name}</Text>
                    <Text style={styles.ingPct}>{ing.percentage}%</Text>
                  </View>
                  <View style={styles.ingLotBox}>
                    <Text style={styles.ingLotLabel}>Lote Utilizado:</Text>
                    <Text style={styles.ingLotValue}>{ing.loteMpUsado || 'N/A'}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            // ================= VISTA DE MATERIA PRIMA (INVENTARIO) =================
            <View style={styles.detailsSection}>
               <Text style={styles.sectionTitle}>Datos Logísticos</Text>
               <View style={styles.detailItem}>
                 <Factory color="#64748b" size={20} />
                 <View>
                    <Text style={styles.detailItemLabel}>Lote Proveedor Original</Text>
                    <Text style={styles.detailItemValue}>{itemData.loteProveedor || 'S/D'}</Text>
                 </View>
               </View>
               <View style={styles.detailItem}>
                 <Calendar color="#64748b" size={20} />
                 <View>
                    <Text style={styles.detailItemLabel}>Fecha de Vencimiento</Text>
                    <Text style={styles.detailItemValue}>{itemData.vencimiento || 'No registra'}</Text>
                 </View>
               </View>
               <View style={styles.detailItem}>
                 <Layers color="#64748b" size={20} />
                 <View>
                    <Text style={styles.detailItemLabel}>Unidad de Negocio / Depósito</Text>
                    <Text style={styles.detailItemValue}>{itemData.company}</Text>
                 </View>
               </View>
            </View>
          )}

          <TouchableOpacity style={styles.resetBtn} onPress={() => { setItemData(null); setScanned(false); }}>
            <Search color="#fff" size={20} />
            <Text style={styles.resetBtnText}>Auditar Nuevo Lote</Text>
          </TouchableOpacity>
          <View style={{height: 30}}/>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2, zIndex: 10
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  headerSub: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#f8fafc' },
  permissionText: { textAlign: 'center', color: '#64748b', marginBottom: 25, fontSize: 15, fontWeight: '500' },
  btn: { backgroundColor: '#0f172a', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 14 },
  btnText: { color: '#fff', fontWeight: '800', letterSpacing: 0.5 },
  
  // SCANNER OVERLAY
  scannerWrapper: { flex: 1, position: 'relative' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center' },
  unfocusedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  focusedRow: { flexDirection: 'row', height: 260 },
  focusedContainer: { width: 260, height: 260, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  instructionBadge: { backgroundColor: 'rgba(15, 23, 42, 0.8)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  overlayText: { color: '#f8fafc', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  
  // CORNERS
  cornerTopLeft: { position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTopWidth: 6, borderLeftWidth: 6, borderColor: '#38bdf8', borderTopLeftRadius: 10 },
  cornerTopRight: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderTopWidth: 6, borderRightWidth: 6, borderColor: '#38bdf8', borderTopRightRadius: 10 },
  cornerBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 6, borderLeftWidth: 6, borderColor: '#38bdf8', borderBottomLeftRadius: 10 },
  cornerBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 6, borderRightWidth: 6, borderColor: '#38bdf8', borderBottomRightRadius: 10 },

  // RESULTADOS
  resultContainer: { padding: 20 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14, borderRadius: 12, marginBottom: 20, borderWidth: 1 },
  statusText: { fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  
  infoCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  typeBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  label: { fontSize: 10, color: '#64748b', fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  value: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { flex: 1 },
  subValue: { fontSize: 15, fontWeight: '800', color: '#334155' },
  
  // SECCIONES DINÁMICAS
  detailsSection: { marginTop: 25 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  gridBlock: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 },
  gridItem: { width: '48%', backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', gap: 8 },
  gridText: { fontSize: 12, color: '#64748b' },
  gridBold: { fontWeight: '800', color: '#1e293b' },

  ingredientCard: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  ingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  ingName: { flex: 1, fontSize: 14, fontWeight: '800', color: '#1e293b', marginLeft: 8 },
  ingPct: { fontSize: 14, fontWeight: '900', color: '#0ea5e9' },
  ingLotBox: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ingLotLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  ingLotValue: { fontSize: 12, fontWeight: '800', color: '#0f172a' },

  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 15, backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  detailItemLabel: { fontSize: 10, color: '#64748b', fontWeight: '800', textTransform: 'uppercase' },
  detailItemValue: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginTop: 2 },

  resetBtn: { backgroundColor: '#0f172a', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 14, marginTop: 30, gap: 10, elevation: 4 },
  resetBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 }
});