import React, { useRef, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, 
  ScrollView, ActivityIndicator, TextInput, StatusBar 
} from 'react-native';
// IMPORTANTE: Cambio a la librería recomendada
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { db, auth } from '../config/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { ChevronLeft, Printer, Info, Tag, Search, CheckCircle2 } from 'lucide-react-native';

export default function QRGeneratorScreen({ route, navigation }) {
  const params = route.params || {};
  const [itemData, setItemData] = useState(params.itemData || null);
  const [companyName, setCompanyName] = useState(params.companyName || 'H2O Control');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const qrRef = useRef();

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
      const zplString = `
^XA
^CF0,30
^FO50,40^FDLOTE: ${itemData.batchInternal}^FS
^CF0,25
^FO50,80^FDPROD: ${itemData.itemName.substring(0, 20)}^FS
^FO50,115^FDVENCE: ${itemData.expiryDate || 'S/D'}^FS
^FO50,150^FDUNIDAD: ${companyName}^FS
^FO330,40^BQN,2,4^FDQA,${itemData.batchInternal}^FS
^XZ`;

      await addDoc(collection(db, "cola_impresion"), {
        zpl: zplString,
        printerId: "ZEBRA_BATAN_01",
        status: "pendiente",
        user: auth.currentUser?.email || 'Sistema',
        itemName: itemData.itemName,
        batchInternal: itemData.batchInternal,
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

      <ScrollView 
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {!itemData && (
          <View style={styles.manualSection}>
            <Text style={styles.sectionTitle}>Buscar producto existente:</Text>
            <View style={styles.searchBar}>
              <TextInput 
                style={styles.searchInput}
                placeholder="Nombre de MP o Insumo..."
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
                    expiryDate: res.vencimiento || 'S/V'
                  });
                  setCompanyName(res.company);
                }}
              >
                <View style={{flex:1}}>
                  <Text style={styles.resultText}>{res.itemName}</Text>
                  <Text style={styles.resultSub}>Stock: {res.quantity} {res.unit}</Text>
                </View>
                <CheckCircle2 color="#2e4a3b" size={20} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {itemData && (
          <>
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>VISTA PREVIA DE ETIQUETA</Text>
              
              <View style={styles.labelCanvas}>
                <View style={styles.labelHeader}>
                  <Text style={styles.brandText}>H2O CONTROL</Text>
                  <Text style={styles.companyText}>{companyName}</Text>
                </View>

                <View style={styles.labelBody}>
                  <View style={styles.qrContainer}>
                    <QRCode
                      value={itemData.batchInternal || 'ERR'}
                      size={100}
                      color="#000"
                      backgroundColor="#fff"
                    />
                  </View>

                  <View style={styles.dataContainer}>
                    <Text style={styles.dataTitle}>LOTE INTERNO</Text>
                    <Text style={styles.dataValue}>{itemData.batchInternal}</Text>
                    
                    <Text style={styles.dataTitle}>PRODUCTO</Text>
                    <Text style={[styles.dataValue, {fontSize: 13}]} numberOfLines={2}>
                        {itemData.itemName}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.infoBox}>
              <Info color="#2e4a3b" size={18} />
              <Text style={styles.infoText}>
                Esta etiqueta vincula el stock físico con el sistema digital. 
              </Text>
            </View>

            <TouchableOpacity style={styles.printButton} onPress={handlePrintToZebra}>
              <Printer color="#fff" size={22} />
              <Text style={styles.printButtonText}>IMPRIMIR EN ZEBRA</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetBtn} onPress={() => setItemData(null)}>
                <Text style={styles.resetBtnText}>Cambiar Producto</Text>
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
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#2e4a3b' },
  headerSub: { fontSize: 10, color: '#888' },
  container: { padding: 20 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 10, color: '#444' },
  searchBar: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  searchInput: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#ddd', color: '#333' },
  searchBtn: { backgroundColor: '#2e4a3b', padding: 12, borderRadius: 12, justifyContent: 'center' },
  resultItem: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 8, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee'
  },
  resultText: { fontWeight: 'bold', color: '#333' },
  resultSub: { fontSize: 11, color: '#888' },
  previewCard: { backgroundColor: '#fff', padding: 15, borderRadius: 24, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  previewLabel: { fontSize: 9, fontWeight: 'bold', color: '#aaa', textAlign: 'center', marginBottom: 15, letterSpacing: 1 },
  labelCanvas: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#000', padding: 12, borderRadius: 4 },
  labelHeader: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, paddingBottom: 5, marginBottom: 10 },
  brandText: { fontWeight: 'bold', fontSize: 12 },
  companyText: { fontSize: 9, color: '#666' },
  labelBody: { flexDirection: 'row', gap: 12 },
  qrContainer: { padding: 4, borderWidth: 1, borderColor: '#eee' },
  dataContainer: { flex: 1 },
  dataTitle: { fontSize: 7, fontWeight: 'bold', color: '#888', textTransform: 'uppercase' },
  dataValue: { fontSize: 14, fontWeight: '900', color: '#000' },
  infoBox: { flexDirection: 'row', backgroundColor: '#e8f5e9', padding: 15, borderRadius: 15, marginTop: 20, alignItems: 'center', gap: 10 },
  infoText: { flex: 1, fontSize: 11, color: '#2e4a3b', fontStyle: 'italic' },
  printButton: { backgroundColor: '#2e4a3b', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 15, marginTop: 25, gap: 10, elevation: 5 },
  printButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  resetBtn: { marginTop: 15, alignItems: 'center', paddingVertical: 10 },
  resetBtnText: { color: '#2e4a3b', fontSize: 12, fontWeight: 'bold', textDecorationLine: 'underline' }
});