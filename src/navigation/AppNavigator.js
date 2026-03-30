import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// 1. Importación de pantallas base y Auth
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';

// 2. Gestión por Empresa e Inventario
import CompanyDetailScreen from '../screens/CompanyDetailScreen';
import StockView from '../screens/StockView';

// 3. Operaciones Logísticas de Movimiento
import IncomingInventoryScreen from '../screens/IncomingInventoryScreen';
import OutgoingInventoryScreen from '../screens/OutgoingInventoryScreen';
import ProductionOrderScreen from '../screens/ProductionOrderScreen';
import PackagingOrderScreen from '../screens/PackagingOrderScreen';

// 4. Módulos de Laboratorio (H2O), Calidad (BBS) y Reportes
import FormulationScreen from '../screens/FormulationScreen'; 
import AddFormulaScreen from '../screens/AddFormulaScreen'; 
import QuarterlyCalculatorScreen from '../screens/QuarterlyCalculatorScreen'; 
import QualityControlScreen from '../screens/QualityControlScreen'; 
import HistoryScreen from '../screens/HistoryScreen';

// 5. Módulos de Inteligencia IA y Trazabilidad QR
import SmartAICargoScreen from '../screens/SmartAICargoScreen'; 
import QRGeneratorScreen from '../screens/QRGeneratorScreen';
import TraceabilityScannerScreen from '../screens/TraceabilityScannerScreen';

// 6. Módulo de Personal y Asistencia (TÓTEM Y REPORTES)
import StaffAttendanceScreen from '../screens/StaffAttendanceScreen'; 
import AttendanceReportsScreen from '../screens/AttendanceReportsScreen';

const Stack = createStackNavigator();

export default function AppNavigator({ user }) {
  return (
    <Stack.Navigator 
      initialRouteName={user ? "Home" : "Login"}
      screenOptions={{ 
        headerShown: false,
        gestureEnabled: true,
        cardStyle: { backgroundColor: '#fff' }
      }}
    >
      {/* SECCIÓN: ACCESO Y SEGURIDAD */}
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      
      {/* SECCIÓN: DASHBOARD PRINCIPAL */}
      <Stack.Screen name="Home" component={HomeScreen} />
      
      {/* SECCIÓN: INTELIGENCIA Y CARGA IA */}
      <Stack.Screen name="SmartAICargo" component={SmartAICargoScreen} />
      <Stack.Screen name="QuarterlyCalculator" component={QuarterlyCalculatorScreen} />

      {/* SECCIÓN: TRAZABILIDAD Y QR */}
      <Stack.Screen name="QRGenerator" component={QRGeneratorScreen} /> 
      <Stack.Screen name="TraceabilityScanner" component={TraceabilityScannerScreen} />
      
      {/* SECCIÓN: GESTIÓN DE UNIDADES DE NEGOCIO */}
      <Stack.Screen name="CompanyDetail" component={CompanyDetailScreen} />
      <Stack.Screen name="StockView" component={StockView} />
      
      {/* SECCIÓN: OPERACIONES DE PLANTA */}
      <Stack.Screen name="IncomingInventory" component={IncomingInventoryScreen} />
      <Stack.Screen name="OutgoingInventory" component={OutgoingInventoryScreen} />
      <Stack.Screen name="ProductionOrder" component={ProductionOrderScreen} />
      <Stack.Screen name="PackagingOrder" component={PackagingOrderScreen} />
      
      {/* SECCIÓN: LABORATORIO Y AUDITORÍA */}
      <Stack.Screen name="Formulation" component={FormulationScreen} />
      <Stack.Screen name="AddFormula" component={AddFormulaScreen} />
      <Stack.Screen name="QualityControl" component={QualityControlScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />

      {/* SECCIÓN: PERSONAL Y ASISTENCIA */}
      <Stack.Screen name="StaffAttendance" component={StaffAttendanceScreen} />
      <Stack.Screen name="AttendanceReports" component={AttendanceReportsScreen} />
      
    </Stack.Navigator>
  );
}