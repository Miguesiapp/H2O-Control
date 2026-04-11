import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Alert, StatusBar, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../config/firebase';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth'; 
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ChevronLeft, User, Mail, Lock, ShieldCheck, UserPlus } from 'lucide-react-native';

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();

    if (!cleanEmail || !password || !cleanName) {
      Alert.alert("Campos Requeridos", "Por favor completa todos los datos para el alta de personal.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Seguridad", "La contraseña debe tener al menos 6 caracteres por política de la empresa.");
      return;
    }

    setLoading(true);

    try {
      // 1. Registro en Auth
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      try {
        // 2. Creación de Perfil Corporativo en Firestore
        await setDoc(doc(db, "Users", user.uid), {
          uid: user.uid,
          name: cleanName,
          email: cleanEmail,
          role: 'operario', // Nivel de acceso base
          status: 'activo',
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        });

        setLoading(false);
        Alert.alert("Alta Exitosa", `Bienvenido ${cleanName}. Se ha creado tu legajo digital.`);
        navigation.replace('Home');

      } catch (firestoreError) {
        // Rollback: Si Firestore falla, borramos el usuario de Auth para evitar inconsistencias
        await deleteUser(user);
        setLoading(false);
        Alert.alert("Error de Sistema", "Fallo al crear el perfil en la base de datos central.");
      }

    } catch (authError) {
      setLoading(false);
      let errorMessage = "No se pudo procesar el alta.";
      if (authError.code === 'auth/email-already-in-use') errorMessage = "Este correo ya pertenece a un empleado registrado.";
      if (authError.code === 'auth/invalid-email') errorMessage = "El formato del correo es inválido.";
      
      Alert.alert("Fallo de Autenticación", errorMessage);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft color="#fff" size={28} />
          </TouchableOpacity>

          <View style={styles.brandSection}>
            <View style={styles.logoBadge}>
              <UserPlus color="#10b981" size={35} />
            </View>
            <Text style={styles.brandTitle}>H2O Control</Text>
            <Text style={styles.brandSub}>ALTA DE NUEVO PERSONAL</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Información de Legajo</Text>
            
            <View style={styles.inputBox}>
              <User color="#64748b" size={20} />
              <TextInput 
                style={styles.input} 
                placeholder="Nombre y Apellido completo" 
                placeholderTextColor="#94a3b8"
                value={displayName} 
                onChangeText={setDisplayName}
              />
            </View>

            <View style={styles.inputBox}>
              <Mail color="#64748b" size={20} />
              <TextInput 
                style={styles.input} 
                placeholder="Correo corporativo o personal" 
                placeholderTextColor="#94a3b8"
                value={email} 
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputBox}>
              <Lock color="#64748b" size={20} />
              <TextInput 
                style={styles.input} 
                placeholder="Contraseña de acceso" 
                placeholderTextColor="#94a3b8"
                value={password} 
                secureTextEntry 
                onChangeText={setPassword}
              />
            </View>

            <TouchableOpacity 
              style={[styles.mainBtn, loading && { opacity: 0.8 }]} 
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.mainBtnText}>CONFIRMAR REGISTRO</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.footerBtn}>
            <Text style={styles.footerText}>
              ¿Ya tienes una cuenta? <Text style={{fontWeight: 'bold', color: '#fff'}}>Inicia Sesión</Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  scrollContent: { flexGrow: 1, padding: 25, justifyContent: 'center' },
  backBtn: { position: 'absolute', top: 20, left: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 12 },
  
  brandSection: { alignItems: 'center', marginBottom: 40 },
  logoBadge: { width: 70, height: 70, backgroundColor: '#fff', borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 15, elevation: 10, shadowColor: '#10b981', shadowOpacity: 0.3, shadowRadius: 10 },
  brandTitle: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  brandSub: { fontSize: 10, color: '#94a3b8', fontWeight: '800', letterSpacing: 2, marginTop: 5 },

  card: { backgroundColor: '#fff', borderRadius: 24, padding: 25, elevation: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15 },
  label: { fontSize: 12, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 },
  
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 16, marginBottom: 15, paddingHorizontal: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  input: { flex: 1, paddingVertical: 16, marginLeft: 10, color: '#0f172a', fontSize: 15, fontWeight: '600' },
  
  mainBtn: { backgroundColor: '#0f172a', paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginTop: 15, elevation: 5, shadowColor: '#000', shadowOpacity: 0.2 },
  mainBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  
  footerBtn: { marginTop: 30, padding: 10 },
  footerText: { textAlign: 'center', color: '#94a3b8', fontSize: 14 }
});