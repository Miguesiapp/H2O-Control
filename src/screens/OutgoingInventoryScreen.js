import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Alert, StatusBar, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebase';
import { deductStock, registerMovement } from '../services/logisticsService';
import { ChevronLeft, Truck, Send, PackageMinus, MapPin, Barcode, ClipboardType } from 'lucide-react-native';

export default function OutgoingInventoryScreen({ route, navigation }) {
  const { companyName } = route.params;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    productName: '',
    quantity: '',
    batchInternal: '', 
    destination: '', 
    transportName: '' 
  });

  const handleDispatch = async () => {
    const qtyNormalized = Number(formData.quantity.replace(',', '.'));

    if (!formData.productName.trim() || isNaN(qtyNormalized) || qtyNormalized <= 0 || !formData.batchInternal.trim()) {
      Alert.alert("Atención", "Verifica que el Producto, el Lote y una cantidad válida mayor a 0 estén ingresados.");
      return;
    }

    if (!formData.destination.trim() || !formData.transportName.trim()) {
      Alert.alert("Faltan Datos", "Por normativas de trazabilidad, debes ingresar el destino y el transporte.");
      return;
    }

    try {
      setIsSubmitting(true);
      const itemName = formData.productName.trim().toUpperCase();
      const batchId = formData.batchInternal.trim().toUpperCase();

      // 1. Restar del Stock Final
      const success = await deductStock(
        companyName,
        itemName,
        qtyNormalized,
        batchId,
        'FINAL'
      );

      if (success) {
        // 2. Registrar en Auditoría (Remito de Salida Interno)
        await registerMovement(
          auth.currentUser?.email || 'Sistema',
          'EGRESO_DESPACHO_CLIENTE',
          companyName,
          {
            itemName: itemName,
            quantity: -Math.abs(qtyNormalized), // Lo guardamos en negativo para auditoría visual
            batchInternal: batchId,
            details: `Destino: ${formData.destination.trim()} | Transporte: ${formData.transportName.trim()}`,
            stockType: 'LOG',
            unit: 'Uds'
          }
        );

        Alert.alert(
          "Despacho Autorizado", 
          `Se han descontado ${qtyNormalized} unidades del lote ${batchId}.\nEl registro ha sido guardado en la auditoría general.`,
          [{ text: "Entendido", onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert(
          "Quiebre de Stock", 
          "El sistema no encontró disponibilidad suficiente para el producto y lote indicados. Verifica el código de trazabilidad."
        );
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error de Sistema", "No se pudo procesar la salida de mercadería.");
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
          <Text style={styles.headerTitle}>Orden de Despacho</Text>
          <Text style={styles.headerSub}>{companyName} • Salida Física</Text>
        </View>
        <Truck color="#0f172a" size={24} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* BANNER DE ADVERTENCIA */}
        <View style={styles.infoBanner}>
          <Text style={styles.bannerText}>
            Toda salida de mercadería queda vinculada al usuario <Text style={{fontWeight: '800'}}>{auth.currentUser?.email}</Text> para auditoría.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Identificación de Mercadería</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Producto a Despachar (Envasado)</Text>
          <View style={styles.inputWrapper}>
            <PackageMinus color="#94a3b8" size={18} style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder="Ej: ACTION - 20L" 
              placeholderTextColor="#94a3b8"
              value={formData.productName}
              onChangeText={(txt) => setFormData({...formData, productName: txt})}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>Cant. Unidades</Text>
              <TextInput 
                style={styles.inputPlain} 
                placeholder="Ej: 48" 
                keyboardType="numeric"
                placeholderTextColor="#94a3b8"
                value={formData.quantity}
                onChangeText={(txt) => setFormData({...formData, quantity: txt})}
              />
            </View>
            <View style={{ flex: 1.5 }}>
              <Text style={styles.label}>Lote de Salida</Text>
              <View style={styles.inputWrapper}>
                <Barcode color="#94a3b8" size={18} style={styles.inputIcon} />
                <TextInput 
                  style={[styles.input, {fontSize: 13}]} 
                  placeholder="Ej: PT-20260411-1234" 
                  placeholderTextColor="#94a3b8"
                  value={formData.batchInternal}
                  onChangeText={(txt) => setFormData({...formData, batchInternal: txt})}
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Datos de Logística</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Cliente / Punto de Entrega</Text>
          <View style={styles.inputWrapper}>
            <MapPin color="#94a3b8" size={18} style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder="Ej: BioAcker Córdoba" 
              placeholderTextColor="#94a3b8"
              value={formData.destination}
              onChangeText={(txt) => setFormData({...formData, destination: txt})}
            />
          </View>

          <Text style={styles.label}>Datos del Transporte / Chofer</Text>
          <View style={styles.inputWrapper}>
            <ClipboardType color="#94a3b8" size={18} style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder="Ej: Transporte Andreani / Patente AB123CD" 
              placeholderTextColor="#94a3b8"
              value={formData.transportName}
              onChangeText={(txt) => setFormData({...formData, transportName: txt})}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.dispatchButton, isSubmitting && { opacity: 0.7 }]} 
          onPress={handleDispatch}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Send color="#fff" size={20} />
              <Text style={styles.dispatchButtonText}>Confirmar y Descontar Stock</Text>
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
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0', elevation: 2 
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  headerSub: { fontSize: 11, color: '#ef4444', textTransform: 'uppercase', fontWeight: '800', letterSpacing: 0.5 },
  
  container: { padding: 20 },
  
  infoBanner: { backgroundColor: '#fef2f2', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#fca5a5' },
  bannerText: { color: '#b91c1c', fontSize: 12, textAlign: 'center', lineHeight: 18 },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 12, marginLeft: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  card: { 
    backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 25, 
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, 
    borderWidth: 1, borderColor: '#e2e8f0' 
  },
  label: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 8, textTransform: 'uppercase' },
  
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, marginBottom: 15 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#0f172a', fontWeight: '600' },
  inputPlain: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 15, color: '#0f172a', fontWeight: '600', marginBottom: 15 },
  
  row: { flexDirection: 'row' },
  
  dispatchButton: { 
    backgroundColor: '#ef4444', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', 
    padding: 18, borderRadius: 14, marginTop: 10, gap: 10, elevation: 4, 
    shadowColor: '#ef4444', shadowOpacity: 0.3, shadowRadius: 8 
  },
  dispatchButtonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }
});