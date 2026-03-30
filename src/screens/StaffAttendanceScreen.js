import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, 
  ActivityIndicator, ScrollView, useWindowDimensions, Image
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { db, storage, auth } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { UserCheck, UserX, Camera, ShieldCheck, ChevronLeft, UserPlus, RotateCcw, Save } from 'lucide-react-native';

export default function StaffAttendanceScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isPhone = width < 600;

  const [permission, requestPermission] = useCameraPermissions();
  const [type, setType] = useState(null); // 'CHECK IN', 'CHECK OUT', 'REGISTRO'
  const [loading, setLoading] = useState(false);
  const [tempPhoto, setTempPhoto] = useState(null); // Para la vista previa del registro
  const cameraRef = useRef(null);

  const ADMIN_MAILS = ['bduville@h2ocontrol.com.ar', 'jmalvasio@h2ocontrol.com.ar', 'miguesilva.1985@outlook.es'];
  const canViewReports = ADMIN_MAILS.includes(auth.currentUser?.email?.toLowerCase());

  useEffect(() => {
    activateKeepAwakeAsync();
    return () => deactivateKeepAwake();
  }, []);

  const handleAction = async (actionType) => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert("Permisos", "Se requiere cámara para continuar.");
        return;
      }
    }
    setType(actionType);
  };

  const processPhoto = async () => {
    if (!cameraRef.current || loading) return;
    setLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.4,
        base64: true,
      });

      if (type === 'REGISTRO') {
        setTempPhoto(photo);
      } else {
        await finalizeRegistration(photo.base64);
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo capturar la imagen.");
    } finally {
      setLoading(false);
    }
  };

  const finalizeRegistration = async (base64Data) => {
    setLoading(true);
    try {
      const path = type === 'REGISTRO' ? 'staff_profiles' : 'attendance';
      const fileName = `${path}/${type}_${auth.currentUser?.uid || 'anon'}_${Date.now()}.jpg`;
      const storageRef = ref(storage, fileName);
      
      await uploadString(storageRef, base64Data, 'base64');
      const photoUrl = await getDownloadURL(storageRef);

      await addDoc(collection(db, "StaffLogs"), {
        type: type,
        timestamp: serverTimestamp(),
        photoUrl: photoUrl,
        userEmail: auth.currentUser?.email,
        deviceName: isPhone ? "Celular" : "Tablet_Entrada"
      });

      Alert.alert("Éxito", "Operación registrada correctamente.");
      setType(null);
      setTempPhoto(null);
    } catch (error) {
      Alert.alert("Error", "Error al subir a la base de datos.");
    } finally {
      setLoading(false);
    }
  };

  // --- VISTA: MENÚ PRINCIPAL ---
  if (!type) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>H2O Control</Text>
          <Text style={styles.subtitle}>Tótem de Asistencia</Text>
          
          <View style={[styles.menuGrid, (isPhone && !isLandscape) && styles.menuColumn]}>
            <TouchableOpacity 
              style={[styles.bigBtn, { backgroundColor: '#e8f5e9', borderColor: '#2e7d32' }, isPhone && styles.phoneBtn]} 
              onPress={() => handleAction('CHECK IN')}
            >
              <UserCheck color="#2e7d32" size={isPhone ? 50 : 80} />
              <Text style={[styles.btnText, { color: '#2e7d32' }, isPhone && { fontSize: 18 }]}>CHECK IN</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.bigBtn, { backgroundColor: '#fff0f0', borderColor: '#ff4444' }, isPhone && styles.phoneBtn]} 
              onPress={() => handleAction('CHECK OUT')}
            >
              <UserX color="#ff4444" size={isPhone ? 50 : 80} />
              <Text style={[styles.btnText, { color: '#ff4444' }, isPhone && { fontSize: 18 }]}>CHECK OUT</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.registerBtn}
            onPress={() => handleAction('REGISTRO')}
          >
            <UserPlus color="#555" size={24} />
            <Text style={styles.registerBtnText}>REGISTRO INICIAL FOTO</Text>
          </TouchableOpacity>

          {canViewReports && (
            <TouchableOpacity style={styles.adminBtn} onPress={() => navigation.navigate('AttendanceReports')}>
              <ShieldCheck color="#2e4a3b" size={24} />
              <Text style={styles.adminBtnText}>CHECK INGRESOS</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
            <Text style={{color: '#888', fontWeight: 'bold'}}>← Volver</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- VISTA: PREVIEW (SÓLO PARA REGISTRO INICIAL) ---
  if (tempPhoto) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: `data:image/jpg;base64,${tempPhoto.base64}` }} style={StyleSheet.absoluteFillObject} />
        <View style={styles.previewOverlay}>
          <Text style={styles.previewText}>¿TE GUSTA ESTA FOTO PARA TU PERFIL?</Text>
          <View style={styles.previewButtons}>
            <TouchableOpacity style={styles.retryBtn} onPress={() => setTempPhoto(null)}>
              <RotateCcw color="#fff" size={24} />
              <Text style={styles.whiteText}>REINTENTAR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={() => finalizeRegistration(tempPhoto.base64)}>
              <Save color="#fff" size={24} />
              <Text style={styles.whiteText}>GUARDAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // --- VISTA: CÁMARA ---
  return (
    <View style={styles.cameraContainer}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="front" />
      <View style={styles.cameraOverlay}>
        <Text style={styles.cameraTitle}>{type}</Text>
        <View style={[styles.faceGuide, isPhone && { width: 220, height: 300 }]} />
        <View style={styles.controls}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setType(null)}>
            <Text style={{color: '#fff', fontWeight: 'bold'}}>SALIR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.captureBtn} onPress={processPhoto} disabled={loading}>
            {loading ? <ActivityIndicator color="#2e4a3b" /> : <Camera color="#2e4a3b" size={32} />}
          </TouchableOpacity>
          <View style={{ width: 60 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  title: { fontSize: 34, fontWeight: '900', color: '#1a1a1a' },
  subtitle: { fontSize: 18, color: '#666', marginBottom: 30 },
  menuGrid: { flexDirection: 'row', gap: 20, width: '100%', justifyContent: 'center' },
  menuColumn: { flexDirection: 'column', alignItems: 'center' },
  bigBtn: { width: 280, height: 280, borderRadius: 30, borderWidth: 3, alignItems: 'center', justifyContent: 'center', elevation: 8, backgroundColor: '#fff' },
  phoneBtn: { width: '100%', height: 160 },
  btnText: { fontSize: 20, fontWeight: '900', marginTop: 15 },
  registerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 25, padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#ccc', width: '100%', justifyContent: 'center' },
  registerBtnText: { color: '#555', fontWeight: '800' },
  adminBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, padding: 15, backgroundColor: '#f0f4f2', borderRadius: 15, width: '100%', justifyContent: 'center' },
  adminBtnText: { color: '#2e4a3b', fontWeight: '800' },
  backLink: { marginTop: 30 },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: 30, alignItems: 'center' },
  cameraTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.7)', padding: 12, borderRadius: 10 },
  faceGuide: { width: 280, height: 380, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 140, borderStyle: 'dashed' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 20, width: '100%', justifyContent: 'space-between', marginBottom: 20 },
  captureBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { padding: 15, backgroundColor: 'rgba(255,0,0,0.5)', borderRadius: 12 },
  previewOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 50 },
  previewText: { color: '#fff', fontWeight: '900', fontSize: 18, marginBottom: 30, textAlign: 'center', paddingHorizontal: 20 },
  previewButtons: { flexDirection: 'row', gap: 20 },
  retryBtn: { backgroundColor: '#ff4444', padding: 20, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  saveBtn: { backgroundColor: '#2e7d32', padding: 20, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  whiteText: { color: '#fff', fontWeight: 'bold' }
});