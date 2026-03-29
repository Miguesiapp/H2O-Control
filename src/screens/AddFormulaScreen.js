import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Alert, SafeAreaView 
} from 'react-native';
import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ChevronLeft, Save, Plus, Beaker, Trash2 } from 'lucide-react-native';

export default function AddFormulaScreen({ navigation }) {
  const [productName, setProductName] = useState('');
  const [ph, setPh] = useState('');
  const [density, setDensity] = useState('');
  const [ingredients, setIngredients] = useState([{ id: '1', name: '', percentage: '' }]);

  // Función para normalizar y convertir a decimal
  const toDecimal = (val) => {
    if (!val) return 0;
    // Reemplaza coma por punto y convierte a número
    return parseFloat(String(val).replace(',', '.'));
  };

  const handleSave = async () => {
    if (!productName || !ph || !density) {
      Alert.alert("Atención", "Los datos de pH y Densidad son obligatorios para el laboratorio.");
      return;
    }

    try {
      const phVal = toDecimal(ph);
      const densityVal = toDecimal(density);

      if (isNaN(phVal) || isNaN(densityVal)) {
        Alert.alert("Error", "Los valores de pH o Densidad no son números válidos.");
        return;
      }

      await addDoc(collection(db, "Formulas"), {
        productName: productName.toUpperCase(),
        ph: phVal,
        density: densityVal,
        ingredients: ingredients.map(ing => ({
          ...ing,
          name: ing.name.trim(),
          percentage: toDecimal(ing.percentage)
        })),
        createdAt: serverTimestamp()
      });

      Alert.alert("Éxito", "Fórmula técnica guardada con precisión decimal.");
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo sincronizar con Firebase.");
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { id: Date.now().toString(), name: '', percentage: '' }]);
  };

  const removeIngredient = (id) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter(ing => ing.id !== id));
    }
  };

  const updateIngredient = (idx, field, val) => {
    const newIng = [...ingredients];
    newIng[idx][field] = val;
    setIngredients(newIng);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER TÉCNICO */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft color="#2e4a3b" size={28} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Nueva Formulación</Text>
          <Text style={styles.headerSub}>Laboratorio H2O Control</Text>
        </View>
        <Beaker color="#2e4a3b" size={24} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.label}>Producto Técnico</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Ej: MARISCAL / ACKER-PRO" 
            value={productName} 
            onChangeText={setProductName}
            placeholderTextColor="#999"
          />
          
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>pH Objetivo</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ej: 6.5" 
                keyboardType="decimal-pad" 
                value={ph} 
                onChangeText={setPh}
                placeholderTextColor="#999"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Densidad (g/cm³)</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ej: 1.255" 
                keyboardType="decimal-pad" 
                value={density} 
                onChangeText={setDensity}
                placeholderTextColor="#999"
              />
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Composición Química (% p/p)</Text>
        
        {ingredients.map((ing, idx) => (
          <View key={ing.id} style={styles.ingRow}>
            <TextInput 
              style={[styles.input, { flex: 2 }]} 
              placeholder="Insumo / MP" 
              value={ing.name}
              onChangeText={(val) => updateIngredient(idx, 'name', val)}
              placeholderTextColor="#bbb"
            />
            <TextInput 
              style={[styles.input, { flex: 1, marginLeft: 10 }]} 
              placeholder="%" 
              keyboardType="decimal-pad"
              value={ing.percentage}
              onChangeText={(val) => updateIngredient(idx, 'percentage', val)}
              placeholderTextColor="#bbb"
            />
            {ingredients.length > 1 && (
              <TouchableOpacity onPress={() => removeIngredient(ing.id)} style={styles.deleteBtn}>
                <Trash2 color="#ef4444" size={22} />
              </TouchableOpacity>
            )}
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={addIngredient}>
          <Plus color="#2e4a3b" size={20} />
          <Text style={styles.addBtnText}>Añadir Componente</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Save color="#fff" size={20} />
          <Text style={styles.saveButtonText}>Guardar en Maestro</Text>
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
    padding: 15, 
    borderRadius: 15, 
    elevation: 3, 
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 5,
    marginBottom: 20
  },
  label: { fontSize: 11, fontWeight: 'bold', color: '#2e4a3b', marginTop: 10, marginBottom: 5, textTransform: 'uppercase' },
  input: { 
    backgroundColor: '#f9f9f9', 
    padding: 12, 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: '#eee',
    color: '#1a1a1a'
  },
  row: { flexDirection: 'row' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#444', marginTop: 10, marginBottom: 15 },
  ingRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'center' },
  deleteBtn: { padding: 8, marginLeft: 5 },
  addBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 10, 
    backgroundColor: '#fff', 
    alignSelf: 'flex-start',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2e4a3b'
  },
  addBtnText: { color: '#2e4a3b', fontWeight: 'bold', marginLeft: 5, fontSize: 13 },
  saveButton: { 
    backgroundColor: '#2e4a3b', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 18, 
    borderRadius: 15, 
    marginTop: 40, 
    gap: 10,
    elevation: 4
  },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' }
});