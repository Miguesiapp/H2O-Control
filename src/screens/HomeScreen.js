import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, StatusBar, useWindowDimensions, Modal, Pressable, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../config/firebase';
import { collection, query, where, getDocs, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { canAccessQualityControl } from '../config/permissions';
import { LogOut, FlaskConical, ClipboardCheck, ChevronRight, Clock, Sparkles, Calculator, UserCheck, Database, Keyboard, Package, Truck, Beaker, Container, Box, MonitorPlay, ShoppingCart, Search } from 'lucide-react-native';

export default function HomeScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [criticalItems, setCriticalItems] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [mpModalVisible, setMpModalVisible] = useState(false);
  const [pendingOPCount, setPendingOPCount] = useState(0);
  const [pendingOECount, setPendingOECount] = useState(0);
  const [pendingODCount, setPendingODCount] = useState(0);
  const [pendingPurchasesCount, setPendingPurchasesCount] = useState(0);
  const [pendingLabCount, setPendingLabCount] = useState(0);
  const currentUserEmail = auth.currentUser?.email || 'Usuario';
  const [currentUserName, setCurrentUserName] = useState(
    auth.currentUser?.displayName
      ? auth.currentUser.displayName.split(' ')[0]
      : currentUserEmail.split('@')[0]
  );

  // AUTO-MIGRACIÓN PARA USUARIOS ANTIGUOS
  useEffect(() => {
    const fetchAndMigrateName = async () => {
      if (auth.currentUser && !auth.currentUser.displayName) {
        try {
          const userDoc = await getDoc(doc(db, "Users", auth.currentUser.uid));
          if (userDoc.exists() && userDoc.data().name) {
            const fullName = userDoc.data().name;
            setCurrentUserName(fullName.split(' ')[0]);
            // Actualizamos silenciosamente el perfil de Auth para futuras sesiones
            await updateProfile(auth.currentUser, { displayName: fullName });
          }
        } catch (error) {
          console.log("No se pudo auto-migrar el nombre:", error);
        }
      }
    };
    fetchAndMigrateName();
  }, []);

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

  useEffect(() => {
    const qOP = query(
      collection(db, "Orders"),
      where("type", "==", "OP"),
      where("status", "in", ["ENVIADO", "EN_PROCESO"])
    );
    const unsubscribeOP = onSnapshot(qOP, (snapshot) => {
      setPendingOPCount(snapshot.docs.length);
    }, (error) => {
      console.error("Error fetching pending OP:", error);
    });

    const qOE = query(
      collection(db, "Orders"),
      where("type", "==", "OE"),
      where("status", "in", ["ENVIADO", "EN_PROCESO"])
    );
    const unsubscribeOE = onSnapshot(qOE, (snapshot) => {
      setPendingOECount(snapshot.docs.length);
    }, (error) => {
      console.error("Error fetching pending OE:", error);
    });

    const qOD = query(
      collection(db, "Orders"),
      where("type", "==", "OD"),
      where("status", "in", ["ENVIADO", "EN_PROCESO"])
    );
    const unsubscribeOD = onSnapshot(qOD, (snapshot) => {
      setPendingODCount(snapshot.docs.length);
    }, (error) => {
      console.error("Error fetching pending OD:", error);
    });

    const qPurchases = query(
      collection(db, "PurchaseRequests"),
      where("status", "==", "PENDING")
    );
    const unsubscribePurchases = onSnapshot(qPurchases, (snapshot) => {
      setPendingPurchasesCount(snapshot.docs.length);
    }, (error) => {
      console.error("Error fetching pending purchases:", error);
    });

    const qLab = query(
      collection(db, "Inventory"),
      where("status", "in", ["PENDIENTE", "PENDIENTE_LABORATORIO"])
    );
    const unsubscribeLab = onSnapshot(qLab, (snapshot) => {
      setPendingLabCount(snapshot.docs.length);
    }, (error) => {
      console.error("Error fetching pending lab items:", error);
    });

    return () => {
      unsubscribeOP();
      unsubscribeOE();
      unsubscribeOD();
      unsubscribePurchases();
      unsubscribeLab();
    };
  }, []);

  const handleHardRefresh = () => {
    if (Platform.OS === 'web') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function (registrations) {
          for (let registration of registrations) {
            registration.unregister();
          }
          window.location.reload(true);
        });
      } else {
        window.location.reload(true);
      }
    } else {
      Alert.alert("Aviso", "Esta función es para la versión Web/PWA.");
    }
  };

  const handleLogOut = () => {
    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm("¿Deseas desconectar este dispositivo de la red corporativa?");
      if (confirmLogout) {
        auth.signOut().then(() => navigation.replace('Login'));
      }
    } else {
      Alert.alert("Cerrar Sesión", "¿Deseas desconectar este dispositivo de la red corporativa?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Salir", style: 'destructive', onPress: () => auth.signOut().then(() => navigation.replace('Login')) }
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER ENTERPRISE */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSup}>SISTEMA OPERATIVO CENTRAL</Text>
          <Text style={styles.welcome}>Hola, {currentUserName}</Text>
          <View style={styles.userBadge}>
            <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.userMail} numberOfLines={1}>{currentUserEmail}</Text>
          </View>
        </View>

        {/* PANEL DE ACCESO RÁPIDO */}
        <View style={styles.headerButtons}>
          {Platform.OS === 'web' && (
            <TouchableOpacity activeOpacity={0.7} style={styles.actionBtn} onPress={handleHardRefresh}>
              <Sparkles color="#3b82f6" size={22} />
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

      <ScrollView maximumZoomScale={1}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ENTRADAS DE STOCK - MOVIDO ARRIBA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingresos de Stock</Text>



          <TouchableOpacity
            style={[styles.mainCard, { borderColor: '#64748b', backgroundColor: '#f8fafc' }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('IncomingInventory', { companyName: 'STOCK_CENTRAL_MP' })}
          >
            <View style={[styles.mainCardIcon, { backgroundColor: '#64748b' }]}>
              <Keyboard color="#fff" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.mainCardTitle, { color: '#0f172a' }]}>Ingreso Manual (Q1)</Text>
              <Text style={styles.mainCardSub}>MP e Insumos (Bidones, Cajas, Etiquetas)</Text>
            </View>
            <ChevronRight color="#64748b" size={24} />
          </TouchableOpacity>
        </View>

        {/* INVENTARIO CENTRAL */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inventarios Centrales</Text>

          <TouchableOpacity
            style={[styles.mainCard, { borderColor: '#3b82f6', backgroundColor: '#eff6ff' }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('StockView', { companyName: 'STOCK_CENTRAL_MP', stockType: 'MP', title: 'Materia Prima General' })}
          >
            <View style={[styles.mainCardIcon, { backgroundColor: '#3b82f6' }]}>
              <Database color="#fff" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.mainCardTitle, { color: '#1e3a8a' }]}>Stock Materia Prima</Text>
              <Text style={styles.mainCardSub}>Químicos y componentes base</Text>
            </View>
            <ChevronRight color="#3b82f6" size={24} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainCard, { borderColor: '#8b5cf6', backgroundColor: '#f5f3ff' }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('StockView', { companyName: 'STOCK_CENTRAL_INSUMOS', stockType: 'INSUMOS', title: 'Inventario de Insumos' })}
          >
            <View style={[styles.mainCardIcon, { backgroundColor: '#8b5cf6' }]}>
              <Box color="#fff" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.mainCardTitle, { color: '#4c1d95' }]}>Stock Insumos</Text>
              <Text style={styles.mainCardSub}>Bidones, cajas y etiquetas</Text>
            </View>
            <ChevronRight color="#8b5cf6" size={24} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainCard, { borderColor: '#f59e0b', backgroundColor: '#fffbeb' }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('StockView', { companyName: 'H2O', stockType: 'GRANEL', title: 'Inventario Granel' })}
          >
            <View style={[styles.mainCardIcon, { backgroundColor: '#f59e0b' }]}>
              <Container color="#fff" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.mainCardTitle, { color: '#92400e' }]}>Stock Granel</Text>
              <Text style={styles.mainCardSub}>Productos madres fabricados</Text>
            </View>
            <ChevronRight color="#f59e0b" size={24} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainCard, { borderColor: '#10b981', backgroundColor: '#ecfdf5' }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('StockView', { companyName: 'H2O', stockType: 'FINAL', title: 'Producto Envasado' })}
          >
            <View style={[styles.mainCardIcon, { backgroundColor: '#10b981' }]}>
              <Package color="#fff" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.mainCardTitle, { color: '#064e3b' }]}>Stock Terminado</Text>
              <Text style={styles.mainCardSub}>Productos listos para despacho</Text>
            </View>
            <ChevronRight color="#10b981" size={24} />
          </TouchableOpacity>
        </View>

        {/* FLUJO OPERATIVO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Órdenes y Operativa</Text>



          <TouchableOpacity activeOpacity={0.8} style={styles.labCard} onPress={() => navigation.navigate('ProductionOrder', { companyName: 'H2O' })}>
            <View style={[styles.labIconBox, { backgroundColor: '#f0f9ff' }]}>
              <Beaker color="#0ea5e9" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.labCardTitle}>Orden de Producción (OP) (Q2)</Text>
                {pendingOPCount > 0 && (
                  <View style={styles.badgeCount}>
                    <Text style={styles.badgeCountText}>{pendingOPCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.labCardSub}>Fabricar Producto Madre (Granel)</Text>
            </View>
            <ChevronRight color="#cbd5e1" size={20} />
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} style={styles.labCard} onPress={() => navigation.navigate('PackagingOrder', { companyName: 'H2O' })}>
            <View style={[styles.labIconBox, { backgroundColor: '#fdf4ff' }]}>
              <Box color="#c026d3" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.labCardTitle}>Orden de Envasado (OE) (Q3)</Text>
                {pendingOECount > 0 && (
                  <View style={styles.badgeCount}>
                    <Text style={styles.badgeCountText}>{pendingOECount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.labCardSub}>Envasar en Bidones y Cajas</Text>
            </View>
            <ChevronRight color="#cbd5e1" size={20} />
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} style={styles.labCard} onPress={() => navigation.navigate('DirectPackagingOrder', { companyName: 'H2O' })}>
            <View style={[styles.labIconBox, { backgroundColor: '#ecfdf5' }]}>
              <Box color="#10b981" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.labCardTitle}>Orden Envasado Directo (OEM)</Text>
              </View>
              <Text style={styles.labCardSub}>Envasar Materia Prima en Bidones/Cajas</Text>
            </View>
            <ChevronRight color="#cbd5e1" size={20} />
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} style={styles.labCard} onPress={() => navigation.navigate('OutgoingInventory', { companyName: 'H2O' })}>
            <View style={[styles.labIconBox, { backgroundColor: '#fef2f2' }]}>
              <Truck color="#ef4444" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.labCardTitle}>Orden de Despacho (OD) (Q5)</Text>
                {pendingODCount > 0 && (
                  <View style={styles.badgeCount}>
                    <Text style={styles.badgeCountText}>{pendingODCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.labCardSub}>Despacho físico a clientes</Text>
            </View>
            <ChevronRight color="#cbd5e1" size={20} />
          </TouchableOpacity>
        </View>

        {/* PLANTA Y LABORATORIO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Planta y Calidad</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.qualityCard, !canAccessQualityControl(currentUserEmail) && { opacity: 0.5 }]}
              activeOpacity={canAccessQualityControl(currentUserEmail) ? 0.8 : 1}
              onPress={() => {
                if (canAccessQualityControl(currentUserEmail)) {
                  navigation.navigate('QualityControl');
                } else {
                  Alert.alert("Acceso Denegado", "No tienes permisos de Laboratorio/Calidad para acceder a esta sección.");
                }
              }}
            >
              <View style={[styles.qualityIconBox, { backgroundColor: '#fffbeb' }]}>
                <ClipboardCheck color="#f59e0b" size={24} />
                {pendingLabCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{pendingLabCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.qualityCardText}>BBS Calidad</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.qualityCard} onPress={() => navigation.navigate('Formulation')}>
              <View style={[styles.qualityIconBox, { backgroundColor: '#fdf4ff' }]}>
                <FlaskConical color="#c026d3" size={24} />
              </View>
              <Text style={styles.qualityCardText}>Formulación</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>

            <TouchableOpacity style={styles.qualityCard} onPress={() => navigation.navigate('StaffAttendance')}>
              <View style={[styles.qualityIconBox, { backgroundColor: '#f0f9ff' }]}>
                <UserCheck color="#0ea5e9" size={24} />
              </View>
              <Text style={styles.qualityCardText}>Tótem Asistencia</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.qualityCard} onPress={() => navigation.navigate('PurchaseRequests')}>
              <View style={[styles.qualityIconBox, { backgroundColor: '#fef2f2' }]}>
                <ShoppingCart color="#ef4444" size={24} />
                {pendingPurchasesCount > 0 && <View style={styles.notificationDot} />}
              </View>
              <Text style={styles.qualityCardText}>Pedidos Internos</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* LOGÍSTICA TRANSVERSAL Y HERRAMIENTAS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Funciones Extras</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.adminSmallCard} onPress={() => navigation.navigate('SmartAICargo', { companyName: 'STOCK_CENTRAL_MP' })}>
              <Sparkles color="#3b82f6" size={20} />
              <Text style={styles.adminSmallCardText}>Ingreso IA</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.adminSmallCard} onPress={() => navigation.navigate('QuarterlyCalculator')}>
              <Calculator color="#334155" size={20} />
              <Text style={styles.adminSmallCardText}>Calculadora</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.row, { marginTop: 15 }]}>
            <TouchableOpacity style={styles.adminSmallCard} onPress={() => navigation.navigate('InventoryAdjustment')}>
              <Keyboard color="#334155" size={20} />
              <Text style={styles.adminSmallCardText}>Ajuste Stock</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminSmallCard} onPress={() => navigation.navigate('Traceability')}>
              <Search color="#334155" size={20} />
              <Text style={styles.adminSmallCardText}>Trazabilidad</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 90 }} />
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
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#1e293b', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 0.5 },

  mainCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12, elevation: 1 },
  mainCardIcon: { padding: 12, borderRadius: 12, marginRight: 15 },
  mainCardTitle: { fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  mainCardSub: { fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '500' },

  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  qualityCard: { flex: 1, backgroundColor: '#fff', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', gap: 12, elevation: 1 },
  qualityIconBox: { padding: 12, borderRadius: 14 },
  qualityCardText: { fontWeight: '800', fontSize: 13, color: '#334155' },

  labCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1, marginBottom: 12 },
  labIconBox: { backgroundColor: '#f5f3ff', padding: 12, borderRadius: 14, marginRight: 15 },
  labCardTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  labCardSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  badgeCount: { backgroundColor: '#ef4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginLeft: 8 },
  badgeCountText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  adminSmallCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', gap: 12, elevation: 1 },
  adminSmallCardText: { color: '#334155', fontSize: 13, fontWeight: '800' },

  fabAiButton: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    zIndex: 1000,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    elevation: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 15
  },
  fabAiText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1
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