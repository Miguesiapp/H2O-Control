import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  TextInput, ActivityIndicator, StatusBar, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { collection, onSnapshot, query, orderBy, where, doc, deleteDoc } from 'firebase/firestore';
import { ChevronLeft, Plus, Search, Beaker, CheckCircle2, FlaskConical, AlertCircle, AlertTriangle, Edit3, Trash2 } from 'lucide-react-native';
import Toast from 'react-native-toast-message';

const normalizeString = (str) => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

export default function FormulationScreen({ navigation }) {
  const [formulas, setFormulas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [expandedFormulas, setExpandedFormulas] = useState([]);

  const toggleExpand = (id) => {
    setExpandedFormulas(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleDelete = (id, name) => {
    Alert.alert(
      "Eliminar Fórmula",
      `¿Estás seguro que deseas eliminar la receta de ${name}? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", 
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "Formulas_Maestras", id));
              Toast.show({ type: 'success', text1: 'Eliminado', text2: `La receta de ${name} fue eliminada permanentemente.` });
            } catch (e) {
              Alert.alert("Error", "No se pudo eliminar la fórmula.");
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    // Apuntamos a Formulas_Maestras y solo traemos las ACTIVAS
    const q = query(
      collection(db, "Formulas_Maestras"), 
      where("status", "==", "ACTIVA"),
      orderBy("productName", "asc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFormulas(data);
      setLoading(false);
    }, (error) => {
      console.error("Error al cargar fórmulas maestras: ", error);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  // Filtrado de búsqueda
  const filteredFormulas = formulas.filter(f => 
    normalizeString(f.productName).includes(normalizeString(searchText))
  );

  const renderFormula = ({ item }) => {
    // Lógica para determinar colorimetría según el pH (Ácido vs Alcalino)
    const isAcid = item.phObjetivo < 7;
    const themeColor = isAcid ? '#ef4444' : '#3b82f6';
    const bgTheme = isAcid ? '#fef2f2' : '#eff6ff';
    const borderTheme = isAcid ? '#fecaca' : '#bfdbfe';

    const isExpanded = expandedFormulas.includes(item.id);

    return (
      <View style={[styles.card, { borderTopColor: themeColor }]}>
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => toggleExpand(item.id)}
        >
          <View style={styles.cardHeader}>
            <View style={styles.titleContainer}>
              <View style={[styles.iconBox, { backgroundColor: bgTheme }]}>
                <Beaker size={20} color={themeColor} />
              </View>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.productTitle}>{item.productName}</Text>
                <Text style={styles.companySub}>{item.companyTarget}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.typeBadge, { backgroundColor: bgTheme, borderColor: borderTheme }]}>
                <Text style={[styles.typeBadgeText, { color: themeColor }]}>
                  {isAcid ? 'ÁCIDO' : 'ALCALINO'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('AddFormula', { formulaToEdit: item })} style={{ padding: 5 }}>
                <Edit3 size={20} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id, item.productName)} style={{ padding: 5 }}>
                <Trash2 size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View>
            <View style={styles.specsRow}>
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>pH TEÓRICO</Text>
                <Text style={[styles.specValue, { color: themeColor }]}>{item.phObjetivo}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>DENSIDAD (g/cm³)</Text>
                <Text style={styles.specValue}>{item.densidadObjetivo}</Text>
              </View>
            </View>

            <View style={styles.compositionBox}>
              <Text style={styles.formulaTitle}>Composición / Protocolo</Text>
              <View style={styles.ingredientsList}>
                {item.ingredients?.map((ing, index) => {
                  if (ing.type === 'NOTE') {
                    return (
                      <View key={index} style={[styles.ingRow, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                        <View style={[styles.ingDot, { backgroundColor: '#f87171' }]} />
                        <Text style={[styles.ingText, { color: '#991b1b', fontWeight: '700' }]}>{ing.text}</Text>
                      </View>
                    );
                  }
                  return (
                    <View key={index} style={styles.ingRow}>
                      <View style={styles.ingDot} />
                      <Text style={styles.ingText}>{ing.name}</Text>
                      <Text style={styles.ingPercentage}>{ing.percentage}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={[styles.warningBox, { backgroundColor: bgTheme, borderColor: borderTheme }]}>
              <AlertTriangle size={14} color={themeColor} />
              <Text style={[styles.warningText, { color: themeColor }]}>
                Precaución: {isAcid ? 'Reacciona violentamente con bases fuertes.' : 'Reacciona violentamente con ácidos fuertes.'}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER ENTERPRISE */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))} style={styles.backBtn}>
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
          <Text style={styles.headerTitle}>Formulación</Text>
          <Text style={styles.headerSub}>Catálogo de Fórmulas</Text>
        </View>
        <TouchableOpacity 
          style={styles.headerAddBtn}
          onPress={() => navigation.navigate('AddFormula')}
        >
          <Plus color="#fff" size={22} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search color="#94a3b8" size={20} />
          <TextInput 
            style={styles.searchInput} 
            placeholder="Buscar por nombre de producto..." 
            placeholderTextColor="#94a3b8"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText !== '' && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <ListFilter color="#64748b" size={20} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0f172a" />
          <Text style={styles.loadingText}>Sincronizando recetas maestras...</Text>
        </View>
      ) : (
        <FlatList maximumZoomScale={1} 
          data={filteredFormulas}
          keyExtractor={item => item.id}
          renderItem={renderFormula}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Beaker color="#cbd5e1" size={48} />
              <Text style={styles.emptyText}>
                {searchText ? 'No se encontraron fórmulas con ese nombre.' : 'El catálogo de fórmulas maestras está vacío.'}
              </Text>
            </View>
          }
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2, zIndex: 10
  },
  backBtn: { padding: 5 },
  headerAddBtn: { backgroundColor: '#0f172a', padding: 8, borderRadius: 12, elevation: 2, shadowColor: '#0f172a', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
  aiBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  headerSub: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: '800', letterSpacing: 0.5 },
  
  searchContainer: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10, backgroundColor: '#f8fafc' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 15, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 15, color: '#0f172a', fontWeight: '500' },
  
  listContainer: { padding: 20, paddingBottom: 100 },
  
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', borderTopWidth: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  titleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox: { padding: 10, borderRadius: 12, marginRight: 12 },
  productTitle: { fontSize: 17, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  companySub: { fontSize: 11, color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  
  typeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  typeBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  
  specsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, backgroundColor: '#f8fafc', padding: 15, borderRadius: 14, borderWidth: 1, borderColor: '#f1f5f9' },
  specItem: { alignItems: 'center', flex: 1 },
  divider: { width: 1, height: '100%', backgroundColor: '#e2e8f0' },
  specLabel: { fontSize: 9, color: '#64748b', fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  specValue: { fontSize: 18, fontWeight: '900', color: '#1e293b' },
  
  compositionBox: { marginBottom: 15 },
  formulaTitle: { fontSize: 12, fontWeight: '800', marginBottom: 12, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
  ingredientsList: { gap: 8 },
  ingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#f1f5f9', padding: 10, borderRadius: 10 },
  ingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#cbd5e1', marginRight: 10 },
  ingText: { fontSize: 13, color: '#334155', fontWeight: '600', flex: 1, paddingRight: 10 },
  ingPercentage: { fontSize: 14, fontWeight: '900', color: '#0f172a', minWidth: 45, textAlign: 'right' },
  
  warningBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 10 },
  warningText: { fontSize: 11, fontWeight: '700', flex: 1, lineHeight: 16 },
  
  
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 50 },
  loadingText: { marginTop: 15, color: '#64748b', fontWeight: '700', fontSize: 14 },
  emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyText: { textAlign: 'center', marginTop: 15, color: '#94a3b8', fontWeight: '600', fontSize: 14, lineHeight: 22 }
});