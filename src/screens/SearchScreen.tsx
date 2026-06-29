import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { Search as SearchIcon, UserPlus, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ref, query, orderByChild, startAt, endAt, get, set } from 'firebase/database';
import { database, auth } from '../../firebaseConfig';

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [sentRequests, setSentRequests] = useState<{[key: string]: boolean}>({});
  const insets = useSafeAreaInsets();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setErrorMsg('');
    try {
      const q = searchQuery.toLowerCase().trim();
      const usersRef = ref(database, 'users');
      
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const usersList = Object.keys(data)
          .map(key => data[key])
          .filter(user => user.uid !== auth.currentUser?.uid)
          .filter(user => {
            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
            return fullName.includes(q) || (user.email && user.email.toLowerCase().includes(q));
          });
          
        setUsers(usersList);
        if (usersList.length === 0) {
           setErrorMsg(`Znaleziono bazę, ale nikt nie pasuje do: "${q}" (W bazie jest ${Object.keys(data).length} użytkowników).`);
        }
      } else {
        setUsers([]);
        setErrorMsg('Baza "users" jest pusta lub nie istnieje. (Snapshot exists = false)');
      }
    } catch (error: any) {
      console.error("Błąd wyszukiwania:", error);
      setErrorMsg(`BŁĄD: ${error.message || 'Nieznany błąd bazy danych'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (targetUid: string) => {
    if (!auth.currentUser) return;
    const myUid = auth.currentUser.uid;
    
    try {
      await set(ref(database, `friend_requests/${targetUid}/${myUid}`), {
        from: myUid,
        status: 'pending',
        timestamp: Date.now()
      });
      
      setSentRequests(prev => ({...prev, [targetUid]: true}));
    } catch (error) {
      console.error("Błąd wysyłania zaproszenia:", error);
    }
  };

  const renderUser = ({ item }: { item: any }) => {
    const isSent = sentRequests[item.uid];
    
    return (
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.firstName?.charAt(0)}{item.lastName?.charAt(0)}</Text>
        </View>
        <View style={styles.userInfo}>
          <View>
            <Text style={styles.userName}>{item.firstName} {item.lastName}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.addButton, isSent && styles.addButtonSent]} 
            onPress={() => handleSendRequest(item.uid)}
            disabled={isSent}
          >
            {isSent ? <Check color={colors.text} size={20} /> : <UserPlus color={colors.background} size={20} />}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.searchBar, { marginTop: insets.top + 16 }]}>
        <SearchIcon color={colors.textSecondary} size={20} />
        <TextInput
          style={styles.searchInput}
          placeholder="Szukaj po imieniu i nazwisku..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Szukaj</Text>
        </TouchableOpacity>
      </View>
      
      {errorMsg ? (
        <Text style={{color: colors.error, marginHorizontal: 16, marginBottom: 12}}>{errorMsg}</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.uid}
          renderItem={renderUser}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Brak wyników wyszukiwania.</Text>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 12,
    margin: 16,
    borderRadius: 24,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    marginLeft: 12,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  searchButtonText: {
    color: colors.background,
    fontWeight: 'bold',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
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
  avatarText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 16,
  },
  userName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  userEmail: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: colors.primary,
    padding: 10,
    borderRadius: 20,
  },
  addButtonSent: {
    backgroundColor: colors.surfaceHighlight,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  }
});
