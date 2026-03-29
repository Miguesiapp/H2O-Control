import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { auth } from '../config/firebase';
import { registerMovement } from '../services/logisticsService';
import { ChevronLeft, Save, Package } from 'lucide-react-native';

export default function IncomingInventoryScreen({ route, navigation }) {
  const { companyName } = route.params;
  const [category, setCategory] = useState('Materia Prima'); 
  const [formData, setFormData] = useState({
    itemName: '',
    quantity: '',
    presentation: '', 
    batchProvider: '',
    providerName: '',
    expiryDate: ''
  });

  // Generador de Lote Interno (Día, Mes, Año)
  const generateDateBatch = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}${month}${year}`;
  };

  const handleSave = async () => {
    if (!formData.itemName || !formData.quantity) {
      Alert.alert("Error", "El nombre del insumo y la cantidad son obligatorios.");
      return;
    }

    try {
      const batchInternal = generateDateBatch(); // Generamos el lote antes para pasarlo al QR
      
      const movementData = {
        itemName: formData.itemName.toUpperCase(),
        quantity: Number(formData.quantity),
        presentation: formData.presentation || null,
        batchProvider: formData.batchProvider,
        providerName: formData.providerName,
        expiryDate: formData.expiryDate,
        category: category,
        stockType: 'MP', 
        batchInternal: batchInternal, 
        unit: category === 'Materia Prima' ? 'Kg/Lts' : 'Uds',
      };

      // 1. Guardamos en Firebase mediante el servicio logístico
      await registerMovement(
        auth.currentUser.email,
        `INGRESO_${category.toUpperCase().replace(' ', '_')}`,
        companyName,
        movementData
      );

      // 2. PREGUNTA CRÍTICA: ¿Querés el QR ahora?
      Alert.alert(
        "Ingreso Exitoso", 
        `Se registró el lote: ${batchInternal}. ¿Deseas imprimir la etiqueta de trazabilidad QR?`,
        [
          {
            text: "No, volver",
            onPress: () => navigation.goBack(),
            style: "cancel"
          },
          { 
            text: "SÍ, GENERAR QR", 
            onPress: () => navigation.navigate('QRGenerator', { 
              itemData: movementData, // Pasamos toda la info para el QR
              companyName: companyName 
            }) 
          }
        ]
      );

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo registrar el ingreso. Revisa tu conexión.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft color="#2e4a3b" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
            <Text style={styles.headerTitle}>Registro de Ingreso</Text>
            <Text style={styles.headerSub}>{companyName}</Text>
        </View>
        <Package color="#2e4a3b" size={24} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.label}>Categoría del Insumo</Text>
        <View style={styles.categoryRow}>
          {['Materia Prima', 'Bidones', 'Cajas', 'Etiquetas'].map(cat => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.catButton, category === cat && styles.catButtonActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.catText, category === cat && styles.catTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
            <Text style={styles.label}>{category.toUpperCase()} (Detalle)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Ej: Ácido Sulfúrico o Bidón Azul" 
              placeholderTextColor="#bbb"
              value={formData.itemName}
              onChangeText={(txt) => setFormData({...formData, itemName: txt})}
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.label}>Cantidad</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="Ej: 500" 
                  keyboardType="numeric"
                  placeholderTextColor="#bbb"
                  value={formData.quantity}
                  onChangeText={(txt) => setFormData({...formData, quantity: txt})}
                />
              </View>
              {category !== 'Materia Prima' ? (
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Capacidad (Lts)</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="20, 10, 5 o 1" 
                    keyboardType="numeric"
                    placeholderTextColor="#bbb"
                    value={formData.presentation}
                    onChangeText={(txt) => setFormData({...formData, presentation: txt})}
                  />
                </View>
              ) : null}
            </View>
        </View>

        <Text style={styles.sectionTitle}>Datos del Proveedor</Text>
        <View style={styles.card}>
            <Text style={styles.label}>Nombre / Razón Social</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Ej: Químicos del Sur S.A." 
              placeholderTextColor="#bbb"
              value={formData.providerName}
              onChangeText={(txt) => setFormData({...formData, providerName: txt})}
            />

            <View style={styles.row}>
                <View style={{flex: 1, marginRight: 10}}>
                    <Text style={styles.label}>Lote Proveedor</Text>
                    <TextInput 
                      style={styles.input} 
                      placeholder="BCK-9900" 
                      placeholderTextColor="#bbb"
                      value={formData.batchProvider}
                      onChangeText={(txt) => setFormData({...formData, batchProvider: txt})}
                    />
                </View>
                <View style={{flex: 1}}>
                    <Text style={styles.label}>Vencimiento</Text>
                    <TextInput 
                      style={styles.input} 
                      placeholder="DD/MM/AAAA" 
                      placeholderTextColor="#bbb"
                      value={formData.expiryDate}
                      onChangeText={(txt) => setFormData({...formData, expiryDate: txt})}
                    />
                </View>
            </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Save color="#fff" size={20} />
          <Text style={styles.saveButtonText}>Confirmar Ingreso a Stock</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ... (Los estilos se mantienen iguales)
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
  headerSub: { fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  container: { padding: 20 },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5
  },
  label: { fontSize: 11, fontWeight: 'bold', color: '#2e4a3b', marginBottom: 8, marginTop: 5, textTransform: 'uppercase' },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#666', marginBottom: 10, marginLeft: 5 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  catButton: { 
    paddingVertical: 8, 
    paddingHorizontal: 15, 
    borderRadius: 20, 
    backgroundColor: '#fff', 
    borderWidth: 1, 
    borderColor: '#ddd' 
  },
  catButtonActive: { backgroundColor: '#2e4a3b', borderColor: '#2e4a3b' },
  catText: { fontSize: 12, color: '#666' },
  catTextActive: { color: '#fff', fontWeight: 'bold' },
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
  saveButton: { 
    backgroundColor: '#2e4a3b', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 18, 
    borderRadius: 15, 
    marginTop: 10, 
    gap: 10,
    elevation: 4
  },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' }
});