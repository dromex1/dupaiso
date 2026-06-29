import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyBALAt7uE0H5c2ykJ5sr5gmBZCHwPCvMeY",
  authDomain: "newgenmes.firebaseapp.com",
  databaseURL: "https://newgenmes-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "newgenmes",
  storageBucket: "newgenmes.firebasestorage.app",
  messagingSenderId: "557092418847",
  appId: "1:557092418847:web:42895f4a19f4bbfbeaac2a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

let auth: any;

if (Platform.OS === 'web') {
  // Na środowisku webowym używamy domyślnego getAuth
  auth = getAuth(app);
} else {
  // Na aplikacjach mobilnych (iOS/Android) importujemy specjalną persistencję
  // Importujemy dynamicznie by zapobiec błędom na webie
  const { getReactNativePersistence } = require('firebase/auth');
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
}

export { auth };
export const database = getDatabase(app);
