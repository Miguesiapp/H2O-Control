import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  Dimensions
} from 'react-native';
// IMPORTANTE: Cambiamos el origen del SafeAreaView
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Package, 
  Container, 
  ChevronLeft,
  Database,
  Beaker,
  Archive,
  Plus,
  ChevronRight
} from 'lucide-react-native';
import QuickAddModal from '../components/QuickAddModal';

const { width } = Dimensions.get('window');

export default function CompanyDetailScreen({ route, navigation }) {
  const { companyName } = route.params;
  const [isModalVisible, setIsModalVisible] = useState(false);

  const menuOptions = [
    { id: 'ingresos', title: 'INGRESOS / COMPRAS', icon: <ArrowDownCircle size={32} color="#2e4a3b" />, color: '#E8F5E9', screen: 'IncomingInventory' },
    { id: 'egresos', title: 'EGRESOS / DESPACHO', icon: <ArrowUpCircle size={32} color="#D32F2F" />, color: '#FFEBEE', screen: 'OutgoingInventory' },
    { id: 'prod', title: 'ORDEN PRODUCCIÓN', icon: <Package size={32} color="#E65100" />, color: '#FFF3E0', screen: 'ProductionOrder' },
    { id: 'envasado', title: 'ORDEN ENVASADO', icon: <Container size={32} color="#0D47A1" />, color: '#E3F2FD', screen: 'PackagingOrder' },
  ];

  const stockOptions = [
    { id: 'stock_mp', title: 'MATERIA PRIMA', icon: <Database color="#2e4a3b" size={24} />, type: 'MP' },
    { id: 'stock_pt', title: 'PRODUCTO TERMINADO', icon: <Beaker color="#2e4a3b" size={24} />, type: 'PT' },
    { id: 'stock_final', title: 'STOCK FINAL', icon: <Archive color="#2e4a3b" size={24} />, type: 'FINAL' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER PREMIUM */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backCircle}
        >
          <ChevronLeft color="#2e4a3b" size={24} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{companyName.toUpperCase()}</Text>
            <View style={styles.badge}>
                <Text style={styles.badgeText}>AGRICULTURA INTELIGENTE</Text>
            </View>
        </View>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        
        <Text style={styles.sectionLabel}>FLUJO LOGÍSTICO</Text>
        <View style={styles.grid}>
          {menuOptions.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              activeOpacity={0.8}
              style={[styles.menuCard, { backgroundColor: item.color }]}
              onPress={() => navigation.navigate(item.screen, { companyName })}
            >
              <View style={styles.iconContainer}>{item.icon}</View>
              <Text style={styles.menuLabel}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 30 }]}>AUDITORÍA DE INVENTARIOS</Text>
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
                <Text style={styles.stockLabel}>{item.title}</Text>
              </View>
              <ChevronRight color="#CCC" size={20} />
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>

      {/* FAB REDISEÑADO */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setIsModalVisible(true)}
      >
        <Plus color="#fff" size={32} />
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
  safe: { flex: 1, backgroundColor: '#F9FBF9' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F4F1',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#1A2E24', letterSpacing: 1 },
  badge: { 
    backgroundColor: '#2e4a3b', 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 4, 
    marginTop: 4 
  },
  badgeText: { fontSize: 8, color: '#FFF', fontWeight: 'bold' },
  
  container: { padding: 20, paddingBottom: 100 },
  sectionLabel: { 
    fontSize: 12, 
    color: '#888', 
    fontWeight: '800', 
    letterSpacing: 1.5,
    marginBottom: 15,
    marginLeft: 5
  },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  menuCard: { 
    width: '48%', 
    height: 120, 
    borderRadius: 24, 
    padding: 15,
    justifyContent: 'space-between',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  iconContainer: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    width: 45,
    height: 45,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  menuLabel: { 
    fontSize: 11, 
    fontWeight: '900', 
    color: '#1A2E24',
    lineHeight: 14
  },

  stockList: { gap: 12 },
  stockCard: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  stockInfo: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  stockIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0F4F1',
    justifyContent: 'center',
    alignItems: 'center'
  },
  stockLabel: { fontSize: 13, fontWeight: '800', color: '#2e4a3b' },

  fab: {
    position: 'absolute',
    right: 25,
    bottom: 30,
    backgroundColor: '#2e4a3b',
    width: 65,
    height: 65,
    borderRadius: 22, 
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#2e4a3b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  }
});