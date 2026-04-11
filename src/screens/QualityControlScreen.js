import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, 
  ActivityIndicator, ScrollView, TextInput, StatusBar, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../config/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { ChevronLeft, CheckCircle, XCircle, Beaker, ClipboardCheck, AlertCircle, FileSignature } from 'lucide-react-native';

const ADMIN_EMAIL = "miguesilva.1985@outlook.es";
const AUTHORIZED_BBS = "calidad@empresa.com"; 

export default function QualityControlScreen({ navigation }) {
  const [pendingLots, setPendingLots] = useState([]);
  const [analysis, setAnalysis] = useState({ ph: '', density: '', obs: '' });
  const [selectedLot, setSelectedLot] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. ESCUCHA OPTIMIZADA: Solo trae los lotes que necesitan revisión
    const q = query(
      collection(db, "Inventory"), 
      where("stockType", "==", "PT"),
      where("status", "in", ["PENDIENTE", "PENDIENTE_LABORATORIO"])
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPendingLots(data);
      setLoading(false);
      
      // Si el lote seleccionado se procesó (ya no está en PENDIENTE), limpia el formulario
      if (selectedLot && !data.find(d => d.id === selectedLot.id)) {
        setSelectedLot(null);
      }
    }, (error) => {
      console.error(error);
      Alert.alert("Error de Conexión", "Fallo al sincronizar con el servidor de Calidad.");
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [selectedLot]);

  const handleAuthorize = async (lot, status) => {
    const userEmail = auth.currentUser?.email?.toLowerCase() || '';
    const isAdmin = userEmail === ADMIN_EMAIL.toLowerCase();
    const isQuality = userEmail === AUTHORIZED_BBS.toLowerCase();

    // Comprobamos si es administrador del sistema o personal de BBS
    if (!isAdmin && !isQuality) {
      Alert.alert("Acceso Denegado", "Operación restringida. Solo firmas autorizadas pueden liberar lotes.");
      return;
    }

    // Normalización de decimales (Cambia comas por puntos)
    const phVal = analysis.ph.replace(',', '.');
    const densityVal = analysis.density.replace(',', '.');

    if (status === 'APTO' && (!phVal || !densityVal)) {
      Alert.alert("Protocolo Incompleto", "Los valores de pH y Densidad son obligatorios para la liberación.");
      return;
    }

    try {
      await updateDoc(doc(db, "Inventory", lot.id), {
        status: status, 
        measuredPh: Number(phVal) || null,
        measuredDensity: Number(densityVal) || null,
        qualityObs: analysis.obs.trim() || 'Sin observaciones.',
        authorizedBy: userEmail,
        authorizedAt: new Date().toISOString()
      });
      
      Alert.alert(
        status === 'APTO' ? "Lote Liberado" : "Lote Rechazado", 
        `El código ${lot.batchInternal} ha sido actualizado a estado ${status}.`
      );
      
      setSelectedLot(null);
      setAnalysis({ ph: '', density: '', obs: '' });
    } catch (error) {
      Alert.alert("Error de Sistema", "No se pudo firmar el documento en la base de datos.");
    }
  };

  const renderLot = ({ item }) => (
    <TouchableOpacity 
      style={[styles.lotCard, selectedLot?.id === item.id && styles.lotCardSelected]} 
      onPress={() => setSelectedLot(item)}
      activeOpacity={0.8}
    >
      <View style={styles.lotHeader}>
        <View style={styles.titleRow}>
           <View style={[styles.iconBox, selectedLot?.id === item.id && { backgroundColor: '#e2e8f0' }]}>
             <Beaker size={18} color="#475569" />
           </View>
           <Text style={styles.lotTitle}>{item.itemName}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>ESPERA</Text>
        </View>
      </View>
      <View style={styles.lotFooter}>
        <Text style={styles.lotSub}>ID: <Text style={styles.lotSubBold}>{item.batchInternal}</Text></Text>
        <Text style={styles.lotSub}>VOL: <Text style={styles.lotSubBold}>{item.quantity} Lts</Text></Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER ENTERPRISE */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
          <Text style={styles.headerTitle}>Laboratorio y BBS</Text>
          <Text style={styles.headerSub}>Protocolos de Liberación</Text>
        </View>
        <ClipboardCheck color="#0f172a" size={24} />
      </View>

      {/* ZONA SUPERIOR: LISTA DE PENDIENTES */}
      <View style={styles.topSection}>
        <Text style={styles.sectionTitle}>En Cuarentena (Esperando Análisis)</Text>
        
        {loading ? (
          <ActivityIndicator color="#3b82f6" style={{ marginTop: 40 }} />
        ) : pendingLots.length > 0 ? (
          <FlatList 
            data={pendingLots}
            keyExtractor={item => item.id}
            renderItem={renderLot}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyWarning}>
            <CheckCircle color="#10b981" size={32} />
            <Text style={styles.emptyText}>No hay lotes en cuarentena. La línea de producción está al día.</Text>
          </View>
        )}
      </View>

      {/* ZONA INFERIOR: FORMULARIO DE FIRMA (Aparece al seleccionar) */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={[styles.bottomSection, !selectedLot && { opacity: 0.5 }]}
      >
        {selectedLot ? (
          <ScrollView 
            style={styles.formContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formHeader}>
              <FileSignature color="#3b82f6" size={24} />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.formTitle}>Auditoría de Lote</Text>
                <Text style={styles.formSub}>{selectedLot.batchInternal}</Text>
              </View>
            </View>
            
            <View style={styles.inputRow}>
              <View style={{ flex: 1, marginRight: 15 }}>
                <Text style={styles.label}>pH Medido</Text>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  placeholder="0.00" 
                  placeholderTextColor="#94a3b8"
                  value={analysis.ph}
                  onChangeText={(txt) => setAnalysis({...analysis, ph: txt})}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Densidad (g/cm³)</Text>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  placeholder="1.00"
                  placeholderTextColor="#94a3b8"
                  value={analysis.density}
                  onChangeText={(txt) => setAnalysis({...analysis, density: txt})}
                />
              </View>
            </View>

            <Text style={styles.label}>Observaciones Técnicas (Opcional)</Text>
            <TextInput 
              style={[styles.input, { height: 90, textAlignVertical: 'top', paddingTop: 15 }]} 
              multiline 
              placeholder="Estado visual, color, ajustes realizados..." 
              placeholderTextColor="#94a3b8"
              value={analysis.obs}
              onChangeText={(txt) => setAnalysis({...analysis, obs: txt})}
            />

            <View style={styles.btnRow}>
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#10b981', shadowColor: '#10b981' }]}
                onPress={() => handleAuthorize(selectedLot, 'APTO')}
              >
                <CheckCircle color="#fff" size={20} />
                <Text style={styles.btnText}>FIRMAR COMO APTO</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#ef4444', shadowColor: '#ef4444' }]}
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
            <AlertCircle color="#cbd5e1" size={48} />
            <Text style={styles.emptyFormText}>
              Seleccione un lote del listado superior para habilitar el panel de firma técnica.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
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
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  headerSub: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: '800', letterSpacing: 0.5 },
  
  topSection: { flex: 1 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#64748b', marginHorizontal: 20, marginTop: 15, textTransform: 'uppercase', letterSpacing: 1 },
  listContainer: { padding: 20, paddingBottom: 10 },
  
  emptyWarning: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { marginTop: 15, color: '#10b981', fontSize: 14, fontWeight: '700', textAlign: 'center', lineHeight: 20 },

  lotCard: { backgroundColor: '#fff', padding: 18, borderRadius: 16, marginBottom: 12, elevation: 1, borderWidth: 1, borderColor: '#e2e8f0' },
  lotCardSelected: { borderWidth: 2, borderColor: '#3b82f6', backgroundColor: '#eff6ff', elevation: 4, shadowColor: '#3b82f6', shadowOpacity: 0.2, shadowRadius: 10 },
  lotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox: { backgroundColor: '#f1f5f9', padding: 8, borderRadius: 10, marginRight: 12 },
  lotTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b', flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a' },
  badgeText: { fontSize: 9, fontWeight: '900', color: '#b45309' },
  lotFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  lotSub: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  lotSubBold: { color: '#0f172a', fontWeight: '800' },

  bottomSection: { flex: 1.2, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  formContainer: { flex: 1, padding: 25 },
  formHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  formTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  formSub: { fontSize: 13, color: '#3b82f6', fontWeight: '800' },
  
  label: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20, color: '#0f172a', fontSize: 18, fontWeight: '700' },
  inputRow: { flexDirection: 'row' },
  
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 16, gap: 8, elevation: 4, shadowOpacity: 0.3, shadowRadius: 8 },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  
  emptyForm: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyFormText: { marginTop: 15, color: '#94a3b8', fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 22 }
});