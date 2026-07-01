import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Alert, StatusBar, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebase';
import { registerMovement } from '../services/logisticsService';
import { ChevronLeft, Save, PackagePlus, FileText, Calendar, Building2, Truck, Droplet, Box, Circle, ClipboardList } from 'lucide-react-native';

const BIDON_CAPACITIES = ['20L', '10L', '5L', '1L'];
const BIDON_BRANDS = ['H2O', 'AGROCUBE', 'ALIANZA', 'AGROFONTEZUELA'];

const CAJA_FORMATS = ['x5', 'x1'];
const CAJA_BRANDS = ['H2O', 'AGROCUBE', 'AGROFONTEZUELA', 'GENERICAS'];

export default function IncomingInventoryScreen({ route, navigation }) {
  const { companyName } = route.params;
  const isMP = companyName === 'STOCK_CENTRAL_MP';
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState(isMP ? 'Materia Prima' : 'Bidones'); 
  
  const [formData, setFormData] = useState({
    itemName: '',
    quantity: '',
    providerName: '',
    batchProvider: '',
    expiryDate: '',
    observations: '',
    capacity: '20L',
    brand: 'H2O',
    format: 'x5'
  });

  const generateUniqueBatch = () => {
    const fecha = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const idUnico = Date.now().toString().slice(-4);
    return `H2O-MAN-${fecha}-${idUnico}`;
  };

  const handleSave = async () => {
    const qtyNormalized = Number(formData.quantity.replace(',', '.'));

    if (isMP) {
      if (!formData.itemName.trim() || isNaN(qtyNormalized) || qtyNormalized <= 0 || !formData.batchProvider.trim() || !formData.expiryDate.trim()) {
        Alert.alert("Datos Incompletos", "Nombre, Cantidad, Lote del Proveedor y Vencimiento son obligatorios para Materia Prima.");
        return;
      }
    } else {
      if (isNaN(qtyNormalized) || qtyNormalized <= 0) {
        Alert.alert("Datos Incompletos", "La cantidad ingresada debe ser mayor a 0.");
        return;
      }
      if ((category === 'Etiquetas' || category === 'Tapas') && !formData.itemName.trim()) {
        Alert.alert("Datos Incompletos", "El nombre de la etiqueta/tapa es obligatorio.");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const batchInternal = generateUniqueBatch(); 
      
      let finalItemName = formData.itemName.trim().toUpperCase();
      let finalUnit = 'Uds';
      
      if (!isMP) {
        if (category === 'Bidones') finalItemName = `BIDON ${formData.capacity} ${formData.brand}`;
        if (category === 'Cajas') finalItemName = `CAJA ${formData.format} ${formData.brand}`;
        if (category === 'Etiquetas') finalItemName = `ETIQUETA ${formData.itemName.trim().toUpperCase()}`;
        if (category === 'Tapas') finalItemName = `TAPA ${formData.itemName.trim().toUpperCase()}`;
      } else {
        finalUnit = 'Kg/Lts';
      }
      
      const movementData = {
        itemName: finalItemName,
        quantity: qtyNormalized,
        batchProvider: formData.batchProvider.trim() || 'S/D',
        providerName: formData.providerName.trim() || 'S/D',
        expiryDate: formData.expiryDate.trim() || 'S/V',
        observations: formData.observations.trim(),
        category: category,
        stockType: isMP ? 'MP' : 'INSUMOS',
        batchInternal: batchInternal, 
        unit: finalUnit,
        status: isMP ? 'PENDIENTE' : 'APTO' 
      };

      await registerMovement(
        auth.currentUser?.email || 'Sistema',
        `INGRESO_MANUAL_${category.toUpperCase().replace(/ /g, '_')}`,
        companyName,
        movementData
      );

      Alert.alert(
        "Alta de Stock Exitosa", 
        `Se registró correctamente el ingreso.\nLote interno: ${batchInternal}`,
        [{ text: "Entendido", onPress: () => navigation.goBack() }]
      );

    } catch (error) {
      console.error(error);
      Alert.alert("Error de Sistema", "No se pudo sincronizar el ingreso con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = isMP ? ['Materia Prima'] : ['Bidones', 'Cajas', 'Etiquetas', 'Tapas'];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
            <Text style={styles.headerTitle}>Ingreso Manual</Text>
            <Text style={styles.headerSub}>{isMP ? 'Materia Prima' : 'Insumos'}</Text>
        </View>
        <PackagePlus color="#0f172a" size={24} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        
        {!isMP && (
          <>
            <Text style={styles.sectionTitle}>Tipo de Insumo</Text>
            <View style={styles.categoryRow}>
              {categories.map(cat => (
                <TouchableOpacity 
                  key={cat} 
                  activeOpacity={0.7}
                  style={[styles.catButton, category === cat && styles.catButtonActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.catText, category === cat && styles.catTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={styles.card}>
          {(category === 'Materia Prima' || category === 'Etiquetas' || category === 'Tapas') && (
            <>
              <Text style={styles.label}>Descripción / Producto</Text>
              <View style={styles.inputWrapper}>
                <FileText color="#94a3b8" size={18} style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder={isMP ? "Ej: ÁCIDO SULFÚRICO" : "Ej: ACTION 5L"} 
                  placeholderTextColor="#94a3b8"
                  value={formData.itemName}
                  onChangeText={(txt) => setFormData({...formData, itemName: txt})}
                  autoCapitalize="characters"
                />
              </View>
            </>
          )}

          {category === 'Bidones' && (
            <>
              <Text style={styles.label}>Capacidad</Text>
              <View style={styles.chipRow}>
                {BIDON_CAPACITIES.map(cap => (
                  <TouchableOpacity 
                    key={cap} 
                    style={[styles.chip, formData.capacity === cap && styles.chipActive]}
                    onPress={() => setFormData({...formData, capacity: cap})}
                  >
                    <Droplet color={formData.capacity === cap ? '#fff' : '#64748b'} size={14} style={{marginRight: 4}}/>
                    <Text style={[styles.chipText, formData.capacity === cap && styles.chipTextActive]}>{cap}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={styles.label}>Marca / Empresa</Text>
              <View style={styles.chipRow}>
                {BIDON_BRANDS.map(brand => (
                  <TouchableOpacity 
                    key={brand} 
                    style={[styles.chip, formData.brand === brand && styles.chipActive]}
                    onPress={() => setFormData({...formData, brand: brand})}
                  >
                    <Building2 color={formData.brand === brand ? '#fff' : '#64748b'} size={14} style={{marginRight: 4}}/>
                    <Text style={[styles.chipText, formData.brand === brand && styles.chipTextActive]}>{brand}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {category === 'Cajas' && (
            <>
              <Text style={styles.label}>Formato</Text>
              <View style={styles.chipRow}>
                {CAJA_FORMATS.map(fmt => (
                  <TouchableOpacity 
                    key={fmt} 
                    style={[styles.chip, formData.format === fmt && styles.chipActive]}
                    onPress={() => setFormData({...formData, format: fmt})}
                  >
                    <Box color={formData.format === fmt ? '#fff' : '#64748b'} size={14} style={{marginRight: 4}}/>
                    <Text style={[styles.chipText, formData.format === fmt && styles.chipTextActive]}>{fmt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={styles.label}>Marca / Empresa</Text>
              <View style={styles.chipRow}>
                {CAJA_BRANDS.map(brand => (
                  <TouchableOpacity 
                    key={brand} 
                    style={[styles.chip, formData.brand === brand && styles.chipActive]}
                    onPress={() => setFormData({...formData, brand: brand})}
                  >
                    <Building2 color={formData.brand === brand ? '#fff' : '#64748b'} size={14} style={{marginRight: 4}}/>
                    <Text style={[styles.chipText, formData.brand === brand && styles.chipTextActive]}>{brand}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.label}>Cantidad a Ingresar</Text>
          <View style={styles.inputWrapper}>
            <Circle color="#94a3b8" size={18} style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder={isMP ? "Cantidad (Lts o Kg)" : "Cantidad en Unidades"}
              keyboardType="numeric"
              placeholderTextColor="#94a3b8"
              value={formData.quantity}
              onChangeText={(txt) => setFormData({...formData, quantity: txt})}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Trazabilidad de Origen</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Razón Social Proveedor</Text>
          <View style={styles.inputWrapper}>
            <Building2 color="#94a3b8" size={18} style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder="Ej: Químicos del Sur S.A." 
              placeholderTextColor="#94a3b8"
              value={formData.providerName}
              onChangeText={(txt) => setFormData({...formData, providerName: txt})}
            />
          </View>

          <View style={styles.row}>
            <View style={{flex: 1, marginRight: 10}}>
              <Text style={styles.label}>Lote Proveedor {isMP && '*'}</Text>
              <View style={styles.inputWrapper}>
                <Truck color="#94a3b8" size={18} style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="BCK-990" 
                  placeholderTextColor="#94a3b8"
                  value={formData.batchProvider}
                  onChangeText={(txt) => setFormData({...formData, batchProvider: txt})}
                />
              </View>
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.label}>Vencimiento {isMP && '*'}</Text>
              <View style={styles.inputWrapper}>
                <Calendar color="#94a3b8" size={18} style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="MM/AAAA" 
                  placeholderTextColor="#94a3b8"
                  value={formData.expiryDate}
                  onChangeText={(txt) => setFormData({...formData, expiryDate: txt})}
                />
              </View>
            </View>
          </View>
          
          <Text style={styles.label}>Observaciones Adicionales</Text>
          <View style={[styles.inputWrapper, { height: 80, alignItems: 'flex-start', paddingTop: 10 }]}>
            <ClipboardList color="#94a3b8" size={18} style={styles.inputIcon} />
            <TextInput 
              style={[styles.input, { height: 60, textAlignVertical: 'top' }]} 
              placeholder="Estado del remito, chofer, novedades..." 
              placeholderTextColor="#94a3b8"
              multiline
              value={formData.observations}
              onChangeText={(txt) => setFormData({...formData, observations: txt})}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, isSubmitting && { opacity: 0.7 }]} 
          onPress={handleSave}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Save color="#fff" size={20} />
              <Text style={styles.saveButtonText}>Confirmar Ingreso</Text>
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
  headerSub: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
  
  container: { padding: 20 },
  
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 12, marginLeft: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 },
  catButton: { 
    flex: 1, minWidth: '45%', backgroundColor: '#fff', paddingVertical: 14, 
    borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center',
    elevation: 1 
  },
  catButtonActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  catText: { fontSize: 13, fontWeight: '800', color: '#64748b' },
  catTextActive: { color: '#fff' },

  card: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 25, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  label: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 8, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 15, marginBottom: 15 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, color: '#0f172a', fontSize: 15, fontWeight: '600' },
  
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  chipTextActive: { color: '#fff' },

  row: { flexDirection: 'row' },
  
  saveButton: { backgroundColor: '#10b981', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 16, marginTop: 10, elevation: 4, shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1, marginLeft: 10 }
});