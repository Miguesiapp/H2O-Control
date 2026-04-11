import React, { useState, useEffect } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, StyleSheet, 
  Alert, StatusBar, useWindowDimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { db, auth } from '../config/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { 
  LogOut, FlaskConical, ClipboardCheck, 
  ChevronRight, Clock, Sparkles, Calculator, QrCode, Printer,
  UserCheck, BrainCircuit, ShieldAlert, ArrowRightLeft
} from 'lucide-react-native';

// ROLES DE SEGURIDAD
const ADMIN_EMAIL = "miguesilva.1985@outlook.es"; 
const EXECUTIVE_USERS = ['miguesilva.1985@outlook.es', 'bduville@h2ocontrol.com.ar']; 

export default function HomeScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height; 
  
  const [criticalCount, setCriticalCount] = useState(0);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const companies = ["H2Ocontrol", "WaterDay", "Alianza", "Agrocube", "BioAcker", "AgroFontezuela"];
  
  const currentUserEmail = auth.currentUser?.email?.toLowerCase() || '';
  const isAdmin = currentUserEmail === ADMIN_EMAIL.toLowerCase();
  const isExecutive = EXECUTIVE_USERS.includes(currentUserEmail);

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
    Alert.alert("Cerrar Sesión", "¿Deseas desconectar este dispositivo de la red corporativa?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: 'destructive', onPress: () => auth.signOut().then(() => navigation.replace('Login')) }
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER ENTERPRISE */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSup}>SISTEMA OPERATIVO CENTRAL</Text>
          <Text style={styles.welcome}>H2O Control</Text>
          <View style={styles.userBadge}>
            <View style={[styles.statusDot, { backgroundColor: isAdmin ? '#10b981' : '#3b82f6' }]} />
            <Text style={styles.userMail} numberOfLines={1}>{auth.currentUser?.email}</Text>
          </View>
        </View>
        
        {/* PANEL DE ACCESO RÁPIDO */}
        <View style={styles.headerButtons}>
          {isExecutive && (
            <TouchableOpacity 
              activeOpacity={0.7} 
              style={[styles.actionBtn, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]} 
              onPress={() => navigation.navigate('ExecutiveReports')}
            >
              <BrainCircuit color="#3b82f6" size={22} />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity activeOpacity={0.7} style={styles.actionBtn} onPress={() => navigation.navigate('History')}>
            <Clock color="#475569" size={22} />
          </TouchableOpacity>
          
          <TouchableOpacity activeOpacity={0.7} style={styles.actionBtnLogOut} onPress={handleLogOut}>
            <LogOut color="#ef4444" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ALERTA CRÍTICA */}
        {!loadingAlerts && criticalCount > 0 && (
          <TouchableOpacity 
            activeOpacity={0.9}
            style={styles.systemAlertBanner}
            onPress={() => navigation.navigate('QuarterlyCalculator')}
          >
            <View style={styles.alertIconBox}>
               <ShieldAlert color="#ef4444" size={20} />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.alertTitle}>Alerta Operativa</Text>
              <Text style={styles.alertSub}>{criticalCount} insumos bajo el punto de pedido.</Text>
            </View>
            <ChevronRight color="#ef4444" size={18} />
          </TouchableOpacity>
        )}

        {/* 1. FLUJO PRIMARIO: UNIDADES DE NEGOCIO (REDISEÑADO) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Unidades de Negocio (Inventario)</Text>
          <View style={[styles.grid, isLandscape && styles.gridLandscape]}>
            {companies.map((company) => (
              <TouchableOpacity 
                key={company} 
                activeOpacity={0.7} 
                style={[styles.companyCard, isLandscape && styles.cardLandscape]} 
                onPress={() => navigation.navigate('CompanyDetail', { companyName: company })}
              >
                <View style={styles.companyNameBox}>
                  <Text style={styles.companyNameText}>{company}</Text>
                </View>
                <ChevronRight color="#cbd5e1" size={20} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 2. FLUJO SECUNDARIO: CALIDAD Y LABORATORIO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Calidad y Laboratorio</Text>
          
          <TouchableOpacity activeOpacity={0.8} style={styles.labCard} onPress={() => navigation.navigate('Formulation')}>
            <View style={styles.labIconBox}>
              <FlaskConical color="#8b5cf6" size={24} />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.labCardTitle}>H2O Laboratorio</Text>
              <Text style={styles.labCardSub}>Gestión de Recetas Maestras</Text>
            </View>
            <ChevronRight color="#cbd5e1" size={20} />
          </TouchableOpacity>

          <View style={styles.row}>
            <TouchableOpacity style={styles.qualityCard} onPress={() => navigation.navigate('QualityControl')}>
              <View style={[styles.qualityIconBox, { backgroundColor: '#fffbeb' }]}>
                <ClipboardCheck color="#f59e0b" size={24} />
              </View>
              <Text style={styles.qualityCardText}>BBS Calidad</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.qualityCard} onPress={() => navigation.navigate('TraceabilityScanner')}>
              <View style={[styles.qualityIconBox, { backgroundColor: '#f1f5f9' }]}>
                <QrCode color="#475569" size={24} />
              </View>
              <Text style={styles.qualityCardText}>Auditoría QR</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. LOGÍSTICA TRANSVERSAL (CLEARING PARA TODOS) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Logística Transversal</Text>
          <TouchableOpacity 
            activeOpacity={0.8} 
            style={[styles.adminCard, { backgroundColor: '#3b82f6' }]} 
            onPress={() => navigation.navigate('InterCompanyTransfer')}
          >
            <View style={styles.aiIconContainer}>
              <ArrowRightLeft color="#fff" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.adminCardTitle}>Clearing Inter-Empresas</Text>
              <Text style={styles.adminCardSub}>Transferencias y préstamos de stock</Text>
            </View>
            <ChevronRight color="rgba(255,255,255,0.5)" size={20} />
          </TouchableOpacity>
        </View>

        {/* 4. FLUJO LOGÍSTICO: ADMINISTRACIÓN (Solo Migue) */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Administración del Sistema</Text>
            
            <TouchableOpacity activeOpacity={0.8} style={styles.adminCard} onPress={() => navigation.navigate('SmartAICargo')}>
              <View style={styles.aiIconContainer}>
                <Sparkles color="#fff" size={24} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminCardTitle}>Ingreso Inteligente (OCR)</Text>
                <Text style={styles.adminCardSub}>Procesamiento de remitos mediante IA</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.5)" size={20} />
            </TouchableOpacity>

            <View style={styles.row}>
                <TouchableOpacity style={[styles.adminSmallCard, { backgroundColor: '#f1f5f9' }]} onPress={() => navigation.navigate('QuarterlyCalculator')}>
                    <Calculator color="#334155" size={20} />
                    <Text style={styles.adminSmallCardText}>Reposición</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.adminSmallCard, { backgroundColor: '#f1f5f9' }]} onPress={() => navigation.navigate('QRGenerator', { manual: true })}>
                    <Printer color="#334155" size={20} />
                    <Text style={styles.adminSmallCardText}>Etiquetas</Text>
                </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 5. FLUJO DE SOPORTE: PERSONAL */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isAdmin ? '5' : '4'}. Control Operativo</Text>
          <TouchableOpacity activeOpacity={0.8} style={[styles.attendanceBtn, isLandscape && { width: '48.5%' }]} onPress={() => navigation.navigate('StaffAttendance')}>
            <View style={styles.attendanceIconBox}>
              <UserCheck color="#0ea5e9" size={26} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.attendanceTitle}>Tótem de Asistencia</Text>
              <Text style={styles.attendanceSub}>Terminal de ingreso y egreso</Text>
            </View>
            <ChevronRight color="#cbd5e1" size={20} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingHorizontal: 5 },
  headerSup: { fontSize: 10, fontWeight: '800', color: '#64748b', letterSpacing: 1.5, marginBottom: 2 },
  welcome: { fontSize: 26, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  userBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginTop: 5, borderWidth: 1, borderColor: '#e2e8f0' },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  userMail: { fontSize: 11, color: '#475569', fontWeight: '600' },
  headerButtons: { flexDirection: 'row', gap: 8, marginTop: 5 },
  actionBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  actionBtnLogOut: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fee2e2' },
  
  section: { marginBottom: 25 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, marginLeft: 5 },

  systemAlertBanner: { backgroundColor: '#fef2f2', flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 25, borderWidth: 1, borderColor: '#fca5a5', elevation: 1 },
  alertIconBox: { backgroundColor: '#fee2e2', padding: 8, borderRadius: 12, marginRight: 15 },
  alertTitle: { fontSize: 14, color: '#b91c1c', fontWeight: '800' },
  alertSub: { fontSize: 11, color: '#dc2626', marginTop: 2, fontWeight: '500' },

  grid: { gap: 10 },
  gridLandscape: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  
  // UNIDADES DE NEGOCIO (NUEVO DISEÑO CON "CÁPSULAS")
  companyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 10, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  cardLandscape: { width: '48.5%' },
  companyNameBox: { flex: 1, backgroundColor: '#ecfdf5', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginRight: 10, alignItems: 'flex-start' },
  companyNameText: { fontSize: 14, fontWeight: '900', color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.5 },

  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  qualityCard: { flex: 1, backgroundColor: '#fff', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', gap: 12, elevation: 1 },
  qualityIconBox: { padding: 12, borderRadius: 14 },
  qualityCardText: { fontWeight: '800', fontSize: 12, color: '#334155' },
  
  labCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1, marginBottom: 12 },
  labIconBox: { backgroundColor: '#f5f3ff', padding: 12, borderRadius: 14, marginRight: 15 },
  labCardTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  labCardSub: { fontSize: 11, color: '#64748b', marginTop: 2 },

  adminCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', padding: 18, borderRadius: 16, elevation: 3, marginBottom: 12 },
  aiIconContainer: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 14, marginRight: 15 },
  adminCardTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  adminCardSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  adminSmallCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 10 },
  adminSmallCardText: { color: '#334155', fontSize: 12, fontWeight: '800' },

  attendanceBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  attendanceIconBox: { backgroundColor: '#f0f9ff', padding: 12, borderRadius: 14, marginRight: 15 },
  attendanceTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  attendanceSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
});