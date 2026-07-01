import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, StatusBar, useWindowDimensions, Modal, Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../config/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import {
  LogOut, FlaskConical, ClipboardCheck,
  ChevronRight, Clock, Sparkles, Calculator,
  UserCheck, BrainCircuit, ShieldAlert, ArrowRightLeft,
  Database, Keyboard
} from 'lucide-react-native';

export default function HomeScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [criticalItems, setCriticalItems] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [mpModalVisible, setMpModalVisible] = useState(false);
  const companies = ["H2Ocontrol", "WaterDay", "Alianza", "Agrocube", "BioAcker", "AgroFontezuela"];

  const currentUserEmail = auth.currentUser?.email || 'Usuario';

  useEffect(() => {
    const q = query(collection(db, "Inventory"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => doc.data());
      const alerts = items.filter(item => item.quantity <= (item.minStock || 100));

      const uniqueNames = [...new Set(alerts.map(item => item.itemName))];
      setCriticalItems(uniqueNames);
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
            <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.userMail} numberOfLines={1}>{currentUserEmail}</Text>
          </View>
        </View>

        {/* PANEL DE ACCESO RÁPIDO */}
        <View style={styles.headerButtons}>
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

        {/* INVENTARIO GENERAL */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inventario General</Text>
          
          <TouchableOpacity 
            style={[styles.companyCard, { borderColor: '#3b82f6', backgroundColor: '#eff6ff', paddingVertical: 15, marginBottom: 10 }]} 
            activeOpacity={0.8}
            onPress={() => navigation.navigate('StockView', { companyName: 'STOCK_CENTRAL_MP', stockType: 'MP', title: 'Materia Prima General' })}
          >
            <View style={[styles.companyNameBox, { backgroundColor: '#3b82f6', alignItems: 'center' }]}>
              <Text style={[styles.companyNameText, { color: '#fff' }]}>STOCK MATERIA PRIMA GRAL</Text>
            </View>
            <ChevronRight color="#3b82f6" size={24} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.companyCard, { borderColor: '#8b5cf6', backgroundColor: '#f5f3ff', paddingVertical: 15, marginBottom: 15 }]} 
            activeOpacity={0.8}
            onPress={() => navigation.navigate('StockView', { companyName: 'STOCK_CENTRAL_INSUMOS', stockType: 'INSUMOS', title: 'Inventario General de Insumos' })}
          >
            <View style={[styles.companyNameBox, { backgroundColor: '#8b5cf6', alignItems: 'center' }]}>
              <Text style={[styles.companyNameText, { color: '#fff' }]}>STOCK GENERAL DE INSUMOS</Text>
            </View>
            <ChevronRight color="#8b5cf6" size={24} />
          </TouchableOpacity>
        </View>

        {/* 1. UNIDADES DE NEGOCIO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clientes</Text>
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

        {/* 2. PLANTA Y LABORATORIO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Planta y Calidad</Text>

          <TouchableOpacity activeOpacity={0.8} style={styles.labCard} onPress={() => navigation.navigate('Formulation')}>
            <View style={styles.labIconBox}>
              <FlaskConical color="#8b5cf6" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.labCardTitle}>H2O Laboratorio</Text>
              <Text style={styles.labCardSub}>Catálogo de Fórmulas Maestras</Text>
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

            <TouchableOpacity style={styles.qualityCard} onPress={() => navigation.navigate('StaffAttendance')}>
              <View style={[styles.qualityIconBox, { backgroundColor: '#f0f9ff' }]}>
                <UserCheck color="#0ea5e9" size={24} />
              </View>
              <Text style={styles.qualityCardText}>Tótem Asistencia</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. LOGÍSTICA TRANSVERSAL Y HERRAMIENTAS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Funciones Extras</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.adminSmallCard} onPress={() => navigation.navigate('QuarterlyCalculator')}>
              <Calculator color="#334155" size={20} />
              <Text style={styles.adminSmallCardText}>Calculadora</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* FAB: INGRESO GLOBAL DE MP */}
      <TouchableOpacity
        style={styles.fabAiButton}
        activeOpacity={0.9}
        onPress={() => setMpModalVisible(true)}
      >
        <Database color="#fff" size={20} />
        <Text style={styles.fabAiText}>CARGAR MP</Text>
      </TouchableOpacity>

      {/* MODAL GLOBAL MP */}
      <Modal
        visible={mpModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMpModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMpModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ingreso Global de Stock</Text>
            <Text style={styles.modalSub}>Selecciona cómo deseas ingresar la materia prima.</Text>

            <TouchableOpacity
              style={styles.modalBtnPrimary}
              onPress={() => {
                setMpModalVisible(false);
                navigation.navigate('SmartAICargo', { companyName: 'STOCK_CENTRAL_MP' });
              }}
            >
              <Sparkles color="#fff" size={20} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.modalBtnPrimaryText}>Ingreso Inteligente (IA)</Text>
                <Text style={styles.modalBtnPrimarySub}>Pegar texto, lista o usar cámara</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalBtnSecondary}
              onPress={() => {
                setMpModalVisible(false);
                navigation.navigate('IncomingInventory', { companyName: 'STOCK_CENTRAL_MP' });
              }}
            >
              <Keyboard color="#0f172a" size={20} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.modalBtnSecondaryText}>Carga Manual</Text>
                <Text style={styles.modalBtnSecondarySub}>Ingresar items uno por uno</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

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

  topScanCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 18, elevation: 2, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  scanIconContainer: { backgroundColor: '#3b82f6', padding: 10, borderRadius: 12, marginRight: 12 },
  scanCardTitle: { color: '#0f172a', fontSize: 14, fontWeight: '800' },
  scanCardSub: { color: '#64748b', fontSize: 11, marginTop: 2 },

  section: { marginBottom: 25 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, marginLeft: 5 },

  systemAlertBanner: { backgroundColor: '#fef2f2', flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#fca5a5', elevation: 1 },
  alertIconBox: { backgroundColor: '#fee2e2', padding: 8, borderRadius: 12, marginRight: 15 },
  alertTitle: { fontSize: 14, color: '#b91c1c', fontWeight: '800' },
  alertSub: { fontSize: 11, color: '#dc2626', marginTop: 2, fontWeight: '600', lineHeight: 16 },

  grid: { gap: 10 },
  gridLandscape: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },

  companyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 10, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  cardLandscape: { width: '48.5%' },
  companyNameBox: { flex: 1, backgroundColor: '#ecfdf5', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginRight: 10, alignItems: 'flex-start' },
  companyNameText: { fontSize: 14, fontWeight: '900', color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.5 },

  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  qualityCard: { flex: 1, backgroundColor: '#fff', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', gap: 12, elevation: 1 },
  qualityIconBox: { padding: 12, borderRadius: 14 },
  qualityCardText: { fontWeight: '800', fontSize: 13, color: '#334155' },

  labCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1, marginBottom: 12 },
  labIconBox: { backgroundColor: '#f5f3ff', padding: 12, borderRadius: 14, marginRight: 15 },
  labCardTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  labCardSub: { fontSize: 11, color: '#64748b', marginTop: 2 },

  adminSmallCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', gap: 12, elevation: 1 },
  adminSmallCardText: { color: '#334155', fontSize: 13, fontWeight: '800' },

  // FAB TRASLÚCIDO Y MÁGICO (Reubicado y sin robot)
  fabAiButton: {
    position: 'absolute',
    right: 20,
    bottom: 45, // Más arriba para esquivar el notch/barras de navegación de Android/iOS
    backgroundColor: 'rgba(15, 23, 42, 0.85)', // Cristal oscuro traslúcido
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)', // Borde de cristal
    elevation: 8,
    gap: 8,
    shadowColor: '#3b82f6', // Resplandor azul mágico
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 15
  },
  fabAiText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 0.5
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 5,
    textAlign: 'center'
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 25
  },
  modalBtnPrimary: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12
  },
  modalBtnPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800'
  },
  modalBtnPrimarySub: {
    color: '#bfdbfe',
    fontSize: 11,
    marginTop: 2
  },
  modalBtnSecondary: {
    backgroundColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  modalBtnSecondaryText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800'
  },
  modalBtnSecondarySub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2
  }
});