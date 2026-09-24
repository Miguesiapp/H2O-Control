import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert, 
  ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform
} from 'react-native';
import { auth, db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { ChevronLeft, Search, Plus, Calendar, Clock, Trash2 } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { isAdmin } from '../config/permissions';

export default function EventualitiesScreen({ navigation }) {
  const [eventualities, setEventualities] = useState([]);
  const [filteredEventualities, setFilteredEventualities] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newNote, setNewNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const isUserAdmin = isAdmin(auth.currentUser?.email);

  useEffect(() => {
    const q = query(collection(db, 'Eventualities'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEventualities(data);
      setFilteredEventualities(data);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
      Alert.alert('Error', 'No se pudieron cargar las eventualidades.');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredEventualities(eventualities);
      return;
    }
    const lowerQuery = searchQuery.toLowerCase();
    const filtered = eventualities.filter(item => 
      (item.text && item.text.toLowerCase().includes(lowerQuery)) ||
      (item.user && item.user.toLowerCase().includes(lowerQuery))
    );
    setFilteredEventualities(filtered);
  }, [searchQuery, eventualities]);

  const handleSaveNote = async () => {
    if (!newNote.trim()) return;

    try {
      setIsSaving(true);
      await addDoc(collection(db, 'Eventualities'), {
        text: newNote.trim(),
        user: auth.currentUser?.email || 'Sistema',
        createdAt: serverTimestamp()
      });
      setNewNote('');
      Toast.show({ type: 'success', text1: 'Nota guardada', text2: 'El registro se guardó correctamente.' });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo guardar la nota.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    Alert.alert("Eliminar Registro", "¿Seguro que deseas eliminar esta eventualidad?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: async () => {
        try {
          await deleteDoc(doc(db, 'Eventualities', id));
          Toast.show({ type: 'success', text1: 'Registro eliminado' });
        } catch (error) {
          Alert.alert("Error", "No se pudo eliminar el registro.");
        }
      }}
    ]);
  };

  const renderItem = ({ item }) => {
    const date = item.createdAt ? item.createdAt.toDate() : new Date();
    const formattedDate = date.toLocaleDateString('es-AR');
    const formattedTime = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={styles.noteCard}>
        <View style={styles.noteHeader}>
          <Text style={styles.noteUser}>{item.user}</Text>
          {isUserAdmin && (
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={{padding: 4}}>
              <Trash2 size={16} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.noteText}>{item.text}</Text>
        <View style={styles.noteFooter}>
          <View style={styles.footerItem}>
            <Calendar size={12} color="#94a3b8" />
            <Text style={styles.footerText}>{formattedDate}</Text>
          </View>
          <View style={styles.footerItem}>
            <Clock size={12} color="#94a3b8" />
            <Text style={styles.footerText}>{formattedTime}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Eventualidades</Text>
        <View style={{ width: 30 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Search color="#94a3b8" size={20} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar palabras clave..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <FlatList
            data={filteredEventualities}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={() => (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No hay registros de eventualidades.</Text>
              </View>
            )}
          />
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.noteInput}
            placeholder="Escribe una nueva nota o eventualidad..."
            placeholderTextColor="#94a3b8"
            multiline
            value={newNote}
            onChangeText={setNewNote}
          />
          <TouchableOpacity 
            style={[styles.saveBtn, !newNote.trim() && { backgroundColor: '#cbd5e1' }]} 
            onPress={handleSaveNote}
            disabled={!newNote.trim() || isSaving}
          >
            {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Plus color="#fff" size={24} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', 
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2,
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#0f172a',
    outlineStyle: 'none'
  },
  
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  noteCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteUser: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3b82f6',
  },
  noteText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
    marginBottom: 12,
  },
  noteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBox: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
    fontStyle: 'italic',
  },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  noteInput: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 48,
    maxHeight: 120,
    fontSize: 15,
    color: '#0f172a',
    textAlignVertical: 'top',
    outlineStyle: 'none'
  },
  saveBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
