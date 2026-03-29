import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { db, auth } from '../config/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { 
  LogOut, 
  FlaskConical, 
  ClipboardCheck, 
  Droplets, 
  ChevronRight, 
  Clock, 
  Sparkles, 
  Calculator,
  QrCode,
  Printer // Nuevo icono para generación manual
} from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ADMIN_EMAIL = "miguesilva.1985@outlook.es";

export default function HomeScreen({ navigation }) {
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
    });

    return () => unsubscribe();
  }, []);

  const handleLogOut = () => {
    Alert.alert("Cerrar Sesión", "¿Deseas salir?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", onPress: () => auth.signOut().then(() => navigation.replace('Login')) }
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        bounces={true}
        overScrollMode="always"
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.welcome}>Panel H2O</Text>
            <Text style={styles.userMail} numberOfLines={1}>{auth.currentUser?.email}</Text>
          </View>
          
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#f0f4f2' }]} 
              onPress={() => navigation.navigate('History')}
            >
              <Clock color="#2e4a3b" size={22} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#fff0f0' }]} 
              onPress={handleLogOut}
            >
              <LogOut color="#ff4444" size={22} />
            </TouchableOpacity>
          </View>
        </View>

        {/* BANNER DINÁMICO */}
        {!loadingAlerts && criticalCount > 0 && (
          <TouchableOpacity 
            style={styles.aiBanner}
            onPress={() => navigation.navigate('QuarterlyCalculator')}
          >
            <Sparkles color="#2e4a3b" size={16} />
            <Text style={styles.aiBannerText}>
              {criticalCount} insumos críticos detectados.
            </Text>
            <ChevronRight color="#2e4a3b" size={14} />
          </TouchableOpacity>
        )}

        {/* SECCIÓN ADMIN */}
        {isAdmin && (
          <View style={styles.adminSection}>
            <Text style={styles.sectionTitle}>Gestión Maestra</Text>
            
            <TouchableOpacity 
              style={styles.adminCard}
              onPress={() => navigation.navigate('SmartAICargo')}
            >
              <View style={styles.aiIconContainer}>
                <Sparkles color="#fff" size={24} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminCardTitle}>Carga Inteligente IA</Text>
                <Text style={styles.adminCardSub}>Escanear remitos y fotos</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.5)" size={20} />
            </TouchableOpacity>

            <View style={styles.adminRow}>
                <TouchableOpacity 
                    style={[styles.adminSmallCard, { backgroundColor: '#4a6b5a' }]}
                    onPress={() => navigation.navigate('QuarterlyCalculator')}
                >
                    <Calculator color="#fff" size={20} />
                    <Text style={styles.adminSmallCardText}>Reposición</Text>
                </TouchableOpacity>

                {/* NUEVO: GENERAR QR MANUAL PARA STOCK EXISTENTE */}
                <TouchableOpacity 
                    style={[styles.adminSmallCard, { backgroundColor: '#2e4a3b' }]}
                    onPress={() => navigation.navigate('QRGenerator', { manual: true })}
                >
                    <Printer color="#fff" size={20} />
                    <Text style={styles.adminSmallCardText}>Generar QR</Text>
                </TouchableOpacity>
            </View>
          </View>
        )}

        {/* UNIDADES DE NEGOCIO */}
        <Text style={styles.sectionTitle}>Unidades de Negocio</Text>
        <View style={styles.grid}>
          {companies.map((company) => (
            <TouchableOpacity 
              key={company} 
              style={styles.card} 
              onPress={() => navigation.navigate('CompanyDetail', { companyName: company })}
            >
              <View style={styles.iconContainer}>
                <Droplets color="#2e4a3b" size={22} />
              </View>
              <Text style={styles.cardText}>{company}</Text>
              <ChevronRight color="#ccc" size={16} />
            </TouchableOpacity>
          ))}
        </View>

        {/* AUDITORÍA Y CALIDAD */}
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
          style={[styles.menuItem, { backgroundColor: '#edf2ff', width: '100%', marginBottom: 10 }]}
          onPress={() => navigation.navigate('Formulation')}
        >
          <FlaskConical color="#4466ff" size={24} />
          <Text style={styles.menuItemText}>H2O (Formulación de Productos)</Text>
        </TouchableOpacity>

        {/* Padding final para asegurar que el último item suba del todo */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scrollView: { flex: 1 },
  scrollContent: { 
    paddingHorizontal: 20, 
    paddingTop: 10,
    paddingBottom: 40, 
    flexGrow: 1 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20
  },
  welcome: { fontSize: 26, fontWeight: '900', color: '#1a1a1a' },
  userMail: { fontSize: 13, color: '#666' },
  headerButtons: { flexDirection: 'row', gap: 10 },
  actionBtn: { width: 45, height: 45, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  aiBanner: {
    backgroundColor: '#e8f5e9',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#c8e6c9',
    gap: 10
  },
  aiBannerText: { flex: 1, fontSize: 13, color: '#2e4a3b', fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15, marginTop: 10, color: '#333' },
  grid: { gap: 10 },
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    padding: 18, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#f0f0f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4
  },
  iconContainer: { backgroundColor: '#f1f8f4', padding: 10, borderRadius: 10, marginRight: 15 },
  cardText: { flex: 1, fontSize: 16, fontWeight: '700', color: '#222' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  menuItem: { 
    flex: 1, 
    padding: 20, 
    borderRadius: 18, 
    alignItems: 'center', 
    gap: 10, 
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05
  },
  menuItemText: { fontWeight: '800', fontSize: 13, textAlign: 'center', color: '#444' },
  adminSection: { marginBottom: 10 },
  adminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2e4a3b', 
    padding: 22,
    borderRadius: 20,
    elevation: 5
  },
  aiIconContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    borderRadius: 14,
    marginRight: 15
  },
  adminCardTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  adminCardSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  adminRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  adminSmallCard: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 18, 
    borderRadius: 16, 
    gap: 10,
    elevation: 3
  },
  adminSmallCardText: { color: '#fff', fontSize: 13, fontWeight: '800' }
});