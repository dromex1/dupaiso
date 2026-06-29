import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { colors } from '../theme/colors';
import { Send, ChevronLeft, Plus } from 'lucide-react-native';
import { ref, onValue, push, set, onDisconnect, remove, get } from 'firebase/database';
import { database, auth } from '../../firebaseConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

type ChatRouteProp = {
  key: string;
  name: 'Chat';
  params: { friendId: string; friendName: string; avatarUrl?: string };
};

export default function ChatScreen() {
  const route = useRoute<ChatRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { friendId, friendName, avatarUrl: friendAvatar } = route.params;
  
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [friendStatus, setFriendStatus] = useState<string>('offline');
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const insets = useSafeAreaInsets();

  const myUid = auth.currentUser?.uid || '';
  // Generujemy unikalne, stałe ID czatu dla tej pary użytkowników
  const chatId = [myUid, friendId].sort().join('_');

  useEffect(() => {
    // Nasłuchiwanie na wiadomości
    const messagesRef = ref(database, `chats/${chatId}/messages`);
    
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const msgs = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).sort((a, b) => a.timestamp - b.timestamp);
        
        setMessages(msgs);
      } else {
        setMessages([]);
      }
    });

    return unsubscribe;
  }, [chatId]);

  useEffect(() => {
    // Nasłuchiwanie na status Online znajomego
    const friendStatusRef = ref(database, `users/${friendId}/status`);
    const unsubscribeStatus = onValue(friendStatusRef, (snapshot) => {
      if (snapshot.exists()) {
        setFriendStatus(snapshot.val());
      } else {
        setFriendStatus('offline');
      }
    });

    // Nasłuchiwanie czy znajomy pisze
    const friendTypingRef = ref(database, `chats/${chatId}/typing/${friendId}`);
    const unsubscribeTyping = onValue(friendTypingRef, (snapshot) => {
      setIsTyping(snapshot.val() === true);
    });

    // Automatyczne usuwanie statusu pisania w razie utraty połączenia
    const myTypingRef = ref(database, `chats/${chatId}/typing/${myUid}`);
    onDisconnect(myTypingRef).remove();

    return () => {
      unsubscribeStatus();
      unsubscribeTyping();
    };
  }, [chatId, friendId, myUid]);

  const handleTyping = (text: string) => {
    setMessage(text);
    
    // Zaktualizuj stan pisania w bazie
    const myTypingRef = ref(database, `chats/${chatId}/typing/${myUid}`);
    if (text.length > 0) {
      set(myTypingRef, true);
    } else {
      remove(myTypingRef);
    }

    // Wyczyść po 2 sekundach braku aktywności
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      remove(myTypingRef);
    }, 2000);
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    
    const msgText = message.trim();
    // Usuń status pisania od razu po wysłaniu
    const myTypingRef = ref(database, `chats/${chatId}/typing/${myUid}`);
    remove(myTypingRef);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setMessage('');
    
    try {
      const messagesRef = ref(database, `chats/${chatId}/messages`);
      await push(messagesRef, {
        senderId: myUid,
        text: messageText,
        timestamp: Date.now(),
      });
      sendPushNotification(messageText);
    } catch (error) {
      console.error(error);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Wymagane są uprawnienia do galerii, aby wysłać zdjęcie!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.3,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      const messagesRef = ref(database, `chats/${chatId}/messages`);
      await push(messagesRef, {
        senderId: myUid,
        imageUrl: base64Image,
        text: '',
        timestamp: Date.now(),
      });
      sendPushNotification('Wysłał(a) zdjęcie 📸');
    }
  };

  const sendPushNotification = async (bodyText: string) => {
    const friendTokenRef = ref(database, `users/${friendId}/pushToken`);
    const snap = await get(friendTokenRef);
    if (snap.exists()) {
      const expoPushToken = snap.val();
      const payload = {
        to: expoPushToken,
        sound: 'default',
        title: 'Nowa wiadomość!',
        body: bodyText,
      };

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMine = item.senderId === myUid;
    const date = new Date(item.timestamp);
    
    return (
      <View style={[styles.messageRow, isMine ? styles.myMessageRow : styles.theirMessageRow]}>
        <View style={[styles.messageBubble, isMine ? styles.myMessage : styles.theirMessage]}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.messageImage} />
          ) : null}
          {item.text ? <Text style={styles.messageText}>{item.text}</Text> : null}
          <Text style={styles.timeText}>{date.getHours()}:{date.getMinutes().toString().padStart(2, '0')}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'ios' ? 10 : 16) }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ChevronLeft color={colors.textSecondary} size={28} />
          </TouchableOpacity>
          {friendAvatar ? (
            <Image source={{ uri: friendAvatar }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Text style={styles.headerAvatarText}>{friendName.charAt(0)}</Text>
            </View>
          )}
          <View>
            <Text style={styles.headerTitle}>{friendName}</Text>
            <Text style={styles.headerSubtitle}>
              {isTyping ? (
                <Text style={styles.typingText}>pisze...</Text>
              ) : (
                friendStatus === 'online' ? 'Dostępny(a)' : 'Niedostępny(a)'
              )}
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.inputWrapper}>
          <TouchableOpacity onPress={handlePickImage} style={styles.attachButton}>
            <Plus color={colors.textSecondary} size={24} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Wpisz wiadomość..."
            placeholderTextColor={colors.textSecondary}
            value={message}
            onChangeText={handleTyping}
            multiline
          />
        </View>
        <TouchableOpacity 
          style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]} 
          onPress={handleSend}
          disabled={!message.trim()}
        >
          <Send color={!message.trim() ? colors.textSecondary : colors.background} size={20} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.chatBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerAvatarText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  typingText: {
    color: colors.primary,
    fontStyle: 'italic',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 4,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  theirMessageRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 12,
  },
  myMessage: {
    backgroundColor: colors.bubbleOutgoing,
    borderTopRightRadius: 4,
  },
  theirMessage: {
    backgroundColor: colors.bubbleIncoming,
    borderTopLeftRadius: 4,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 4,
  },
  messageText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  timeText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    alignSelf: 'flex-end',
    marginTop: 2,
    marginLeft: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 24,
    marginRight: 8,
    minHeight: 48,
    alignItems: 'center',
  },
  attachButton: {
    paddingLeft: 12,
  },
  input: {
    flex: 1,
    color: colors.text,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: colors.primary,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.surface,
  }
});
