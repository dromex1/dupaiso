import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { colors } from '../theme/colors';
import { Send, ChevronLeft } from 'lucide-react-native';
import { ref, onValue, push, set } from 'firebase/database';
import { database, auth } from '../../firebaseConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ChatRouteProp = {
  key: string;
  name: 'Chat';
  params: { friendId: string; friendName: string };
};

export default function ChatScreen() {
  const route = useRoute<ChatRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { friendId, friendName } = route.params;
  
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const flatListRef = useRef<FlatList>(null);
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

    return () => unsubscribe();
  }, [chatId]);

  const handleSend = async () => {
    if (!message.trim()) return;
    
    const msgText = message.trim();
    setMessage('');
    
    try {
      const messagesRef = ref(database, `chats/${chatId}/messages`);
      const newMsgRef = push(messagesRef);
      
      await set(newMsgRef, {
        text: msgText,
        senderId: myUid,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error("Błąd wysyłania wiadomości:", error);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderId === myUid;
    
    // Formatowanie czasu
    const date = new Date(item.timestamp);
    const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    
    return (
      <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.theirMessageRow]}>
        <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
          <Text style={styles.messageText}>{item.text}</Text>
          <Text style={styles.timeText}>{timeString}</Text>
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
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{friendName.charAt(0)}</Text>
          </View>
          <Text style={styles.headerTitle}>{friendName}</Text>
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

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Wpisz wiadomość"
            placeholderTextColor={colors.textSecondary}
            value={message}
            onChangeText={setMessage}
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
    paddingBottom: Platform.OS === 'ios' ? 32 : 8,
    backgroundColor: 'transparent',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 24,
    marginRight: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  input: {
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
