import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { collection, onSnapshot, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { ChevronLeft, Clock, ArrowDownToLine, ArrowUpFromLine, Activity, User, ArrowRightLeft, Filter, ChevronDown, ChevronUp, FileText, X } from 'lucide-react-native';
import { generateAuditSummary } from '../services/aiService';
import { generateAndSharePDF } from '../services/reportService';

const FILTER_TABS = [
  { id: 'ALL', label: 'Todos' },
  { id: 'MP', label: 'Ingresos MP' },
  { id: 'OP', label: 'Producción (OP)' },
  { id: 'OE', label: 'Envasado (OE)' },
  { id: 'OD', label: 'Despachos (OD)' }
];

export default function HistoryScreen({ navigation }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [expandedMonths, setExpandedMonths] = useState({});
  const [generatingPdfFor, setGeneratingPdfFor] = useState(null);

  const [selectedOPLog, setSelectedOPLog] = useState(null);
  const [opDetails, setOpDetails] = useState(null);
  const [loadingOpDetails, setLoadingOpDetails] = useState(false);

  const handleOpenOPDetails = async (log) => {
    if (!log.action?.includes('INGRESO_OP')) return;
    setSelectedOPLog(log);
    setLoadingOpDetails(true);
    setOpDetails(null);
    try {
      // 1. Fetch Order
      const qOrder = query(collection(db, 'Orders'), where('data.batchInternal', '==', log.batchInternal));
      const snapOrder = await getDocs(qOrder);
      
      // 2. Fetch Granel from Inventory
      const qInv = query(collection(db, 'Inventory'), where('batchInternal', '==', log.batchInternal), where('stockType', '==', 'GRANEL'));
      const snapInv = await getDocs(qInv);
      
      let orderData = snapOrder.empty ? null : snapOrder.docs[0].data();
      let invData = snapInv.empty ? null : snapInv.docs[0].data();
      
      setOpDetails({
        ingredients: orderData?.data?.actualIngredients || orderData?.data?.ingredients || [],
        ph: invData?.measuredPh || orderData?.data?.ph || 'Pendiente BBS',
        density: invData?.measuredDensity || orderData?.data?.density || 'Pendiente BBS'
      });
    } catch (e) {
      console.error(e);
      alert("Error cargando detalles");
    } finally {
      setLoadingOpDetails(false);
    }
  };

  useEffect(() => {
    // Escucha en tiempo real de la colección AuditLog
    const q = query(collection(db, 'AuditLog'), orderBy('timestamp', 'desc'), limit(300)); // Ampliamos límite para ver más meses
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logDocs = snapshot.docs.map(doc => {
        const data = doc.data();
        const dateObj = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
        const monthYear = dateObj.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
        
        return {
          id: doc.id,
          ...data,
          dateObj,
          monthYear,
          // Manejo seguro de fechas de Firestore
          formattedDate: dateObj.toLocaleString()
        };
      });
      setHistory(logDocs);
      setLoading(false);
    }, (error) => {
      console.error("Error al traer historial de auditoría:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Función MOTOR DE COLORES sincronizada con nuestro sistema
  const getActionTheme = (action = '') => {
    const act = action.toUpperCase();
    
    if (act.includes('INGRESO') || act.includes('CARGA')) {
      return { color: '#10b981', bg: '#ecfdf5', icon: ArrowDownToLine }; // Verde
    }
    if (act.includes('EGRESO') || act.includes('RETIRO') || act.includes('CONSUMO')) {
      return { color: '#ef4444', bg: '#fef2f2', icon: ArrowUpFromLine }; // Rojo
    }
    if (act.includes('CLEARING') || act.includes('TRANSFERENCIA')) {
      return { color: '#3b82f6', bg: '#eff6ff', icon: ArrowRightLeft }; // Azul
    }
    if (act.includes('PRODUCCION') || act.includes('ENVASADO')) {
      return { color: '#f59e0b', bg: '#fffbeb', icon: Activity }; // Naranja
    }
    
    return { color: '#64748b', bg: '#f1f5f9', icon: Clock }; // Gris por defecto
  };

  const filteredHistory = history.filter(item => {
    if (activeFilter === 'ALL') return true;
    const act = (item.action || '').toUpperCase();
    
    if (activeFilter === 'MP') return act.includes('INGRESO_COMPRA') || act.includes('INGRESO_MANUAL') || act.includes('CARGA_INICIAL');
    if (activeFilter === 'OP') return act.includes('OP') || act.includes('PRODUCCION');
    if (activeFilter === 'OE') return act.includes('OE') || act.includes('ENVASADO') || act.includes('CONSUMO');
    if (activeFilter === 'OD') return act.includes('EGRESO_DESPACHO') || act.includes('RETIRO') || act.includes('OD');
    
    return true;
  });

  // AGRUPACIÓN POR MES
  const groupedData = filteredHistory.reduce((acc, item) => {
    if (!acc[item.monthYear]) {
      acc[item.monthYear] = [];
    }
    acc[item.monthYear].push(item);
    return acc;
  }, {});

  const sections = Object.keys(groupedData).map(key => ({
    title: key,
    data: groupedData[key]
  }));

  // Expandir automáticamente el primer mes al cargar si no hay nada expandido
  useEffect(() => {
    if (sections.length > 0 && Object.keys(expandedMonths).length === 0) {
      setExpandedMonths({ [sections[0].title]: true });
    }
  }, [sections, expandedMonths]);

  const toggleMonth = (month) => {
    setExpandedMonths(prev => ({
      ...prev,
      [month]: !prev[month]
    }));
  };

  const handleExportPDF = async (monthTitle, monthData) => {
    try {
      setGeneratingPdfFor(monthTitle);
      
      const filterLabel = FILTER_TABS.find(t => t.id === activeFilter)?.label || 'Todos';
      
      // 1. Obtener auditoría de IA
      const aiSummary = await generateAuditSummary(monthData, filterLabel, monthTitle);
      
      // 2. Generar y compartir PDF
      await generateAndSharePDF(monthTitle, filterLabel, aiSummary, monthData);
      
    } catch (error) {
      alert("Hubo un error al generar el PDF. Revisa tu conexión a internet.");
      console.error(error);
    } finally {
      setGeneratingPdfFor(null);
    }
  };

  const renderLog = (item, isLast) => {
    const theme = getActionTheme(item.action);
    const IconComponent = theme.icon;
    const isNegative = Number(item.quantity) < 0;

    return (
      <TouchableOpacity 
        style={styles.logCard} 
        key={item.id}
        activeOpacity={item.action?.includes('INGRESO_OP') ? 0.7 : 1}
        onPress={() => item.action?.includes('INGRESO_OP') && handleOpenOPDetails(item)}
      >
        <View style={styles.logLeft}>
          {!isLast && <View style={styles.timelineLine} />}
          <View style={[styles.iconBox, { backgroundColor: theme.bg, borderColor: theme.color }]}>
            <IconComponent color={theme.color} size={16} />
          </View>
        </View>

        <View style={styles.logRight}>
          <View style={styles.logHeader}>
            <Text style={[styles.logAction, { color: theme.color, flexShrink: 1, marginRight: 8 }]} numberOfLines={2}>{item.action?.replace(/_/g, ' ')}</Text>
            <Text style={[styles.logDate, { flexShrink: 0 }]}>{item.formattedDate}</Text>
          </View>

          <View style={styles.logBody}>
            <View style={{ flex: 1 }}>
              <Text style={styles.logItemName}>{item.itemName || 'Producto no especificado'}</Text>
              <Text style={styles.logCompany}>{item.company || 'Global'}</Text>
            </View>
            <View style={styles.qtyBox}>
              <Text style={[styles.logQty, { color: isNegative ? '#ef4444' : '#0f172a' }]}>
                {isNegative ? '' : '+'}{item.quantity} <Text style={styles.logUnit}>{item.unit || 'Uds'}</Text>
              </Text>
            </View>
          </View>

          <View style={styles.logFooter}>
            <View style={styles.userRow}>
              <User color="#94a3b8" size={12} />
              <Text style={styles.logUser} numberOfLines={1}>{item.user || 'Sistema'}</Text>
            </View>
            
            <View style={{alignItems: 'flex-end', flexShrink: 1, marginLeft: 8}}>
               {item.batchInternal && <Text style={styles.logBatch} numberOfLines={2}>Lote Int: {item.batchInternal}</Text>}
               {item.loteProveedor && <Text style={[styles.logBatch, {marginTop: 4, backgroundColor: '#fef3c7', color: '#b45309'}]} numberOfLines={2}>Lote Prov: {item.loteProveedor}</Text>}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = ({ item: section }) => {
    const isExpanded = expandedMonths[section.title];
    
    return (
      <View style={styles.sectionContainer}>
        <TouchableOpacity 
          style={styles.monthHeader} 
          onPress={() => toggleMonth(section.title)}
          activeOpacity={0.7}
        >
          <Text style={styles.monthTitle}>{section.title}</Text>
          <View style={styles.monthBadge}>
            <Text style={styles.monthBadgeText}>{section.data.length} reg.</Text>
            {isExpanded ? <ChevronUp color="#64748b" size={20} /> : <ChevronDown color="#64748b" size={20} />}
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.monthContent}>
            
            {/* Botón de Exportar a PDF */}
            <TouchableOpacity 
              style={styles.pdfButton}
              onPress={() => handleExportPDF(section.title, section.data)}
              disabled={generatingPdfFor === section.title}
            >
              {generatingPdfFor === section.title ? (
                <>
                  <ActivityIndicator size="small" color="#fff" style={{marginRight: 8}} />
                  <Text style={styles.pdfButtonText}>Auditando con IA y Generando PDF...</Text>
                </>
              ) : (
                <>
                  <FileText color="#fff" size={16} style={{marginRight: 8}} />
                  <Text style={styles.pdfButtonText}>Exportar Reporte PDF</Text>
                </>
              )}
            </TouchableOpacity>

            {section.data.map((log, index) => renderLog(log, index === section.data.length - 1))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      {/* HEADER ENTERPRISE (Tono oscuro para la bóveda) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))} style={styles.backBtn}>
          <ChevronLeft color="#f8fafc" size={28} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Auditoría Inalterable</Text>
          <Text style={styles.headerSub}>Registro de Movimientos Globales</Text>
        </View>
        <Filter color="#475569" size={24} style={{ marginRight: 5 }} />
      </View>

      <View style={styles.container}>
        
        {/* TABS DE FILTRO */}
        <View style={styles.filterContainer}>
          <ScrollView maximumZoomScale={1} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {FILTER_TABS.map(tab => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.filterTab, activeFilter === tab.id && styles.filterTabActive]}
                onPress={() => setActiveFilter(tab.id)}
              >
                <Text style={[styles.filterTabText, activeFilter === tab.id && styles.filterTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#0f172a" />
            <Text style={styles.loadingText}>Desencriptando registros...</Text>
          </View>
        ) : (
          <FlatList maximumZoomScale={1}
            data={sections}
            keyExtractor={item => item.title}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={renderSection}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Clock color="#cbd5e1" size={48} />
                <Text style={styles.emptyText}>No se encontraron registros para este filtro.</Text>
              </View>
            }
          />
        )}
      </View>

      {/* MODAL DETALLES DE OP */}
      <Modal visible={!!selectedOPLog} transparent animationType="slide" onRequestClose={() => setSelectedOPLog(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalles de OP Completada</Text>
              <TouchableOpacity onPress={() => setSelectedOPLog(null)}>
                <X color="#64748b" size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{padding: 20}}>
               <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15}}>
                 <View>
                   <Text style={{fontSize: 12, color: '#64748b'}}>Lote OP</Text>
                   <Text style={{fontSize: 16, fontWeight: '900', color: '#0f172a'}}>{selectedOPLog?.batchInternal}</Text>
                 </View>
                 <View style={{alignItems: 'flex-end'}}>
                   <Text style={{fontSize: 12, color: '#64748b'}}>Fecha</Text>
                   <Text style={{fontSize: 14, fontWeight: '700', color: '#334155'}}>{selectedOPLog?.formattedDate}</Text>
                 </View>
               </View>

               <View style={{backgroundColor: '#f1f5f9', padding: 15, borderRadius: 12, marginBottom: 20}}>
                 <Text style={{fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: '800'}}>Producto</Text>
                 <Text style={{fontSize: 18, fontWeight: '900', color: '#3b82f6', marginBottom: 5}}>{selectedOPLog?.itemName}</Text>
                 <Text style={{fontSize: 14, color: '#475569'}}>Cantidad Producida: <Text style={{fontWeight: '800', color: '#0f172a'}}>{selectedOPLog?.quantity} {selectedOPLog?.unit}</Text></Text>
                 <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 5}}>
                   <User size={14} color="#64748b" />
                   <Text style={{fontSize: 12, color: '#64748b'}}>{selectedOPLog?.user}</Text>
                 </View>
               </View>

               {loadingOpDetails ? (
                 <View style={{padding: 30, alignItems: 'center'}}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={{marginTop: 10, color: '#64748b'}}>Cargando auditoría de materias primas...</Text>
                 </View>
               ) : (
                 <>
                   <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20}}>
                     <View style={{flex: 1, backgroundColor: '#eff6ff', padding: 12, borderRadius: 10, marginRight: 10, borderWidth: 1, borderColor: '#bfdbfe'}}>
                        <Text style={{fontSize: 11, color: '#1e40af', fontWeight: '800'}}>DENSIDAD (BBS)</Text>
                        <Text style={{fontSize: 16, fontWeight: '900', color: '#1e3a8a'}}>{opDetails?.density || '-'}</Text>
                     </View>
                     <View style={{flex: 1, backgroundColor: '#eff6ff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#bfdbfe'}}>
                        <Text style={{fontSize: 11, color: '#1e40af', fontWeight: '800'}}>pH (BBS)</Text>
                        <Text style={{fontSize: 16, fontWeight: '900', color: '#1e3a8a'}}>{opDetails?.ph || '-'}</Text>
                     </View>
                   </View>

                   <Text style={{fontSize: 14, fontWeight: '800', color: '#334155', marginBottom: 10, textTransform: 'uppercase'}}>Materias Primas Consumidas</Text>
                   {opDetails?.ingredients?.length > 0 ? opDetails.ingredients.map((ing, idx) => {
                     const batches = ing.batchesToConsume?.map(b => b.batchProvider && b.batchProvider !== 'S/D' && b.batchProvider !== 'S/L' ? `${b.batchInternal} (${b.batchProvider})` : b.batchInternal).join(' | ') || 'S/L';
                     return (
                       <View key={idx} style={{backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0'}}>
                         <Text style={{fontSize: 14, fontWeight: '800', color: '#0f172a'}}>{ing.name}</Text>
                         <Text style={{fontSize: 13, color: '#10b981', fontWeight: '700', marginTop: 2}}>Uso Real: {ing.actualQty !== undefined ? ing.actualQty.toFixed(2) : (ing.required || 0).toFixed(2)} Kg/L</Text>
                         <Text style={{fontSize: 11, color: '#64748b', marginTop: 4}}>Lotes: {batches}</Text>
                       </View>
                     )
                   }) : (
                     <Text style={{color: '#94a3b8', fontStyle: 'italic', marginBottom: 20}}>No hay detalle de ingredientes disponible.</Text>
                   )}
                 </>
               )}
               <View style={{height: 40}} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#0f172a',
    zIndex: 10
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#f8fafc' },
  headerSub: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  
  container: { flex: 1, backgroundColor: '#f8fafc', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#f8fafc', borderRadius: 16, overflow: 'hidden', elevation: 10, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },

  filterContainer: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#f8fafc', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  filterScroll: { paddingHorizontal: 15, paddingVertical: 12, gap: 8 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  filterTabActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  filterTabText: { fontSize: 12, fontWeight: '800', color: '#64748b' },
  filterTabTextActive: { color: '#fff' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 15, color: '#475569', fontWeight: '700', fontSize: 13 },
  
  list: { paddingHorizontal: 20, paddingBottom: 50, paddingTop: 15 },
  
  sectionContainer: { marginBottom: 15 },
  monthHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    backgroundColor: '#fff', padding: 15, borderRadius: 16, 
    borderWidth: 1, borderColor: '#e2e8f0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5
  },
  monthTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a', letterSpacing: 0.5 },
  monthBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthBadgeText: { fontSize: 12, color: '#64748b', marginRight: 5, fontWeight: '600' },
  monthContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  
  pdfButton: {
    backgroundColor: '#004ca8',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#004ca8',
    shadowOpacity: 0.3,
    shadowRadius: 5
  },
  pdfButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },

  logCard: { flexDirection: 'row', marginBottom: 15 },
  logLeft: { width: 30, alignItems: 'center', marginRight: 10 },
  timelineLine: { position: 'absolute', top: 30, bottom: -20, width: 2, backgroundColor: '#e2e8f0' },
  iconBox: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, marginTop: 10, zIndex: 2 },
  
  logRight: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 15, marginTop: 10, marginBottom: 5, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  logAction: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  logDate: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  
  logBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  logItemName: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  logCompany: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase' },
  qtyBox: { backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  logQty: { fontSize: 16, fontWeight: '900' },
  logUnit: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  
  logFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  logUser: { fontSize: 11, color: '#64748b', fontStyle: 'italic', fontWeight: '500', flexShrink: 1 },
  logBatch: { fontSize: 10, color: '#94a3b8', fontWeight: '800', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, textAlign: 'right' },

  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyText: { marginTop: 15, color: '#94a3b8', fontWeight: '600', fontSize: 13 }
});