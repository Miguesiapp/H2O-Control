import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text, ActivityIndicator, StatusBar, Platform, Animated, Image, StyleSheet } from 'react-native';
import { auth } from './src/config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import AppNavigator from './src/navigation/AppNavigator';

// ---------------------------------------------------------
// FIX: Habilitar scroll nativo en React Native Web
// ---------------------------------------------------------
if (Platform.OS === 'web') {
  const style = document.createElement('style');
  style.textContent = `
    html, body, #root { 
      height: 100%; 
      width: 100%; 
      overflow-x: hidden;
      overflow-y: scroll; 
      display: flex; 
      flex-direction: column; 
    }
  `;
  document.head.appendChild(style);
}
// ---------------------------------------------------------

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  
  // Estados para el Splash Screen Animado
  const [splashAnimationFinished, setSplashAnimationFinished] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.85)).current;

  // Escuchador del estado de autenticación de Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      if (initializing) setInitializing(false);
    });

    // Limpiar el escuchador al desmontar el componente
    return unsubscribe;
  }, []);

  // Lógica de Animación del Splash Screen
  useEffect(() => {
    // 1. Animación de "latido" (Scale up) al iniciar
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 20,
      useNativeDriver: true,
    }).start();

    // 2. Cuando Firebase termine de cargar, le damos un pequeño tiempo extra para que el logo se luzca
    if (!initializing) {
      setTimeout(() => {
        // 3. Efecto Fade Out suave hacia la App principal
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }).start(() => {
          setSplashAnimationFinished(true); // Desmonta el splash y muestra la App
        });
      }, 1500); // 1.5 segundos mostrando el logo
    }
  }, [initializing]);

  // Si no ha terminado la animación, mostramos el Splash Animado en vez de un simple spinner
  if (!splashAnimationFinished) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <Animated.View style={{ 
          opacity: fadeAnim, 
          transform: [{ scale: scaleAnim }],
          width: '100%',
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#004ca8' 
        }}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoTitle}>H2O</Text>
            <Text style={styles.logoSub}>CONTROL</Text>
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" />
      <AppNavigator user={user} />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#004ca8', // Mismo color de fondo para evitar parpadeos
  },
  logoCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent'
  },
  logoTitle: {
    fontSize: 65,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: -5,
  },
  logoSub: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 4,
    marginLeft: 4, // Para centrar ópticamente por el letterSpacing
  }
});