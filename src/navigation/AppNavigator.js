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
import InventoryAdjustmentScreen from '../screens/InventoryAdjustmentScreen';
import OutgoingInventoryScreen from '../screens/OutgoingInventoryScreen';
import ProductionOrderScreen from '../screens/ProductionOrderScreen';
import PackagingOrderScreen from '../screens/PackagingOrderScreen';
import DirectPackagingOrderScreen from '../screens/DirectPackagingOrderScreen';
import InterCompanyTransferScreen from '../screens/InterCompanyTransferScreen';
// 4. Módulos de Laboratorio (H2O), Calidad (BBS) y Reportes
import FormulationScreen from '../screens/FormulationScreen'; 
import AddFormulaScreen from '../screens/AddFormulaScreen'; 
import QuarterlyCalculatorScreen from '../screens/QuarterlyCalculatorScreen'; 
import QualityControlScreen from '../screens/QualityControlScreen'; 
import HistoryScreen from '../screens/HistoryScreen';
import TraceabilityScreen from '../screens/TraceabilityScreen';
import LowStockAlertsScreen from '../screens/LowStockAlertsScreen';

// 5. Módulos de Inteligencia IA
import SmartAICargoScreen from '../screens/SmartAICargoScreen'; 

// 6. Módulo de Personal y Asistencia (TÓTEM Y REPORTES)
import StaffAttendanceScreen from '../screens/StaffAttendanceScreen';
import DictionaryScreen from '../screens/DictionaryScreen'; 
import AttendanceReportsScreen from '../screens/AttendanceReportsScreen';

// 7. Módulo de Inteligencia Ejecutiva (C-LEVEL)
import ExecutiveReportsScreen from '../screens/ExecutiveReportsScreen';

// 8. Solicitudes de Compras
import PurchaseRequestsScreen from '../screens/PurchaseRequestsScreen';

// 9. Módulo EIG (Seguridad e Higiene)
import EIGPanelScreen from '../screens/EIGPanelScreen';

// 10. Registros de Eventualidades
import EventualitiesScreen from '../screens/EventualitiesScreen';

// NOTA: Se eliminaron QRGeneratorScreen y TraceabilityScannerScreen de las importaciones.

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

      {/* SECCIÓN: INTELIGENCIA EJECUTIVA (C-LEVEL) */}
      <Stack.Screen name="ExecutiveReports" component={ExecutiveReportsScreen} />
      
      {/* SECCIÓN: INTELIGENCIA Y CARGA IA */}
      <Stack.Screen name="SmartAICargo" component={SmartAICargoScreen} />
      <Stack.Screen name="QuarterlyCalculator" component={QuarterlyCalculatorScreen} />
      
      {/* SECCIÓN: GESTIÓN DE UNIDADES DE NEGOCIO */}
      <Stack.Screen name="CompanyDetail" component={CompanyDetailScreen} />
      <Stack.Screen name="StockView" component={StockView} />
      <Stack.Screen name="LowStockAlerts" component={LowStockAlertsScreen} />
      
      {/* SECCIÓN: OPERACIONES DE PLANTA (TRANSFERENCIAS) */}
      <Stack.Screen name="IncomingInventory" component={IncomingInventoryScreen} />
      <Stack.Screen name="InventoryAdjustment" component={InventoryAdjustmentScreen} />
      <Stack.Screen name="OutgoingInventory" component={OutgoingInventoryScreen} />
      <Stack.Screen name="ProductionOrder" component={ProductionOrderScreen} />
      <Stack.Screen name="PackagingOrder" component={PackagingOrderScreen} />
      <Stack.Screen name="DirectPackagingOrder" component={DirectPackagingOrderScreen} />
      <Stack.Screen name="InterCompanyTransfer" component={InterCompanyTransferScreen} />

      
      {/* SECCIÓN: MÓDULOS DE LABORATORIO E HISTORIAL */}
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="Traceability" component={TraceabilityScreen} />
      <Stack.Screen name="Formulation" component={FormulationScreen} />
      <Stack.Screen name="AddFormula" component={AddFormulaScreen} />
      <Stack.Screen name="QualityControl" component={QualityControlScreen} />

      {/* SECCIÓN: PEDIDOS INTERNOS */}
      <Stack.Screen name="PurchaseRequests" component={PurchaseRequestsScreen} />

      {/* SECCIÓN: PERSONAL Y ASISTENCIA */}
      <Stack.Screen name="StaffAttendance" component={StaffAttendanceScreen} />
      <Stack.Screen name="Dictionary" component={DictionaryScreen} />
      <Stack.Screen name="AttendanceReports" component={AttendanceReportsScreen} />

      {/* SECCIÓN: SEGURIDAD E HIGIENE (EIG) Y EVENTUALIDADES */}
      <Stack.Screen name="EIGPanel" component={EIGPanelScreen} />
      <Stack.Screen name="Eventualities" component={EventualitiesScreen} />
    </Stack.Navigator>
  );
}