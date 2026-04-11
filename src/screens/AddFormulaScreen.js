import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Alert, StatusBar 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ChevronLeft, Save, Plus, Beaker, Trash2, QrCode } from 'lucide-react-native';

export default function AddFormulaScreen({ navigation }) {
  const [productName, setProductName] = useState('');
  const [companyName, setCompanyName] = useState('H2O Control'); // Para saber a quién le formulamos
  const [ph, setPh] = useState('');
  const [density, setDensity] = useState('');
  
  // NUEVO: Agregamos 'loteMp' al estado de los ingredientes
  const [ingredients, setIngredients] = useState([{ id: '1', name: '', percentage: '', loteMp: '' }]);

  const toDecimal = (val) => {
    if (!val) return 0;
    return parseFloat(String(val).replace(',', '.'));
  };

  const handleSave = async () => {
    if (!productName || !ph || !density) {
      Alert.alert("Atención", "Los datos de pH y Densidad son obligatorios para liberar el lote.");
      return;
    }

    // Validar que se haya ingresado al menos un lote de MP para la trazabilidad
    const hasMissingLots = ingredients.some(ing => !ing.loteMp.trim());
    if (hasMissingLots) {
      Alert.alert("Trazabilidad Incompleta", "Por favor, ingresa el Lote de Proveedor/Interno de todas las materias primas utilizadas.");
      return;
    }

    try {
      const phVal = toDecimal(ph);
      const densityVal = toDecimal(density);

      if (isNaN(phVal) || isNaN(densityVal)) {
        Alert.alert("Error", "Los valores de pH o Densidad no son numéricos.");
        return;
      }

      // LÓGICA DE TRAZABILIDAD: Generamos el Lote Principal (DNI del producto terminado)
      const fechaFab = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const batchInternal = `PT-${fechaFab}-${Date.now().toString().slice(-4)}`;

      // Guardamos la orden de producción en Firebase
      await addDoc(collection(db, "Produccion_Lotes"), {
        productName: productName.toUpperCase(),
        companyTarget: companyName.toUpperCase(),
        batchInternal: batchInternal,
        ph: phVal,
        density: densityVal,
        ingredients: ingredients.map(ing => ({
          name: ing.name.trim(),
          percentage: toDecimal(ing.percentage),
          loteMpUsado: ing.loteMp.trim().toUpperCase() // Trazabilidad de Cuna
        })),
        responsable: auth.currentUser?.email || 'Sistema',
        fechaFabricacion: serverTimestamp()
      });

      // Flujo de éxito y enlace al QR
      Alert.alert(
        "Lote Liberado", 
        `Se registró la fabricación con éxito.\nLote: ${batchInternal}\n¿Deseas imprimir la etiqueta QR para los bidones?`,
        [
          { text: "Solo Guardar", onPress: () => navigation.goBack(), style: "cancel" },
          { 
            text: "GENERAR QR", 
            onPress: () => navigation.navigate('QRGenerator', {
              itemData: {
                itemName: productName.toUpperCase(),
                batchInternal: batchInternal,
                stockType: 'PT', // Le decimos al generador que es Producto Terminado
                fechaIngreso: new Date().toLocaleDateString(),
                quantity: 'N/A', // O podrías agregar un campo para los Litros Totales fabricados
                unit: 'Lts'
              },
              companyName: companyName.toUpperCase()
            }) 
          }
        ]
      );
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo sincronizar el lote con el servidor.");
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { id: Date.now().toString(), name: '', percentage: '', loteMp: '' }]);
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
          <Text style={styles.headerTitle}>Registro de Fabricación</Text>
          <Text style={styles.headerSub}>Control de Calidad y Trazabilidad</Text>
        </View>
        <Beaker color="#2e4a3b" size={24} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          
          <View style={styles.row}>
            <View style={{ flex: 2, marginRight: 10 }}>
              <Text style={styles.label}>Producto a Fabricar</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ej: ACTION / SHOCK" 
                value={productName} 
                onChangeText={setProductName}
                placeholderTextColor="#999"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Para Empresa</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ej: BioAcker" 
                value={companyName} 
                onChangeText={setCompanyName}
                placeholderTextColor="#999"
              />
            </View>
          </View>
          
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>pH Final</Text>
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

        <Text style={styles.sectionTitle}>Materias Primas Utilizadas</Text>
        
        {ingredients.map((ing, idx) => (
          <View key={ing.id} style={styles.ingredientBlock}>
            <View style={styles.ingRow}>
              <TextInput 
                style={[styles.input, { flex: 2 }]} 
                placeholder="Materia Prima (Ej: Ácido)" 
                value={ing.name}
                onChangeText={(val) => updateIngredient(idx, 'name', val)}
                placeholderTextColor="#bbb"
              />
              <TextInput 
                style={[styles.input, { flex: 1, marginLeft: 10 }]} 
                placeholder="Cant (%)" 
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
            {/* NUEVO: Campo obligatorio para el lote de trazabilidad */}
            <View style={styles.loteRow}>
              <TextInput 
                style={styles.inputLote} 
                placeholder="Lote de la MP (Escaneo o Manual)" 
                value={ing.loteMp}
                onChangeText={(val) => updateIngredient(idx, 'loteMp', val)}
                placeholderTextColor="#999"
              />
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={addIngredient}>
          <Plus color="#2e4a3b" size={20} />
          <Text style={styles.addBtnText}>Añadir Materia Prima</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <QrCode color="#fff" size={20} />
          <Text style={styles.saveButtonText}>Liberar Lote y Trazar</Text>
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>
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
  card: { 
    backgroundColor: '#fff', padding: 15, borderRadius: 15, elevation: 3, 
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, marginBottom: 20,
    borderWidth: 1, borderColor: '#e2e8f0'
  },
  label: { fontSize: 11, fontWeight: '800', color: '#475569', marginTop: 10, marginBottom: 5, textTransform: 'uppercase' },
  input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', color: '#1e293b', fontWeight: '500' },
  row: { flexDirection: 'row' },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#0f1710', marginTop: 10, marginBottom: 15 },
  
  ingredientBlock: { backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  ingRow: { flexDirection: 'row', alignItems: 'center' },
  loteRow: { marginTop: 8 },
  inputLote: { backgroundColor: '#fffbe6', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#ffe0b2', color: '#d84315', fontSize: 13, fontWeight: '700' },
  
  deleteBtn: { padding: 8, marginLeft: 5 },
  addBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 5, backgroundColor: '#fff', alignSelf: 'flex-start', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#2e4a3b' },
  addBtnText: { color: '#2e4a3b', fontWeight: 'bold', marginLeft: 5, fontSize: 13 },
  saveButton: { backgroundColor: '#2e4a3b', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 15, marginTop: 30, gap: 10, elevation: 4 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' }
});