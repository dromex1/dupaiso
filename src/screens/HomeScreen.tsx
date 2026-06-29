import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Image } from 'react-native';
import { colors } from '../theme/colors';
import { ref, onValue, get, set } from 'firebase/database';
import { database, auth } from '../../firebaseConfig';
import { LogOut, ChevronRight, User } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { signOut } from 'firebase/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

export default function HomeScreen() {
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(true);
  
  // Stany dla formularza uzupełniania profilu
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const navigation = useNavigation<HomeScreenNavigationProp>();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const myUid = auth.currentUser.uid;
    
    // Najpierw sprawdzamy, czy użytkownik w ogóle istnieje w bazie
    const checkProfile = async () => {
      const userSnap = await get(ref(database, `users/${myUid}`));
      if (!userSnap.exists()) {
        setProfileExists(false);
        setLoading(false);
        return;
      }
      setProfileExists(true);
      
      // Jeśli istnieje, nasłuchujemy znajomych
      const friendsRef = ref(database, `friends/${myUid}`);
      onValue(friendsRef, async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const friendsArray = [];
          for (const friendId in data) {
            const friendSnap = await get(ref(database, `users/${friendId}`));
            if (friendSnap.exists()) {
              friendsArray.push(friendSnap.val());
            }
          }
          setFriends(friendsArray);
        } else {
          setFriends([]);
        }
        setLoading(false);
      });
    };
    
    checkProfile();
  }, []);

  const handleLogout = () => {
    signOut(auth);
  };

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim() || !auth.currentUser) return;
    setSavingProfile(true);
    try {
      const user = auth.currentUser;
      const searchName = `${firstName.trim()} ${lastName.trim()}`.toLowerCase();
      await set(ref(database, 'users/' + user.uid), {
        uid: user.uid,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        searchName,
        email: user.email,
        createdAt: Date.now()
      });
      setProfileExists(true);
    } catch (error) {
      console.error("Błąd zapisu profilu", error);
    } finally {
      setSavingProfile(false);
    }
  };

  if (!profileExists) {
    return (
      <View style={styles.container}>
        <View style={styles.setupContainer}>
          <Text style={styles.title}>Uzupełnij profil!</Text>
          <Text style={styles.subtitle}>Twoje konto nie istnieje w bazie (prawdopodobnie zostało stworzone ręcznie w Firebase). Podaj swoje dane, by inni mogli Cię wyszukać.</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Imię"
            placeholderTextColor={colors.textSecondary}
            value={firstName}
            onChangeText={setFirstName}
          />
          <TextInput
            style={styles.input}
            placeholder="Nazwisko"
            placeholderTextColor={colors.textSecondary}
            value={lastName}
            onChangeText={setLastName}
          />
          
          <TouchableOpacity 
            style={[styles.saveButton, (!firstName || !lastName) && { opacity: 0.5 }]} 
            onPress={handleSaveProfile}
            disabled={!firstName || !lastName || savingProfile}
          >
            {savingProfile ? <ActivityIndicator color={colors.text} /> : <Text style={styles.saveButtonText}>Zapisz do bazy</Text>}
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleLogout} style={{marginTop: 20}}>
             <Text style={{color: colors.error, textAlign: 'center'}}>Wyloguj się</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderFriend = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.friendCard}
      onPress={() => navigation.navigate('Chat', { friendId: item.uid, friendName: `${item.firstName} ${item.lastName}`, avatarUrl: item.avatarUrl })}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarText}>{item.firstName?.charAt(0)}{item.lastName?.charAt(0)}</Text>
        )}
        {item.status === 'online' && <View style={styles.onlineIndicator} />}
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.userName}>{item.firstName} {item.lastName}</Text>
          <Text style={styles.timeText}>Wczoraj</Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>Kliknij, aby rozpocząć rozmowę...</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Czaty</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <LogOut color={colors.textSecondary} size={24} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.uid}
          renderItem={renderFriend}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Brak otwartych czatów.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  setupContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  input: {
    backgroundColor: colors.inputBackground,
    color: colors.text,
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 0,
  },
  saveButton: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#111b21',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  logoutButton: {
    padding: 8,
  },
  listContainer: {
    paddingTop: 8,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  chatInfo: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  userName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  timeText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  lastMessage: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  }
});
