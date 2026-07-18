import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  StatusBar, Modal, TextInput, Platform, FlatList,
  Switch, useWindowDimensions, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../config/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { updateOrderStatus, assignOrderRoleTo, updateOrderPriority, updateOrderProgressAndChecklist } from '../services/logisticsService';
import { ChevronLeft, ArrowUp, ArrowDown, UserPlus, CheckCircle2, Clock, PlayCircle, ClipboardCheck, BarChart3, Truck, Edit3 } from 'lucide-react-native';

export default function OrdersBoardScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 1024; // Breakpoint for wide table view

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals for editing
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [assigningRole, setAssigningRole] = useState(null); // 'formulation', 'packaging', 'clark'
  const [workerName, setWorkerName] = useState('');

  // Modal for Progress
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [progressValue, setProgressValue] = useState('0');

  const currentUserEmail = auth.currentUser?.email || 'Usuario';

  useEffect(() => {
    const q = query(collection(db, 'Orders'), orderBy('priority', 'asc'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          displayBatch: extractBatchInfo(data.type, data.data),
          displayProduct: extractProductInfo(data.type, data.data),
          displayLitros: data.data?.liters || data.data?.quantity || '-',
          displayPresentation: data.data?.presentation || '-',
          displayClient: data.data?.clientName || 'General',
          displayTank: data.data?.tank || '-',
        };
      });
      ordersData.sort((a, b) => (a.priority || 0) - (b.priority || 0));
      setOrders(ordersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const extractBatchInfo = (type, data) => {
    if (!data) return 'N/A';
    if (type === 'OP') return data.batch || 'S/D';
    if (type === 'OE') return data.targetBatch || 'S/D';
    if (type === 'OD') return data.dispatchId || 'S/D';
    return 'N/A';
  };

  const extractProductInfo = (type, data) => {
    if (!data) return 'N/A';
    if (type === 'OP') return data.formulaName || 'Producto General';
    if (type === 'OE') return data.productName || 'Envasado';
    if (type === 'OD') return data.productName || 'Despacho';
    return 'Desconocido';
  };

  const handleAssign = async () => {
    if (!workerName.trim()) {
      Alert.alert('Error', 'Debe ingresar un nombre');
      return;
    }
    try {
      await assignOrderRoleTo(selectedOrderId, assigningRole, workerName.trim(), currentUserEmail);
      setAssignModalVisible(false);
      setWorkerName('');
      setAssigningRole(null);
    } catch (e) {
      Alert.alert('Error', 'No se pudo asignar el encargado.');
    }
  };

  const handleUpdateProgress = async () => {
    let num = parseInt(progressValue);
    if (isNaN(num)) num = 0;
    if (num > 100) num = 100;
    if (num < 0) num = 0;

    try {
      await updateOrderProgressAndChecklist(selectedOrderId, { progressPercentage: num }, currentUserEmail);
      setProgressModalVisible(false);
    } catch (e) {
      Alert.alert('Error', 'No se pudo actualizar el progreso.');
    }
  };

  const toggleChecklist = async (orderId, currentVal) => {
    try {
      await updateOrderProgressAndChecklist(orderId, { checklistMaterials: !currentVal }, currentUserEmail);
    } catch (e) {
      Alert.alert('Error', 'No se pudo actualizar el checklist.');
    }
  };

  const cycleStatus = async (orderId, currentStatus) => {
    const statuses = ['PENDIENTE', 'EN_PROCESO', 'FINALIZADO'];
    let currentIndex = statuses.indexOf(currentStatus);
    if (currentIndex === -1) currentIndex = 0; 
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    
    try {
      await updateOrderStatus(orderId, nextStatus, currentUserEmail);
    } catch (e) {
      Alert.alert('Error', 'No se pudo cambiar el estado.');
    }
  };

  const movePriority = async (index, direction) => {
    if (direction === 'up' && index > 0) {
      const newOrders = [...orders];
      const temp = newOrders[index].priority || index;
      const targetTemp = newOrders[index - 1].priority || (index - 1);
      
      await updateOrderPriority(newOrders[index].id, targetTemp - 1, currentUserEmail);
      await updateOrderPriority(newOrders[index - 1].id, temp + 1, currentUserEmail);
    } else if (direction === 'down' && index < orders.length - 1) {
      const newOrders = [...orders];
      const temp = newOrders[index].priority || index;
      const targetTemp = newOrders[index + 1].priority || (index + 1);
      
      await updateOrderPriority(newOrders[index].id, targetTemp + 1, currentUserEmail);
      await updateOrderPriority(newOrders[index + 1].id, temp - 1, currentUserEmail);
    }
  };

  const renderStatusBadge = (status) => {
    let color = '#64748b';
    let text = status || 'PENDIENTE';
    let Icon = Clock;
    
    switch (status) {
      case 'ENVIADO': case 'PENDIENTE': color = '#f59e0b'; Icon = Clock; text = 'PENDIENTE'; break;
      case 'EN_PROCESO': color = '#3b82f6'; Icon = PlayCircle; text = 'PROCESO'; break;
      case 'FINALIZADO': color = '#10b981'; Icon = CheckCircle2; text = 'LISTO'; break;
    }

    return (
      <View style={[styles.statusBadge, { borderColor: color }]}>
        <Icon color={color} size={12} style={{ marginRight: 4 }} />
        <Text style={[styles.statusText, { color: color }]}>{text}</Text>
      </View>
    );
  };

  const renderAssigneeBox = (order, role, title, color) => {
    const value = order[`assigned_${role}`];
    return (
      <TouchableOpacity 
        style={styles.roleBox}
        onPress={() => {
          setSelectedOrderId(order.id);
          setAssigningRole(role);
          setWorkerName(value || '');
          setAssignModalVisible(true);
        }}
      >
        <Text style={[styles.roleTitle, { color }]}>{title}</Text>
        {value ? (
          <Text style={styles.roleValue} numberOfLines={1}>{value}</Text>
        ) : (
          <View style={styles.assignBtn}>
            <UserPlus color="#64748b" size={14} />
            <Text style={styles.assignBtnText}>Asignar</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderProgressBox = (order) => {
    const progress = order.progressPercentage || 0;
    return (
      <TouchableOpacity 
        style={styles.progressBox}
        onPress={() => {
          setSelectedOrderId(order.id);
          setProgressValue(progress.toString());
          setProgressModalVisible(true);
        }}
      >
        <View style={styles.progressHeader}>
          <Text style={styles.progressText}>{progress}% Avance</Text>
          <Edit3 color="#64748b" size={12} />
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
      </TouchableOpacity>
    );
  };

  // -------------------------------------------------------------------------
  // DESKTOP WIDE ROW RENDERER
  // -------------------------------------------------------------------------
  const renderDesktopItem = ({ item, index }) => {
    const typeColor = item.type === 'OP' ? '#0ea5e9' : item.type === 'OE' ? '#c026d3' : '#ef4444';
    
    return (
      <View style={styles.desktopRow}>
        {/* Check Materials */}
        <View style={[styles.dCol, { width: 80, alignItems: 'center' }]}>
          <Switch 
            value={!!item.checklistMaterials} 
            onValueChange={() => toggleChecklist(item.id, !!item.checklistMaterials)}
            trackColor={{ false: '#334155', true: '#10b981' }}
            thumbColor={'#fff'}
          />
        </View>

        {/* Priority */}
        <View style={[styles.dCol, { width: 80, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }]}>
          <Text style={styles.dPriorityText}>{item.priority || index}</Text>
          <View style={{ marginLeft: 8 }}>
             <TouchableOpacity onPress={() => movePriority(index, 'up')} style={styles.arrowBtn}>
               <ArrowUp color="#94a3b8" size={16} />
             </TouchableOpacity>
             <TouchableOpacity onPress={() => movePriority(index, 'down')} style={styles.arrowBtn}>
               <ArrowDown color="#94a3b8" size={16} />
             </TouchableOpacity>
          </View>
        </View>

        {/* Type & Client */}
        <View style={[styles.dCol, { flex: 1.5, paddingRight: 10 }]}>
           <View style={[styles.typeBadge, { backgroundColor: typeColor + '20', borderColor: typeColor }]}>
             <Text style={[styles.typeBadgeText, { color: typeColor }]}>{item.type}</Text>
           </View>
           <Text style={styles.dSubText} numberOfLines={1}>{item.displayClient}</Text>
        </View>

        {/* Product Details */}
        <View style={[styles.dCol, { flex: 2, paddingRight: 10 }]}>
          <Text style={styles.dMainText} numberOfLines={1}>{item.displayProduct}</Text>
          <Text style={styles.dSubText}>Batch: {item.displayBatch} | {item.displayLitros} L | Tq: {item.displayTank}</Text>
        </View>

        {/* Roles */}
        <View style={[styles.dCol, { flex: 4, flexDirection: 'row', gap: 10, paddingRight: 15 }]}>
           <View style={{ flex: 1 }}>{renderAssigneeBox(item, 'formulation', 'Formulación', '#38bdf8')}</View>
           <View style={{ flex: 1 }}>{renderAssigneeBox(item, 'packaging', 'Envasado', '#d946ef')}</View>
           <View style={{ flex: 1 }}>{renderAssigneeBox(item, 'clark', 'Log. / Clark', '#fca5a5')}</View>
        </View>

        {/* Status & Progress */}
        <View style={[styles.dCol, { width: 150, alignItems: 'flex-end' }]}>
          <TouchableOpacity onPress={() => cycleStatus(item.id, item.status)} style={{ marginBottom: 8 }}>
            {renderStatusBadge(item.status)}
          </TouchableOpacity>
          {renderProgressBox(item)}
        </View>
      </View>
    );
  };

  // -------------------------------------------------------------------------
  // MOBILE STACKED CARD RENDERER
  // -------------------------------------------------------------------------
  const renderMobileItem = ({ item, index }) => {
    const typeColor = item.type === 'OP' ? '#0ea5e9' : item.type === 'OE' ? '#c026d3' : '#ef4444';
    
    return (
      <View style={styles.mobileCard}>
        {/* Header: Priority, Type, Status */}
        <View style={styles.mCardHeader}>
          <View style={styles.mPriorityBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => movePriority(index, 'up')} style={styles.arrowBtn}>
                <ArrowUp color="#94a3b8" size={16} />
              </TouchableOpacity>
              <Text style={styles.mPriorityText}>{item.priority || index}</Text>
              <TouchableOpacity onPress={() => movePriority(index, 'down')} style={styles.arrowBtn}>
                <ArrowDown color="#94a3b8" size={16} />
              </TouchableOpacity>
            </View>
            <View style={[styles.typeBadge, { backgroundColor: typeColor + '20', borderColor: typeColor, marginLeft: 10 }]}>
              <Text style={[styles.typeBadgeText, { color: typeColor }]}>{item.type}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => cycleStatus(item.id, item.status)}>
            {renderStatusBadge(item.status)}
          </TouchableOpacity>
        </View>

        {/* Content: Product */}
        <View style={styles.mCardContent}>
          <Text style={styles.dSubText}>{item.displayClient}</Text>
          <Text style={styles.mMainText}>{item.displayProduct}</Text>
          <Text style={styles.mDetailsText}>Batch: {item.displayBatch} • {item.displayLitros} L • Tq: {item.displayTank}</Text>
        </View>

        {/* Checklist & Progress */}
        <View style={styles.mRow}>
          <View style={styles.mChecklistBox}>
            <Text style={styles.mLabel}>Materiales OK:</Text>
            <Switch 
              value={!!item.checklistMaterials} 
              onValueChange={() => toggleChecklist(item.id, !!item.checklistMaterials)}
              trackColor={{ false: '#334155', true: '#10b981' }}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 15 }}>
            {renderProgressBox(item)}
          </View>
        </View>

        {/* Roles Grid */}
        <View style={styles.mRolesGrid}>
           <View style={styles.mRoleWrapper}>{renderAssigneeBox(item, 'formulation', 'Form.', '#38bdf8')}</View>
           <View style={styles.mRoleWrapper}>{renderAssigneeBox(item, 'packaging', 'Env.', '#d946ef')}</View>
           <View style={styles.mRoleWrapper}>{renderAssigneeBox(item, 'clark', 'Clark', '#fca5a5')}</View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#f8fafc" size={28} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <ClipboardCheck color="#38bdf8" size={24} style={{ marginRight: 10 }} />
          <Text style={styles.headerTitle}>PLAN MAESTRO</Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      {/* Main Board Container */}
      <View style={styles.boardWrapper}>
        {isDesktop ? (
          // DESKTOP HORIZONTAL SCROLL WRAPPER
          <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.hScroll}>
            <View style={{ minWidth: 1200 }}>
              {/* Table Header */}
              <View style={styles.dTableHeader}>
                <Text style={[styles.dTh, { width: 80, textAlign: 'center' }]}>MAT (OK)</Text>
                <Text style={[styles.dTh, { width: 80, textAlign: 'center' }]}>PRIOR.</Text>
                <Text style={[styles.dTh, { flex: 1.5 }]}>ORDEN / CLIENTE</Text>
                <Text style={[styles.dTh, { flex: 2 }]}>PRODUCTO / DETALLES</Text>
                <Text style={[styles.dTh, { flex: 4 }]}>EQUIPOS ASIGNADOS</Text>
                <Text style={[styles.dTh, { width: 150, textAlign: 'right' }]}>ESTADO / AVANCE</Text>
              </View>
              {/* List */}
              <FlatList
                data={orders}
                keyExtractor={(item) => item.id}
                renderItem={renderDesktopItem}
                contentContainerStyle={{ paddingBottom: 100 }}
                ListEmptyComponent={
                  !loading && <View style={styles.emptyContainer}><Text style={styles.emptyText}>SIN PLAN DE PRODUCCIÓN ACTIVO</Text></View>
                }
              />
            </View>
          </ScrollView>
        ) : (
          // MOBILE VERTICAL LIST
          <FlatList
            data={orders}
            keyExtractor={(item) => item.id}
            renderItem={renderMobileItem}
            contentContainerStyle={{ padding: 10, paddingBottom: 100 }}
            ListEmptyComponent={
              !loading && <View style={styles.emptyContainer}><Text style={styles.emptyText}>SIN PLAN DE PRODUCCIÓN ACTIVO</Text></View>
            }
          />
        )}
      </View>

      {/* Modal de Asignación */}
      <Modal visible={assignModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Asignar Personal</Text>
            <Text style={styles.modalSub}>Rol seleccionado: {assigningRole}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nombre del operario..."
              placeholderTextColor="#94a3b8"
              value={workerName}
              onChangeText={setWorkerName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setAssignModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleAssign}>
                <Text style={styles.modalSaveText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Progreso */}
      <Modal visible={progressModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Actualizar Avance</Text>
            <Text style={styles.modalSub}>Ingresa el % de avance actual (0-100)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <TextInput
                style={[styles.modalInput, { flex: 1, marginBottom: 0, textAlign: 'center', fontSize: 24 }]}
                keyboardType="numeric"
                maxLength={3}
                value={progressValue}
                onChangeText={setProgressValue}
                autoFocus
              />
              <Text style={{ color: '#94a3b8', fontSize: 24, marginLeft: 10 }}>%</Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setProgressModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleUpdateProgress}>
                <Text style={styles.modalSaveText}>Actualizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020617' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#0f172a',
    borderBottomWidth: 1, borderBottomColor: '#1e293b'
  },
  backBtn: { padding: 5 },
  headerCenter: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#f8fafc', letterSpacing: 1 },
  
  boardWrapper: { flex: 1 },
  hScroll: { flex: 1 },

  // DESKTOP STYLES
  dTableHeader: {
    flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 12,
    backgroundColor: '#0f172a', borderBottomWidth: 1, borderBottomColor: '#1e293b'
  },
  dTh: { color: '#64748b', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  desktopRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1e293b', backgroundColor: '#020617'
  },
  dCol: { justifyContent: 'center' },
  dPriorityText: { color: '#e2e8f0', fontSize: 18, fontWeight: '900' },
  dMainText: { color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  dSubText: { color: '#94a3b8', fontSize: 12, marginTop: 4 },

  // MOBILE STYLES
  mobileCard: {
    backgroundColor: '#0f172a', borderRadius: 12, padding: 15, marginBottom: 12,
    borderWidth: 1, borderColor: '#1e293b'
  },
  mCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  mPriorityBox: { flexDirection: 'row', alignItems: 'center' },
  mPriorityText: { color: '#e2e8f0', fontSize: 16, fontWeight: '900', marginHorizontal: 8 },
  mCardContent: { marginBottom: 15 },
  mMainText: { color: '#f8fafc', fontSize: 18, fontWeight: '800', marginVertical: 4 },
  mDetailsText: { color: '#cbd5e1', fontSize: 13 },
  mRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, backgroundColor: '#020617', padding: 10, borderRadius: 8 },
  mChecklistBox: { flexDirection: 'row', alignItems: 'center' },
  mLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '700', marginRight: 8 },
  mRolesGrid: { flexDirection: 'row', gap: 8 },
  mRoleWrapper: { flex: 1 },

  // SHARED UI
  arrowBtn: { padding: 2 },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  typeBadgeText: { fontSize: 12, fontWeight: '900' },
  
  roleBox: { backgroundColor: '#020617', borderWidth: 1, borderColor: '#1e293b', borderRadius: 8, padding: 8 },
  roleTitle: { fontSize: 10, fontWeight: '800', marginBottom: 4 },
  roleValue: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  assignBtn: { flexDirection: 'row', alignItems: 'center', opacity: 0.6 },
  assignBtnText: { color: '#94a3b8', fontSize: 11, marginLeft: 4, fontWeight: '700' },

  progressBox: { width: '100%', marginTop: 4 },
  progressHeader: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 4 },
  progressText: { color: '#94a3b8', fontSize: 11, fontWeight: '800', marginRight: 4 },
  progressBarBg: { height: 6, backgroundColor: '#1e293b', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 3 },

  statusBadge: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, backgroundColor: '#020617' },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { color: '#334155', fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  // MODALS
  modalOverlay: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1e293b', padding: 25, borderRadius: 16, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: '#334155' },
  modalTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '800', marginBottom: 5 },
  modalSub: { color: '#94a3b8', fontSize: 12, marginBottom: 20 },
  modalInput: { backgroundColor: '#0f172a', color: '#f8fafc', padding: 15, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: '#334155', marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalCancel: { padding: 12 },
  modalCancelText: { color: '#94a3b8', fontWeight: '700' },
  modalSave: { backgroundColor: '#3b82f6', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  modalSaveText: { color: '#fff', fontWeight: '800' }
});
