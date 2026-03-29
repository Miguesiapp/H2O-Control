import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  initializeAuth, 
  getReactNativePersistence, 
  browserSessionPersistence 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD9Hi4cke0FVFfklD7fj-Da-5s2USVrV7M",
  authDomain: "h2o-control-a153b.firebaseapp.com",
  projectId: "h2o-control-a153b",
  storageBucket: "h2o-control-a153b.firebasestorage.app",
  messagingSenderId: "742826612856",
  appId: "1:742826612856:web:e9b75028710a47d277b58d",
  measurementId: "G-E0GMN93FK1"
};

const app = initializeApp(firebaseConfig);

// Lógica de persistencia inteligente
let auth;
if (Platform.OS === 'web') {
  // En la Web (PWA), usamos la persistencia del navegador
  auth = getAuth(app); 
} else {
  // En Móvil (Android/iOS), usamos AsyncStorage para que no se cierre la sesión
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
}

const db = getFirestore(app);

export { auth, db };