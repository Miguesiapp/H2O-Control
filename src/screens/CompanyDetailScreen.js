import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  StatusBar, useWindowDimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowDownToLine, ArrowUpFromLine, Package, Container, 
  ChevronLeft, Database, Beaker, Archive, Plus, ChevronRight, Briefcase
} from 'lucide-react-native';
import QuickAddModal from '../components/QuickAddModal';

// LISTA GLOBAL DE EMPRESAS ACTUALIZADA (Nivel Sistema)
export const COMPANIES_LIST = ["H2Ocontrol", "WaterDay", "Alianza", "Agrocube", "BioAcker", "AgroFontezuela"];

export default function CompanyDetailScreen({ route, navigation }) {
  const { companyName } = route.params;
  const [isModalVisible, setIsModalVisible] = useState(false);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const menuOptions = [
    { id: 'ingresos', title: 'Ingreso MP', sub: 'Remitos / Compras', icon: <ArrowDownToLine size={28} color="#10b981" />, bg: '#ecfdf5', border: '#a7f3d0', screen: 'IncomingInventory' },
    { id: 'egresos', title: 'Despachos', sub: 'Salida a Cliente', icon: <ArrowUpFromLine size={28} color="#ef4444" />, bg: '#fef2f2', border: '#fecaca', screen: 'OutgoingInventory' },
    { id: 'prod', title: 'Producción', sub: 'Crear Granel', icon: <Package size={28} color="#f59e0b" />, bg: '#fffbeb', border: '#fde68a', screen: 'ProductionOrder' },
    { id: 'envasado', title: 'Envasado', sub: 'Llenado Final', icon: <Container size={28} color="#3b82f6" />, bg: '#eff6ff', border: '#bfdbfe', screen: 'PackagingOrder' },
  ];

  const stockOptions = [
    { id: 'stock_mp', title: 'Materias Primas', sub: 'Insumos y Bases', icon: <Database color="#64748b" size={24} />, type: 'MP' },
    { id: 'stock_pt', title: 'Granel (En Proceso)', sub: 'Líquido en Tanques', icon: <Beaker color="#64748b" size={24} />, type: 'PT' },
    { id: 'stock_final', title: 'Producto Terminado', sub: 'Stock Envasado', icon: <Archive color="#64748b" size={24} />, type: 'FINAL' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER ENTERPRISE */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backCircle}>
          <ChevronLeft color="#0f172a" size={24} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{companyName.toUpperCase()}</Text>
            <View style={styles.badge}>
                <Text style={styles.badgeText}>UNIDAD DE NEGOCIO</Text>
            </View>
        </View>
        <View style={styles.iconGhost}>
          <Briefcase color="#cbd5e1" size={24} />
        </View> 
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.container}
      >
        <Text style={styles.sectionLabel}>Flujo Operativo</Text>
        <View style={[styles.grid, isLandscape && styles.gridLandscape]}>
          {menuOptions.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              activeOpacity={0.8}
              style={[styles.menuCard, { backgroundColor: item.bg, borderColor: item.border }, isLandscape && styles.menuCardLandscape]}
              onPress={() => navigation.navigate(item.screen, { companyName })}
            >
              <View style={styles.cardHeader}>
                <View style={styles.iconContainer}>{item.icon}</View>
                <ChevronRight color={item.border} size={20} />
              </View>
              <View>
                <Text style={styles.menuLabel}>{item.title}</Text>
                <Text style={styles.menuSub}>{item.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 35 }]}>Auditoría de Stock</Text>
        <View style={styles.stockList}>
          {stockOptions.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              activeOpacity={0.7}
              style={styles.stockCard}
              onPress={() => navigation.navigate('StockView', { companyName, stockType: item.type, title: item.title })}
            >
              <View style={styles.stockInfo}>
                <View style={styles.stockIconBox}>{item.icon}</View>
                <View>
                  <Text style={styles.stockLabel}>{item.title}</Text>
                  <Text style={styles.stockSub}>{item.sub}</Text>
                </View>
              </View>
              <ChevronRight color="#cbd5e1" size={20} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* FAB (Floating Action Button) ESTILO C-LEVEL */}
      <TouchableOpacity 
        activeOpacity={0.8}
        style={styles.fab} 
        onPress={() => setIsModalVisible(true)}
      >
        <Plus color="#fff" size={28} />
      </TouchableOpacity>

      <QuickAddModal 
        visible={isModalVisible} 
        onClose={() => setIsModalVisible(false)} 
        companyName={companyName}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5
  },
  backCircle: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', letterSpacing: 0.5 },
  badge: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginTop: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  badgeText: { fontSize: 9, color: '#475569', fontWeight: '800', letterSpacing: 0.5 },
  iconGhost: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  
  container: { padding: 20, paddingBottom: 100 },
  sectionLabel: { fontSize: 12, color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15, marginLeft: 5 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  gridLandscape: { flexDirection: 'row', flexWrap: 'wrap' },
  
  menuCard: { 
    width: '48%', height: 140, borderRadius: 20, padding: 18,
    justifyContent: 'space-between', borderWidth: 1, elevation: 1
  },
  menuCardLandscape: { width: '23%' },
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconContainer: { backgroundColor: '#fff', width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  menuLabel: { fontSize: 14, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  menuSub: { fontSize: 10, fontWeight: '600', color: '#64748b', marginTop: 2 },

  stockList: { gap: 12 },
  stockCard: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', padding: 18, borderRadius: 16,
    borderWidth: 1, borderColor: '#e2e8f0', elevation: 1
  },
  stockInfo: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  stockIconBox: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  stockLabel: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  stockSub: { fontSize: 11, color: '#64748b', fontWeight: '500', marginTop: 2 },

  fab: {
    position: 'absolute', right: 25, bottom: 30,
    backgroundColor: '#0f172a', width: 60, height: 60, borderRadius: 20, 
    justifyContent: 'center', alignItems: 'center', elevation: 6,
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8
  }
});