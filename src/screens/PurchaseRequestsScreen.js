import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  TextInput, ActivityIndicator, StatusBar, Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../config/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ChevronLeft, Send, ShoppingCart, CheckCircle2 } from 'lucide-react-native';
import Toast from 'react-native-toast-message';

export default function PurchaseRequestsScreen({ navigation }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newRequestText, setNewRequestText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "PurchaseRequests"), 
      orderBy("createdAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(data);
      setLoading(false);
    }, (error) => {
      console.error("Error al cargar pedidos:", error);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const handleSendRequest = async () => {
    if (!newRequestText.trim()) return;

    try {
      setIsSubmitting(true);
      const currentUser = auth.currentUser?.email || 'Sistema';
      
      await addDoc(collection(db, "PurchaseRequests"), {
        text: newRequestText.trim(),
        status: 'PENDING',
        requestedBy: currentUser,
        createdAt: serverTimestamp(),
      });
      
      setNewRequestText('');
      Toast.show({ type: 'success', text1: 'Pedido Enviado', text2: 'El pedido fue registrado exitosamente.' });
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo enviar el pedido.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRequest = (id) => {
    Alert.alert(
      "Confirmar Compra",
      "¿Estás seguro que este pedido ya fue gestionado o comprado?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sí, confirmar", 
          onPress: async () => {
            try {
              const currentUser = auth.currentUser?.email || 'Sistema';
              await updateDoc(doc(db, "PurchaseRequests", id), {
                status: 'COMPLETED',
                confirmedBy: currentUser,
                confirmedAt: serverTimestamp()
              });
              Toast.show({ type: 'success', text1: 'Pedido Confirmado', text2: 'Marcado como completado.' });
            } catch (error) {
              Alert.alert("Error", "No se pudo actualizar el estado.");
            }
          }
        }
      ]
    );
  };

  const renderRequestCard = ({ item }) => {
    const isCompleted = item.status === 'COMPLETED';
    
    const themeColor = isCompleted ? '#10b981' : '#ef4444';
    const bgTheme = isCompleted ? '#ecfdf5' : '#fef2f2';
    
    // Formatear la fecha
    let dateStr = '';
    if (item.createdAt) {
      const date = new Date(item.createdAt.seconds * 1000);
      dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    return (
      <View style={[styles.card, { borderLeftColor: themeColor }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardText}>{item.text}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Pedido por:</Text>
            <Text style={styles.metaValue}>{item.requestedBy}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Fecha:</Text>
            <Text style={styles.metaValue}>{dateStr}</Text>
          </View>
          
          {isCompleted && (
            <View style={[styles.metaRow, { marginTop: 5 }]}>
              <Text style={[styles.metaLabel, { color: '#059669' }]}>Confirmado por:</Text>
              <Text style={[styles.metaValue, { color: '#059669' }]}>{item.confirmedBy}</Text>
            </View>
          )}
        </View>

        {!isCompleted ? (
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: bgTheme, borderColor: themeColor }]}
            onPress={() => handleConfirmRequest(item.id)}
          >
            <CheckCircle2 color={themeColor} size={20} />
            <Text style={[styles.actionBtnText, { color: themeColor, fontSize: 13, marginLeft: 6 }]}>Pedido Pendiente</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.actionBtn, { backgroundColor: '#10b981', borderColor: '#059669', flexDirection: 'row', paddingHorizontal: 12 }]}>
            <CheckCircle2 color="#fff" size={20} />
            <Text style={[styles.actionBtnText, { color: '#fff', fontSize: 13, marginLeft: 6 }]}>Pedido Realizado</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
        <View style={{ flex: 1, paddingLeft: 10 }}>
          <Text style={styles.headerTitle}>Pedidos Internos</Text>
          <Text style={styles.headerSub}>Muro de solicitudes de compra</Text>
        </View>
      </View>

      {/* CAJA DE TEXTO (NUEVO PEDIDO) */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Ej: Faltan rollos de film stretch..."
            value={newRequestText}
            onChangeText={setNewRequestText}
            multiline
            maxLength={150}
            placeholderTextColor="#94a3b8"
          />
        </View>
        <TouchableOpacity 
          style={[styles.sendBtn, (!newRequestText.trim() || isSubmitting) && styles.sendBtnDisabled]} 
          onPress={handleSendRequest}
          disabled={!newRequestText.trim() || isSubmitting}
        >
          {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Send color="#fff" size={20} />}
        </TouchableOpacity>
      </View>

      {/* LISTA DE PEDIDOS */}
      <View style={styles.listContainer}>
        {loading ? (
          <ActivityIndicator color="#ef4444" size="large" style={{ marginTop: 40 }} />
        ) : requests.length === 0 ? (
          <View style={styles.emptyBox}>
            <ShoppingCart color="#cbd5e1" size={48} />
            <Text style={styles.emptyText}>No hay pedidos registrados.</Text>
          </View>
        ) : (
          <FlatList
            data={requests}
            keyExtractor={item => item.id}
            renderItem={renderRequestCard}
            contentContainerStyle={{ paddingBottom: 40 }}
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
    paddingHorizontal: 15, 
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  backBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 12, 
    backgroundColor: '#f1f5f9', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1, 
    borderColor: '#e2e8f0' 
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  headerSub: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    alignItems: 'flex-end',
    gap: 10
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 12,
    minHeight: 50,
    maxHeight: 100
  },
  input: {
    fontSize: 16,
    color: '#334155',
  },
  sendBtn: {
    width: 50,
    height: 50,
    backgroundColor: '#ef4444',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#ef4444',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 }
  },
  sendBtnDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0
  },
  
  listContainer: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 15
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 15
  },
  
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 6,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  cardText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 10
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    width: 90
  },
  metaValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    flex: 1
  },
  
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10
  },
  actionBtnText: {
    fontSize: 10,
    fontWeight: '900',
    marginTop: 4,
    textTransform: 'uppercase'
  },
  completedBadge: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 50,
    marginLeft: 10
  }
});
