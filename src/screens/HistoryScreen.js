import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../config/firebase';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { ChevronLeft, FileText, AlertCircle } from 'lucide-react-native';
import { generateProfessionalReport } from '../services/reportService';

export default function HistoryScreen({ navigation }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [criticalAlerts, setCriticalAlerts] = useState([]);

  const ADMIN_EMAILS = [
    'miguesilva.1985@outlook.es', 
    'proximamente_dueno@empresa.com' 
  ];

  const isAuthorized = ADMIN_EMAILS.includes(auth.currentUser?.email?.toLowerCase());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Traer Historial de Movimientos
      const qLogs = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(50));
      const logSnapshot = await getDocs(qLogs);
      const logDocs = logSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        formattedDate: doc.data().timestamp?.toDate().toLocaleString() || 'Sin fecha'
      }));
      setHistory(logDocs);

      // 2. Traer Alertas Críticas para el Reporte
      // Buscamos en todo el inventario qué productos están bajo el mínimo
      const qStock = query(collection(db, 'Inventory'));
      const stockSnapshot = await getDocs(qStock);
      const alerts = stockSnapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id }))
        .filter(item => item.quantity <= (item.minStock || 100));
      
      setCriticalAlerts(alerts);
    } catch (error) {
      console.error("Error al traer datos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    const stats = {
      totalIn: history.filter(h => h.action?.includes('INGRESO')).length,
      totalOut: history.filter(h => h.action?.includes('SALIDA') || h.action?.includes('EGRESO')).length,
    };

    const reportData = history.map(h => ({
      timestamp: h.formattedDate,
      action: h.action || 'Movimiento',
      itemName: h.details?.itemName || 'N/A',
      quantity: h.details?.quantity || '0',
      unit: h.details?.unit || '',
      user: h.userEmail || 'Sistema'
    }));

    // Pasamos el nombre de la empresa y las alertas detectadas al servicio
    generateProfessionalReport("H2O CONTROL GLOBAL", reportData, stats, criticalAlerts);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft color="#fff" size={28} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Auditoría Real-Time</Text>
          {criticalAlerts.length > 0 && (
            <View style={styles.alertBadge}>
              <AlertCircle color="#ffeb3b" size={12} />
              <Text style={styles.alertBadgeText}>{criticalAlerts.length} Alertas</Text>
            </View>
          )}
        </View>
        
        {isAuthorized ? (
          <TouchableOpacity onPress={handleExportPDF} style={styles.exportIcon}>
            <FileText color="#fff" size={24} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 28 }} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#ffffff" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.logCard}>
              <View style={styles.logHeader}>
                <Text style={styles.logAction}>{item.action?.replace(/_/g, ' ')}</Text>
                <Text style={styles.logDate}>{item.formattedDate}</Text>
              </View>
              <Text style={styles.logDetails}>
                {item.details?.itemName} - {item.details?.quantity} {item.details?.unit}
              </Text>
              <Text style={styles.logUser}>{item.userEmail}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#2e4a3b' }, // Verde Selva Institucional
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    backgroundColor: '#2e4a3b'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  alertBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  alertBadgeText: { color: '#ffeb3b', fontSize: 10, fontWeight: 'bold' },
  exportIcon: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 },
  list: { padding: 15, backgroundColor: '#f8f9fa', flexGrow: 1 },
  logCard: { 
    backgroundColor: '#fff', 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2e4a3b',
    elevation: 2
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  logAction: { fontWeight: 'bold', color: '#2e4a3b', fontSize: 11, textTransform: 'uppercase' },
  logDate: { fontSize: 10, color: '#999' },
  logDetails: { fontSize: 15, color: '#333', fontWeight: '600', marginVertical: 4 },
  logUser: { fontSize: 11, color: '#888', fontStyle: 'italic' }
});