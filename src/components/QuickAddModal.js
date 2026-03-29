import React, { useState } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Picker } from '@react-native-picker/picker';

export default function QuickAddModal({ visible, onClose, companyName }) {
  const [form, setForm] = useState({
    name: '',
    qty: '',
    unit: 'Lts',
    type: 'MP',
    min: ''
  });

  const handleSave = async () => {
    // Validación básica
    if (!form.name || !form.qty || !form.min) {
      Alert.alert("Atención", "Por favor, completa todos los campos obligatorios.");
      return;
    }

    try {
      // Estructura de datos optimizada para trazabilidad y alertas
      await addDoc(collection(db, 'Inventory'), {
        company: companyName,
        itemName: form.name.toUpperCase().trim(),
        quantity: Number(form.qty.replace(',', '.')), // Soporte para decimales con coma
        unit: form.unit,
        stockType: form.type, // MP, PT o FINAL
        minStock: Number(form.min),
        lastUpdate: serverTimestamp(),
        status: 'APTO', // Al ser carga manual inicial, lo marcamos como apto por defecto
        batchInternal: "INICIAL-" + new Date().getFullYear()
      });
      
      // Limpiar y cerrar
      setForm({ name: '', qty: '', unit: 'Lts', type: 'MP', min: '' });
      onClose();
      
      if(Platform.OS === 'web') {
        alert("¡Carga inicial exitosa!");
      }

    } catch (e) {
      console.error(e);
      Alert.alert("Error", "No se pudieron guardar los datos. Revisa la conexión.");
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <View style={styles.modal}>
          <Text style={styles.title}>Carga Inicial: {companyName}</Text>
          
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Nombre del Producto / Insumo</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Ej: Ácido Sulfúrico o Bidón 20L" 
              placeholderTextColor="#ccc"
              value={form.name}
              onChangeText={(t) => setForm({...form, name: t})}
            />

            <View style={styles.row}>
              <View style={{flex: 1}}>
                <Text style={styles.label}>Cantidad Actual</Text>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  placeholder="0.00"
                  value={form.qty}
                  onChangeText={(t) => setForm({...form, qty: t})}
                />
              </View>
              <View style={{flex: 1, marginLeft: 15}}>
                <Text style={styles.label}>Stock Mínimo</Text>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  placeholder="Punto de pedido"
                  value={form.min}
                  onChangeText={(t) => setForm({...form, min: t})}
                />
              </View>
            </View>

            <Text style={styles.label}>Unidad de Medida</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={form.unit}
                onValueChange={(v) => setForm({...form, unit: v})}
              >
                <Picker.Item label="Litros (Lts)" value="Lts" />
                <Picker.Item label="Kilogramos (Kg)" value="Kg" />
                <Picker.Item label="Unidades (Uds)" value="Uds" />
              </Picker>
            </View>

            <Text style={styles.label}>Tipo de Inventario</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={form.type}
                onValueChange={(v) => setForm({...form, type: v})}
              >
                <Picker.Item label="Materia Prima / Insumo (MP)" value="MP" />
                <Picker.Item label="Producto Granel / Tanque (PT)" value="PT" />
                <Picker.Item label="Producto Envasado (FINAL)" value="FINAL" />
              </Picker>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={{color: '#999', fontWeight: '600'}}>CANCELAR</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
              <Text style={{color: '#fff', fontWeight: 'bold'}}>GUARDAR EN STOCK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'center', 
    padding: 20 
  },
  modal: { 
    backgroundColor: '#fff', 
    borderRadius: 25, 
    padding: 25, 
    maxHeight: '90%',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#2e4a3b', marginBottom: 15 },
  label: { fontSize: 11, fontWeight: 'bold', color: '#aaa', marginBottom: 5, marginTop: 15, textTransform: 'uppercase' },
  input: { 
    borderBottomWidth: 1.5, 
    borderBottomColor: '#eee', 
    paddingVertical: 8, 
    fontSize: 16, 
    color: '#333' 
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  pickerContainer: { 
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden'
  },
  actions: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    marginTop: 30, 
    alignItems: 'center',
    gap: 10
  },
  saveBtn: { 
    backgroundColor: '#2e4a3b', 
    paddingVertical: 14, 
    paddingHorizontal: 20, 
    borderRadius: 12,
    elevation: 3
  },
  cancelBtn: { padding: 12, marginRight: 10 }
});