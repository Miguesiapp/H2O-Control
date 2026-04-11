import React, { useState } from 'react';
import { 
  Modal, View, Text, TextInput, TouchableOpacity, 
  StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { auth } from '../config/firebase';
// IMPORTANTE: Ahora usamos el servicio centralizado para garantizar la auditoría
import { registerMovement } from '../services/logisticsService';
import { Save, X, PackagePlus, AlertTriangle } from 'lucide-react-native';

export default function QuickAddModal({ visible, onClose, companyName }) {
  const [form, setForm] = useState({
    name: '',
    qty: '',
    unit: 'Lts',
    type: 'MP',
    min: '',
    loteProveedor: '', // Nuevo: Clave para trazabilidad
    vencimiento: ''    // Nuevo: Clave para calidad
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    // Validación estricta
    if (!form.name || !form.qty || !form.min) {
      Alert.alert("Atención", "Completa Nombre, Cantidad y Stock Mínimo.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Formato Trazabilidad: H2O - INI(Carga Inicial) - FECHA - ID
      const fechaHoy = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const batchInternal = `H2O-INI-${fechaHoy}-${Date.now().toString().slice(-4)}`;

      // Usamos el Motor de Logística para que quede grabado en el AuditLog
      await registerMovement(
        auth.currentUser?.email || 'Sistema', 
        'CARGA_INICIAL_MANUAL', 
        companyName, 
        {
          itemName: form.name.toUpperCase().trim(),
          quantity: Number(form.qty.replace(',', '.')),
          unit: form.unit,
          stockType: form.type,
          minStock: Number(form.min),
          loteProveedor: form.loteProveedor.trim() || 'S/D',
          vencimiento: form.vencimiento.trim() || 'S/V',
          batchInternal: batchInternal
        }
      );
      
      // Limpiar y cerrar
      setForm({ name: '', qty: '', unit: 'Lts', type: 'MP', min: '', loteProveedor: '', vencimiento: '' });
      onClose();
      
      if(Platform.OS === 'web') {
        alert("Carga inicial registrada en auditoría.");
      }

    } catch (e) {
      console.error(e);
      Alert.alert("Error de Sistema", "No se pudo sincronizar con la base de datos central.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
        <View style={styles.modal}>
          
          <View style={styles.header}>
            <View style={styles.headerTitleBox}>
              <PackagePlus color="#10b981" size={24} />
              <Text style={styles.title}>Alta de Inventario</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{companyName}</Text>
            </View>
          </View>
          
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Producto / Insumo Técnico</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ej: ÁCIDO SULFÚRICO / BIDÓN 20L" 
                placeholderTextColor="#94a3b8"
                value={form.name}
                onChangeText={(t) => setForm({...form, name: t})}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, {flex: 1, marginRight: 10}]}>
                <Text style={styles.label}>Cant. Inicial</Text>
                <TextInput 
                  style={[styles.input, { color: '#0f172a', fontWeight: 'bold' }]} 
                  keyboardType="numeric" 
                  placeholder="0.00"
                  placeholderTextColor="#94a3b8"
                  value={form.qty}
                  onChangeText={(t) => setForm({...form, qty: t})}
                />
              </View>
              <View style={[styles.inputGroup, {flex: 1}]}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 5}}>
                  <AlertTriangle color="#f59e0b" size={12} />
                  <Text style={[styles.label, {marginBottom: 0}]}>Stock Mínimo</Text>
                </View>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric" 
                  placeholder="Punto pedido"
                  placeholderTextColor="#94a3b8"
                  value={form.min}
                  onChangeText={(t) => setForm({...form, min: t})}
                />
              </View>
            </View>

            {/* NUEVOS CAMPOS DE TRAZABILIDAD */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, {flex: 1, marginRight: 10}]}>
                <Text style={styles.label}>Lote Proveedor</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="Opcional"
                  placeholderTextColor="#94a3b8"
                  value={form.loteProveedor}
                  onChangeText={(t) => setForm({...form, loteProveedor: t})}
                />
              </View>
              <View style={[styles.inputGroup, {flex: 1}]}>
                <Text style={styles.label}>Vencimiento</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="MM/AAAA"
                  placeholderTextColor="#94a3b8"
                  value={form.vencimiento}
                  onChangeText={(t) => setForm({...form, vencimiento: t})}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, {flex: 1, marginRight: 10}]}>
                <Text style={styles.label}>Unidad</Text>
                <View style={styles.pickerContainer}>
                  <Picker selectedValue={form.unit} onValueChange={(v) => setForm({...form, unit: v})}>
                    <Picker.Item label="Litros (Lts)" value="Lts" />
                    <Picker.Item label="Kilogramos (Kg)" value="Kg" />
                    <Picker.Item label="Unidades (Uds)" value="Uds" />
                  </Picker>
                </View>
              </View>
              
              <View style={[styles.inputGroup, {flex: 1}]}>
                <Text style={styles.label}>Clasificación</Text>
                <View style={styles.pickerContainer}>
                  <Picker selectedValue={form.type} onValueChange={(v) => setForm({...form, type: v})}>
                    <Picker.Item label="Mat. Prima (MP)" value="MP" />
                    <Picker.Item label="Granel (PT)" value="PT" />
                    <Picker.Item label="Envasado (FINAL)" value="FINAL" />
                  </Picker>
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn} disabled={isSubmitting}>
              <X color="#64748b" size={20} />
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={isSubmitting}>
              <Save color="#fff" size={20} />
              <Text style={styles.saveText}>{isSubmitting ? 'Guardando...' : 'Confirmar Alta'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: '#fff', borderRadius: 24, padding: 24, maxHeight: '90%', elevation: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 15 },
  headerTitleBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  badge: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#475569', textTransform: 'uppercase' },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 14, color: '#1e293b', fontWeight: '500' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  pickerContainer: { backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', height: 50, justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 20 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, gap: 6, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', flex: 1, justifyContent: 'center', marginRight: 10 },
  cancelText: { color: '#475569', fontWeight: '700', fontSize: 14 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10b981', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, gap: 6, flex: 1.5, justifyContent: 'center', elevation: 2, shadowColor: '#10b981', shadowOpacity: 0.3, shadowRadius: 5 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 }
});