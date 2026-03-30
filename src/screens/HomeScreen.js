import React, { useState, useEffect } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, StyleSheet, 
  Alert, Dimensions, StatusBar, useWindowDimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { db, auth } from '../config/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { 
  LogOut, FlaskConical, ClipboardCheck, Droplets, 
  ChevronRight, Clock, Sparkles, Calculator, QrCode, Printer,
  UserCheck // <--- Nuevo icono para el Tótem
} from 'lucide-react-native';

const ADMIN_EMAIL = "miguesilva.1985@outlook.es";

export default function HomeScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height; 
  
  const [criticalCount, setCriticalCount] = useState(0);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const companies = ["H2Ocontrol", "WaterDay", "Alianza", "Agrocube", "BioAcker"];
  
  const isAdmin = auth.currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    const q = query(collection(db, "Inventory"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => doc.data());
      const alerts = items.filter(item => item.quantity <= (item.minStock || 100));
      setCriticalCount(alerts.length);
      setLoadingAlerts(false);
    }, (error) => {
      console.error("Error en Firebase:", error);
      setLoadingAlerts(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogOut = () => {
    Alert.alert("Cerrar Sesión", "¿Deseas salir de H2O Control?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: 'destructive', onPress: () => auth.signOut().then(() => navigation.replace('Login')) }
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.welcome}>Panel H2O</Text>
            <Text style={styles.userMail} numberOfLines={1}>{auth.currentUser?.email}</Text>
          </View>
          
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              activeOpacity={0.7}
              style={[styles.actionBtn, { backgroundColor: '#f0f4f2' }]} 
              onPress={() => navigation.navigate('History')}
            >
              <Clock color="#2e4a3b" size={22} />
            </TouchableOpacity>

            <TouchableOpacity 
              activeOpacity={0.7}
              style={[styles.actionBtn, { backgroundColor: '#fff0f0' }]} 
              onPress={handleLogOut}
            >
              <LogOut color="#ff4444" size={22} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ALERTA DE STOCK */}
        {!loadingAlerts && criticalCount > 0 && (
          <TouchableOpacity 
            activeOpacity={0.9}
            style={styles.aiBanner}
            onPress={() => navigation.navigate('QuarterlyCalculator')}
          >
            <View style={styles.alertCircle}>
               <Sparkles color="#fff" size={14} />
            </View>
            <Text style={styles.aiBannerText}>
              {criticalCount} insumos críticos detectados.
            </Text>
            <ChevronRight color="#2e4a3b" size={14} />
          </TouchableOpacity>
        )}

        {/* SECCIÓN ADMIN: IA Y GESTIÓN */}
        {isAdmin && (
          <View style={styles.adminSection}>
            <Text style={styles.sectionTitle}>Gestión Maestra</Text>
            
            <TouchableOpacity 
              activeOpacity={0.8}
              style={styles.adminCard}
              onPress={() => navigation.navigate('SmartAICargo')}
            >
              <View style={styles.aiIconContainer}>
                <Sparkles color="#fff" size={24} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminCardTitle}>Carga Inteligente IA</Text>
                <Text style={styles.adminCardSub}>Procesar remitos con OpenAI</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.5)" size={20} />
            </TouchableOpacity>

            <View style={styles.adminRow}>
                <TouchableOpacity 
                    style={[styles.adminSmallCard, { backgroundColor: '#4a6b5a' }]}
                    onPress={() => navigation.navigate('QuarterlyCalculator')}
                >
                    <Calculator color="#fff" size={18} />
                    <Text style={styles.adminSmallCardText}>Reposición</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.adminSmallCard, { backgroundColor: '#2e4a3b' }]}
                    onPress={() => navigation.navigate('QRGenerator', { manual: true })}
                >
                    <Printer color="#fff" size={18} />
                    <Text style={styles.adminSmallCardText}>Generar QR</Text>
                </TouchableOpacity>
            </View>
          </View>
        )}

        {/* NUEVA SECCIÓN: CONTROL DE PLANTA (TÓTEM) */}
        <Text style={styles.sectionTitle}>Control de Planta</Text>
        <TouchableOpacity 
          activeOpacity={0.8}
          style={[styles.attendanceBtn, isLandscape && { width: '48.5%' }]}
          onPress={() => navigation.navigate('StaffAttendance')}
        >
          <View style={styles.attendanceIconBox}>
            <UserCheck color="#fff" size={28} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.attendanceTitle}>Tótem de Asistencia</Text>
            <Text style={styles.attendanceSub}>Registrar Ingreso / Egreso</Text>
          </View>
          <ChevronRight color="#2e4a3b" size={18} />
        </TouchableOpacity>

        {/* UNIDADES DE NEGOCIO (ADAPTATIVO) */}
        <Text style={styles.sectionTitle}>Unidades de Negocio</Text>
        <View style={[styles.grid, isLandscape && styles.gridLandscape]}>
          {companies.map((company) => (
            <TouchableOpacity 
              key={company} 
              activeOpacity={0.6}
              style={[styles.card, isLandscape && styles.cardLandscape]} 
              onPress={() => navigation.navigate('CompanyDetail', { companyName: company })}
            >
              <View style={styles.iconContainer}>
                <Droplets color="#2e4a3b" size={20} />
              </View>
              <Text style={styles.cardText}>{company}</Text>
              <ChevronRight color="#ccc" size={16} />
            </TouchableOpacity>
          ))}
        </View>

        {/* OPERACIONES Y CALIDAD */}
        <Text style={styles.sectionTitle}>Operaciones y Calidad</Text>
        <View style={styles.row}>
          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: '#f1f8f4' }]}
            onPress={() => navigation.navigate('TraceabilityScanner')}
          >
            <QrCode color="#2e4a3b" size={24} />
            <Text style={styles.menuItemText}>Auditar QR</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: '#fff9e6' }]}
            onPress={() => navigation.navigate('QualityControl')}
          >
            <ClipboardCheck color="#ffb300" size={24} />
            <Text style={styles.menuItemText}>BBS (Calidad)</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          activeOpacity={0.8}
          style={[styles.menuItem, { backgroundColor: '#edf2ff', width: '100%', flexDirection: 'row', justifyContent: 'center' }]}
          onPress={() => navigation.navigate('Formulation')}
        >
          <FlaskConical color="#4466ff" size={22} />
          <Text style={[styles.menuItemText, { marginLeft: 10 }]}>H2O (Fórmulas de Laboratorio)</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  welcome: { fontSize: 28, fontWeight: '900', color: '#1a1a1a', letterSpacing: -0.5 },
  userMail: { fontSize: 13, color: '#888', marginTop: -2 },
  headerButtons: { flexDirection: 'row', gap: 10 },
  actionBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  aiBanner: {
    backgroundColor: '#e8f5e9',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#c8e6c9',
    gap: 12
  },
  alertCircle: { backgroundColor: '#2e4a3b', padding: 6, borderRadius: 20 },
  aiBannerText: { flex: 1, fontSize: 14, color: '#2e4a3b', fontWeight: '700' },
  sectionTitle: { fontSize: 19, fontWeight: '800', marginBottom: 15, marginTop: 15, color: '#222' },
  
  // BOTÓN ASISTENCIA (ESTILO NUEVO)
  attendanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    marginBottom: 10
  },
  attendanceIconBox: { backgroundColor: '#2e4a3b', padding: 12, borderRadius: 15, marginRight: 15 },
  attendanceTitle: { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
  attendanceSub: { fontSize: 12, color: '#666' },

  // GRID ADAPTATIVO
  grid: { gap: 10 },
  gridLandscape: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    padding: 16, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#f0f0f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  cardLandscape: {
    width: '48.5%', 
    marginBottom: 5,
  },

  iconContainer: { backgroundColor: '#f1f8f4', padding: 8, borderRadius: 10, marginRight: 15 },
  cardText: { flex: 1, fontSize: 16, fontWeight: '700', color: '#333' },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  menuItem: { 
    flex: 1, 
    paddingVertical: 20, 
    borderRadius: 20, 
    alignItems: 'center', 
    gap: 8,
    elevation: 2
  },
  menuItemText: { fontWeight: '800', fontSize: 14, color: '#444' },
  adminSection: { marginBottom: 5 },
  adminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2e4a3b', 
    padding: 20,
    borderRadius: 22,
    elevation: 4
  },
  aiIconContainer: { backgroundColor: 'rgba(255,255,255,0.15)', padding: 10, borderRadius: 12, marginRight: 15 },
  adminCardTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  adminCardSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  adminRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  adminSmallCard: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 16, 
    borderRadius: 16, 
    gap: 8,
    elevation: 2
  },
  adminSmallCardText: { color: '#fff', fontSize: 14, fontWeight: '700' }
});