import React, { useState, useCallback, useEffect } from 'react';
import { GiftedChat, IMessage } from 'react-native-gifted-chat';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TSupportTabStackParamsList } from '../../../navigation/userStack/bottomTabsStack/types';
import CustomHeader from '../../../components/CustomHeader';

type RealTimeGroupChatRouteProp = NativeStackNavigationProp<TSupportTabStackParamsList, 'GroupChat'>;

const RealTimeGroupChatScreen = ({ route }: { route: { params: { groupName: string } } }) => {
  const { groupName } = route.params;
  const navigation = useNavigation<RealTimeGroupChatRouteProp>();
  const [messages, setMessages] = useState<IMessage[]>([]);

  // Whitelist of allowed collection names to prevent injection
  const ALLOWED_COLLECTIONS: Record<string, string> = {
    'parents support circle': 'parents_support_circle',
    'weekly check ins': 'weekly_check_ins',
  };
  const collectionName = ALLOWED_COLLECTIONS[groupName.toLowerCase()] || 'parents_support_circle';

  useEffect(() => {
    const unsubscribe = firestore()
      .collection(collectionName)
      .orderBy('createdAt', 'desc')
      .onSnapshot(querySnapshot => {
        const messages = querySnapshot.docs.map(doc => ({
          _id: doc.id,
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          text: doc.data().text,
          user: doc.data().user,
        }));
        setMessages(messages);
      });

    return () => unsubscribe();
  }, [collectionName]);

  const MAX_MESSAGE_LENGTH = 2000;

  const onSend = useCallback((messages = []) => {
    const { text, user } = messages[0];
    if (!text || text.trim().length === 0 || text.length > MAX_MESSAGE_LENGTH) return;
    
    firestore()
      .collection(collectionName)
      .add({
        text: text.trim(),
        user,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
  }, [collectionName]);

  return (
    <>
      <CustomHeader 
        title={groupName || 'Support Group'} 
        showBackButton={true} 
      />
      <GiftedChat
        messages={messages}
        onSend={messages => onSend(messages)}
        user={{
          _id: auth().currentUser?.uid || 'anonymous',
          name: auth().currentUser?.email?.split('@')[0] || 'User',
        }}
        placeholder="Type a message..."
        showUserAvatar
        renderUsernameOnMessage
      />
    </>
  );
};

export default RealTimeGroupChatScreen;
