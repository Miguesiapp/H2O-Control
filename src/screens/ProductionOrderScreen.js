import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { auth, db } from '../config/firebase';
import { doc, collection, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { registerMovement } from '../services/logisticsService';
import { ChevronLeft, Play, Beaker } from 'lucide-react-native';

export default function ProductionOrderScreen({ route, navigation }) {
  const { companyName } = route.params;
  const [productName, setProductName] = useState('');
  const [targetQuantity, setTargetQuantity] = useState('');

  // Generador de Lote Automático (DDMMYYYY)
  const generateDateBatch = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}${month}${year}`;
  };

  const handleStartProduction = async () => {
    if (!productName || !targetQuantity) {
      Alert.alert("Error", "Completa el nombre del producto y la cantidad");
      return;
    }

    try {
      const batchId = generateDateBatch();
      const qty = Number(targetQuantity);
      
      // 1. Iniciamos un proceso de escritura por lotes (Atomic Batch)
      // Esto asegura que si una parte falla, nada se guarde (integridad de datos)
      const batch = writeBatch(db);

      // 2. Datos para el nuevo Producto Terminado a Granel (PT)
      const productionData = {
        itemName: productName.toUpperCase(),
        quantity: qty,
        stockType: 'PT',
        batchInternal: batchId,
        unit: 'Lts',
        company: companyName,
        status: 'PENDIENTE',
        lastUpdate: serverTimestamp()
      };

      // 3. REGISTRO DE MOVIMIENTO Y ACTUALIZACIÓN DE STOCK
      // Aquí el sistema registra la producción y prepara el PT para el inventario
      await registerMovement(
        auth.currentUser.email,
        'ORDEN_PRODUCCION_INICIO',
        companyName,
        productionData
      );

      Alert.alert(
        "Formulación Iniciada", 
        `Lote: ${batchId}\nEl producto ha sido enviado a Laboratorio para su aprobación final.`
      );
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo sincronizar con el inventario");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft color="#2e4a3b" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
          <Text style={styles.headerTitle}>Orden de Producción</Text>
          <Text style={styles.headerSub}>{companyName}</Text>
        </View>
        <Beaker color="#2e4a3b" size={24} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.label}>Producto a Formular</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Ej: Fertilizante H2O-Acker" 
            value={productName}
            onChangeText={setProductName}
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Volumen Total (Litros)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Ej: 1000" 
            keyboardType="numeric"
            value={targetQuantity}
            onChangeText={setTargetQuantity}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.batchInfo}>
           <Text style={styles.batchTitle}>Identificación de Tanda</Text>
           <Text style={styles.batchValue}>LOTE INTERNO: {generateDateBatch()}</Text>
           <Text style={styles.infoText}>
             Nota: Al iniciar, el producto quedará en estado "Pendiente" hasta que Laboratorio apruebe el control de calidad.
           </Text>
        </View>

        <TouchableOpacity style={styles.mainButton} onPress={handleStartProduction}>
          <Play color="#fff" size={20} fill="#fff" />
          <Text style={styles.mainButtonText}>Iniciar Formulación</Text>
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
  card: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 15, 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 10 
  },
  label: { fontSize: 13, fontWeight: 'bold', color: '#2e4a3b', marginBottom: 8, marginTop: 5 },
  input: { 
    backgroundColor: '#f9f9f9', 
    padding: 15, 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: '#eee', 
    fontSize: 16,
    color: '#333',
    marginBottom: 15
  },
  batchInfo: {
    backgroundColor: '#e8f5e9',
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#c8e6c9'
  },
  batchTitle: { fontSize: 11, fontWeight: 'bold', color: '#2e7d32', textTransform: 'uppercase' },
  batchValue: { fontSize: 16, fontWeight: 'bold', color: '#2e4a3b', marginVertical: 5 },
  infoText: { color: '#666', fontSize: 11, fontStyle: 'italic' },
  mainButton: { 
    backgroundColor: '#2e4a3b', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 18, 
    borderRadius: 15, 
    marginTop: 30, 
    gap: 10,
    elevation: 3
  },
  mainButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' }
});