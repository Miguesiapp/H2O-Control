import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, 
  StatusBar, KeyboardAvoidingView, Platform, ActivityIndicator, Animated 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase'; 
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore'; 
import { Lock, Mail, ChevronRight, ShieldCheck } from 'lucide-react-native';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Animaciones
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      Alert.alert("Acceso Restringido", "Por favor ingresa tus credenciales autorizadas.");
      return;
    }

    setLoading(true);

    try {
      // 1. Autenticación en Firebase
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      // 2. Validación de Perfil en Firestore
      const userRef = doc(db, "Users", user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        // PRO TIP: Actualizamos el último acceso para auditoría del dueño
        await updateDoc(userRef, { lastLogin: serverTimestamp() });
        
        setLoading(false);
        navigation.replace('Home');
      } else {
        setLoading(false);
        Alert.alert("Perfil no Detectado", "Tu cuenta de acceso no tiene un perfil corporativo vinculado.");
      }

    } catch (error) {
      setLoading(false);
      console.log("Login Error Code:", error.code);
      
      let message = "Las credenciales ingresadas no son válidas.";
      if (error.code === 'auth/user-not-found') message = "No existe un empleado registrado con ese correo.";
      if (error.code === 'auth/wrong-password') message = "La contraseña es incorrecta. Verifica e intenta de nuevo.";
      if (error.code === 'auth/too-many-requests') message = "Demasiados intentos fallidos. Cuenta bloqueada temporalmente.";
      
      Alert.alert("Fallo de Autenticación", message);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        {/* CABECERA CORPORATIVA */}
        <Animated.View style={[styles.brandSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoTitle}>H2O</Text>
            <Text style={styles.logoSub}>CONTROL</Text>
          </View>
          <Text style={styles.brandSub}>AGRICULTURA SUSTENTABLE</Text>
        </Animated.View>

        {/* TARJETA DE LOGIN */}
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.label}>Inicio de Sesión</Text>
          
          <View style={styles.inputBox}>
            <Mail color="#94a3b8" size={20} />
            <TextInput 
              style={styles.input} 
              placeholder="Email Corporativo" 
              placeholderTextColor="#94a3b8"
              value={email} 
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>
          
          <View style={styles.inputBox}>
            <Lock color="#94a3b8" size={20} />
            <TextInput 
              style={styles.input} 
              placeholder="Contraseña" 
              placeholderTextColor="#94a3b8"
              value={password} 
              secureTextEntry 
              onChangeText={setPassword}
              editable={!loading}
            />
          </View>
          
          <TouchableOpacity 
            style={[styles.mainBtn, loading && { opacity: 0.8 }]} 
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.mainBtnText}>ACCEDER AL PANEL</Text>
                <ChevronRight color="#fff" size={20} />
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* ACCESO PARA NUEVOS EMPLEADOS */}
        <TouchableOpacity 
          onPress={() => navigation.navigate('Register')}
          disabled={loading}
          style={styles.footerLink}
        >
          <View style={styles.footerRow}>
            <ShieldCheck color="rgba(255,255,255,0.5)" size={16} />
            <Text style={styles.linkText}>
              ¿Eres nuevo? <Text style={styles.linkBold}>Solicitar alta de personal</Text>
            </Text>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#004ca8' },
  container: { flex: 1, justifyContent: 'center', padding: 25 },
  
  brandSection: { alignItems: 'center', marginBottom: 45 },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: 15
  },
  logoTitle: {
    fontSize: 40,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: -4,
  },
  logoSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 3,
    marginLeft: 3,
  },
  brandSub: { 
    fontSize: 11, 
    color: 'rgba(255,255,255,0.7)', 
    letterSpacing: 2, 
    fontWeight: '600' 
  },
  
  card: { backgroundColor: '#ffffff', padding: 25, borderRadius: 24, elevation: 10, shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.1, shadowRadius: 20 },
  label: { fontSize: 18, fontWeight: '900', color: '#1e293b', marginBottom: 20, textAlign: 'center' },
  
  inputBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f8fafc', 
    borderRadius: 16, 
    marginBottom: 18, 
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  input: { flex: 1, paddingVertical: 16, marginLeft: 12, color: '#0f172a', fontSize: 16, fontWeight: '600' },
  
  mainBtn: { 
    backgroundColor: '#0f172a', 
    padding: 18, 
    borderRadius: 16, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    gap: 10
  },
  mainBtnText: { color: 'white', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  
  footerLink: { marginTop: 35, alignSelf: 'center' },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  linkBold: { color: '#fff', fontWeight: 'bold', textDecorationLine: 'underline' }
});