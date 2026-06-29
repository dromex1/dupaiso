import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { ref, onValue, get, remove, set } from 'firebase/database';
import { database, auth } from '../../firebaseConfig';
import { Check, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RequestsScreen() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const myUid = auth.currentUser.uid;
    const requestsRef = ref(database, `friend_requests/${myUid}`);
    
    const unsubscribe = onValue(requestsRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        // Pobieramy dane użytkowników, którzy wysłali zaproszenia
        const requestsArray = [];
        for (const senderId in data) {
          if (data[senderId].status === 'pending') {
            const userSnap = await get(ref(database, `users/${senderId}`));
            if (userSnap.exists()) {
              requestsArray.push({
                ...data[senderId],
                senderData: userSnap.val()
              });
            }
          }
        }
        setRequests(requestsArray);
      } else {
        setRequests([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAccept = async (senderId: string) => {
    if (!auth.currentUser) return;
    const myUid = auth.currentUser.uid;
    
    try {
      // 1. Dodaj do moich znajomych
      await set(ref(database, `friends/${myUid}/${senderId}`), true);
      // 2. Dodaj mnie do jego znajomych
      await set(ref(database, `friends/${senderId}/${myUid}`), true);
      // 3. Usuń zaproszenie
      await remove(ref(database, `friend_requests/${myUid}/${senderId}`));
      
      // Opcjonalnie: możemy też zainicjować "Czat", ale wystarczy lista znajomych
    } catch (error) {
      console.error("Błąd akceptacji zaproszenia:", error);
    }
  };

  const handleReject = async (senderId: string) => {
    if (!auth.currentUser) return;
    const myUid = auth.currentUser.uid;
    
    try {
      await remove(ref(database, `friend_requests/${myUid}/${senderId}`));
    } catch (error) {
      console.error("Błąd odrzucenia zaproszenia:", error);
    }
  };

  const renderRequest = ({ item }: { item: any }) => {
    const user = item.senderData;
    
    return (
      <View style={styles.requestCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.firstName?.charAt(0)}{user.lastName?.charAt(0)}</Text>
        </View>
        <View style={styles.userInfo}>
          <View>
            <Text style={styles.userName}>{user.firstName} {user.lastName}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.acceptButton]} 
              onPress={() => handleAccept(user.uid)}
            >
              <Check color={colors.background} size={20} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.rejectButton]} 
              onPress={() => handleReject(user.uid)}
            >
              <X color={colors.textSecondary} size={20} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.from}
          renderItem={renderRequest}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Nie masz żadnych nowych zaproszeń.</Text>
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
  listContainer: {
    paddingTop: 8,
  },
  requestCard: {
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
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: colors.primary,
  },
  rejectButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  }
});
