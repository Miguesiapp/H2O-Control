import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../config/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { ChevronLeft, Clock, ArrowDownToLine, ArrowUpFromLine, Activity, User } from 'lucide-react-native';

const ADMIN_EMAILS = ['miguesilva.1985@outlook.es', 'bduville@h2ocontrol.com.ar'];

export default function HistoryScreen({ navigation }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Verificamos si es administrador
  const isAuthorized = ADMIN_EMAILS.includes(auth.currentUser?.email?.toLowerCase() || '');

  useEffect(() => {
    // Escucha en tiempo real de la colección correcta: AuditLog
    const q = query(collection(db, 'AuditLog'), orderBy('timestamp', 'desc'), limit(100));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logDocs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Manejo seguro de fechas de Firestore
          formattedDate: data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString() : 'Fecha Pendiente'
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

  // Función para determinar el color e icono según la acción
  const getActionTheme = (action = '') => {
    if (action.includes('INGRESO')) return { color: '#10b981', bg: '#ecfdf5', icon: ArrowDownToLine };
    if (action.includes('EGRESO') || action.includes('RETIRO')) return { color: '#ef4444', bg: '#fef2f2', icon: ArrowUpFromLine };
    if (action.includes('PRODUCCION') || action.includes('ENVASADO')) return { color: '#f59e0b', bg: '#fffbeb', icon: Activity };
    return { color: '#64748b', bg: '#f1f5f9', icon: Clock };
  };

  const renderLog = ({ item }) => {
    const theme = getActionTheme(item.action);
    const IconComponent = theme.icon;
    const isNegative = Number(item.quantity) < 0;

    return (
      <View style={styles.logCard}>
        <View style={styles.logLeft}>
          <View style={styles.timelineLine} />
          <View style={[styles.iconBox, { backgroundColor: theme.bg, borderColor: theme.color }]}>
            <IconComponent color={theme.color} size={16} />
          </View>
        </View>

        <View style={styles.logRight}>
          <View style={styles.logHeader}>
            <Text style={[styles.logAction, { color: theme.color }]}>{item.action?.replace(/_/g, ' ')}</Text>
            <Text style={styles.logDate}>{item.formattedDate}</Text>
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
              <Text style={styles.logUser}>{item.user}</Text>
            </View>
            <Text style={styles.logBatch}>Lote: {item.batchInternal || 'N/A'}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      {/* HEADER ENTERPRISE (Tono oscuro para la bóveda) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#f8fafc" size={28} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Auditoría Inalterable</Text>
          <Text style={styles.headerSub}>Registro de Movimientos Globales</Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.container}>
        <View style={styles.infoBanner}>
          <Text style={styles.bannerText}>
            Últimos 100 movimientos de la planta. Para un análisis detallado o impresión de PDF, utilice el <Text style={{fontWeight: '800'}}>Centro de Inteligencia</Text>.
          </Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#0f172a" />
            <Text style={styles.loadingText}>Desencriptando registros...</Text>
          </View>
        ) : (
          <FlatList
            data={history}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={renderLog}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Clock color="#cbd5e1" size={48} />
                <Text style={styles.emptyText}>No hay registros de auditoría recientes.</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' }, // Fondo oscuro para el header
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#0f172a',
    zIndex: 10
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#f8fafc' },
  headerSub: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  
  container: { flex: 1, backgroundColor: '#f8fafc', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20 },
  
  infoBanner: { backgroundColor: '#e2e8f0', padding: 12, borderRadius: 12, marginHorizontal: 20, marginBottom: 15 },
  bannerText: { color: '#475569', fontSize: 11, textAlign: 'center', lineHeight: 16 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 15, color: '#475569', fontWeight: '700', fontSize: 13 },
  
  list: { paddingHorizontal: 20, paddingBottom: 50 },
  
  // TIMELINE CARD DESIGN
  logCard: { flexDirection: 'row', marginBottom: 5 },
  logLeft: { width: 30, alignItems: 'center', marginRight: 15 },
  timelineLine: { position: 'absolute', top: 30, bottom: -20, width: 2, backgroundColor: '#e2e8f0' },
  iconBox: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, marginTop: 10, zIndex: 2 },
  
  logRight: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 15, marginTop: 10, marginBottom: 5, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5 },
  
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  logAction: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  logDate: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  
  logBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  logItemName: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  logCompany: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase' },
  qtyBox: { backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  logQty: { fontSize: 16, fontWeight: '900' },
  logUnit: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  
  logFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logUser: { fontSize: 11, color: '#64748b', fontStyle: 'italic', fontWeight: '500' },
  logBatch: { fontSize: 10, color: '#94a3b8', fontWeight: '800', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },

  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyText: { marginTop: 15, color: '#94a3b8', fontWeight: '600', fontSize: 13 }
});