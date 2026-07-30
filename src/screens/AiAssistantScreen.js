import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Send, Sparkles, BrainCircuit, Bot } from 'lucide-react-native';
import { chatWithLogisticsAI } from '../services/aiService';
import { db } from '../config/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function AiAssistantScreen({ navigation }) {
  const [messages, setMessages] = useState([
    { 
      id: '1', 
      text: '¡Hola! Soy H2O Neural. Puedo ayudarte a calcular órdenes de producción, cruzar recetas con el stock físico o predecir faltantes de compras. ¿Qué necesitas fabricar hoy?', 
      sender: 'ai' 
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Contextos de Planta que inyectaremos a la IA
  const [plantContext, setPlantContext] = useState({ inventory: [], formulas: [] });
  const flatListRef = useRef(null);

  // Al abrir la pantalla, descargamos un "snapshot" de la planta para que la IA piense
  useEffect(() => {
    const fetchPlantData = async () => {
      try {
        const invSnap = await getDocs(collection(db, "Inventory"));
        const formSnap = await getDocs(collection(db, "Formulas_Maestras"));
        
        const inventory = invSnap.docs.map(d => d.data());
        const formulas = formSnap.docs.map(d => d.data());
        
        setPlantContext({ inventory, formulas });
      } catch (error) {
        console.error("Error cargando contexto para IA:", error);
      }
    };
    fetchPlantData();
  }, []);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage = { id: Date.now().toString(), text: inputText, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      // Enviamos el mensaje junto con el historial y los datos reales de la planta
      const aiResponseText = await chatWithLogisticsAI(inputText, messages, plantContext);
      
      const aiMessage = { 
        id: (Date.now() + 1).toString(), 
        text: aiResponseText, 
        sender: 'ai' 
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage = { id: Date.now().toString(), text: 'Ocurrió un error en mis circuitos. Verifica tu conexión a internet.', sender: 'ai' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isAi = item.sender === 'ai';
    return (
      <View style={[styles.messageBubble, isAi ? styles.messageAi : styles.messageUser]}>
        {isAi && (
          <View style={styles.aiAvatar}>
            <Bot color="#fff" size={16} />
          </View>
        )}
        <View style={[styles.messageContent, isAi ? styles.contentAi : styles.contentUser]}>
          <Text style={[styles.messageText, isAi ? styles.textAi : styles.textUser]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))} style={styles.backBtn}>
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
          <BrainCircuit color="#3b82f6" size={24} />
          <View>
            <Text style={styles.headerTitle}>H2O Neural</Text>
            <Text style={styles.headerSub}>Asistente de Producción</Text>
          </View>
        </View>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList maximumZoomScale={1}
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ej: ¿Hay stock para hacer 1000L de Action?"
            placeholderTextColor="#94a3b8"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendBtn, (!inputText.trim() || loading) && { opacity: 0.5 }]} 
            onPress={handleSend}
            disabled={!inputText.trim() || loading}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Send color="#fff" size={20} />}
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
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2 
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  headerSub: { fontSize: 11, color: '#3b82f6', textTransform: 'uppercase', fontWeight: '800', letterSpacing: 0.5 },
  
  container: { flex: 1 },
  chatContainer: { padding: 20, paddingBottom: 10 },
  
  messageBubble: { flexDirection: 'row', marginBottom: 20, maxWidth: '85%' },
  messageAi: { alignSelf: 'flex-start' },
  messageUser: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  
  aiAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', marginRight: 10, marginTop: 5 },
  
  messageContent: { padding: 15, borderRadius: 20, elevation: 1 },
  contentAi: { backgroundColor: '#fff', borderTopLeftRadius: 5, borderWidth: 1, borderColor: '#e2e8f0' },
  contentUser: { backgroundColor: '#0f172a', borderTopRightRadius: 5 },
  
  messageText: { fontSize: 15, lineHeight: 22 },
  textAi: { color: '#1e293b' },
  textUser: { color: '#f8fafc' },

  inputContainer: { flexDirection: 'row', padding: 15, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0', alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 12, maxHeight: 100, fontSize: 15, color: '#0f172a' },
  sendBtn: { backgroundColor: '#3b82f6', width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginBottom: 2 }
});