import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { auth } from '../config/firebase';
import { deductStock, registerMovement } from '../services/logisticsService';
import { ChevronLeft, Truck, Send } from 'lucide-react-native';

export default function OutgoingInventoryScreen({ route, navigation }) {
  const { companyName } = route.params;
  const [formData, setFormData] = useState({
    productName: '',
    quantity: '',
    presentation: '20',
    batchInternal: '', 
    destination: '', 
    transportName: '' 
  });

  const handleDispatch = async () => {
    if (!formData.productName || !formData.quantity || !formData.batchInternal) {
      Alert.alert("Error", "Los campos Producto, Cantidad y Lote son obligatorios.");
      return;
    }

    try {
      // 1. Restar del Stock Final (Envasado)
      const success = await deductStock(
        companyName,
        formData.productName.toUpperCase(),
        Number(formData.quantity),
        formData.batchInternal,
        'FINAL'
      );

      if (success) {
        // 2. Registrar en Auditoría con formato profesional
        await registerMovement(
          auth.currentUser.email,
          'EGRESO_DESPACHO_CLIENTE',
          companyName,
          {
            itemName: formData.productName.toUpperCase(),
            quantity: formData.quantity,
            batchInternal: formData.batchInternal,
            details: `Destino: ${formData.destination} | Transporte: ${formData.transportName}`,
            stockType: 'LOG' 
          }
        );

        Alert.alert("Despacho Exitoso", "El stock ha sido descontado y el movimiento registrado.");
        navigation.goBack();
      } else {
        Alert.alert("Stock Insuficiente", "No se encontró disponibilidad para ese lote y producto.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo procesar la salida de mercadería.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER INSTITUCIONAL */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft color="#2e4a3b" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
            <Text style={styles.headerTitle}>Orden de Despacho</Text>
            <Text style={styles.headerSub}>{companyName}</Text>
        </View>
        <Truck color="#2e4a3b" size={24} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.label}>Producto Terminado (Envasado)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Ej: Fertilizante Bio-Acker" 
            placeholderTextColor="#bbb"
            value={formData.productName}
            onChangeText={(txt) => setFormData({...formData, productName: txt})}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>Cant. Bidones</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ej: 48" 
                keyboardType="numeric"
                placeholderTextColor="#bbb"
                value={formData.quantity}
                onChangeText={(txt) => setFormData({...formData, quantity: txt})}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Lote de Salida</Text>
              <TextInput 
                style={styles.input} 
                placeholder="DDMMYYYY" 
                keyboardType="numeric"
                placeholderTextColor="#bbb"
                value={formData.batchInternal}
                onChangeText={(txt) => setFormData({...formData, batchInternal: txt})}
              />
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Logística y Destino</Text>
        <View style={styles.card}>
            <Text style={styles.label}>Cliente / Punto de Entrega</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Nombre del Cliente o Ciudad" 
              placeholderTextColor="#bbb"
              value={formData.destination}
              onChangeText={(txt) => setFormData({...formData, destination: txt})}
            />

            <Text style={styles.label}>Datos del Transporte</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Chofer, Patente o Empresa" 
              placeholderTextColor="#bbb"
              value={formData.transportName}
              onChangeText={(txt) => setFormData({...formData, transportName: txt})}
            />
        </View>

        <TouchableOpacity style={styles.dispatchButton} onPress={handleDispatch}>
          <Send color="#fff" size={20} />
          <Text style={styles.dispatchButtonText}>Confirmar Despacho</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7f5' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee' 
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#2e4a3b' },
  headerSub: { fontSize: 10, color: '#888', textTransform: 'uppercase' },
  container: { padding: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#666', marginTop: 20, marginBottom: 10, marginLeft: 5 },
  card: { 
    backgroundColor: '#fff', 
    padding: 18, 
    borderRadius: 15, 
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5
  },
  label: { fontSize: 11, fontWeight: 'bold', color: '#2e4a3b', marginBottom: 8, marginTop: 5, textTransform: 'uppercase' },
  input: { 
    backgroundColor: '#f9f9f9', 
    padding: 12, 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: '#f0f0f0', 
    fontSize: 15,
    color: '#333',
    marginBottom: 10
  },
  row: { flexDirection: 'row' },
  dispatchButton: { 
    backgroundColor: '#d32f2f', // Rojo para acción de salida
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 18, 
    borderRadius: 15, 
    marginTop: 35, 
    gap: 10,
    elevation: 4
  },
  dispatchButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' }
});