import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { auth, database } from '../../firebaseConfig';
import { ref as dbRef, get, update } from 'firebase/database';
import * as ImagePicker from 'expo-image-picker';
import { Camera, LogOut } from 'lucide-react-native';
import { signOut } from 'firebase/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const [userData, setUserData] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const insets = useSafeAreaInsets();
  
  const myUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!myUid) return;
    
    const fetchUser = async () => {
      const snap = await get(dbRef(database, `users/${myUid}`));
      if (snap.exists()) {
        setUserData(snap.val());
      }
    };
    
    fetchUser();
  }, [myUid]);

  const handlePickImage = async () => {
    // Zapytaj o uprawnienia
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Wymagane są uprawnienia do galerii, by zmienić awatar!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3, // Zmniejszamy jakość dla Base64
      base64: true, // Włączamy konwersję do Base64
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      await uploadAvatar(base64Image);
    }
  };

  const uploadAvatar = async (base64Image: string) => {
    if (!myUid) return;
    setUploading(true);
    try {
      // Zapisujemy string Base64 bezpośrednio do Realtime Database (nie Firestore, bo RTDB też jest darmowe i ma 1GB)
      await update(dbRef(database, `users/${myUid}`), {
        avatarUrl: base64Image
      });
      
      setUserData((prev: any) => ({ ...prev, avatarUrl: base64Image }));
      alert('Awatar został pomyślnie zmieniony!');
    } catch (error) {
      console.error("Błąd podczas zapisywania awatara: ", error);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  if (!userData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Mój Profil</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.avatarContainer}>
          {userData.avatarUrl ? (
            <Image source={{ uri: userData.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>
                {userData.firstName?.charAt(0)}{userData.lastName?.charAt(0)}
              </Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.cameraButton} 
            onPress={handlePickImage}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <Camera color={colors.background} size={20} />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.userName}>{userData.firstName} {userData.lastName}</Text>
        <Text style={styles.userEmail}>{userData.email}</Text>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut color={colors.error} size={20} />
          <Text style={styles.logoutText}>Wyloguj się</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: colors.surface,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  content: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 40,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  avatarPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  avatarImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.background,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 40,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  }
});
