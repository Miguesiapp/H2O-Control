import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { ChevronLeft, AlertTriangle } from 'lucide-react-native';

export default function LowStockAlertsScreen({ route, navigation }) {
  const { items = [] } = route.params || {};

  const renderItem = ({ item }) => (
    <View style={styles.alertCard}>
      <View style={styles.iconBox}>
        <AlertTriangle color="#ef4444" size={24} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.itemName}>{item}</Text>
        <Text style={styles.actionText}>REPONER STOCK</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
          <Text style={styles.headerTitle}>Alertas de Stock</Text>
          <Text style={styles.headerSub}>Ítems por debajo del mínimo</Text>
        </View>
        <View style={{width: 40}} />
      </View>

      <View style={styles.container}>
        {items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No hay alertas activas. El stock está saludable.</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item, index) => index.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  backBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  headerSub: { fontSize: 13, color: '#64748b' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  listContent: { padding: 20 },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  cardContent: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '800', color: '#991b1b', marginBottom: 4 },
  actionText: { fontSize: 13, fontWeight: '700', color: '#ef4444' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyText: { fontSize: 16, color: '#64748b', textAlign: 'center' }
});
