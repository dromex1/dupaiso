import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ref, onValue, onDisconnect, set, update } from 'firebase/database';
import { auth, database } from './firebaseConfig';
import { Platform, View, ActivityIndicator, StyleSheet } from 'react-native';
import { MessageCircle, Search, UserPlus, User as UserIcon } from 'lucide-react-native';

// Ekrany
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import RequestsScreen from './src/screens/RequestsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ChatScreen from './src/screens/ChatScreen';

// Typy
import { RootStackParamList, MainTabParamList } from './src/types/navigation';
import { colors } from './src/theme/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tab.Screen 
        name="Znajomi" 
        component={HomeScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />
        }}
      />
      <Tab.Screen 
        name="Szukaj" 
        component={SearchScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} />
        }}
      />
      <Tab.Screen 
        name="Zaproszenia" 
        component={RequestsScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <UserPlus color={color} size={size} />
        }}
      />
      <Tab.Screen 
        name="Profil" 
        component={ProfileScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <UserIcon color={color} size={size} />
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let connectedRefUnsubscribe: (() => void) | undefined;
    
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // System Obecności (Presence System)
        const myConnectionsRef = ref(database, `users/${currentUser.uid}/status`);
        const connectedRef = ref(database, '.info/connected');
        
        const unsubscribeConnected = onValue(connectedRef, (snap) => {
          if (snap.val() === true) {
            // Gdy łączymy się z bazą
            set(myConnectionsRef, 'online');
            // Zlecenie dla serwera, co ma zrobić gdy znikniemy (zamkniemy apkę)
            onDisconnect(myConnectionsRef).set('offline');
          }
        });
        
        connectedRefUnsubscribe = () => unsubscribeConnected();
      }
    });

    return () => {
      unsubscribeAuth();
      if (connectedRefUnsubscribe) {
        connectedRefUnsubscribe();
      }
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          // Zalogowany użytkownik
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="Chat" component={ChatScreen} />
          </>
        ) : (
          // Niezalogowany użytkownik
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
