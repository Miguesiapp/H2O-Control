import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Alert, StatusBar, ActivityIndicator, Switch, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../config/firebase';
import { registerMovement } from '../services/logisticsService';
import { ChevronLeft, Save, PackagePlus, FileText, Calendar as CalendarIcon, Building2, Truck, Droplet, Box, Circle, ClipboardList, Database, ArrowDownCircle, ArrowUpCircle, X } from 'lucide-react-native';
import AutocompleteInput from '../components/AutocompleteInput';
import { Calendar as CalendarPicker } from 'react-native-calendars';
import { ChevronRight } from 'lucide-react-native';
import { Modal } from 'react-native';
import Toast from 'react-native-toast-message';
import { 
  RAW_MATERIALS_LIST, PRODUCTS_MADRE_LIST, PRODUCTS_FINAL_LIST,
  ETIQUETA_CAPACITIES, BIDON_CAPACITIES, CAJA_FORMATS, PROVIDERS_LIST,
  generateBatchId, BIDON_BRANDS, CAJA_BRANDS
} from '../config/constants';
import { printSingleLabel } from '../services/labelService';

export default function InventoryAdjustmentScreen({ navigation }) {
  const [inventoryType, setInventoryType] = useState('MP'); // 'MP' | 'INSUMOS' | 'PT'
  const [operationType, setOperationType] = useState(null); // null | 'INGRESO' | 'EGRESO'
  const [unitType, setUnitType] = useState('Kilos'); // 'Kilos' | 'Litros'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState('Bidones'); 
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  
  const [formData, setFormData] = useState({
    itemName: '',
    quantity: '',
    providerName: '',
    batchProvider: '',
    expiryDate: '',
    observations: '',
    capacity: '20', 
    format: 'x5',
    brandBidon: 'H2O',
    brandCaja: 'H2O CON LOGO'
  });



  const handleSave = async () => {
    if (!operationType) {
      Alert.alert("Atención", "Debes seleccionar si es un Alta o Baja por ajuste.");
      return;
    }

    let qtyNormalized = Number(formData.quantity.replace(',', '.'));
    const isMP = inventoryType === 'MP';
    const isPT = inventoryType === 'PT';
    const isGranel = inventoryType === 'GRANEL';
    const isEgreso = operationType === 'EGRESO';

    if (isNaN(qtyNormalized) || qtyNormalized <= 0) {
      Alert.alert("Datos Inválidos", "La cantidad debe ser mayor a 0.");
      return;
    }

    if (isEgreso) {
      qtyNormalized = -Math.abs(qtyNormalized); // Convert to negative for FIFO deduction
      if (!formData.observations.trim()) {
        Alert.alert("Justificación Requerida", "Debes ingresar el motivo de la baja en observaciones.");
        return;
      }
    }

    if (isMP) {
      if (!formData.itemName.trim()) {
         Alert.alert("Datos Incompletos", "El nombre de la Materia Prima es obligatorio.");
         return;
      }
      if (!isEgreso && (!formData.batchProvider.trim() || !formData.expiryDate.trim())) {
        Alert.alert("Datos Incompletos", "Lote del Proveedor y Vencimiento son obligatorios para Ingreso de Materia Prima.");
        return;
      }
    } else if (isGranel) {
      if (!formData.itemName.trim()) {
         Alert.alert("Datos Incompletos", "El nombre del producto a Granel es obligatorio.");
         return;
      }
    } else {
      if (category === 'Etiquetas' && !formData.itemName.trim()) {
        Alert.alert("Datos Incompletos", "El nombre del producto para la etiqueta es obligatorio.");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      
      let batchInternal = '';
      if (formData.batchProvider.trim() !== '') {
        batchInternal = formData.batchProvider.trim().toUpperCase();
      } else {
        batchInternal = isEgreso || isPT || isGranel ? generateBatchId() : 'S/D';
        if (isEgreso) batchInternal = 'S/D';
      }
      
      let finalItemName = formData.itemName.trim().toUpperCase();
      let finalUnit = 'Uds';
      
      if (isPT) {
        finalUnit = unitType === 'Kilos' ? 'Kg' : (unitType === 'Litros' ? 'Lts' : 'Uds');
      } else if (isGranel) {
        finalUnit = unitType === 'Kilos' ? 'Kg' : 'Lts';
      } else if (!isMP) {
        if (category === 'Bidones') finalItemName = `BIDON ${formData.capacity}L ${formData.brandBidon}`;
        if (category === 'Cajas') finalItemName = `CAJA ${formData.format} ${formData.brandCaja}`;
        if (category === 'Etiquetas') finalItemName = `ETIQUETA ${formData.capacity} ${formData.itemName.trim().toUpperCase()}`;
      } else {
        finalUnit = unitType === 'Kilos' ? 'Kg' : 'Lts';
      }
      
      const movementData = {
        itemName: finalItemName,
        quantity: qtyNormalized,
        batchProvider: formData.batchProvider.trim() || 'S/D',
        providerName: formData.providerName.trim() || 'S/D',
        expiryDate: formData.expiryDate.trim() || 'S/V',
        observations: formData.observations.trim(),
        category: isMP ? 'Materia Prima' : (isPT ? 'Producto Terminado' : (isGranel ? 'Producto Granel' : category)),
        stockType: isMP ? 'MP' : (isPT ? 'FINAL' : (isGranel ? 'GRANEL' : 'INSUMOS')),
        batchInternal: batchInternal, 
        unit: finalUnit,
        status: (isMP && !isEgreso) ? 'PENDIENTE' : ((isGranel && !isEgreso) ? 'PENDIENTE_LABORATORIO' : 'APTO')
      };

      let companyDest = 'STOCK_CENTRAL_INSUMOS';
      if (isMP) companyDest = 'STOCK_CENTRAL_MP';
      if (isPT || isGranel) companyDest = 'H2O';
      
      let actionName = '';
      if (isEgreso) {
        actionName = 'BAJA_POR_AJUSTE';
      } else {
        if (isMP) actionName = 'ALTA_POR_AJUSTE_MATERIA_PRIMA';
        else if (isPT) actionName = 'ALTA_POR_AJUSTE_PRODUCTO_TERMINADO';
        else if (isGranel) actionName = 'ALTA_POR_AJUSTE_GRANEL';
        else actionName = `ALTA_POR_AJUSTE_${category.toUpperCase().replace(/ /g, '_')}`;
      }

      await registerMovement(
        auth.currentUser?.email || 'Sistema',
        actionName,
        companyDest,
        movementData
      );

      if (isEgreso) {
        if (Platform.OS === 'web') {
          Toast.show({ type: 'success', text1: 'Ajuste Exitoso', text2: 'El stock fue modificado en la base de datos.' });
          (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'));
        } else {
          Alert.alert("Ajuste Exitoso", "El stock fue modificado en la base de datos.", [
            { text: "Entendido", onPress: () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')) }
          ]);
        }
      } else {
        if (Platform.OS === 'web') {
          Toast.show({ type: 'success', text1: 'Cargado con éxito', text2: `Lote asignado: ${batchInternal}` });
          setFormData({ itemName: '', quantity: '', providerName: '', batchProvider: '', expiryDate: '', observations: '', capacity: '20L', format: 'x5' });
        } else {
          Alert.alert(
            "Alta de Stock Exitosa",
            `Lote asignado: ${batchInternal}\n¿Desea imprimir etiqueta de identificación (Zebra)?`,
            [
              { text: "No, gracias", style: "cancel", onPress: () => navigation.navigate('Home') },
              { text: "Imprimir Etiqueta", onPress: async () => {
                  try {
                    await printSingleLabel({
                      type: isMP ? 'MP' : 'INSUMOS',
                      name: finalItemName,
                      batch: isMP ? (formData.batchProvider.trim() || batchInternal) : batchInternal,
                      expiration: formData.expiryDate.trim() || 'N/A',
                      quantity: qtyNormalized,
                      unit: finalUnit
                    });
                  } catch (e) {
                    Alert.alert("Error de Impresión", "No se pudo generar la etiqueta.");
                  } finally {
                    navigation.navigate('Home');
                  }
                }
              }
            ]
          );
        }
      }

    } catch (error) {
      console.error(error);
      Alert.alert("Error de Sistema", "No se pudo procesar el movimiento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const INSUMOS_CATEGORIES = ['Bidones', 'Cajas', 'Etiquetas'];
  const isEgreso = operationType === 'EGRESO';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))} style={styles.backBtn}>
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
            <Text style={styles.headerTitle}>Gestión de Stock</Text>
            <Text style={styles.headerSub}>Ajustes de Inventario</Text>
        </View>
        <PackagePlus color="#0f172a" size={24} />
      </View>

      <ScrollView maximumZoomScale={1} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        
        {/* Toggle INGRESO / EGRESO */}
        <View style={styles.opToggleContainer}>
          <TouchableOpacity 
            style={[styles.opToggleBtn, operationType === 'INGRESO' && styles.opToggleBtnIngreso]}
            onPress={() => setOperationType('INGRESO')}
          >
            <ArrowUpCircle color={operationType === 'INGRESO' ? '#fff' : '#64748b'} size={18} style={{marginRight: 6}} />
            <Text style={[styles.opToggleText, operationType === 'INGRESO' && styles.opToggleTextActive]}>ALTA POR AJUSTE</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.opToggleBtn, operationType === 'EGRESO' && styles.opToggleBtnEgreso]}
            onPress={() => setOperationType('EGRESO')}
          >
            <ArrowDownCircle color={operationType === 'EGRESO' ? '#fff' : '#64748b'} size={18} style={{marginRight: 6}} />
            <Text style={[styles.opToggleText, operationType === 'EGRESO' && styles.opToggleTextActive]}>BAJA POR AJUSTE</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.masterToggleContainer}>
          <TouchableOpacity 
            style={[styles.masterToggleBtn, inventoryType === 'MP' && styles.masterToggleBtnActive]}
            onPress={() => setInventoryType('MP')}
          >
            <Database color={inventoryType === 'MP' ? '#fff' : '#64748b'} size={18} style={{marginRight: 6}} />
            <Text style={[styles.masterToggleText, inventoryType === 'MP' && styles.masterToggleTextActive]}>MP</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.masterToggleBtn, inventoryType === 'PT' && { backgroundColor: '#10b981', borderColor: '#10b981' }]}
            onPress={() => setInventoryType('PT')}
          >
            <PackagePlus color={inventoryType === 'PT' ? '#fff' : '#64748b'} size={18} style={{marginRight: 6}} />
            <Text style={[styles.masterToggleText, inventoryType === 'PT' && styles.masterToggleTextActive]}>PT</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.masterToggleBtn, inventoryType === 'GRANEL' && { backgroundColor: '#f59e0b', borderColor: '#f59e0b' }]}
            onPress={() => setInventoryType('GRANEL')}
          >
            <Droplet color={inventoryType === 'GRANEL' ? '#fff' : '#64748b'} size={18} style={{marginRight: 6}} />
            <Text style={[styles.masterToggleText, inventoryType === 'GRANEL' && styles.masterToggleTextActive]}>GRANEL</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.masterToggleBtn, inventoryType === 'INSUMOS' && styles.masterToggleBtnActiveInsumos]}
            onPress={() => setInventoryType('INSUMOS')}
          >
            <Box color={inventoryType === 'INSUMOS' ? '#fff' : '#64748b'} size={18} style={{marginRight: 6}} />
            <Text style={[styles.masterToggleText, inventoryType === 'INSUMOS' && styles.masterToggleTextActive]}>INSUMOS</Text>
          </TouchableOpacity>
        </View>

        {inventoryType === 'INSUMOS' && (
          <>
            <Text style={styles.sectionTitle}>Categoría de Insumo</Text>
            <View style={styles.categoryRow}>
              {INSUMOS_CATEGORIES.map(cat => (
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

        <View style={styles.formContainer}>
          {(inventoryType === 'MP' || inventoryType === 'GRANEL' || inventoryType === 'PT' || (inventoryType === 'INSUMOS' && category === 'Etiquetas')) && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{inventoryType === 'MP' ? 'Materia Prima' : (inventoryType === 'GRANEL' ? 'Producto Granel' : 'Producto / Nombre')}</Text>
              <AutocompleteInput
                data={inventoryType === 'MP' ? RAW_MATERIALS_LIST : (inventoryType === 'GRANEL' ? PRODUCTS_MADRE_LIST : PRODUCTS_FINAL_LIST)}
                value={formData.itemName}
                onChangeText={(t) => setFormData({...formData, itemName: t})}
                placeholder={inventoryType === 'MP' ? "Buscar MP..." : (inventoryType === 'GRANEL' ? "Buscar Granel..." : "Nombre del producto...")}
                allowCustom={true}
              />
            </View>
          )}

          {inventoryType === 'INSUMOS' && category === 'Etiquetas' && (
            <>
              <Text style={styles.label}>Capacidad de la Etiqueta</Text>
              <View style={styles.chipRow}>
                {ETIQUETA_CAPACITIES.map(cap => (
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
            </>
          )}

          {inventoryType === 'INSUMOS' && category === 'Bidones' && (
            <>
              <Text style={styles.label}>Capacidad del Bidón</Text>
              <View style={styles.chipRow}>
                {BIDON_CAPACITIES.map(cap => (
                  <TouchableOpacity 
                    key={cap} 
                    style={[styles.chip, formData.capacity === cap && styles.chipActive]}
                    onPress={() => setFormData({...formData, capacity: cap})}
                  >
                    <Droplet color={formData.capacity === cap ? '#fff' : '#64748b'} size={14} style={{marginRight: 4}}/>
                    <Text style={[styles.chipText, formData.capacity === cap && styles.chipTextActive]}>{cap}L</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Marca del Bidón</Text>
              <View style={styles.chipRow}>
                {BIDON_BRANDS.map(brand => (
                  <TouchableOpacity 
                    key={brand} 
                    style={[styles.chip, formData.brandBidon === brand && styles.chipActive]}
                    onPress={() => setFormData({...formData, brandBidon: brand})}
                  >
                    <Building2 color={formData.brandBidon === brand ? '#fff' : '#64748b'} size={14} style={{marginRight: 4}}/>
                    <Text style={[styles.chipText, formData.brandBidon === brand && styles.chipTextActive]}>{brand}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {inventoryType === 'INSUMOS' && category === 'Cajas' && (
            <>
              <Text style={styles.label}>Formato de Caja</Text>
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

              <Text style={styles.label}>Marca de Caja</Text>
              <View style={styles.chipRow}>
                {CAJA_BRANDS.map(brand => (
                  <TouchableOpacity 
                    key={brand} 
                    style={[styles.chip, formData.brandCaja === brand && styles.chipActive]}
                    onPress={() => setFormData({...formData, brandCaja: brand})}
                  >
                    <Box color={formData.brandCaja === brand ? '#fff' : '#64748b'} size={14} style={{marginRight: 4}}/>
                    <Text style={[styles.chipText, formData.brandCaja === brand && styles.chipTextActive]}>{brand}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <View style={{ marginBottom: 20 }}>
            <Text style={styles.label}>Cantidad a {isEgreso ? 'Descontar' : 'Ingresar'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.inputWrapper, { flex: 1, marginBottom: 0 }, isEgreso && { borderColor: '#fca5a5', backgroundColor: '#fef2f2' }]}>
                <Circle color={isEgreso ? "#ef4444" : "#94a3b8"} size={18} style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Cantidad"
                  keyboardType="numeric"
                  placeholderTextColor="#94a3b8"
                  value={formData.quantity}
                  onChangeText={(txt) => setFormData({...formData, quantity: txt})}
                />
              </View>

              {(inventoryType === 'PT' || inventoryType === 'MP' || inventoryType === 'GRANEL') ? (
                <View style={{ flexDirection: 'row', marginLeft: 10, backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4 }}>
                  <TouchableOpacity 
                    style={[{ paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8 }, unitType === 'Kilos' && { backgroundColor: '#0f172a' }]} 
                    onPress={() => setUnitType('Kilos')}
                  >
                    <Text style={[{ fontSize: 13, fontWeight: '700', color: '#64748b' }, unitType === 'Kilos' && { color: '#fff' }]}>Kilos</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[{ paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8 }, unitType === 'Litros' && { backgroundColor: '#0f172a' }]} 
                    onPress={() => setUnitType('Litros')}
                  >
                    <Text style={[{ fontSize: 13, fontWeight: '700', color: '#64748b' }, unitType === 'Litros' && { color: '#fff' }]}>Litros</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', marginLeft: 10, backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4 }}>
                  <View style={[{ paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, backgroundColor: '#0f172a' }]}>
                     <Text style={[{ fontSize: 13, fontWeight: '700', color: '#fff' }]}>Uds</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{isEgreso ? 'Lote a Descontar (Opcional)' : 'Trazabilidad de Origen'}</Text>
        <View style={styles.card}>
          {!isEgreso && (
            <>
              <Text style={styles.label}>Razón Social Proveedor</Text>
              <AutocompleteInput
                data={PROVIDERS_LIST}
                value={formData.providerName}
                onChangeText={(txt) => setFormData({...formData, providerName: txt})}
                placeholder="Ej: Químicos del Sur S.A."
                icon={<Building2 color="#94a3b8" size={18} />}
              />
            </>
          )}

          <View style={styles.row}>
            <View style={{flex: 1, marginRight: !isEgreso ? 10 : 0}}>
              <Text style={styles.label}>{isEgreso ? 'Lote Específico' : `Lote Proveedor ${inventoryType === 'MP' ? '*' : ''}`}</Text>
              <View style={styles.inputWrapper}>
                <Truck color="#94a3b8" size={18} style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder={isEgreso ? "Si lo dejas vacío, descontará FIFO" : "BCK-990"} 
                  placeholderTextColor="#94a3b8"
                  value={formData.batchProvider}
                  onChangeText={(txt) => setFormData({...formData, batchProvider: txt})}
                />
              </View>
            </View>
            {!isEgreso && (
              <View style={{flex: 1}}>
                <Text style={styles.label}>Vencimiento {inventoryType === 'MP' && '*'}</Text>
                <TouchableOpacity 
                  style={styles.inputWrapper}
                  onPress={() => setIsCalendarVisible(true)}
                >
                  <CalendarIcon color="#94a3b8" size={18} style={styles.inputIcon} />
                  <Text style={[styles.input, { flex: 1, color: formData.expiryDate ? '#0f172a' : '#94a3b8' }]}>
                    {formData.expiryDate || 'MM/AAAA'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.card}>
          <Text style={styles.label}>Observaciones / Justificación {isEgreso && '*'}</Text>
          <View style={[styles.inputWrapper, { height: 80, alignItems: 'flex-start', paddingTop: 10 }]}>
            <ClipboardList color="#94a3b8" size={18} style={styles.inputIcon} />
            <TextInput 
              style={[styles.input, { height: 60, textAlignVertical: 'top' }]} 
              placeholder={isEgreso ? "Ej: Muestra enviada a cliente..." : "Estado del remito, chofer..."} 
              placeholderTextColor="#94a3b8"
              multiline
              value={formData.observations}
              onChangeText={(txt) => setFormData({...formData, observations: txt})}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, isEgreso && { backgroundColor: '#ef4444', shadowColor: '#ef4444' }, isSubmitting && { opacity: 0.7 }]} 
          onPress={handleSave}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Save color="#fff" size={20} />
              <Text style={styles.saveButtonText}>{isEgreso ? 'Confirmar Baja' : 'Confirmar Ingreso'}</Text>
            </>
          )}
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* CALENDAR MODAL */}
      <Modal visible={isCalendarVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Fecha de Vencimiento</Text>
              <TouchableOpacity onPress={() => setIsCalendarVisible(false)}>
                <X color="#64748b" size={24} />
              </TouchableOpacity>
            </View>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#f8fafc'}}>
              <TouchableOpacity onPress={() => setCalendarYear(y => y - 1)} style={{padding: 10}}>
                <ChevronLeft color="#3b82f6" size={28} />
              </TouchableOpacity>
              <Text style={{fontSize: 22, fontWeight: '900', color: '#0f172a'}}>{calendarYear}</Text>
              <TouchableOpacity onPress={() => setCalendarYear(y => y + 1)} style={{padding: 10}}>
                <ChevronRight color="#3b82f6" size={28} />
              </TouchableOpacity>
            </View>

            <View style={{flexDirection: 'row', flexWrap: 'wrap', padding: 15, justifyContent: 'center'}}>
              {["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"].map((m, i) => (
                <TouchableOpacity 
                  key={m}
                  style={{width: '30%', paddingVertical: 15, margin: '1.5%', backgroundColor: '#f1f5f9', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0'}}
                  onPress={() => {
                    const monthStr = String(i + 1).padStart(2, '0');
                    setFormData({...formData, expiryDate: `${monthStr}/${calendarYear}`});
                    setIsCalendarVisible(false);
                  }}
                >
                  <Text style={{fontSize: 16, fontWeight: '700', color: '#334155'}}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
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

  opToggleContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  opToggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  opToggleBtnIngreso: { backgroundColor: '#10b981', borderColor: '#10b981' },
  opToggleBtnEgreso: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  opToggleText: { fontSize: 12, fontWeight: '900', color: '#64748b' },
  opToggleTextActive: { color: '#fff' },

  masterToggleContainer: { flexDirection: 'column', gap: 10, marginBottom: 25 },
  masterToggleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingVertical: 15, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  masterToggleBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  masterToggleBtnActiveInsumos: { backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' },
  masterToggleText: { fontSize: 13, fontWeight: '900', color: '#64748b', letterSpacing: 0.5 },
  masterToggleTextActive: { color: '#fff' },
  
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 12, marginLeft: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 },
  catButton: { 
    flex: 1, minWidth: '30%', backgroundColor: '#fff', paddingVertical: 12, 
    borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center',
    elevation: 1 
  },
  catButtonActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  catText: { fontSize: 12, fontWeight: '800', color: '#64748b' },
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
  saveButtonEgreso: { backgroundColor: '#ef4444', shadowColor: '#ef4444' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1, marginLeft: 10 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  calendarContainer: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', elevation: 10 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  calendarTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' }
});