import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { auth } from './src/config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  // Escuchador del estado de autenticación de Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (initializing) setInitializing(false);
    });

    // Limpiar el escuchador al desmontar el componente
    return unsubscribe;
  }, []);

  // Mientras verifica la sesión activa, mostramos un spinner de carga
  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#283593" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {/* StatusBar para que los iconos de batería/hora se vean bien en iOS/Android */}
      <StatusBar barStyle="dark-content" />
      
      {/* Pasamos el objeto "user" al Navigator. 
        Si el usuario existe, AppNavigator arrancará en 'Home'.
        Si es null, arrancará en 'Login'.
      */}
      <AppNavigator user={user} />
    </NavigationContainer>
  );
}