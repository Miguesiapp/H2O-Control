import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, 
  ActivityIndicator, ScrollView, useWindowDimensions, Image, StatusBar, TextInput, Modal
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { db, storage, auth } from '../config/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { 
  UserCheck, UserX, Camera, ShieldCheck, UserPlus, 
  RotateCcw, Save, Lock, Monitor, ChevronLeft, UserCircle 
} from 'lucide-react-native';

export default function StaffAttendanceScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  
  const [permission, requestPermission] = useCameraPermissions();
  const [type, setType] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [tempPhoto, setTempPhoto] = useState(null); 
  const cameraRef = useRef(null);

  const [staffProfiles, setStaffProfiles] = useState([]);
  const [selectedOperario, setSelectedOperario] = useState(null);
  const [newOperarioName, setNewOperarioName] = useState('');
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const ALLOWED_EMAILS = [
    'produccion@h2ocontrol.com.ar', 
    'bduville@h2ocontrol.com.ar', 
    'miguesilva.1985@outlook.es'
  ];
  
  const userEmail = auth.currentUser?.email?.toLowerCase();
  const hasAccess = ALLOWED_EMAILS.includes(userEmail);

  useEffect(() => {
    if (hasAccess) {
      activateKeepAwakeAsync(); 
      const q = query(collection(db, "StaffProfiles"), orderBy("name"));
      const unsub = onSnapshot(q, (snap) => {
        setStaffProfiles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => {
        deactivateKeepAwake();
        unsub();
      };
    }
  }, [hasAccess]);

  if (!hasAccess) {
    return (
      <SafeAreaView style={styles.containerLock}>
        <View style={styles.lockCircle}>
          <Lock color="#ef4444" size={50} />
        </View>
        <Text style={styles.lockTitle}>Terminal Restringida</Text>
        <Text style={styles.lockSubtitle}>
          Este dispositivo no cuenta con las credenciales de seguridad para operar como Terminal de Asistencia.
        </Text>
        <TouchableOpacity style={styles.lockBackBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}>
          <ChevronLeft color="#fff" size={20} />
          <Text style={styles.whiteText}>SALIR DEL SISTEMA</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const openSelection = (actionType) => {
    if (staffProfiles.length === 0) {
      Alert.alert("Sin Perfiles", "No hay operarios registrados. Primero deben registrar su perfil.");
      return;
    }
    setType(actionType);
    setShowSelectModal(true);
  };

  const handleAction = async (actionType, operarioName) => {
    setShowSelectModal(false);
    setShowRegisterModal(false);
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert("Hardware Bloqueado", "El sistema requiere acceso a la cámara para la biometría visual.");
        return;
      }
    }
    setSelectedOperario(operarioName);
    setType(actionType);
  };

  const startRegistration = () => {
    setNewOperarioName('');
    setShowRegisterModal(true);
  };

  const processPhoto = async () => {
    if (!cameraRef.current || loading) return;
    setLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: true,
      });

      if (type === 'REGISTRO') {
        setTempPhoto(photo);
      } else {
        await finalizeRegistration(photo.base64);
      }
    } catch (error) {
      Alert.alert("Error de Sensor", "No se pudo capturar la biometría. Reintente.");
    } finally {
      setLoading(false);
    }
  };

  const finalizeRegistration = async (base64Data) => {
    setLoading(true);
    try {
      let photoUrl = null;

      if (type === 'REGISTRO') {
        const path = 'staff_profiles';
        const fileName = `${path}/${type}_${auth.currentUser?.uid}_${Date.now()}.jpg`;
        const storageRef = ref(storage, fileName);
        
        await uploadString(storageRef, base64Data, 'base64');
        photoUrl = await getDownloadURL(storageRef);

        await addDoc(collection(db, "StaffProfiles"), {
          name: selectedOperario,
          photoUrl: photoUrl,
          registeredAt: serverTimestamp()
        });
      }

      await addDoc(collection(db, "StaffLogs"), {
        type: type,
        operario: selectedOperario,
        timestamp: serverTimestamp(),
        photoUrl: photoUrl, 
        userEmail: auth.currentUser?.email,
        deviceName: width > 800 ? "Terminal_Tablet_Fija" : "Terminal_Movil_Admin"
      });

      Alert.alert("Operación Exitosa", `Se registró su ${type} correctamente.`, [
        { text: "CERRAR", onPress: () => { setType(null); setSelectedOperario(null); } }
      ]);
      setTempPhoto(null);
    } catch (error) {
      Alert.alert("Error de Sincronización", "Fallo al subir registro a la nube.");
    } finally {
      setLoading(false);
    }
  };

  if (!type || showSelectModal || showRegisterModal) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.topHeader}>
           <Text style={styles.headerSup}>UNIDAD OPERATIVA BATÁN</Text>
           <Text style={styles.headerMain}>H2O Control System</Text>
        </View>

        <ScrollView maximumZoomScale={1} contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroBox}>
             <ShieldCheck color="#10b981" size={24} />
             <Text style={styles.heroText}>Terminal de Identificación Activa</Text>
          </View>
          
          <View style={[styles.menuGrid, isLandscape && { flexDirection: 'row' }]}>
            <TouchableOpacity 
              style={[styles.bigBtn, { borderBottomColor: '#10b981' }]} 
              onPress={() => openSelection('CHECK IN')}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#ecfdf5' }]}>
                <UserCheck color="#10b981" size={40} />
              </View>
              <Text style={styles.btnTitle}>CHECK IN</Text>
              <Text style={styles.btnSub}>Ingreso Biométrico</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.bigBtn, { borderBottomColor: '#ef4444' }]} 
              onPress={() => openSelection('CHECK OUT')}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#fef2f2' }]}>
                <UserX color="#ef4444" size={40} />
              </View>
              <Text style={styles.btnTitle}>CHECK OUT</Text>
              <Text style={styles.btnSub}>Egreso Biométrico</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerActions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={startRegistration}>
              <UserPlus color="#64748b" size={20} />
              <Text style={styles.secondaryBtnText}>REGISTRO DE PERFIL NUEVO</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('AttendanceReports')}>
              <Monitor color="#64748b" size={20} />
              <Text style={styles.secondaryBtnText}>PANEL DE AUDITORÍA</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))} style={styles.backBtn}>
            <Text style={styles.backBtnText}>SALIR DE MODO TÓTEM</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* MODAL SELECCIONAR PERFIL */}
        <Modal visible={showSelectModal} transparent={true} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>¿Quién eres?</Text>
              <Text style={styles.modalSub}>Selecciona tu perfil para {type}</Text>
              <ScrollView maximumZoomScale={1} style={{maxHeight: 400}}>
                {staffProfiles.map(p => (
                  <TouchableOpacity 
                    key={p.id} 
                    style={styles.profileRow}
                    onPress={() => handleAction(type, p.name)}
                  >
                    {p.photoUrl ? (
                      <Image source={{ uri: p.photoUrl }} style={styles.profileAvatar} />
                    ) : (
                      <UserCircle color="#64748b" size={40} />
                    )}
                    <Text style={styles.profileName}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => { setShowSelectModal(false); setType(null); }}>
                <Text style={styles.cancelModalText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL NUEVO PERFIL */}
        <Modal visible={showRegisterModal} transparent={true} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Nuevo Operario</Text>
              <Text style={styles.modalSub}>Ingresa el nombre completo</Text>
              <TextInput 
                style={styles.inputModal}
                placeholder="Ej: Migue Silva"
                value={newOperarioName}
                onChangeText={setNewOperarioName}
                autoCapitalize="words"
              />
              <TouchableOpacity 
                style={styles.actionModalBtn} 
                onPress={() => {
                  if(!newOperarioName.trim()) { Alert.alert("Error", "Ingresa un nombre"); return;}
                  handleAction('REGISTRO', newOperarioName.trim());
                }}
              >
                <Text style={styles.whiteText}>Iniciar Escaneo Facial</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => { setShowRegisterModal(false); setType(null); }}>
                <Text style={styles.cancelModalText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  if (tempPhoto) {
    return (
      <View style={styles.previewContainer}>
        <Image source={{ uri: `data:image/jpg;base64,${tempPhoto.base64}` }} style={StyleSheet.absoluteFillObject} />
        <View style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Verificación de Identidad</Text>
            <Text style={styles.previewSub}>¿Es legible la fotografía para el legajo digital?</Text>
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.retryBtn} onPress={() => setTempPhoto(null)}>
                <RotateCcw color="#fff" size={20} />
                <Text style={styles.whiteText}>REPETIR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmSaveBtn} onPress={() => finalizeRegistration(tempPhoto.base64)}>
                <Save color="#fff" size={20} />
                <Text style={styles.whiteText}>CONFIRMAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="front" />
      <View style={styles.cameraOverlay}>
        <View style={styles.cameraHeader}>
          <Text style={styles.cameraStatus}>{type}: {selectedOperario}</Text>
        </View>
        
        <View style={styles.faceGuide} />
        
        <View style={styles.cameraFooter}>
          <TouchableOpacity style={styles.camCancelBtn} onPress={() => { setType(null); setSelectedOperario(null); }}>
            <Text style={styles.whiteText}>CANCELAR</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.captureBtn} onPress={processPhoto} disabled={loading}>
            {loading ? <ActivityIndicator color="#0f172a" /> : <Camera color="#0f172a" size={32} />}
          </TouchableOpacity>
          
          <View style={{ width: 80 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  containerLock: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 40 },
  lockCircle: { padding: 25, borderRadius: 100, backgroundColor: '#fef2f2', marginBottom: 20 },
  lockTitle: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  lockSubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 12, lineHeight: 20, marginBottom: 35 },
  lockBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0f172a', paddingVertical: 16, paddingHorizontal: 30, borderRadius: 15 },
  
  topHeader: { padding: 25, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  headerSup: { fontSize: 10, fontWeight: '800', color: '#64748b', letterSpacing: 2 },
  headerMain: { fontSize: 22, fontWeight: '900', color: '#0f172a', marginTop: 4 },
  
  scrollContent: { padding: 25, alignItems: 'center' },
  heroBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 30, elevation: 2 },
  heroText: { fontSize: 13, fontWeight: '700', color: '#047857' },

  menuGrid: { gap: 20, width: '100%' },
  bigBtn: { flex: 1, backgroundColor: '#fff', padding: 30, borderRadius: 24, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderBottomWidth: 6, elevation: 4 },
  iconCircle: { width: 80, height: 80, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  btnTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  btnSub: { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginTop: 4 },

  footerActions: { width: '100%', marginTop: 40, gap: 12 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  secondaryBtnText: { color: '#475569', fontWeight: '800', fontSize: 13 },

  backBtn: { marginTop: 40, padding: 10 },
  backBtnText: { color: '#94a3b8', fontWeight: '800', fontSize: 11, letterSpacing: 1 },

  // MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 25, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', textAlign: 'center' },
  modalSub: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 20 },
  profileRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  profileAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9' },
  profileName: { marginLeft: 15, fontSize: 16, fontWeight: '800', color: '#1e293b' },
  cancelModalBtn: { marginTop: 15, padding: 15, alignItems: 'center' },
  cancelModalText: { color: '#94a3b8', fontWeight: '800', fontSize: 14 },
  inputModal: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 20 },
  actionModalBtn: { backgroundColor: '#10b981', padding: 16, borderRadius: 12, alignItems: 'center' },

  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: 40, alignItems: 'center' },
  cameraHeader: { backgroundColor: 'rgba(15, 23, 42, 0.8)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  cameraStatus: { color: '#f8fafc', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  faceGuide: { width: 280, height: 360, borderWidth: 2, borderColor: 'rgba(56, 189, 248, 0.5)', borderRadius: 140, borderStyle: 'dashed' },
  cameraFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  captureBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 10 },
  camCancelBtn: { backgroundColor: 'rgba(239, 68, 68, 0.6)', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },

  previewContainer: { flex: 1, backgroundColor: '#000' },
  previewOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end', padding: 25 },
  previewCard: { backgroundColor: '#fff', borderRadius: 24, padding: 25, elevation: 20 },
  previewTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  previewSub: { fontSize: 14, color: '#64748b', marginTop: 5, marginBottom: 25 },
  previewActions: { flexDirection: 'row', gap: 15 },
  retryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#64748b', padding: 18, borderRadius: 16 },
  confirmSaveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#10b981', padding: 18, borderRadius: 16 },
  whiteText: { color: '#fff', fontWeight: '800', fontSize: 14 }
});