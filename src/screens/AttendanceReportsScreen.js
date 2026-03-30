import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Image, 
  ScrollView, ActivityIndicator, Alert, Dimensions 
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { FileText, ChevronLeft, UserCircle } from 'lucide-react-native';

// IMPORTAMOS EL GENERADOR DE PDF (Asegurate de tener este archivo en utils)
import { generateAttendancePdf } from '../utils/AttendancePdfGenerator';

// Configuración del calendario en Español
LocaleConfig.locales['es'] = {
  monthNames: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  dayNames: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
  dayNamesShort: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
};
LocaleConfig.defaultLocale = 'es';

// LÍMITES HORARIOS H2O CONTROL
const INGRESO_MAX = { h: 8, m: 15 }; // Tolerancia hasta 8:15 am
const EGRESO_MIN = { h: 16, m: 0 };  // Salida mínima 4:00 pm

export default function AttendanceReportsScreen({ navigation }) {
  const [logs, setLogs] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [markedDates, setMarkedDates] = useState({});

  // Lista de Staff con Migue Silva y Jefes
  const staffMembers = [
    { id: '1', name: 'Migue Silva', email: 'miguesilva.1985@outlook.es' },
    { id: '2', name: 'B. Duville', email: 'bduville@h2ocontrol.com.ar' },
    { id: '3', name: 'J. Malvasio', email: 'jmalvasio@h2ocontrol.com.ar' },
    { id: '4', name: 'Operario 4', email: 'op4@h2ocontrol.com.ar' },
    { id: '5', name: 'Operario 5', email: 'op5@h2ocontrol.com.ar' },
    { id: '6', name: 'Operario 6', email: 'op6@h2ocontrol.com.ar' },
    { id: '7', name: 'Operario 7', email: 'op7@h2ocontrol.com.ar' },
    { id: '8', name: 'Operario 8', email: 'op8@h2ocontrol.com.ar' },
    { id: '9', name: 'Operario 9', email: 'op9@h2ocontrol.com.ar' },
    { id: '10', name: 'Operario 10', email: 'op10@h2ocontrol.com.ar' },
    { id: '11', name: 'Operario 11', email: 'op11@h2ocontrol.com.ar' },
    { id: '12', name: 'Operario 12', email: 'op12@h2ocontrol.com.ar' },
  ];

  useEffect(() => {
    const q = query(collection(db, "StaffLogs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLogs(data);
      processCalendarData(data, selectedStaff);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [selectedStaff]);

  const processCalendarData = (allLogs, staffEmail) => {
    let marks = {};
    const filtered = staffEmail ? allLogs.filter(l => l.userEmail?.toLowerCase() === staffEmail.toLowerCase()) : allLogs;

    const dayGroups = {};
    filtered.forEach(log => {
      if (!log.timestamp) return;
      const dateKey = new Date(log.timestamp.seconds * 1000).toISOString().split('T')[0];
      if (!dayGroups[dateKey]) dayGroups[dateKey] = [];
      dayGroups[dateKey].push(log);
    });

    Object.keys(dayGroups).forEach(date => {
      const dailyLogs = dayGroups[date];
      const dayOfWeek = new Date(date).getDay();
      
      if (dayOfWeek === 0) return; // Ignorar domingos

      let dotColor = '#2e7d32'; // Verde inicial (OK)

      dailyLogs.forEach(log => {
        const time = new Date(log.timestamp.seconds * 1000);
        const h = time.getHours();
        const m = time.getMinutes();

        if (log.type === 'CHECK IN') {
          if (h > INGRESO_MAX.h || (h === INGRESO_MAX.h && m > INGRESO_MAX.m)) {
            dotColor = '#fbc02d'; // Amarillo (Tarde)
          }
        } else if (log.type === 'CHECK OUT') {
          if (h < EGRESO_MIN.h) {
            dotColor = '#fbc02d'; // Amarillo (Salida temprana)
          }
        }
      });

      marks[date] = { 
        marked: true, 
        dotColor: dotColor,
        selected: !!staffEmail,
        selectedColor: staffEmail ? '#e8f5e9' : null
      };
    });
    setMarkedDates(marks);
  };

  const handleExportPdf = () => {
    if (!selectedStaff) {
      Alert.alert("Atención", "Seleccioná un operario de la lista a la derecha para generar su reporte.");
      return;
    }
    const staffMember = staffMembers.find(m => m.email === selectedStaff);
    const staffLogs = logs.filter(l => l.userEmail?.toLowerCase() === selectedStaff.toLowerCase());
    
    if (staffLogs.length === 0) {
      Alert.alert("Sin datos", "Este operario no tiene registros cargados.");
      return;
    }

    generateAttendancePdf(staffMember.name, staffLogs);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#2e4a3b" size={28} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>CHECK INGRESOS</Text>
          <Text style={styles.headerSub}>Planta Batán • Horario 08-16</Text>
        </View>
        <TouchableOpacity style={styles.pdfBtn} onPress={handleExportPdf}>
          <FileText color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.mainLayout}>
        {/* IZQUIERDA: CALENDARIO */}
        <View style={styles.calendarWrapper}>
          {loading ? (
            <ActivityIndicator size="large" color="#2e4a3b" style={{ marginTop: 50 }} />
          ) : (
            <>
              <Calendar
                theme={{
                  calendarBackground: '#fff',
                  todayTextColor: '#2e4a3b',
                  dayTextColor: '#2d4150',
                  dotColor: '#2e4a3b',
                  monthTextColor: '#2e4a3b',
                  textMonthFontWeight: '900',
                  textDayHeaderFontWeight: '600',
                  selectedDayBackgroundColor: '#2e4a3b',
                }}
                markedDates={markedDates}
                enableSwipeMonths={true}
              />
              <View style={styles.legendCard}>
                <Text style={styles.legendTitle}>Referencias de Color</Text>
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: '#2e7d32'}]} /><Text style={styles.legendText}>Cumplido</Text></View>
                  <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: '#fbc02d'}]} /><Text style={styles.legendText}>Incumplido</Text></View>
                  <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: '#d32f2f'}]} /><Text style={styles.legendText}>Faltas</Text></View>
                </View>
              </View>
            </>
          )}
        </View>

        {/* DERECHA: SIDEBAR AVATARES */}
        <View style={styles.sidebar}>
          <Text style={styles.sidebarLabel}>PERSONAL</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
            {staffMembers.map(member => (
              <TouchableOpacity 
                key={member.id} 
                activeOpacity={0.7}
                onPress={() => setSelectedStaff(selectedStaff === member.email ? null : member.email)}
                style={[
                  styles.avatarContainer, 
                  selectedStaff === member.email && styles.avatarActive
                ]}
              >
                <View style={[styles.photoFrame, selectedStaff === member.email && { borderColor: '#2e4a3b', backgroundColor: '#e8f5e9' }]}>
                   <UserCircle color={selectedStaff === member.email ? "#2e4a3b" : "#bbb"} size={45} />
                </View>
                <Text style={[styles.avatarName, selectedStaff === member.email && { color: '#2e4a3b', fontWeight: '900' }]}>
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
  container: { flex: 1, backgroundColor: '#fff' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15,
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0' 
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#1a1a1a' },
  headerSub: { fontSize: 11, color: '#888', fontWeight: '600' },
  backBtn: { padding: 5 },
  pdfBtn: { backgroundColor: '#2e4a3b', padding: 10, borderRadius: 12 },
  mainLayout: { flex: 1, flexDirection: 'row' },
  calendarWrapper: { flex: 3.2, padding: 10 },
  sidebar: { 
    flex: 1, 
    backgroundColor: '#f9faf9', 
    borderLeftWidth: 1, 
    borderLeftColor: '#f0f0f0', 
    alignItems: 'center', 
    paddingTop: 15 
  },
  sidebarLabel: { fontSize: 9, fontWeight: '900', color: '#aaa', letterSpacing: 1.5, marginBottom: 20 },
  avatarContainer: { alignItems: 'center', marginBottom: 22, width: '100%' },
  avatarActive: { transform: [{ scale: 1.05 }] },
  photoFrame: { 
    width: 54, 
    height: 54, 
    borderRadius: 27, 
    backgroundColor: '#fff', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#eee',
    elevation: 2
  },
  avatarName: { fontSize: 10, fontWeight: '700', color: '#888', marginTop: 6 },
  legendCard: { 
    marginTop: 15, 
    backgroundColor: '#f8f9fa', 
    padding: 15, 
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#eee'
  },
  legendTitle: { fontSize: 12, fontWeight: '800', color: '#444', marginBottom: 8 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  legendText: { fontSize: 10, fontWeight: '600', color: '#666' }
});