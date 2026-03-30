import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, 
  ActivityIndicator, ScrollView, TextInput, StatusBar 
} from 'react-native';
// IMPORTANTE: Cambio a la librería recomendada
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../config/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { ChevronLeft, CheckCircle, XCircle, Beaker, ClipboardCheck } from 'lucide-react-native';

const ADMIN_EMAIL = "miguesilva.1985@outlook.es";
const AUTHORIZED_BBS = "calidad@empresa.com"; 

export default function QualityControlScreen({ navigation }) {
  const [pendingLots, setPendingLots] = useState([]);
  const [analysis, setAnalysis] = useState({ ph: '', density: '', obs: '' });
  const [selectedLot, setSelectedLot] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuchar lotes a granel (PT) que están en tanque
    const q = query(collection(db, "Inventory"), where("stockType", "==", "PT"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPendingLots(data);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuthorize = async (lot, status) => {
    const userEmail = auth.currentUser?.email?.toLowerCase();
    const isAdmin = userEmail === ADMIN_EMAIL.toLowerCase();
    const isQuality = userEmail === AUTHORIZED_BBS.toLowerCase();

    if (!isAdmin && !isQuality) {
      Alert.alert("Acceso Denegado", "Solo el personal de BBS o el Administrador pueden validar protocolos.");
      return;
    }

    if (status === 'APTO' && (!analysis.ph || !analysis.density)) {
      Alert.alert("Faltan Parámetros", "Es obligatorio registrar pH y Densidad para liberar el lote.");
      return;
    }

    try {
      await updateDoc(doc(db, "Inventory", lot.id), {
        status: status, 
        measuredPh: analysis.ph,
        measuredDensity: analysis.density,
        qualityObs: analysis.obs,
        authorizedBy: userEmail,
        authorizedAt: new Date().toISOString()
      });
      
      Alert.alert("Protocolo Cerrado", `El lote ${lot.batchInternal} ha sido marcado como ${status}.`);
      setSelectedLot(null);
      setAnalysis({ ph: '', density: '', obs: '' });
    } catch (error) {
      Alert.alert("Error", "No se pudo actualizar el registro de calidad.");
    }
  };

  const renderLot = ({ item }) => (
    <TouchableOpacity 
      style={[styles.lotCard, selectedLot?.id === item.id && styles.lotCardSelected]} 
      onPress={() => setSelectedLot(item)}
      activeOpacity={0.7}
    >
      <View style={styles.lotHeader}>
        <View style={styles.titleRow}>
           <Beaker size={18} color="#2e4a3b" style={{marginRight: 8}} />
           <Text style={styles.lotTitle}>{item.itemName}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: item.status === 'APTO' ? '#e8f5e9' : item.status === 'RECHAZADO' ? '#ffebee' : '#fff3e0' }]}>
          <Text style={[styles.badgeText, { color: item.status === 'APTO' ? '#2e7d32' : item.status === 'RECHAZADO' ? '#c62828' : '#e65100' }]}>
            {item.status || 'PENDIENTE'}
          </Text>
        </View>
      </View>
      <Text style={styles.lotSub}>LOTE: {item.batchInternal}  |  STOCK: {item.quantity} Lts</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#2e4a3b" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
            <Text style={styles.headerTitle}>Protocolos BBS</Text>
            <Text style={styles.headerSub}>Control de Calidad</Text>
        </View>
        <ClipboardCheck color="#2e4a3b" size={24} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>Lotes en Tanque / Espera</Text>
        
        {loading ? (
          <ActivityIndicator color="#2e4a3b" style={{ marginTop: 20 }} />
        ) : (
          <FlatList 
            data={pendingLots}
            keyExtractor={item => item.id}
            renderItem={renderLot}
            style={{ maxHeight: '40%' }}
            contentContainerStyle={{ padding: 20 }}
            showsVerticalScrollIndicator={false}
          />
        )}

        {selectedLot ? (
          <ScrollView 
            style={styles.formContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.formTitle}>Análisis Lote: {selectedLot.batchInternal}</Text>
            
            <View style={styles.inputRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.label}>pH MEDIDO</Text>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  placeholder="Ej: 6.5" 
                  placeholderTextColor="#bbb"
                  value={analysis.ph}
                  onChangeText={(txt) => setAnalysis({...analysis, ph: txt})}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>DENSIDAD (g/cm³)</Text>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  placeholder="Ej: 1.15"
                  placeholderTextColor="#bbb"
                  value={analysis.density}
                  onChangeText={(txt) => setAnalysis({...analysis, density: txt})}
                />
              </View>
            </View>

            <Text style={styles.label}>OBSERVACIONES TÉCNICAS</Text>
            <TextInput 
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
              multiline 
              placeholder="Estado visual, impurezas, etc..." 
              placeholderTextColor="#bbb"
              value={analysis.obs}
              onChangeText={(txt) => setAnalysis({...analysis, obs: txt})}
            />

            <View style={styles.btnRow}>
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#2e7d32' }]}
                onPress={() => handleAuthorize(selectedLot, 'APTO')}
              >
                <CheckCircle color="#fff" size={20} />
                <Text style={styles.btnText}>LIBERAR LOTE</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#d32f2f' }]}
                onPress={() => handleAuthorize(selectedLot, 'RECHAZADO')}
              >
                <XCircle color="#fff" size={20} />
                <Text style={styles.btnText}>RECHAZAR</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        ) : (
          <View style={styles.emptyForm}>
            <Beaker color="#ddd" size={80} />
            <Text style={styles.emptyText}>Selecciona un lote del listado superior</Text>
          </View>
        )}
      </View>
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
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee',
    elevation: 4
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#2e4a3b' },
  headerSub: { fontSize: 10, color: '#888', textTransform: 'uppercase' },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#888', marginLeft: 20, marginTop: 15, textTransform: 'uppercase', letterSpacing: 1 },
  lotCard: { backgroundColor: '#fff', padding: 18, borderRadius: 15, marginBottom: 10, marginHorizontal: 20, elevation: 2, borderWidth: 1, borderColor: '#eee' },
  lotCardSelected: { borderWidth: 2, borderColor: '#2e4a3b', elevation: 5 },
  lotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  lotTitle: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 9, fontWeight: '900' },
  lotSub: { fontSize: 11, color: '#777', marginTop: 6, fontWeight: '700' },
  formContainer: { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, elevation: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  formTitle: { fontSize: 17, fontWeight: '900', marginBottom: 20, color: '#2e4a3b' },
  label: { fontSize: 11, fontWeight: 'bold', color: '#2e4a3b', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: '#f9f9f9', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#eee', marginBottom: 15, color: '#333', fontSize: 15 },
  inputRow: { flexDirection: 'row' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 15 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 15, gap: 8, elevation: 4 },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  emptyForm: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 15, color: '#bbb', fontSize: 13, fontWeight: '700', textAlign: 'center', paddingHorizontal: 40 }
});