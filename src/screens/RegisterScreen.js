import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  SafeAreaView, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { auth, db } from '../config/firebase';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth'; 
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ChevronLeft, User, Mail, Lock, ShieldCheck } from 'lucide-react-native';

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    // 1. Limpieza y validación inicial
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();

    if (!cleanEmail || !password || !cleanName) {
      Alert.alert("Campos incompletos", "Por favor completa todos los datos para el alta de personal.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Contraseña débil", "La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      // 2. Crear usuario en Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      try {
        // 3. Crear el perfil en Firestore (Colección Users)
        // IMPORTANTE: Asegurate de haber publicado las Reglas de Firestore que te pasé
        await setDoc(doc(db, "Users", user.uid), {
          uid: user.uid,
          name: cleanName,
          email: cleanEmail,
          role: 'operario', // Por defecto todos entran como operarios
          createdAt: serverTimestamp()
        });

        setLoading(false);
        Alert.alert("Usuario Creado", "Bienvenido al sistema H2O Control.");
        navigation.replace('Home');

      } catch (firestoreError) {
        // Si Firestore falla (por reglas o red), borramos el usuario de Auth
        // para evitar cuentas huérfanas y permitir re-intento.
        await deleteUser(user);
        setLoading(false);
        console.error("Error en Firestore:", firestoreError);
        Alert.alert("Error de Base de Datos", "No se pudo crear el perfil. Contacta al administrador.");
      }

    } catch (authError) {
      setLoading(false);
      let errorMessage = "No se pudo completar el registro.";
      
      if (authError.code === 'auth/email-already-in-use') {
        errorMessage = "Este correo ya está registrado por otro empleado.";
      } else if (authError.code === 'auth/invalid-email') {
        errorMessage = "El formato del correo electrónico no es válido.";
      }
      
      Alert.alert("Error de Registro", errorMessage);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft color="#fff" size={28} />
          </TouchableOpacity>

          <View style={styles.brandContainer}>
            <View style={styles.logoCircle}>
              <ShieldCheck color="#fff" size={40} />
            </View>
            <Text style={styles.title}>Alta de Personal</Text>
            <Text style={styles.subtitle}>Gestión de Accesos H2O</Text>
          </View>

          <View style={styles.formCard}>
            {/* Input Nombre */}
            <View style={styles.inputContainer}>
              <User color="#2e4a3b" size={20} style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="Nombre completo" 
                placeholderTextColor="#999"
                value={displayName} 
                onChangeText={setDisplayName}
              />
            </View>

            {/* Input Email */}
            <View style={styles.inputContainer}>
              <Mail color="#2e4a3b" size={20} style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="Correo electrónico" 
                placeholderTextColor="#999"
                value={email} 
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            
            {/* Input Password */}
            <View style={styles.inputContainer}>
              <Lock color="#2e4a3b" size={20} style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="Contraseña (mín. 6 caracteres)" 
                placeholderTextColor="#999"
                value={password} 
                secureTextEntry 
                onChangeText={setPassword}
              />
            </View>
            
            {/* Botón Registro */}
            <TouchableOpacity 
              style={[styles.button, loading && { opacity: 0.7 }]} 
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? "PROCESANDO..." : "CONFIRMAR ALTA"}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.footerLink}>
            <Text style={styles.linkText}>¿Ya tienes cuenta? <Text style={styles.linkBold}>Inicia sesión</Text></Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#2e4a3b' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 25 },
  backBtn: { position: 'absolute', top: 10, left: 10, padding: 10, zIndex: 10 },
  brandContainer: { alignItems: 'center', marginBottom: 30 },
  logoCircle: { 
    width: 80, 
    height: 80, 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    borderRadius: 40, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 15
  },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 2 },
  formCard: { 
    backgroundColor: '#fff', 
    padding: 25, 
    borderRadius: 20, 
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10
  },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f5f7f5', 
    borderRadius: 12, 
    marginBottom: 15, 
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#eee'
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, color: '#333', fontSize: 15 },
  button: { 
    backgroundColor: '#2e4a3b', 
    padding: 18, 
    borderRadius: 12, 
    alignItems: 'center',
    marginTop: 10,
    elevation: 3
  },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },
  footerLink: { marginTop: 25 },
  linkText: { textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  linkBold: { color: '#fff', fontWeight: 'bold' }
});