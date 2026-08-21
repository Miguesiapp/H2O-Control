import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, 
  ActivityIndicator, ScrollView, TextInput, StatusBar, KeyboardAvoidingView, Platform
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../config/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, limit } from 'firebase/firestore';
import { ChevronLeft, CheckCircle, XCircle, Beaker, ClipboardCheck, AlertCircle, FileSignature, Database, Container, History, ListTodo, ChevronDown, ChevronUp, User } from 'lucide-react-native';

export default function QualityControlScreen({ navigation }) {
  const [viewMode, setViewMode] = useState('PENDING'); // 'PENDING' o 'HISTORY'
  const [activeTab, setActiveTab] = useState('MP'); // 'MP' o 'GRANEL'
  const [pendingLots, setPendingLots] = useState([]);
  const [historyLots, setHistoryLots] = useState([]);
  const [expandedItems, setExpandedItems] = useState([]);
  const [expandedMonths, setExpandedMonths] = useState({});
  const [analysis, setAnalysis] = useState({ ph: '', density: '', obs: '' });
  const [selectedLot, setSelectedLot] = useState(null);
  const [loading, setLoading] = useState(true);

  const toggleExpand = (id) => {
    setExpandedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleMonth = (month) => {
    setExpandedMonths(prev => ({...prev, [month]: !prev[month]}));
  };

  useEffect(() => {
    setLoading(true);
    setSelectedLot(null);
    setAnalysis({ ph: '', density: '', obs: '' });

    const targetStockType = activeTab === 'MP' ? 'MP' : 'GRANEL';
    let q;

    if (viewMode === 'PENDING') {
      const targetStatus = activeTab === 'MP' ? 'PENDIENTE' : 'PENDIENTE_LABORATORIO';
      q = query(
        collection(db, "Inventory"), 
        where("stockType", "==", targetStockType),
        where("status", "==", targetStatus)
      );
    } else {
      q = query(
        collection(db, "Inventory"), 
        where("stockType", "==", targetStockType),
        where("status", "in", ["APTO", "RECHAZADO"])
      );
      // Nota: Sin índice compuesto, obtenemos todos y ordenamos localmente para extraer los últimos 300.
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (viewMode === 'HISTORY') {
        // Ordenar descendentemente por fecha de autorización
        data = data.sort((a, b) => {
          const dateA = a.authorizedAt ? new Date(a.authorizedAt).getTime() : 0;
          const dateB = b.authorizedAt ? new Date(b.authorizedAt).getTime() : 0;
          return dateB - dateA;
        }).slice(0, 300); // Limitar a 300 en memoria
        
        // Agregar mes/año para agrupar
        data = data.map(item => {
          const d = item.authorizedAt ? new Date(item.authorizedAt) : new Date();
          return {
            ...item,
            monthYear: d.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase(),
            formattedAuthDate: d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
          };
        });
        
        setHistoryLots(data);
      } else {
        setPendingLots(data);
        // Si el lote seleccionado se procesó (ya no está), limpia el formulario
        if (selectedLot && !data.find(d => d.id === selectedLot.id)) {
          setSelectedLot(null);
        }
      }
      setLoading(false);
    }, (error) => {
      console.error(error);
      Alert.alert("Error de Conexión", "Fallo al sincronizar con el servidor de Calidad.");
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [activeTab, viewMode]);

  const handleAuthorize = async (lot, status) => {
    const userEmail = auth.currentUser?.email || 'Usuario Desconocido';

    const phVal = analysis.ph.replace(',', '.');
    const densityVal = analysis.density.replace(',', '.');

    if (status === 'APTO' && activeTab === 'GRANEL' && (!phVal || !densityVal)) {
      Alert.alert("Protocolo Incompleto", "Los valores de pH y Densidad son obligatorios para la liberación de GRANEL.");
      return;
    }

    try {
      const updatePayload = {
        status: status, 
        measuredPh: Number(phVal) || null,
        measuredDensity: Number(densityVal) || null,
        qualityObs: analysis.obs.trim() || 'Sin observaciones.',
        authorizedBy: userEmail,
        authorizedAt: new Date().toISOString()
      };

      // Si el lote es RECHAZADO, ponemos quantity en 0 como capa extra de seguridad
      // para que nunca sea contado en el stock disponible, incluso si el filtro
      // por status fallara. El historial de auditoría queda intacto (AuditLog).
      if (status === 'RECHAZADO') {
        updatePayload.originalQuantity = lot.quantity; // Preservar cantidad original para historial
        updatePayload.quantity = 0;
      }

      await updateDoc(doc(db, "Inventory", lot.id), updatePayload);

      let toastText2, alertMsg;
      if (status === 'APTO') {
        toastText2 = `El lote ${lot.batchInternal} fue liberado y ya está disponible en stock.`;
        alertMsg = `El lote ${lot.batchInternal} fue liberado y está disponible en el inventario.\nFirmado por: ${userEmail}`;
      } else {
        toastText2 = `El lote ${lot.batchInternal} fue rechazado. No será sumado al stock disponible.`;
        alertMsg = activeTab === 'GRANEL'
          ? `El lote ${lot.batchInternal} fue RECHAZADO.\n\n⚠️ Las Materias Primas utilizadas ya fueron descontadas del inventario (son parte del proceso productivo).\n\nEl Granel NO será agregado al stock disponible.\n\nFirmado por: ${userEmail}`
          : `El lote ${lot.batchInternal} fue RECHAZADO.\n\nNo será sumado al stock disponible. Queda registrado en el historial de BBS Calidad.\n\nFirmado por: ${userEmail}`;
      }

      if (Platform.OS === 'web') {
        Toast.show({ 
          type: status === 'APTO' ? 'success' : 'error', 
          text1: status === 'APTO' ? "✅ Lote Liberado" : "❌ Lote Rechazado", 
          text2: toastText2
        });
      } else {
        Alert.alert(
          status === 'APTO' ? "✅ Lote Liberado" : "❌ Lote Rechazado", 
          alertMsg
        );
      }
      
      setSelectedLot(null);
      setAnalysis({ ph: '', density: '', obs: '' });
    } catch (error) {
      Alert.alert("Error de Sistema", "No se pudo firmar el documento en la base de datos.");
    }
  };

  const renderGroup = ({ item }) => {
    const isExpanded = expandedItems.includes(item.id);

    return (
      <View style={{ marginBottom: 12 }}>
        <TouchableOpacity 
          style={styles.lotCard} 
          onPress={() => toggleExpand(item.id)}
          activeOpacity={0.8}
        >
          <View style={styles.lotHeader}>
            <View style={styles.titleRow}>
               <View style={styles.iconBox}>
                 {activeTab === 'MP' ? <Database size={18} color="#475569" /> : <Beaker size={18} color="#475569" />}
               </View>
               <Text style={styles.lotTitle}>{item.itemName}</Text>
            </View>
            <View style={styles.badgeGroup}>
              <Text style={styles.badgeGroupText}>{item.lotes.length}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContainer}>
            {item.lotes.map((lote, index) => (
               <TouchableOpacity 
                 key={lote.id || index.toString()}
                 style={[styles.loteCard, selectedLot?.id === lote.id && styles.loteCardSelected]}
                 onPress={() => setSelectedLot(lote)}
               >
                  <View style={styles.loteHeaderSmall}>
                    <Text style={styles.loteTitleSmall}>
                      Ingreso: {lote.createdAt && typeof lote.createdAt.toDate === 'function' ? lote.createdAt.toDate().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : (lote.createdAt ? new Date(lote.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : 'S/F')}
                    </Text>
                    <Text style={styles.loteQtySmall}>{lote.quantity} {lote.unit}</Text>
                  </View>
                  
                  {activeTab === 'MP' && <Text style={styles.loteSubSmall}>Lote Prov: <Text style={{fontWeight: '700'}}>{lote.batchProvider || lote.loteProveedor || 'S/D'}</Text></Text>}
                  {activeTab === 'MP' && lote.providerName && <Text style={styles.loteSubSmall}>Proveedor: <Text style={{fontWeight: '700'}}>{lote.providerName}</Text></Text>}
                  {activeTab === 'GRANEL' && <Text style={styles.loteSubSmall}>Lote Prod: <Text style={{fontWeight: '700'}}>{lote.batchInternal || 'S/D'}</Text></Text>}
               </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Auto-expand first month if empty
  useEffect(() => {
    const grouped = historyLots.reduce((acc, item) => {
      if (!acc[item.monthYear]) acc[item.monthYear] = [];
      acc[item.monthYear].push(item);
      return acc;
    }, {});
    const sections = Object.keys(grouped);
    if (viewMode === 'HISTORY' && sections.length > 0 && Object.keys(expandedMonths).length === 0) {
       setExpandedMonths({ [sections[0]]: true });
    }
  }, [historyLots, viewMode]);

  const renderHistoryLog = (item, isLast) => {
    const isApto = item.status === 'APTO';
    return (
      <View key={item.id} style={{ flexDirection: 'row', marginBottom: 15 }}>
        <View style={{ width: 30, alignItems: 'center', marginRight: 10 }}>
          {!isLast && <View style={styles.timelineLine} />}
          <View style={[styles.iconBoxHistory, { borderColor: isApto ? '#10b981' : '#ef4444', backgroundColor: isApto ? '#ecfdf5' : '#fef2f2' }]}>
            {isApto ? <CheckCircle color="#10b981" size={16} /> : <XCircle color="#ef4444" size={16} />}
          </View>
        </View>

        <View style={styles.logRight}>
          <View style={styles.logHeader}>
            <Text style={[styles.logAction, { color: isApto ? '#10b981' : '#ef4444', flexShrink: 1, marginRight: 8 }]} numberOfLines={2}>
              {item.status}
            </Text>
            <Text style={[styles.logDate, { flexShrink: 0 }]}>{item.formattedAuthDate}</Text>
          </View>

          <View style={styles.logBody}>
            <View style={{ flex: 1 }}>
              <Text style={styles.logItemName}>{item.itemName || item.productName || 'Desconocido'}</Text>
              {(item.measuredPh || item.measuredDensity) && (
                <Text style={styles.logCompany}>pH: {item.measuredPh || '-'} | Den: {item.measuredDensity || '-'}</Text>
              )}
            </View>
            <View style={styles.qtyBox}>
              <Text style={styles.logQty}>
                {item.quantity} <Text style={styles.logUnit}>{item.unit || 'Uds'}</Text>
              </Text>
            </View>
          </View>

          <View style={styles.logFooter}>
            <View style={styles.userRow}>
              <User color="#94a3b8" size={12} />
              <Text style={styles.logUser} numberOfLines={1}>{item.authorizedBy || 'Sistema'}</Text>
            </View>
            
            <View style={{alignItems: 'flex-end', flexShrink: 1, marginLeft: 8}}>
               {item.batchInternal && item.batchInternal !== 'S/D' && <Text style={styles.logBatch} numberOfLines={2}>Lote Int: {item.batchInternal}</Text>}
               {item.batchProvider && item.batchProvider !== 'S/D' && <Text style={[styles.logBatch, {marginTop: 4, backgroundColor: '#fef3c7', color: '#b45309'}]} numberOfLines={2}>Lote Prov: {item.batchProvider}</Text>}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderHistorySection = ({ item: section }) => {
    const isExpanded = expandedMonths[section.title];
    return (
      <View style={styles.sectionContainer}>
        <TouchableOpacity style={styles.monthHeader} onPress={() => toggleMonth(section.title)} activeOpacity={0.7}>
          <Text style={styles.monthTitle}>{section.title}</Text>
          <View style={styles.monthBadge}>
            <Text style={styles.monthBadgeText}>{section.data.length} reg.</Text>
            {isExpanded ? <ChevronUp color="#64748b" size={20} /> : <ChevronDown color="#64748b" size={20} />}
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.monthContent}>
            {section.data.map((log, index) => renderHistoryLog(log, index === section.data.length - 1))}
          </View>
        )}
      </View>
    );
  };

  // Group pending lots by product
  const groupedLotsMap = pendingLots.reduce((acc, item) => {
    const rawName = item.itemName || item.productName || 'Desconocido';
    const groupKey = rawName.trim().toUpperCase();
    
    if (!acc[groupKey]) {
      acc[groupKey] = {
        id: groupKey,
        itemName: rawName,
        lotes: []
      };
    }
    acc[groupKey].lotes.push(item);
    return acc;
  }, {});
  
  const groupedLots = Object.values(groupedLotsMap).sort((a, b) => a.itemName.localeCompare(b.itemName));

  const historyGroupedMap = historyLots.reduce((acc, item) => {
    if (!acc[item.monthYear]) acc[item.monthYear] = [];
    acc[item.monthYear].push(item);
    return acc;
  }, {});

  const historySections = Object.keys(historyGroupedMap).map(key => ({
    title: key,
    data: historyGroupedMap[key]
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))} style={styles.backBtn}>
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
          <Text style={styles.headerTitle}>Laboratorio y BBS</Text>
          <Text style={styles.headerSub}>Protocolos de Liberación</Text>
        </View>
        <ClipboardCheck color="#0f172a" size={24} />
      </View>

      {/* SELECTOR DE MODO */}
      <View style={styles.viewModeContainer}>
        <TouchableOpacity 
          style={[styles.viewModeBtn, viewMode === 'PENDING' && styles.viewModeBtnActive]}
          onPress={() => setViewMode('PENDING')}
        >
          <ListTodo color={viewMode === 'PENDING' ? '#fff' : '#64748b'} size={18} />
          <Text style={[styles.viewModeText, viewMode === 'PENDING' && styles.viewModeTextActive]}>PENDIENTES</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.viewModeBtn, viewMode === 'HISTORY' && styles.viewModeBtnActive]}
          onPress={() => setViewMode('HISTORY')}
        >
          <History color={viewMode === 'HISTORY' ? '#fff' : '#64748b'} size={18} />
          <Text style={[styles.viewModeText, viewMode === 'HISTORY' && styles.viewModeTextActive]}>HISTORIAL</Text>
        </TouchableOpacity>
      </View>

      {/* SISTEMA DE PESTAÑAS (TABS) */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'MP' && styles.tabBtnActive]}
          onPress={() => setActiveTab('MP')}
        >
          <Database color={activeTab === 'MP' ? '#fff' : '#64748b'} size={18} />
          <Text style={[styles.tabText, activeTab === 'MP' && styles.tabTextActive]}>MATERIA PRIMA</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'GRANEL' && styles.tabBtnActive]}
          onPress={() => setActiveTab('GRANEL')}
        >
          <Container color={activeTab === 'GRANEL' ? '#fff' : '#64748b'} size={18} />
          <Text style={[styles.tabText, activeTab === 'GRANEL' && styles.tabTextActive]}>GRANEL PRODUCIDO</Text>
        </TouchableOpacity>
      </View>

      {/* ZONA SUPERIOR: LISTA PRINCIPAL */}
      <View style={styles.topSection}>
        <Text style={styles.sectionTitle}>{viewMode === 'PENDING' ? `En Cuarentena (${activeTab})` : `Historial de Calidad (${activeTab})`}</Text>
        
        {loading ? (
          <ActivityIndicator color="#3b82f6" style={{ marginTop: 40 }} />
        ) : viewMode === 'PENDING' ? (
          groupedLots.length > 0 ? (
            <FlatList maximumZoomScale={1} 
              data={groupedLots}
              keyExtractor={item => item.id}
              renderItem={renderGroup}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyWarning}>
              <CheckCircle color="#10b981" size={32} />
              <Text style={styles.emptyText}>No hay lotes en cuarentena. La línea de {activeTab} está al día.</Text>
            </View>
          )
        ) : (
          historySections.length > 0 ? (
            <FlatList maximumZoomScale={1} 
              data={historySections}
              keyExtractor={item => item.title}
              renderItem={renderHistorySection}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyWarning}>
              <ClipboardCheck color="#cbd5e1" size={32} />
              <Text style={styles.emptyText}>No hay registros históricos de {activeTab}.</Text>
            </View>
          )
        )}
      </View>

      {/* ZONA INFERIOR: FORMULARIO DE FIRMA (Aparece al seleccionar) */}
      {selectedLot && (
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.bottomSection}
        >
          <ScrollView maximumZoomScale={1} 
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
        </KeyboardAvoidingView>
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
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  headerSub: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: '800', letterSpacing: 0.5 },
  
  tabContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 8 },
  tabBtnActive: { backgroundColor: '#3b82f6' },
  tabText: { fontSize: 13, fontWeight: '800', color: '#64748b', letterSpacing: 0.5 },
  tabTextActive: { color: '#fff' },

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
  badgeGroup: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  badgeGroupText: { fontSize: 11, fontWeight: '900', color: '#1d4ed8' },
  lotFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  lotSub: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  lotSubBold: { color: '#0f172a', fontWeight: '800' },
  
  expandedContainer: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 12, marginTop: -5, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  loteCard: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  loteCardSelected: { borderWidth: 2, borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  loteHeaderSmall: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  loteTitleSmall: { fontSize: 12, fontWeight: '700', color: '#334155' },
  loteQtySmall: { fontSize: 12, fontWeight: '800', color: '#0f172a' },
  loteSubSmall: { fontSize: 11, color: '#64748b', marginBottom: 2 },

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
  emptyFormText: { marginTop: 15, color: '#94a3b8', fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 22 },

  // --- NUEVOS ESTILOS PARA HISTORIAL ---
  viewModeContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  viewModeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6, marginHorizontal: 4 },
  viewModeBtnActive: { backgroundColor: '#1e293b' },
  viewModeText: { fontSize: 12, fontWeight: '800', color: '#64748b', letterSpacing: 0.5 },
  viewModeTextActive: { color: '#fff' },

  sectionContainer: { marginBottom: 15 },
  monthHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    backgroundColor: '#fff', padding: 15, borderRadius: 16, 
    borderWidth: 1, borderColor: '#e2e8f0', elevation: 2
  },
  monthTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a', letterSpacing: 0.5 },
  monthBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthBadgeText: { fontSize: 12, color: '#64748b', marginRight: 5, fontWeight: '600' },
  monthContent: { paddingTop: 10, paddingBottom: 10 },

  iconBoxHistory: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, marginTop: 10, zIndex: 2 },
  timelineLine: { position: 'absolute', top: 30, bottom: -20, width: 2, backgroundColor: '#e2e8f0' },
  
  logRight: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 15, marginTop: 10, marginBottom: 5, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  logAction: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  logDate: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  
  logBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  logItemName: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  logCompany: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  qtyBox: { backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  logQty: { fontSize: 16, fontWeight: '900' },
  logUnit: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  
  logFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  logUser: { fontSize: 11, color: '#64748b', fontStyle: 'italic', fontWeight: '500', flexShrink: 1 },
  logBatch: { fontSize: 10, color: '#94a3b8', fontWeight: '800', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, textAlign: 'right' }
});