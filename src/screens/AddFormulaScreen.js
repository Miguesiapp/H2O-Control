import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Alert, StatusBar, KeyboardAvoidingView, Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ChevronLeft, Save, Plus, Beaker, Trash2, BrainCircuit, Sparkles, FileText } from 'lucide-react-native';
import AutocompleteInput from '../components/AutocompleteInput';
import { RAW_MATERIALS_LIST, PRODUCTS_MADRE_LIST, PRODUCTS_FINAL_LIST } from '../config/constants';

export default function AddFormulaScreen({ navigation }) {
  const [productName, setProductName] = useState('');
  const [ph, setPh] = useState('');
  const [density, setDensity] = useState('');
  
  // Ingredientes abstractos (Sin lotes, solo porcentajes para la Fórmula Maestra)
  const [ingredients, setIngredients] = useState([{ id: '1', name: '', amount: '' }]);
  const [inputMode, setInputMode] = useState('PERCENTAGE'); // 'PERCENTAGE' or 'KILOS'

  const toDecimal = (val) => {
    if (!val) return 0;
    return parseFloat(String(val).replace(',', '.'));
  };

  const handleSave = async () => {
    if (!productName.trim() || !ph || !density) {
      Alert.alert("Atención", "El nombre del producto, pH y Densidad son obligatorios.");
      return;
    }

    const hasMissingIngredients = ingredients.some(ing => !ing.name.trim() || !ing.amount);
    if (hasMissingIngredients) {
      Alert.alert("Datos Incompletos", "Por favor, completa el nombre y cantidad de todos los ingredientes.");
      return;
    }

    try {
      const phVal = toDecimal(ph);
      const densityVal = toDecimal(density);

      if (isNaN(phVal) || isNaN(densityVal)) {
        Alert.alert("Error", "Los valores de pH o Densidad deben ser numéricos.");
        return;
      }

      // Validación del 100%
      let totalPercentage = 0;
      const parsedIngredients = ingredients.map(ing => {
        let perc = 0;
        if (inputMode === 'KILOS') {
            const totalAmount = ingredients.reduce((sum, i) => sum + toDecimal(i.amount), 0);
            perc = totalAmount > 0 ? (toDecimal(ing.amount) / totalAmount) * 100 : 0;
        } else {
            perc = toDecimal(ing.amount);
        }
        const finalPerc = parseFloat(perc.toFixed(2));
        totalPercentage += finalPerc;
        return {
          name: ing.name.trim().toUpperCase(),
          percentage: finalPerc
        };
      });

      if (Math.abs(totalPercentage - 100) > 0.1) {
        Alert.alert(
          "Error de Formulación", 
          `La receta no suma 100%.\nSuma actual: ${totalPercentage.toFixed(2)}%\nDiferencia: ${(100 - totalPercentage).toFixed(2)}%`
        );
        return;
      }

      // Guardamos la RECETA MAESTRA en Firebase
      await addDoc(collection(db, "Formulas_Maestras"), {
        productName: productName.trim().toUpperCase(),
        phObjetivo: phVal,
        densidadObjetivo: densityVal,
        ingredients: parsedIngredients,
        status: 'ACTIVA', // Clave para que aparezca en el catálogo
        creadaPor: auth.currentUser?.email || 'Sistema',
        fechaCreacion: serverTimestamp()
      });

      Alert.alert(
        "Fórmula Registrada", 
        `La receta maestra de ${productName.toUpperCase()} se guardó exitosamente y ya está disponible para el cálculo de producciones.`,
        [{ text: "Entendido", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo sincronizar la fórmula con el servidor.");
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { id: Date.now().toString(), name: '', amount: '' }]);
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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#2e4a3b" size={28} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Nueva Fórmula Maestra</Text>
          <Text style={styles.headerSub}>Recetario Base del Sistema</Text>
        </View>
        <Beaker color="#2e4a3b" size={24} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          <Text style={styles.sectionTitle}>Parámetros Generales</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>Nombre del Producto</Text>
              <AutocompleteInput 
                data={[...PRODUCTS_MADRE_LIST, ...PRODUCTS_FINAL_LIST].sort()}
                value={productName}
                onChangeText={setProductName}
                placeholder="Ej: GRANEL BUFFER"
                icon={<FileText color="#94a3b8" size={18} />}
                containerStyle={{ zIndex: 1001 }}
              />
            </View>
          </View>
          
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>pH Teórico</Text>
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

        <Text style={styles.sectionTitle}>Composición Química</Text>
        
        {/* Toggle para cambiar entre % y Kilos */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity 
            style={[styles.toggleBtn, inputMode === 'PERCENTAGE' && styles.toggleBtnActive]}
            onPress={() => setInputMode('PERCENTAGE')}
          >
            <Text style={[styles.toggleText, inputMode === 'PERCENTAGE' && styles.toggleTextActive]}>En Porcentaje (%)</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleBtn, inputMode === 'KILOS' && styles.toggleBtnActive]}
            onPress={() => setInputMode('KILOS')}
          >
            <Text style={[styles.toggleText, inputMode === 'KILOS' && styles.toggleTextActive]}>En Kilos (Kg)</Text>
          </TouchableOpacity>
        </View>

        {ingredients.map((ing, idx) => {
          let calculatedPercentage = null;
          if (inputMode === 'KILOS') {
            const total = ingredients.reduce((sum, i) => sum + toDecimal(i.amount), 0);
            calculatedPercentage = total > 0 ? ((toDecimal(ing.amount) / total) * 100).toFixed(2) : 0;
          }
          return (
          <View key={ing.id} style={styles.ingredientBlock}>
            <View style={styles.ingRow}>
              <View style={{ flex: 2 }}>
                <AutocompleteInput 
                  data={[...RAW_MATERIALS_LIST, ...PRODUCTS_MADRE_LIST].sort()}
                  value={ing.name}
                  onChangeText={(val) => updateIngredient(idx, 'name', val)}
                  placeholder="Materia Prima o Granel"
                  icon={<FileText color="#94a3b8" size={18} />}
                />
              </View>
              <TextInput 
                style={[styles.input, { flex: 1, marginLeft: 10 }]} 
                placeholder={inputMode === 'PERCENTAGE' ? "Cant (%)" : "Cant (Kg)"} 
                keyboardType="decimal-pad"
                value={ing.amount}
                onChangeText={(val) => updateIngredient(idx, 'amount', val)}
                placeholderTextColor="#bbb"
              />
              {ingredients.length > 1 && (
                <TouchableOpacity onPress={() => removeIngredient(ing.id)} style={styles.deleteBtn}>
                  <Trash2 color="#ef4444" size={22} />
                </TouchableOpacity>
              )}
            </View>
            {inputMode === 'KILOS' && ing.amount !== '' && (
              <Text style={{ fontSize: 11, color: '#10b981', fontWeight: 'bold', marginTop: 5, marginLeft: 5 }}>
                Representa: {calculatedPercentage}%
              </Text>
            )}
          </View>
        )})}

        <TouchableOpacity style={styles.addBtn} onPress={addIngredient}>
          <Plus color="#2e4a3b" size={20} />
          <Text style={styles.addBtnText}>Añadir Materia Prima</Text>
        </TouchableOpacity>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Save color="#fff" size={20} />
            <Text style={styles.saveButtonText}>Guardar Fórmula Maestra</Text>
          </TouchableOpacity>
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7f5' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eee', elevation: 2 
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#2e4a3b' },
  headerSub: { fontSize: 10, color: '#888', textTransform: 'uppercase', fontWeight: 'bold' },
  container: { padding: 20 },
  
  aiBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', 
    padding: 18, borderRadius: 16, marginBottom: 20, elevation: 4
  },
  aiIconBox: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 12 },
  aiBannerTitle: { fontSize: 15, fontWeight: '900', color: '#fff' },
  aiBannerSub: { fontSize: 11, color: '#94a3b8', marginTop: 4, lineHeight: 16 },

  card: { 
    backgroundColor: '#fff', padding: 18, borderRadius: 15, elevation: 2, 
    borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20
  },
  label: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', color: '#1e293b', fontSize: 15, fontWeight: '600' },
  
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  chipTextActive: { color: '#fff' },
  
  row: { flexDirection: 'row' },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#334155', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  toggleContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 10, padding: 4, marginBottom: 15 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  toggleBtnActive: { backgroundColor: '#fff', elevation: 2 },
  toggleText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  toggleTextActive: { color: '#2e4a3b' },

  ingredientBlock: { backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  ingRow: { flexDirection: 'row', alignItems: 'center' },
  
  deleteBtn: { padding: 8, marginLeft: 5 },
  addBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 5, backgroundColor: '#fff', alignSelf: 'flex-start', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2e4a3b' },
  addBtnText: { color: '#2e4a3b', fontWeight: 'bold', marginLeft: 5, fontSize: 13 },
  saveButton: { backgroundColor: '#2e4a3b', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 15, marginTop: 30, gap: 10, elevation: 4 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' }
});