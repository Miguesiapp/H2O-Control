import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, StatusBar, useWindowDimensions, Modal, Pressable, Platform, Image, BackHandler
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../config/firebase';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { canAccessQualityControl } from '../config/permissions';
import { formatDisplayName } from '../config/constants';
import {
  LogOut, FlaskConical, ChevronRight, ChevronLeft,
  Sparkles, Keyboard, ShoppingCart, Search, Book,
  BrainCircuit, Menu, X, ShieldCheck, AlertOctagon,
  Calculator, Clock
} from 'lucide-react-native';

export default function HomeScreen({ navigation }) {
  const { width } = useWindowDimensions();

  // Vista activa en el Home: 'MAIN' | 'INGRESOS' | 'ORDENES' | 'STOCK'
  const [activeSection, setActiveSection] = useState('MAIN');
  const [menuVisible, setMenuVisible] = useState(false);

  const [criticalItems, setCriticalItems] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [pendingOPCount, setPendingOPCount] = useState(0);
  const [pendingOECount, setPendingOECount] = useState(0);
  const [pendingOEMCount, setPendingOEMCount] = useState(0);
  const [pendingODCount, setPendingODCount] = useState(0);
  const [pendingPurchasesCount, setPendingPurchasesCount] = useState(0);
  const [pendingLabCount, setPendingLabCount] = useState(0);

  const currentUserEmail = auth.currentUser?.email || 'Usuario';
  const [currentUserName, setCurrentUserName] = useState(
    auth.currentUser?.displayName
      ? auth.currentUser.displayName.split(' ')[0]
      : currentUserEmail.split('@')[0]
  );

  // Manejo del botón físico "Atrás" en Android cuando estamos dentro de una sub-pantalla (Ingresos / Órdenes / Stock)
  useEffect(() => {
    const onBackPress = () => {
      if (menuVisible) {
        setMenuVisible(false);
        return true;
      }
      if (activeSection !== 'MAIN') {
        setActiveSection('MAIN');
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [activeSection, menuVisible]);

  // AUTO-MIGRACIÓN PARA USUARIOS ANTIGUOS
  useEffect(() => {
    const fetchAndMigrateName = async () => {
      if (auth.currentUser && !auth.currentUser.displayName) {
        try {
          const userDoc = await getDoc(doc(db, "Users", auth.currentUser.uid));
          if (userDoc.exists() && userDoc.data().name) {
            const fullName = userDoc.data().name;
            setCurrentUserName(fullName.split(' ')[0]);
            await updateProfile(auth.currentUser, { displayName: fullName });
          }
        } catch (error) {
          console.log("No se pudo auto-migrar el nombre:", error);
        }
      }
    };
    fetchAndMigrateName();
  }, []);

  // MONITOR DE STOCK CRÍTICO
  useEffect(() => {
    const q = query(collection(db, "Inventory"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => d.data());
      const aggregated = {};

      items.forEach(item => {
        if (item.status === 'PENDIENTE' || item.status === 'PENDIENTE_LABORATORIO' || item.status === 'RECHAZADO') return;
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) return;

        const name = formatDisplayName(item.itemName);
        if (!name) return;
        if (!aggregated[name]) {
          aggregated[name] = {
            totalQuantity: 0,
            minStock: item.minStock !== undefined ? item.minStock : null
          };
        }
        aggregated[name].totalQuantity += qty;

        if (aggregated[name].minStock === null && item.minStock !== undefined) {
          aggregated[name].minStock = item.minStock;
        }
      });

      const criticalItemsList = [];
      for (const [name, data] of Object.entries(aggregated)) {
        if (data.minStock !== null && data.totalQuantity <= data.minStock) {
          criticalItemsList.push(name);
        }
      }

      setCriticalItems(criticalItemsList);
      setLoadingAlerts(false);
    }, (error) => {
      console.error("Error en Firebase:", error);
      setLoadingAlerts(false);
    });

    return () => unsubscribe();
  }, []);

  // CONTADORES EN TIEMPO REAL DE ÓRDENES, CALIDAD Y PEDIDOS
  useEffect(() => {
    const qOP = query(
      collection(db, "Orders"),
      where("type", "==", "OP"),
      where("status", "in", ["ENVIADO", "EN_PROCESO"])
    );
    const unsubscribeOP = onSnapshot(qOP, (snapshot) => setPendingOPCount(snapshot.docs.length));

    const qOE = query(
      collection(db, "Orders"),
      where("type", "==", "OE"),
      where("status", "in", ["ENVIADO", "EN_PROCESO"])
    );
    const unsubscribeOE = onSnapshot(qOE, (snapshot) => setPendingOECount(snapshot.docs.length));

    const qOEM = query(
      collection(db, "Orders"),
      where("type", "==", "OEM"),
      where("status", "in", ["ENVIADO", "EN_PROCESO"])
    );
    const unsubscribeOEM = onSnapshot(qOEM, (snapshot) => setPendingOEMCount(snapshot.docs.length));

    const qOD = query(
      collection(db, "Orders"),
      where("type", "==", "OD"),
      where("status", "in", ["ENVIADO", "EN_PROCESO"])
    );
    const unsubscribeOD = onSnapshot(qOD, (snapshot) => setPendingODCount(snapshot.docs.length));

    const qPurchases = query(
      collection(db, "PurchaseRequests"),
      where("status", "==", "PENDING")
    );
    const unsubscribePurchases = onSnapshot(qPurchases, (snapshot) => setPendingPurchasesCount(snapshot.docs.length));

    const qLab = query(
      collection(db, "Inventory"),
      where("status", "in", ["PENDIENTE", "PENDIENTE_LABORATORIO"])
    );
    const unsubscribeLab = onSnapshot(qLab, (snapshot) => setPendingLabCount(snapshot.docs.length));

    return () => {
      unsubscribeOP();
      unsubscribeOE();
      unsubscribeOEM();
      unsubscribeOD();
      unsubscribePurchases();
      unsubscribeLab();
    };
  }, []);

  const totalPendingOrders = pendingOPCount + pendingOECount + pendingOEMCount + pendingODCount;

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
    setMenuVisible(false);
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

  const handleOpenQuality = () => {
    if (canAccessQualityControl(currentUserEmail)) {
      navigation.navigate('QualityControl');
    } else {
      Alert.alert("Acceso Restringido", "No tienes permisos de Laboratorio/Calidad para acceder a BBS Calidad.");
    }
  };

  const navigateFromMenu = (routeName, params = {}) => {
    setMenuVisible(false);
    navigation.navigate(routeName, params);
  };

  // ============================================================================
  // SUB-PANTALLA: ÓRDENES OPERATIVAS (OP, OE, OED, OD)
  // ============================================================================
  const renderOrdenesSection = () => (
    <View style={styles.subScreenWrapper}>
      <View style={styles.subHeaderCard}>
        <TouchableOpacity
          style={styles.backToMainBtn}
          activeOpacity={0.75}
          onPress={() => setActiveSection('MAIN')}
        >
          <ChevronLeft color="#004ea8" size={18} />
          <Text style={styles.backToMainText}>Volver</Text>
        </TouchableOpacity>
        <Text style={styles.subHeaderTitle}>Órdenes Operativas</Text>
      </View>

      <Text style={styles.groupLabel}>PRODUCCIÓN Y ENVASADO</Text>

      <TouchableOpacity
        style={styles.subOptionCard}
        activeOpacity={0.82}
        onPress={() => navigation.navigate('ProductionOrder', { companyName: 'H2O' })}
      >
        <View style={styles.titleWithBadgeRow}>
          <Text style={styles.subOptionTitle}>Orden de Producción (OP)</Text>
          {pendingOPCount > 0 && (
            <View style={styles.liveCountPill}>
              <Text style={styles.liveCountPillText}>{pendingOPCount}</Text>
            </View>
          )}
        </View>
        <ChevronRight color="#004ea8" size={18} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.subOptionCard}
        activeOpacity={0.82}
        onPress={() => navigation.navigate('PackagingOrder', { companyName: 'H2O' })}
      >
        <View style={styles.titleWithBadgeRow}>
          <Text style={styles.subOptionTitle}>Orden de Envasado (OE)</Text>
          {pendingOECount > 0 && (
            <View style={styles.liveCountPill}>
              <Text style={styles.liveCountPillText}>{pendingOECount}</Text>
            </View>
          )}
        </View>
        <ChevronRight color="#004ea8" size={18} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.subOptionCard}
        activeOpacity={0.82}
        onPress={() => navigation.navigate('DirectPackagingOrder', { companyName: 'H2O' })}
      >
        <View style={styles.titleWithBadgeRow}>
          <Text style={styles.subOptionTitle}>Orden Envasado Directo (OED)</Text>
          {pendingOEMCount > 0 && (
            <View style={styles.liveCountPill}>
              <Text style={styles.liveCountPillText}>{pendingOEMCount}</Text>
            </View>
          )}
        </View>
        <ChevronRight color="#004ea8" size={18} />
      </TouchableOpacity>

      <Text style={[styles.groupLabel, { marginTop: 16 }]}>DESPACHO</Text>

      <TouchableOpacity
        style={styles.subOptionCard}
        activeOpacity={0.82}
        onPress={() => navigation.navigate('OutgoingInventory', { companyName: 'H2O' })}
      >
        <View style={styles.titleWithBadgeRow}>
          <Text style={styles.subOptionTitle}>Orden de Despacho (OD)</Text>
          {pendingODCount > 0 && (
            <View style={styles.liveCountPill}>
              <Text style={styles.liveCountPillText}>{pendingODCount}</Text>
            </View>
          )}
        </View>
        <ChevronRight color="#004ea8" size={18} />
      </TouchableOpacity>
    </View>
  );

  // ============================================================================
  // SUB-PANTALLA 3: INVENTARIOS CENTRALES Y STOCK
  // ============================================================================
  const renderStockSection = () => (
    <View style={styles.subScreenWrapper}>
      <View style={styles.subHeaderCard}>
        <TouchableOpacity
          style={styles.backToMainBtn}
          activeOpacity={0.75}
          onPress={() => setActiveSection('MAIN')}
        >
          <ChevronLeft color="#004ea8" size={18} />
          <Text style={styles.backToMainText}>Volver</Text>
        </TouchableOpacity>
        <Text style={styles.subHeaderTitle}>Control de Stock</Text>
      </View>

      <Text style={styles.groupLabel}>ALMACENES</Text>

      <TouchableOpacity
        style={styles.subOptionCard}
        activeOpacity={0.82}
        onPress={() => navigation.navigate('StockView', { companyName: 'STOCK_CENTRAL_MP', stockType: 'MP', title: 'Materia Prima General' })}
      >
        <Text style={styles.subOptionTitle}>Stock Materia Prima</Text>
        <ChevronRight color="#004ea8" size={18} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.subOptionCard}
        activeOpacity={0.82}
        onPress={() => navigation.navigate('StockView', { companyName: 'STOCK_CENTRAL_INSUMOS', stockType: 'INSUMOS', title: 'Inventario de Insumos' })}
      >
        <Text style={styles.subOptionTitle}>Stock Insumos</Text>
        <ChevronRight color="#004ea8" size={18} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.subOptionCard}
        activeOpacity={0.82}
        onPress={() => navigation.navigate('StockView', { companyName: 'H2O', stockType: 'GRANEL', title: 'Inventario Granel' })}
      >
        <Text style={styles.subOptionTitle}>Stock Granel</Text>
        <ChevronRight color="#004ea8" size={18} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.subOptionCard}
        activeOpacity={0.82}
        onPress={() => navigation.navigate('StockView', { companyName: 'H2O', stockType: 'FINAL', title: 'Producto Envasado' })}
      >
        <Text style={styles.subOptionTitle}>Stock Terminado</Text>
        <ChevronRight color="#004ea8" size={18} />
      </TouchableOpacity>

      <Text style={[styles.groupLabel, { marginTop: 16 }]}>ALERTAS</Text>

      {criticalItems.length === 0 ? (
        <View style={styles.subOptionCard}>
          <Text style={[styles.subOptionTitle, { color: '#16a34a' }]}>Stock Saludable (Sin faltantes)</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.subOptionCard}
          activeOpacity={0.82}
          onPress={() => navigation.navigate('LowStockAlerts', { items: criticalItems })}
        >
          <View style={styles.titleWithBadgeRow}>
            <Text style={[styles.subOptionTitle, { color: '#dc2626' }]}>Alertas de Stock Crítico</Text>
            <View style={[styles.liveCountPill, { backgroundColor: '#dc2626' }]}>
              <Text style={styles.liveCountPillText}>{criticalItems.length}</Text>
            </View>
          </View>
          <ChevronRight color="#dc2626" size={18} />
        </TouchableOpacity>
      )}
    </View>
  );

  // ============================================================================
  // PANTALLA PRINCIPAL: 4 ACCESOS COMPACTOS + CALCULADORA E HISTORIAL
  // ============================================================================
  const renderMainDashboard = () => (
    <View>
      {/* BARRA DE PULSO OPERATIVO */}
      <View style={styles.kpiStrip}>
        <TouchableOpacity
          style={styles.kpiCell}
          activeOpacity={0.75}
          onPress={() => setActiveSection('ORDENES')}
        >
          <Text style={styles.kpiLabel}>ÓRDENES ACTIVAS</Text>
          <View style={styles.kpiValueRow}>
            <Text style={[styles.kpiValue, totalPendingOrders > 0 && { color: '#004ea8' }]}>
              {totalPendingOrders}
            </Text>
            <View style={[styles.kpiDot, { backgroundColor: totalPendingOrders > 0 ? '#004ea8' : '#94a3b8' }]} />
          </View>
        </TouchableOpacity>

        <View style={styles.kpiDivider} />

        <TouchableOpacity
          style={styles.kpiCell}
          activeOpacity={0.75}
          onPress={handleOpenQuality}
        >
          <Text style={styles.kpiLabel}>CALIDAD BBS</Text>
          <View style={styles.kpiValueRow}>
            <Text style={[styles.kpiValue, pendingLabCount > 0 && { color: '#d97706' }]}>
              {pendingLabCount > 0 ? `${pendingLabCount} Pend.` : 'Al día'}
            </Text>
            <View style={[styles.kpiDot, { backgroundColor: pendingLabCount > 0 ? '#f59e0b' : '#10b981' }]} />
          </View>
        </TouchableOpacity>

        <View style={styles.kpiDivider} />

        <TouchableOpacity
          style={styles.kpiCell}
          activeOpacity={0.75}
          onPress={() => setActiveSection('STOCK')}
        >
          <Text style={styles.kpiLabel}>ESTADO STOCK</Text>
          <View style={styles.kpiValueRow}>
            <Text style={[styles.kpiValue, { color: criticalItems.length > 0 ? '#dc2626' : '#0f172a' }]}>
              {loadingAlerts ? '...' : (criticalItems.length > 0 ? `${criticalItems.length} Crít.` : 'Óptimo')}
            </Text>
            <View style={[styles.kpiDot, { backgroundColor: criticalItems.length > 0 ? '#dc2626' : '#10b981' }]} />
          </View>
        </TouchableOpacity>
      </View>

      {/* 4 ACCESOS PRINCIPALES (GRILLA 2x2 PROTAGÓNICA) */}
      <View style={styles.coreGrid}>
        {/* 1. INGRESOS - ABRE DIRECTAMENTE INGRESO MP / INSUMOS */}
        <TouchableOpacity
          style={styles.coreCard}
          activeOpacity={0.82}
          onPress={() => navigation.navigate('IncomingInventory', { companyName: 'STOCK_CENTRAL_MP', initialType: 'MP' })}
        >
          <Text style={styles.coreCardTitle}>Ingresos</Text>
          <View style={styles.coreCardFooter}>
            <Text style={styles.coreCardActionText}>Abrir recepción</Text>
            <ChevronRight color="#004ea8" size={17} />
          </View>
        </TouchableOpacity>

        {/* 2. ÓRDENES */}
        <TouchableOpacity
          style={styles.coreCard}
          activeOpacity={0.82}
          onPress={() => setActiveSection('ORDENES')}
        >
          <View style={styles.titleWithBadgeRow}>
            <Text style={styles.coreCardTitle}>Órdenes</Text>
            {totalPendingOrders > 0 && (
              <View style={styles.badgeSmallBlue}>
                <Text style={styles.badgeSmallText}>{totalPendingOrders}</Text>
              </View>
            )}
          </View>
          <View style={styles.coreCardFooter}>
            <Text style={styles.coreCardActionText}>Gestionar órdenes</Text>
            <ChevronRight color="#004ea8" size={17} />
          </View>
        </TouchableOpacity>

        {/* 3. STOCK */}
        <TouchableOpacity
          style={styles.coreCard}
          activeOpacity={0.82}
          onPress={() => setActiveSection('STOCK')}
        >
          <View style={styles.titleWithBadgeRow}>
            <Text style={styles.coreCardTitle}>Stock</Text>
            {criticalItems.length > 0 && (
              <View style={styles.badgeSmallDanger}>
                <Text style={styles.badgeSmallText}>{criticalItems.length}</Text>
              </View>
            )}
          </View>
          <View style={styles.coreCardFooter}>
            <Text style={styles.coreCardActionText}>Consultar inventarios</Text>
            <ChevronRight color="#004ea8" size={17} />
          </View>
        </TouchableOpacity>

        {/* 4. CALIDAD BBS */}
        <TouchableOpacity
          style={[
            styles.coreCard,
            !canAccessQualityControl(currentUserEmail) && { opacity: 0.65 }
          ]}
          activeOpacity={0.82}
          onPress={handleOpenQuality}
        >
          <View style={styles.titleWithBadgeRow}>
            <Text style={styles.coreCardTitle}>Calidad BBS</Text>
            {pendingLabCount > 0 && (
              <View style={styles.badgeSmallWarning}>
                <Text style={styles.badgeSmallText}>{pendingLabCount}</Text>
              </View>
            )}
          </View>
          <View style={styles.coreCardFooter}>
            <Text style={styles.coreCardActionText}>Laboratorio</Text>
            <ChevronRight color="#004ea8" size={17} />
          </View>
        </TouchableOpacity>
      </View>

      {/* ICONOS ACCESORIOS ABAJO: CALCULADORA E HISTORIAL */}
      <View style={styles.bottomIconsRow}>
        <TouchableOpacity
          style={styles.bottomIconBtn}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('QuarterlyCalculator')}
        >
          <Calculator color="#004ea8" size={20} />
          <Text style={styles.bottomIconText}>Calculadora</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomIconBtn}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('History')}
        >
          <Clock color="#004ea8" size={20} />
          <Text style={styles.bottomIconText}>Historial</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* CABECERA CORPORATIVA H2O CONTROL */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.brandBlock}
          activeOpacity={0.85}
          onPress={() => setActiveSection('MAIN')}
        >
          <Image
            source={require('../../assets/logo-blue.png')}
            style={styles.brandLogoImg}
            resizeMode="contain"
          />
          <Text style={styles.welcome} numberOfLines={1}>Hola, {currentUserName}</Text>
        </TouchableOpacity>

        {/* ACCIONES DE CABECERA: REFRESH (WEB) Y MENÚ */}
        <View style={styles.headerActions}>
          {Platform.OS === 'web' && (
            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.headerIconBtn}
              onPress={handleHardRefresh}
            >
              <Sparkles color="#004ea8" size={18} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.menuTriggerBtn}
            onPress={() => setMenuVisible(true)}
          >
            <Menu color="#ffffff" size={19} />
            <Text style={styles.menuTriggerText}>Menú</Text>
            {pendingPurchasesCount > 0 && (
              <View style={styles.menuBadgeDot} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* CONTENIDO PRINCIPAL */}
      <ScrollView
        maximumZoomScale={1}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentMaxWidth}>
          {activeSection === 'MAIN' && renderMainDashboard()}
          {activeSection === 'ORDENES' && renderOrdenesSection()}
          {activeSection === 'STOCK' && renderStockSection()}
        </View>
      </ScrollView>

      {/* MENÚ DESPLEGABLE CORPORATIVO */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)}>
          <Pressable style={styles.menuDrawer} onPress={(e) => e.stopPropagation()}>
            {/* CABECERA DEL MENÚ */}
            <View style={styles.menuHeader}>
              <View style={styles.menuHeaderBrand}>
                <Image
                  source={require('../../assets/logo-blue.png')}
                  style={{ width: 44, height: 32 }}
                  resizeMode="contain"
                />
                <Text style={styles.menuHeaderTitle}>Menú</Text>
              </View>
              <TouchableOpacity
                style={styles.menuCloseBtn}
                onPress={() => setMenuVisible(false)}
              >
                <X color="#0a1929" size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.menuListContent}>
              <Text style={styles.menuSectionLabel}>PLANTA Y FÓRMULAS</Text>

              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.75}
                onPress={() => navigateFromMenu('Formulation')}
              >
                <Text style={styles.menuItemTitle}>Fórmulas</Text>
                <ChevronRight color="#94a3b8" size={18} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.75}
                onPress={() => navigateFromMenu('Dictionary')}
              >
                <Text style={styles.menuItemTitle}>Diccionario MP</Text>
                <ChevronRight color="#94a3b8" size={18} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.75}
                onPress={() => navigateFromMenu('PurchaseRequests')}
              >
                <View style={styles.titleWithBadgeRow}>
                  <Text style={styles.menuItemTitle}>Pedidos Internos</Text>
                  {pendingPurchasesCount > 0 && (
                    <View style={styles.menuCountBadge}>
                      <Text style={styles.menuCountBadgeText}>{pendingPurchasesCount}</Text>
                    </View>
                  )}
                </View>
                <ChevronRight color="#94a3b8" size={18} />
              </TouchableOpacity>

              <Text style={[styles.menuSectionLabel, { marginTop: 14 }]}>AUDITORÍA Y STOCK</Text>

              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.75}
                onPress={() => navigateFromMenu('Traceability')}
              >
                <Text style={styles.menuItemTitle}>Trazabilidad</Text>
                <ChevronRight color="#94a3b8" size={18} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.75}
                onPress={() => navigateFromMenu('ExecutiveReports')}
              >
                <Text style={styles.menuItemTitle}>Auditoría IA</Text>
                <ChevronRight color="#94a3b8" size={18} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.75}
                onPress={() => navigateFromMenu('InventoryAdjustment')}
              >
                <Text style={styles.menuItemTitle}>Ajuste Stock</Text>
                <ChevronRight color="#94a3b8" size={18} />
              </TouchableOpacity>

              <Text style={[styles.menuSectionLabel, { marginTop: 14 }]}>PLANTA Y SEGURIDAD</Text>

              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.75}
                onPress={() => navigateFromMenu('Eventualities')}
              >
                <Text style={styles.menuItemTitle}>Eventos</Text>
                <ChevronRight color="#94a3b8" size={18} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.75}
                onPress={() => navigateFromMenu('EIGPanel')}
              >
                <Text style={styles.menuItemTitle}>Panel EIG</Text>
                <ChevronRight color="#94a3b8" size={18} />
              </TouchableOpacity>

              {/* CERRAR SESIÓN */}
              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.menuLogoutItem}
                activeOpacity={0.8}
                onPress={handleLogOut}
              >
                <Text style={styles.menuLogoutTitle}>Cerrar Sesión</Text>
                <LogOut color="#dc2626" size={18} />
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f4f6f9'
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f4f6f9'
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24
  },
  contentMaxWidth: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center'
  },

  // CABECERA
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10
  },
  brandLogoImg: {
    width: 48,
    height: 36,
    marginRight: 10
  },
  welcome: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0a1929'
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ebf3fc',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center'
  },
  menuTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#004ea8',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 10,
    gap: 6
  },
  menuTriggerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  },
  menuBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#f59e0b',
    borderWidth: 1.5,
    borderColor: '#ffffff'
  },

  // PULSO OPERATIVO (KPIs)
  kpiStrip: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 14
  },
  kpiCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  kpiDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 4
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 3
  },
  kpiValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0a1929'
  },
  kpiDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },

  // 4 ACCESOS PRINCIPALES (GRILLA 2x2 PROTAGÓNICA)
  coreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
    marginBottom: 16
  },
  coreCard: {
    width: '48.2%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbe3ee',
    padding: 16,
    justifyContent: 'space-between',
    minHeight: 104,
    elevation: 2,
    shadowColor: '#0a1929',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8
  },
  coreCardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0a1929',
    letterSpacing: -0.2
  },
  coreCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14
  },
  coreCardActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#004ea8'
  },

  // ICONOS INFERIORES: CALCULADORA E HISTORIAL
  bottomIconsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 6
  },
  bottomIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
    shadowColor: '#0a1929',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4
  },
  bottomIconText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0a1929'
  },

  // BADGES PEQUEÑOS
  badgeSmallBlue: {
    backgroundColor: '#ebf3fc',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6
  },
  badgeSmallDanger: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6
  },
  badgeSmallWarning: {
    backgroundColor: '#fffbeb',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6
  },
  badgeSmallText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0a1929'
  },

  // HERRAMIENTAS DIRECTAS (CALCULADORA E HISTORIAL)
  quickToolsRow: {
    flexDirection: 'row',
    gap: 10
  },
  quickToolCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  quickToolTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0a1929'
  },

  // SUB-PANTALLAS
  subScreenWrapper: {
    flex: 1
  },
  subHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14
  },
  backToMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ebf3fc',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
    gap: 4
  },
  backToMainText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#004ea8'
  },
  subHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0a1929'
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 2
  },
  subOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8
  },
  subOptionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0a1929'
  },
  titleWithBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  liveCountPill: {
    backgroundColor: '#004ea8',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 6
  },
  liveCountPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900'
  },

  // MENÚ DESPLEGABLE
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 41, 0.45)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end'
  },
  menuDrawer: {
    width: '85%',
    maxWidth: 340,
    height: '100%',
    backgroundColor: '#f4f6f9',
    borderLeftWidth: 1,
    borderLeftColor: '#e2e8f0'
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  menuHeaderBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  menuHeaderTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0a1929'
  },
  menuCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  menuListContent: {
    padding: 14,
    paddingBottom: 30
  },
  menuSectionLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#004ea8',
    letterSpacing: 1,
    marginBottom: 6,
    marginLeft: 2
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 6
  },
  menuItemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0a1929'
  },
  menuCountBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6
  },
  menuCountBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900'
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 10
  },
  menuLogoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca'
  },
  menuLogoutTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#dc2626'
  }
});
