import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, SafeAreaView, StatusBar } from 'react-native';
import { ChevronLeft, Book, Search } from 'lucide-react-native';
import { RAW_MATERIALS_LIST } from '../config/constants';

export default function DictionaryScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');

  // Formatear la lista para mostrar la MP principal y sus equivalencias
  const dictionaryItems = RAW_MATERIALS_LIST.map(item => {
    const parts = item.split(' / ').map(p => p.trim());
    return {
      primary: parts[0],
      synonyms: parts.slice(1)
    };
  });

  // Filtrar según la búsqueda
  const filteredItems = dictionaryItems.filter(item => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    
    if (item.primary.toLowerCase().includes(query)) return true;
    if (item.synonyms.some(syn => syn.toLowerCase().includes(query))) return true;
    
    return false;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Diccionario de MP</Text>
          <Text style={styles.headerSub}>Equivalencias y Sinónimos</Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.container}>
        <View style={styles.searchBox}>
          <Search color="#94a3b8" size={20} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por cualquier nombre..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {filteredItems.map((item, index) => (
            <View key={index.toString()} style={styles.card}>
              <View style={styles.primaryBox}>
                <Book color="#3b82f6" size={20} style={{ marginRight: 10 }} />
                <Text style={styles.primaryText}>{item.primary}</Text>
              </View>
              {item.synonyms.length > 0 ? (
                <View style={styles.synonymsBox}>
                  <Text style={styles.synonymsLabel}>SE CONOCE TAMBIÉN COMO:</Text>
                  {item.synonyms.map((syn, idx) => (
                    <Text key={idx.toString()} style={styles.synonymItem}>• {syn}</Text>
                  ))}
                </View>
              ) : (
                <View style={styles.synonymsBox}>
                  <Text style={styles.noSynonyms}>Sin equivalencias registradas</Text>
                </View>
              )}
            </View>
          ))}
          {filteredItems.length === 0 && (
            <Text style={styles.emptyText}>No se encontraron resultados para "{searchQuery}"</Text>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  headerSub: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
  
  container: { flex: 1, padding: 20 },
  
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
    elevation: 1
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '600'
  },
  
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1
  },
  primaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1e293b',
    flex: 1
  },
  synonymsBox: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 12
  },
  synonymsLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    marginBottom: 6,
    letterSpacing: 0.5
  },
  synonymItem: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
    marginBottom: 2
  },
  noSynonyms: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic'
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 30,
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600'
  }
});
