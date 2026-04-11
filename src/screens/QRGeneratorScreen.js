import React, { useRef, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, 
  ScrollView, ActivityIndicator, TextInput, StatusBar 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { db, auth } from '../config/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { ChevronLeft, Printer, Info, Tag, Search, CheckCircle2, Box } from 'lucide-react-native';

export default function QRGeneratorScreen({ route, navigation }) {
  const params = route.params || {};
  // Recibimos los datos enriquecidos desde SmartAICargo o Formulations
  const [itemData, setItemData] = useState(params.itemData || null);
  const [companyName, setCompanyName] = useState(params.companyName || 'H2O Control');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const handleManualSearch = async () => {
    if (searchQuery.length < 3) {
      Alert.alert("Búsqueda", "Ingresa al menos 3 letras del producto.");
      return;
    }
    setSearching(true);
    try {
      const q = query(
        collection(db, "Inventory"), 
        where("itemName", ">=", searchQuery.toUpperCase()),
        where("itemName", "<=", searchQuery.toUpperCase() + '\uf8ff')
      );
      const snap = await getDocs(q);
      const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSearchResults(results);
    } catch (e) {
      Alert.alert("Error", "No se pudo consultar el inventario.");
    } finally {
      setSearching(false);
    }
  };

  const handlePrintToZebra = async () => {
    if (!itemData?.batchInternal) {
      Alert.alert("Error", "Faltan datos del lote para generar el QR.");
      return;
    }

    try {
      // Diferenciamos la etiqueta ZPL si es Producto Terminado o Materia Prima/Insumo
      const isPT = itemData.stockType === 'PT' || itemData.stockType === 'FINAL';
      const labelTipoLote = isPT ? 'LOTE PROD' : 'LOTE PROV';
      const valorTipoLote = isPT ? itemData.batchInternal : (itemData.loteProveedor || 'S/D');

      const zplString = `
^XA
^CF0,25
^FO40,30^FDPROD: ${itemData.itemName.substring(0, 20)}^FS
^CF0,20
^FO40,65^FD${labelTipoLote}: ${valorTipoLote}^FS
^FO40,95^FDID INT: ${itemData.batchInternal}^FS
^FO40,125^FDINGRESO/FAB: ${itemData.fechaIngreso || new Date().toLocaleDateString()}^FS
^FO40,155^FDCANT: ${itemData.quantity || 0} ${itemData.unit || 'Uds'}^FS
^FO40,185^FDVENCE: ${itemData.expiryDate || 'S/D'}^FS
^FO320,40^BQN,2,4^FDQA,${itemData.batchInternal}^FS
^XZ`;

      await addDoc(collection(db, "cola_impresion"), {
        zpl: zplString,
        printerId: "ZEBRA_BATAN_01",
        status: "pendiente",
        user: auth.currentUser?.email || 'Sistema',
        itemName: itemData.itemName,
        batchInternal: itemData.batchInternal,
        stockType: itemData.stockType || 'MP',
        createdAt: serverTimestamp()
      });

      Alert.alert("Éxito", "Etiqueta enviada a la cola de impresión de planta.");
    } catch (error) {
      Alert.alert("Error", "No se pudo registrar la orden de impresión.");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#2e4a3b" size={28} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Generador de QR</Text>
          <Text style={styles.headerSub}>Trazabilidad de Planta</Text>
        </View>
        <Tag color="#2e4a3b" size={24} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {!itemData && (
          <View style={styles.manualSection}>
            <Text style={styles.sectionTitle}>Buscar producto en stock:</Text>
            <View style={styles.searchBar}>
              <TextInput 
                style={styles.searchInput}
                placeholder="Ej: Ácido, Shock, Bidón 5L..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity style={styles.searchBtn} onPress={handleManualSearch}>
                {searching ? <ActivityIndicator color="#fff" /> : <Search color="#fff" size={20} />}
              </TouchableOpacity>
            </View>

            {searchResults.map((res) => (
              <TouchableOpacity 
                key={res.id} 
                style={styles.resultItem}
                onPress={() => {
                  setItemData({
                    itemName: res.itemName,
                    batchInternal: res.batchInternal || `MAN-${Date.now().toString().slice(-6)}`,
                    loteProveedor: res.loteProveedor || 'S/D',
                    expiryDate: res.vencimiento || 'S/V',
                    fechaIngreso: res.fechaIngreso || new Date().toLocaleDateString(),
                    quantity: res.quantity,
                    unit: res.unit || 'Uds',
                    stockType: res.stockType || 'MP'
                  });
                  setCompanyName(res.company);
                }}
              >
                <View style={{flex:1}}>
                  <Text style={styles.resultText}>{res.itemName}</Text>
                  <Text style={styles.resultSub}>Stock: {res.quantity} {res.unit} • Lote: {res.batchInternal}</Text>
                </View>
                <CheckCircle2 color="#2e4a3b" size={20} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {itemData && (
          <>
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>
                {itemData.stockType === 'PT' || itemData.stockType === 'FINAL' 
                  ? 'ETIQUETA DE PRODUCTO TERMINADO' 
                  : 'ETIQUETA DE MATERIA PRIMA / INSUMO'}
              </Text>
              
              <View style={styles.labelCanvas}>
                <View style={styles.labelHeader}>
                  <Text style={styles.brandText}>H2O CONTROL</Text>
                  <Text style={styles.companyText}>{companyName}</Text>
                </View>

                <View style={styles.labelBody}>
                  <View style={styles.qrContainer}>
                    <QRCode
                      value={itemData.batchInternal || 'ERR'}
                      size={90}
                      color="#000"
                      backgroundColor="#fff"
                    />
                    <Text style={styles.scanMeText}>SCAN M.E.</Text>
                  </View>

                  <View style={styles.dataContainer}>
                    <Text style={styles.dataTitle}>PRODUCTO</Text>
                    <Text style={styles.dataValueMain} numberOfLines={1}>{itemData.itemName}</Text>
                    
                    <View style={styles.dataRow}>
                      <View style={{flex: 1}}>
                        <Text style={styles.dataTitle}>ID TRAZABILIDAD</Text>
                        <Text style={styles.dataValue}>{itemData.batchInternal}</Text>
                      </View>
                      <View style={{flex: 1}}>
                        <Text style={styles.dataTitle}>CANTIDAD</Text>
                        <Text style={styles.dataValue}>{itemData.quantity} {itemData.unit}</Text>
                      </View>
                    </View>

                    <View style={styles.dataRow}>
                      <View style={{flex: 1}}>
                        <Text style={styles.dataTitle}>
                          {itemData.stockType === 'PT' ? 'FECHA FORMULACIÓN' : 'LOTE PROVEEDOR'}
                        </Text>
                        <Text style={styles.dataValue}>
                          {itemData.stockType === 'PT' ? (itemData.fechaIngreso || 'HOY') : (itemData.loteProveedor || 'S/D')}
                        </Text>
                      </View>
                      <View style={{flex: 1}}>
                        <Text style={styles.dataTitle}>VENCIMIENTO</Text>
                        <Text style={styles.dataValue}>{itemData.expiryDate || 'S/V'}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.infoBox}>
              <Box color="#2e4a3b" size={24} />
              <Text style={styles.infoText}>
                {itemData.stockType === 'PT' 
                  ? "El QR vincula este producto con el registro digital de las materias primas utilizadas en su formulación." 
                  : "Pega esta etiqueta en el envase/pallet. El código QR es único para este ingreso."}
              </Text>
            </View>

            <TouchableOpacity style={styles.printButton} onPress={handlePrintToZebra}>
              <Printer color="#fff" size={22} />
              <Text style={styles.printButtonText}>IMPRIMIR EN ZEBRA</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetBtn} onPress={() => setItemData(null)}>
                <Text style={styles.resetBtnText}>Cambiar Producto / Volver a buscar</Text>
            </TouchableOpacity>
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8faf8' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#2e4a3b' },
  headerSub: { fontSize: 10, color: '#888' },
  container: { padding: 20 },
  manualSection: { flex: 1 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 10, color: '#444' },
  searchBar: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  searchInput: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#ddd', color: '#333' },
  searchBtn: { backgroundColor: '#2e4a3b', padding: 12, borderRadius: 12, justifyContent: 'center' },
  resultItem: { 
    flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 12, 
    marginBottom: 8, alignItems: 'center', borderWidth: 1, borderColor: '#eee'
  },
  resultText: { fontWeight: 'bold', color: '#333', fontSize: 14 },
  resultSub: { fontSize: 11, color: '#888', marginTop: 2 },
  previewCard: { backgroundColor: '#fff', padding: 15, borderRadius: 24, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  previewLabel: { fontSize: 10, fontWeight: '900', color: '#2e4a3b', textAlign: 'center', marginBottom: 15, letterSpacing: 0.5 },
  labelCanvas: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#111', padding: 12, borderRadius: 8 },
  labelHeader: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 5, marginBottom: 10 },
  brandText: { fontWeight: '900', fontSize: 13, color: '#000' },
  companyText: { fontSize: 10, color: '#555', fontWeight: 'bold' },
  labelBody: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  qrContainer: { padding: 4, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  scanMeText: { fontSize: 8, fontWeight: 'bold', marginTop: 2, color: '#444' },
  dataContainer: { flex: 1, justifyContent: 'space-between' },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  dataTitle: { fontSize: 7, fontWeight: 'bold', color: '#777', textTransform: 'uppercase', marginBottom: 1 },
  dataValueMain: { fontSize: 14, fontWeight: '900', color: '#000' },
  dataValue: { fontSize: 11, fontWeight: '800', color: '#111' },
  infoBox: { flexDirection: 'row', backgroundColor: '#e8f5e9', padding: 15, borderRadius: 15, marginTop: 20, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#c8e6c9' },
  infoText: { flex: 1, fontSize: 12, color: '#2e4a3b', fontStyle: 'italic', lineHeight: 18 },
  printButton: { backgroundColor: '#2e4a3b', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 15, marginTop: 20, gap: 10, elevation: 5 },
  printButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  resetBtn: { marginTop: 15, alignItems: 'center', paddingVertical: 10 },
  resetBtnText: { color: '#555', fontSize: 13, fontWeight: 'bold', textDecorationLine: 'underline' }
});