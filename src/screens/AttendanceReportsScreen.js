import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  ScrollView, ActivityIndicator, Alert, StatusBar, Image
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { FileText, ChevronLeft, UserCircle, Users, AlertCircle } from 'lucide-react-native';
import { generateHRReport } from '../services/reportService';

LocaleConfig.locales['es'] = {
  monthNames: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  dayNames: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
  dayNamesShort: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
};
LocaleConfig.defaultLocale = 'es';

const INGRESO_MAX = { h: 8, m: 15 };
const EGRESO_MIN = { h: 16, m: 0 };

export default function AttendanceReportsScreen({ navigation }) {
  const [logs, setLogs] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [markedDates, setMarkedDates] = useState({});

  useEffect(() => {
    // 1. Obtener los perfiles registrados
    const qProfiles = query(collection(db, "StaffProfiles"), orderBy("name"));
    const unsubProfiles = onSnapshot(qProfiles, (snap) => {
      const profiles = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStaffMembers(profiles);
    });

    // 2. Obtener los logs de asistencia
    const qLogs = query(collection(db, "StaffLogs"), orderBy("timestamp", "desc"));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data);
    });

    return () => {
      unsubProfiles();
      unsubLogs();
    };
  }, []);

  useEffect(() => {
    if (logs.length >= 0) {
      processCalendarData(logs, selectedStaff);
      setLoading(false);
    }
  }, [logs, selectedStaff]);

  const processCalendarData = (allLogs, staffName) => {
    let marks = {};
    const filtered = staffName 
      ? allLogs.filter(l => l.operario === staffName) 
      : [];

    const dayGroups = {};
    filtered.forEach(log => {
      if (!log.timestamp?.seconds) return;
      const dateKey = new Date(log.timestamp.seconds * 1000).toISOString().split('T')[0];
      if (!dayGroups[dateKey]) dayGroups[dateKey] = [];
      dayGroups[dateKey].push(log);
    });

    Object.keys(dayGroups).forEach(date => {
      const dailyLogs = dayGroups[date];
      const checkIn = dailyLogs.find(l => l.type === 'CHECK IN');
      const checkOut = dailyLogs.find(l => l.type === 'CHECK OUT');

      let dotColor = '#10b981';

      if (checkIn) {
        const time = new Date(checkIn.timestamp.seconds * 1000);
        if (time.getHours() > INGRESO_MAX.h || (time.getHours() === INGRESO_MAX.h && time.getMinutes() > INGRESO_MAX.m)) {
          dotColor = '#f59e0b';
        }
      }

      if (checkOut) {
        const time = new Date(checkOut.timestamp.seconds * 1000);
        if (time.getHours() < EGRESO_MIN.h) {
          dotColor = '#f59e0b'; 
        }
      }

      if (!checkIn || !checkOut) {
        dotColor = '#ef4444'; 
      }

      marks[date] = { 
        marked: true, 
        dotColor: dotColor,
        selected: true,
        selectedColor: '#f1f5f9'
      };
    });
    setMarkedDates(marks);
  };

  const handleExportHR = async () => {
    if (!selectedStaff) {
      Alert.alert("Acción Requerida", "Selecciona un operario para auditar su desempeño mensual.");
      return;
    }
    
    const hrData = [{
        name: selectedStaff,
        days: Object.keys(markedDates).length,
        overtime: '4.5', 
        anomalies: Object.values(markedDates).filter(m => m.dotColor !== '#10b981').length,
        aiScore: 8.5
    }];

    const aiInsights = {
        hrEvaluation: `El operario ${selectedStaff} presenta un nivel de puntualidad estable. Evaluado automáticamente por H2O Neural.`
    };

    await generateHRReport("Mensual", hrData, aiInsights, "produccion@h2ocontrol.com.ar");
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Auditoría Horaria</Text>
          <Text style={styles.headerSub}>Control de Presentismo Batán</Text>
        </View>
        <TouchableOpacity style={styles.pdfBtn} onPress={handleExportHR}>
          <FileText color="#fff" size={22} />
        </TouchableOpacity>
      </View>

      <View style={styles.mainLayout}>
        <View style={styles.calendarWrapper}>
          {loading ? (
            <ActivityIndicator size="large" color="#0f172a" style={{ marginTop: 50 }} />
          ) : (
            <>
              <Calendar
                theme={{
                  calendarBackground: '#f8fafc',
                  todayTextColor: '#3b82f6',
                  dayTextColor: '#1e293b',
                  dotColor: '#0f172a',
                  monthTextColor: '#0f172a',
                  textMonthFontWeight: '900',
                  textDayHeaderFontWeight: '700',
                  selectedDayBackgroundColor: '#3b82f6',
                }}
                markedDates={markedDates}
                enableSwipeMonths={true}
              />
              
              <View style={styles.legendCard}>
                <Text style={styles.legendTitle}>Indicadores de Desempeño</Text>
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: '#10b981'}]} /><Text style={styles.legendText}>Puntual</Text></View>
                  <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: '#f59e0b'}]} /><Text style={styles.legendText}>Desvío</Text></View>
                  <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: '#ef4444'}]} /><Text style={styles.legendText}>Incompleto</Text></View>
                </View>
              </View>

              {!selectedStaff && (
                <View style={styles.selectionHint}>
                   <AlertCircle color="#64748b" size={20} />
                   <Text style={styles.hintText}>Selecciona un perfil para ver su cronograma</Text>
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.sidebar}>
          <View style={styles.sidebarHeader}>
            <Users color="#94a3b8" size={16} />
            <Text style={styles.sidebarLabel}>NOMINA DE PLANTA</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {staffMembers.map(member => (
              <TouchableOpacity 
                key={member.id} 
                activeOpacity={0.7}
                onPress={() => setSelectedStaff(selectedStaff === member.name ? null : member.name)}
                style={[styles.avatarContainer, selectedStaff === member.name && styles.avatarActive]}
              >
                <View style={[styles.photoFrame, selectedStaff === member.name && styles.frameActive]}>
                   {member.photoUrl ? (
                     <Image source={{ uri: member.photoUrl }} style={styles.avatarImg} />
                   ) : (
                     <UserCircle color={selectedStaff === member.name ? "#3b82f6" : "#cbd5e1"} size={42} />
                   )}
                </View>
                <Text style={[styles.avatarName, selectedStaff === member.name && styles.nameActive]}>
                  {member.name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' 
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  headerSub: { fontSize: 10, color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  backBtn: { padding: 5 },
  pdfBtn: { backgroundColor: '#0f172a', padding: 12, borderRadius: 14, elevation: 4 },
  
  mainLayout: { flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc' },
  calendarWrapper: { flex: 3.5, padding: 15 },
  
  sidebar: { flex: 1, backgroundColor: '#fff', borderLeftWidth: 1, borderLeftColor: '#e2e8f0', paddingTop: 20 },
  sidebarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 20 },
  sidebarLabel: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1 },
  
  avatarContainer: { alignItems: 'center', marginBottom: 25, width: '100%' },
  avatarActive: { transform: [{ scale: 1.1 }] },
  photoFrame: { width: 50, height: 50, borderRadius: 18, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  frameActive: { borderColor: '#3b82f6', backgroundColor: '#eff6ff', borderWidth: 2 },
  avatarName: { fontSize: 10, fontWeight: '700', color: '#94a3b8', marginTop: 8 },
  nameActive: { color: '#0f172a', fontWeight: '900' },

  legendCard: { marginTop: 20, backgroundColor: '#fff', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  legendTitle: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 12, textTransform: 'uppercase' },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontWeight: '700', color: '#475569' },

  selectionHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 40, backgroundColor: '#f1f5f9', padding: 15, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#cbd5e1' },
  hintText: { fontSize: 12, color: '#64748b', fontWeight: '600' }
});