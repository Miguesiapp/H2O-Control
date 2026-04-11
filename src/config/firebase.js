import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  initializeAuth, 
  getReactNativePersistence 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage'; // Agregamos Storage para las fotos de remitos
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// REEMPLAZO DINÁMICO: 
// Usamos process.env para leer del .env sin exponer la clave en el código
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Inicialización de la App
const app = initializeApp(firebaseConfig);

// Lógica de persistencia (Para que no se deslogueen en la planta de Batán)
let auth;
if (Platform.OS === 'web') {
  auth = getAuth(app); 
} else {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
}

const db = getFirestore(app);
const storage = getStorage(app); // Necesario para guardar las fotos que lee la IA

export { auth, db, storage };