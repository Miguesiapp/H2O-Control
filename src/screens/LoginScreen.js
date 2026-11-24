import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, 
  StatusBar, KeyboardAvoidingView, Platform, ActivityIndicator, Animated, Image 
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
          <View style={styles.logoSquareBox}>
            <Image
              source={require('../../assets/logo-white.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brandSub}>SISTEMA LOGÍSTICO & PRODUCCIÓN</Text>
          <Text style={styles.brandTagline}>Soluciones químicas para una agricultura sustentable</Text>
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
  safe: { flex: 1, backgroundColor: '#004ea8' },
  container: { flex: 1, justifyContent: 'center', padding: 25, maxWidth: 460, width: '100%', alignSelf: 'center' },
  
  brandSection: { alignItems: 'center', marginBottom: 36 },
  logoSquareBox: {
    width: 156,
    height: 120,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    padding: 14,
    marginBottom: 16
  },
  logoImage: {
    width: 126,
    height: 92,
  },
  brandSub: { 
    fontSize: 11, 
    color: '#ffffff', 
    letterSpacing: 2.5, 
    fontWeight: '800' 
  },
  brandTagline: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 5,
    fontWeight: '500'
  },
  
  card: { backgroundColor: '#f8fafc', padding: 26, borderRadius: 24, elevation: 12, shadowColor: '#0a1929', shadowOffset: {width: 0, height: 12}, shadowOpacity: 0.18, shadowRadius: 24, borderWidth: 1, borderColor: '#e2e8f0' },
  label: { fontSize: 18, fontWeight: '900', color: '#0a1929', marginBottom: 20, textAlign: 'center', letterSpacing: 0.3 },
  
  inputBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#ffffff', 
    borderRadius: 14, 
    marginBottom: 16, 
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  input: { flex: 1, paddingVertical: 15, marginLeft: 12, color: '#0a1929', fontSize: 15, fontWeight: '600' },
  
  mainBtn: { 
    backgroundColor: '#004ea8', 
    padding: 17, 
    borderRadius: 14, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    elevation: 4,
    shadowColor: '#004ea8',
    shadowOpacity: 0.25,
    gap: 10
  },
  mainBtnText: { color: 'white', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  
  footerLink: { marginTop: 30, alignSelf: 'center' },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkText: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  linkBold: { color: '#fff', fontWeight: '800', textDecorationLine: 'underline' }
});