import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Package, 
  Container, 
  ChevronLeft,
  Database,
  Beaker,
  Archive,
  Plus
} from 'lucide-react-native';
// Importamos el modal que creamos
import QuickAddModal from '../components/QuickAddModal';

export default function CompanyDetailScreen({ route, navigation }) {
  const { companyName } = route.params;
  const [isModalVisible, setIsModalVisible] = useState(false);

  const menuOptions = [
    { id: 'ingresos', title: 'INGRESOS / COMPRAS', icon: <ArrowDownCircle color="#2e4a3b" />, color: '#f1f8f4', screen: 'IncomingInventory' },
    { id: 'egresos', title: 'EGRESOS / DESPACHO', icon: <ArrowUpCircle color="#d32f2f" />, color: '#fff5f5', screen: 'OutgoingInventory' },
    { id: 'prod', title: 'ORDEN DE PRODUCCIÓN', icon: <Package color="#ef6c00" />, color: '#fff9f0', screen: 'ProductionOrder' },
    { id: 'envasado', title: 'ORDEN DE ENVASADO', icon: <Container color="#1976d2" />, color: '#f0f7ff', screen: 'PackagingOrder' },
  ];

  const stockOptions = [
    { id: 'stock_mp', title: 'MATERIA PRIMA', icon: <Database color="#2e4a3b" />, color: '#f1f8f4', type: 'MP' },
    { id: 'stock_pt', title: 'PRODUCTO TERMINADO (Granel)', icon: <Beaker color="#2e4a3b" />, color: '#f1f8f4', type: 'PT' },
    { id: 'stock_final', title: 'STOCK FINAL (Envasado)', icon: <Archive color="#2e4a3b" />, color: '#f1f8f4', type: 'FINAL' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER INSTITUCIONAL */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft color="#2e4a3b" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
            <Text style={styles.headerTitle}>{companyName}</Text>
            <Text style={styles.headerSubtitle}>Gestión de Unidad</Text>
        </View>
        <View style={{ width: 28 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionTitle}>Operaciones Logísticas</Text>
        <View style={styles.grid}>
          {menuOptions.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={[styles.menuCard, { backgroundColor: item.color }]}
              onPress={() => navigation.navigate(item.screen, { companyName })}
            >
              {item.icon}
              <Text style={styles.menuLabel}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Consulta de Inventarios</Text>
        <View style={styles.grid}>
          {stockOptions.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={[styles.stockCard, { backgroundColor: item.color }]}
              onPress={() => navigation.navigate('StockView', { companyName, stockType: item.type, title: item.title })}
            >
              <View style={styles.row}>
                {item.icon}
                <Text style={styles.stockLabel}>{item.title}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* BOTÓN FLOTANTE (FAB) PARA CARGA INICIAL */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setIsModalVisible(true)}
      >
        <Plus color="#fff" size={30} />
      </TouchableOpacity>

      {/* MODAL DE CARGA RÁPIDA */}
      <QuickAddModal 
        visible={isModalVisible} 
        onClose={() => setIsModalVisible(false)} 
        companyName={companyName}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0' 
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#2e4a3b' },
  headerSubtitle: { fontSize: 10, color: '#999', textTransform: 'uppercase' },
  container: { padding: 20, paddingBottom: 100 },
  sectionTitle: { 
    fontSize: 14, 
    color: '#2e4a3b', 
    marginTop: 10, 
    marginBottom: 15, 
    fontWeight: 'bold', 
    letterSpacing: 0.5 
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  menuCard: { 
    width: '48%', 
    aspectRatio: 1.1, 
    borderRadius: 15, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 15, 
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)'
  },
  menuLabel: { 
    marginTop: 8, 
    fontSize: 10, 
    fontWeight: 'bold', 
    textAlign: 'center', 
    color: '#444' 
  },
  stockCard: { 
    width: '100%', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 10, 
    borderLeftWidth: 5, 
    borderLeftColor: '#2e4a3b' 
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  stockLabel: { fontSize: 13, fontWeight: '700', color: '#2e4a3b' },
  fab: {
    position: 'absolute',
    right: 25,
    bottom: 30,
    backgroundColor: '#2e4a3b',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  }
});