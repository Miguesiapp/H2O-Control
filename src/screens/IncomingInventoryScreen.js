import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Alert, StatusBar, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebase';
import { registerMovement } from '../services/logisticsService';
import { ChevronLeft, Save, PackagePlus, FileText, Calendar, Building2, Truck } from 'lucide-react-native';

export default function IncomingInventoryScreen({ route, navigation }) {
  const { companyName } = route.params;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState('Materia Prima'); 
  const [formData, setFormData] = useState({
    itemName: '',
    quantity: '',
    presentation: '', 
    batchProvider: '',
    providerName: '',
    expiryDate: ''
  });

  // Generador de Lote Manual (Estándar de Trazabilidad H2O)
  const generateUniqueBatch = () => {
    const fecha = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const idUnico = Date.now().toString().slice(-4);
    return `H2O-MAN-${fecha}-${idUnico}`;
  };

  const handleSave = async () => {
    const qtyNormalized = Number(formData.quantity.replace(',', '.'));

    if (!formData.itemName.trim() || isNaN(qtyNormalized) || qtyNormalized <= 0) {
      Alert.alert("Atención", "El nombre del insumo y una cantidad válida mayor a 0 son obligatorios.");
      return;
    }

    try {
      setIsSubmitting(true);
      const batchInternal = generateUniqueBatch(); 
      
      const movementData = {
        itemName: formData.itemName.trim().toUpperCase(),
        quantity: qtyNormalized,
        presentation: formData.presentation.trim() || null,
        batchProvider: formData.batchProvider.trim() || 'S/D',
        providerName: formData.providerName.trim() || 'S/D',
        expiryDate: formData.expiryDate.trim() || 'S/V',
        category: category,
        stockType: 'MP', 
        batchInternal: batchInternal, 
        unit: category === 'Materia Prima' ? 'Lts/Kg' : 'Uds',
      };

      await registerMovement(
        auth.currentUser?.email || 'Sistema',
        `INGRESO_MANUAL_${category.toUpperCase().replace(/ /g, '_')}`,
        companyName,
        movementData
      );

      Alert.alert(
        "Alta de Stock Exitosa", 
        `Se registró el lote interno:\n${batchInternal}\n\n¿Deseas imprimir la etiqueta de trazabilidad QR para identificar la mercadería?`,
        [
          { text: "No, volver", onPress: () => navigation.goBack(), style: "cancel" },
          { 
            text: "IMPRIMIR QR", 
            onPress: () => navigation.navigate('QRGenerator', { 
              itemData: movementData, 
              companyName: companyName 
            }) 
          }
        ]
      );
    } catch (error) {
      console.error(error);
      Alert.alert("Error de Sistema", "No se pudo sincronizar el ingreso con el servidor.");
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
            <Text style={styles.headerTitle}>Ingreso de Mercadería</Text>
            <Text style={styles.headerSub}>{companyName} • Carga Manual</Text>
        </View>
        <PackagePlus color="#0f172a" size={24} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* BANNER DE ADVERTENCIA */}
        <View style={styles.infoBanner}>
          <Text style={styles.bannerText}>
            Para ingresos complejos, se recomienda usar el módulo de <Text style={{fontWeight: '800'}}>Carga Inteligente (IA)</Text> mediante escaneo OCR de remitos.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Categoría del Insumo</Text>
        <View style={styles.categoryRow}>
          {['Materia Prima', 'Bidones', 'Cajas', 'Etiquetas'].map(cat => (
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

        <View style={styles.card}>
          <Text style={styles.label}>Descripción Técnica</Text>
          <View style={styles.inputWrapper}>
            <FileText color="#94a3b8" size={18} style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder="Ej: ÁCIDO SULFÚRICO" 
              placeholderTextColor="#94a3b8"
              value={formData.itemName}
              onChangeText={(txt) => setFormData({...formData, itemName: txt})}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>Cantidad a Ingresar</Text>
              <TextInput 
                style={styles.inputPlain} 
                placeholder="Ej: 500" 
                keyboardType="numeric"
                placeholderTextColor="#94a3b8"
                value={formData.quantity}
                onChangeText={(txt) => setFormData({...formData, quantity: txt})}
              />
            </View>
            {category !== 'Materia Prima' && category !== 'Etiquetas' && (
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Capacidad (Litros)</Text>
                <TextInput 
                  style={styles.inputPlain} 
                  placeholder="Ej: 20, 10, 5" 
                  keyboardType="numeric"
                  placeholderTextColor="#94a3b8"
                  value={formData.presentation}
                  onChangeText={(txt) => setFormData({...formData, presentation: txt})}
                />
              </View>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Trazabilidad de Origen (Proveedor)</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Razón Social</Text>
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
              <Text style={styles.label}>Lote de Origen</Text>
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
              <Text style={styles.label}>Vencimiento</Text>
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
              <Text style={styles.saveButtonText}>Confirmar Alta en Inventario</Text>
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
  
  infoBanner: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: '#cbd5e1' },
  bannerText: { color: '#475569', fontSize: 12, textAlign: 'center', lineHeight: 18 },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 12, marginLeft: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 },
  catButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', elevation: 1 },
  catButtonActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  catText: { fontSize: 12, color: '#64748b', fontWeight: '700' },
  catTextActive: { color: '#f8fafc' },
  
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 25, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  label: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 8, textTransform: 'uppercase' },
  
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, marginBottom: 15 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#0f172a', fontWeight: '600' },
  inputPlain: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 15, color: '#0f172a', fontWeight: '600', marginBottom: 15 },
  
  row: { flexDirection: 'row' },
  
  saveButton: { backgroundColor: '#10b981', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 14, marginTop: 10, gap: 10, elevation: 4, shadowColor: '#10b981', shadowOpacity: 0.3, shadowRadius: 8 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }
});