import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, 
  StatusBar, KeyboardAvoidingView, Platform, ActivityIndicator 
} from 'react-native';
// IMPORTANTE: Cambio a la librería recomendada para evitar el warning de deprecación
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase'; 
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getDoc, doc } from 'firebase/firestore'; 
import { Droplets, Lock, Mail } from 'lucide-react-native';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Campos incompletos", "Por favor ingresa tus credenciales de acceso.");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      const userDoc = await getDoc(doc(db, "Users", user.uid));

      if (userDoc.exists()) {
        setLoading(false);
        navigation.replace('Home');
      } else {
        setLoading(false);
        Alert.alert("Error de Perfil", "Tu cuenta no tiene un perfil asociado. Contacta al administrador.");
      }

    } catch (error) {
      setLoading(false);
      console.log("Error Code:", error.code);
      
      let message = "Email o contraseña incorrectos.";
      if (error.code === 'auth/user-not-found') message = "El usuario no existe.";
      if (error.code === 'auth/wrong-password') message = "Contraseña incorrecta.";
      
      Alert.alert("Error de acceso", message);
    }
  };

  return (
    // Usamos edges para que el color verde #2e4a3b cubra toda la pantalla (notch incluido)
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.brandContainer}>
          <View style={styles.logoCircle}>
            <Droplets color="#fff" size={45} />
          </View>
          <Text style={styles.title}>H2O CONTROL</Text>
          <Text style={styles.subtitle}>Intelligence System</Text>
        </View>

        <View style={styles.formCard}>
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
              editable={!loading}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Lock color="#2e4a3b" size={20} style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder="Contraseña" 
              placeholderTextColor="#999"
              value={password} 
              secureTextEntry 
              onChangeText={setPassword}
              editable={!loading}
            />
          </View>
          
          <TouchableOpacity 
            style={[styles.button, loading && { opacity: 0.7 }]} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>INGRESAR AL PANEL</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          onPress={() => navigation.navigate('Register')}
          disabled={loading}
          style={styles.linkContainer}
        >
          <Text style={styles.linkText}>¿No tienes cuenta? <Text style={styles.linkBold}>Solicitar acceso</Text></Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#2e4a3b' },
  container: { flex: 1, justifyContent: 'center', padding: 25 },
  brandContainer: { alignItems: 'center', marginBottom: 40 },
  logoCircle: { 
    width: 90, 
    height: 90, 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    borderRadius: 45, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 15
  },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', letterSpacing: 2 },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 3 },
  formCard: { 
    backgroundColor: '#fff', 
    padding: 25, 
    borderRadius: 24, 
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10
  },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f5f7f5', 
    borderRadius: 15, 
    marginBottom: 15, 
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#eee'
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, color: '#333', fontSize: 16 },
  button: { 
    backgroundColor: '#2e4a3b', 
    padding: 18, 
    borderRadius: 15, 
    alignItems: 'center',
    marginTop: 10,
    elevation: 3,
    minHeight: 58,
    justifyContent: 'center'
  },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },
  linkContainer: { paddingVertical: 20 },
  linkText: { textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  linkBold: { color: '#fff', fontWeight: 'bold' }
});