import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, CalendarDays, Calendar, CalendarClock, BookOpen, BrainCircuit } from 'lucide-react-native';
import { generateExecutiveReport } from '../services/reportService';
import { auth } from '../config/firebase';

export default function ExecutiveReportsScreen({ navigation }) {
  const [loading, setLoading] = useState(false);

  // Esta función simula la recolección de datos y el llamado a la IA
  const handleGenerateReport = async (period) => {
    setLoading(true);
    try {
      // 1. Aquí a futuro buscaremos los datos reales en Firebase según el 'period'
      const mockStats = {
        totalProduced: '12,450 Lts',
        estimatedExpenses: '450,000',
        efficiencyScore: 94,
        companiesData: [
          { name: 'WaterDay', produced: '5,000 Lts', consumed: '4,800 Kg', trend: '+5%' },
          { name: 'Agrocube', produced: '7,450 Lts', consumed: '7,100 Kg', trend: '+12%' }
        ]
      };

      // 2. Aquí llamaremos al Cerebro IA pasándole el período
      const mockAiInsights = {
        review: `Durante este período ${period.toLowerCase()}, la eficiencia se mantuvo alta. Se detectó un pico inusual en el consumo de envases para la línea WaterDay que sugiere optimizar las compras por volumen.`,
        futureNeeds: `Proyección crítica: Adquirir bidones de 20L y etiquetas de "Action" con 2 semanas de anticipación para cubrir el próximo lote proyectado de Agrocube.`
      };

      // 3. Generamos el PDF Profesional
      await generateExecutiveReport(period, mockStats, mockAiInsights, auth.currentUser?.email);
      
    } catch (error) {
      Alert.alert("Error", "No se pudo generar el documento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#fff" size={28} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Inteligencia C-Level</Text>
          <Text style={styles.headerSub}>Exclusivo Dirección</Text>
        </View>
        <BrainCircuit color="#38bdf8" size={24} />
      </View>

      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Selecciona el Período del Análisis</Text>
        <Text style={styles.description}>
          H2O Neural analizará los datos logísticos y financieros para redactar un informe estratégico.
        </Text>

        <View style={styles.grid}>
          <TouchableOpacity style={styles.card} onPress={() => handleGenerateReport('Diario')} disabled={loading}>
            <CalendarClock color="#0ea5e9" size={32} />
            <Text style={styles.cardTitle}>Reporte Diario</Text>
            <Text style={styles.cardSub}>Cierre de turno y stock</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => handleGenerateReport('Semanal')} disabled={loading}>
            <CalendarDays color="#10b981" size={32} />
            <Text style={styles.cardTitle}>Reporte Semanal</Text>
            <Text style={styles.cardSub}>Análisis de Mermas</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => handleGenerateReport('Mensual')} disabled={loading}>
            <Calendar color="#f59e0b" size={32} />
            <Text style={styles.cardTitle}>Reporte Mensual</Text>
            <Text style={styles.cardSub}>Gastos y Evolución</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => handleGenerateReport('Anual')} disabled={loading}>
            <BookOpen color="#8b5cf6" size={32} />
            <Text style={styles.cardTitle}>Balance Anual</Text>
            <Text style={styles.cardSub}>Proyección estratégica</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#0f172a" />
            <Text style={styles.loadingText}>H2O Neural está redactando el informe...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#0f172a', borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#f8fafc' },
  headerSub: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
  container: { padding: 20, flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginBottom: 5 },
  description: { fontSize: 13, color: '#64748b', marginBottom: 25 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, justifyContent: 'space-between' },
  card: { width: '47%', backgroundColor: '#fff', padding: 20, borderRadius: 16, alignItems: 'center', elevation: 2, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginTop: 10, textAlign: 'center' },
  cardSub: { fontSize: 10, color: '#64748b', textAlign: 'center', marginTop: 5 },
  loadingBox: { marginTop: 40, alignItems: 'center', padding: 20, backgroundColor: '#fff', borderRadius: 15, borderWidth: 1, borderColor: '#cbd5e1' },
  loadingText: { marginTop: 15, fontSize: 14, fontWeight: 'bold', color: '#334155' }
});