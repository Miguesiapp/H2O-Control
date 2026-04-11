import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Alert, StatusBar, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebase';
import { serverTimestamp } from 'firebase/firestore';
import { registerMovement } from '../services/logisticsService';
import { ChevronLeft, Play, Beaker, FileText, Factory, AlertCircle } from 'lucide-react-native';

export default function ProductionOrderScreen({ route, navigation }) {
  const { companyName } = route.params;
  const [productName, setProductName] = useState('');
  const [targetQuantity, setTargetQuantity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generador de Lote Único Nivel Industrial (Formato: PT-YYYYMMDD-ID)
  const generateUniqueBatch = () => {
    const fecha = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const idUnico = Date.now().toString().slice(-4);
    return `PT-${fecha}-${idUnico}`;
  };

  const handleStartProduction = async () => {
    if (!productName.trim() || !targetQuantity.trim()) {
      Alert.alert("Atención", "Especifica el producto y el volumen a fabricar.");
      return;
    }

    const qty = Number(targetQuantity.replace(',', '.'));
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Error", "El volumen debe ser un número mayor a 0.");
      return;
    }

    try {
      setIsSubmitting(true);
      const batchId = generateUniqueBatch();
      
      const productionData = {
        itemName: productName.trim().toUpperCase(),
        quantity: qty,
        stockType: 'PT', // Se marca como Producto Terminado en proceso
        batchInternal: batchId,
        unit: 'Lts',
        company: companyName,
        status: 'PENDIENTE_LABORATORIO', // Clave para que el escáner sepa que no está liberado
        lastUpdate: serverTimestamp()
      };

      // Usamos el motor logístico blindado
      await registerMovement(
        auth.currentUser?.email || 'Sistema',
        'ORDEN_PRODUCCION_EMITIDA',
        companyName,
        productionData
      );

      Alert.alert(
        "Orden Emitida con Éxito", 
        `Lote Asignado: ${batchId}\n\nEl producto figura en estado PENDIENTE. El Laboratorio debe realizar el control de calidad (pH/Densidad) para liberarlo.`,
        [{ text: "Entendido", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error(error);
      Alert.alert("Error del Sistema", "No se pudo emitir la orden de producción.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER ENTERPRISE */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
          <Text style={styles.headerTitle}>Orden de Producción</Text>
          <Text style={styles.headerSub}>{companyName}</Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* BANNER INFORMATIVO */}
        <View style={styles.infoBanner}>
          <View style={styles.iconBox}>
            <Factory color="#3b82f6" size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Emisión de Nueva Tanda</Text>
            <Text style={styles.bannerText}>
              Esta acción generará un identificador único en el sistema. El producto no estará disponible para despacho hasta su liberación técnica.
            </Text>
          </View>
        </View>

        {/* FORMULARIO PRINCIPAL */}
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Producto a Formular</Text>
            <View style={styles.inputWrapper}>
              <FileText color="#94a3b8" size={20} style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="Ej: FERTILIZANTE ACTION" 
                value={productName}
                onChangeText={setProductName}
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Volumen Objetivo (Litros / Kg)</Text>
            <View style={styles.inputWrapper}>
              <Beaker color="#94a3b8" size={20} style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="Ej: 1000" 
                keyboardType="numeric"
                value={targetQuantity}
                onChangeText={setTargetQuantity}
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>
        </View>

        {/* ALERTA DE FLUJO */}
        <View style={styles.workflowAlert}>
          <AlertCircle color="#f59e0b" size={20} style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.workflowTitle}>Flujo de Trabajo Requerido</Text>
            <Text style={styles.workflowText}>
              Una vez emitida la orden, diríjase al módulo de <Text style={{fontWeight: 'bold'}}>H2O Laboratorio</Text> para registrar la receta utilizada y habilitar el código QR.
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.mainButton, isSubmitting && { opacity: 0.7 }]} 
          onPress={handleStartProduction}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Play color="#fff" size={20} fill="#fff" />
              <Text style={styles.mainButtonText}>Emitir Orden y Generar Lote</Text>
            </>
          )}
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', 
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  headerSub: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: '800', letterSpacing: 0.5 },
  
  container: { padding: 20 },
  
  infoBanner: { flexDirection: 'row', backgroundColor: '#eff6ff', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#bfdbfe' },
  iconBox: { backgroundColor: '#dbeafe', padding: 12, borderRadius: 12, marginRight: 15, height: 48, justifyContent: 'center' },
  bannerTitle: { fontSize: 15, fontWeight: '800', color: '#1e3a8a', marginBottom: 4 },
  bannerText: { fontSize: 12, color: '#1e40af', lineHeight: 18 },

  card: { 
    backgroundColor: '#fff', padding: 20, borderRadius: 16, elevation: 2, 
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8,
    borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20
  },
  
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 15 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, fontSize: 16, color: '#0f172a', fontWeight: '600' },

  workflowAlert: { flexDirection: 'row', backgroundColor: '#fffbeb', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#fde68a' },
  workflowTitle: { fontSize: 13, fontWeight: '800', color: '#92400e', marginBottom: 2 },
  workflowText: { fontSize: 12, color: '#b45309', lineHeight: 18 },

  mainButton: { 
    backgroundColor: '#10b981', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', 
    padding: 18, borderRadius: 14, marginTop: 30, gap: 10, elevation: 4,
    shadowColor: '#10b981', shadowOpacity: 0.3, shadowRadius: 8
  },
  mainButtonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }
});