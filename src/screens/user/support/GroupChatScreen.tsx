import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActionSheetIOS,
  FlatList,
} from 'react-native';
import { launchImageLibrary, launchCamera, MediaType } from 'react-native-image-picker';
import { Paperclip, Smile, Send } from 'lucide-react-native';
import { useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TSupportTabStackParamsList } from '../../../navigation/userStack/bottomTabsStack/types';
import CustomHeader from '../../../components/CustomHeader';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

interface Message {
  id: string;
  sender: string;
  initials: string;
  avatar: string;
  message: string;
  time: string;
  isOwn: boolean;
  image?: string;
}

type GroupChatScreenRouteProp = RouteProp<TSupportTabStackParamsList, 'GroupChat'>;

const GroupChatScreen = ({ route }: { route: GroupChatScreenRouteProp }) => {
  const { groupName } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<TSupportTabStackParamsList>>();
  const inputRef = useRef<TextInput>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Collection name based on group
  const collectionName = groupName.toLowerCase().replace(/\s+/g, '_');

  // Real-time messages listener
  useEffect(() => {
    const unsubscribe = firestore()
      .collection(collectionName)
      .orderBy('createdAt', 'desc')
      .onSnapshot(querySnapshot => {
        const messages = querySnapshot.docs.map(doc => {
          const data = doc.data();
          const isOwn = data.userUid === auth().currentUser?.uid;
          return {
            id: doc.id,
            sender: data.userName || 'Unknown',
            initials: data.userName?.substring(0, 2).toUpperCase() || 'UN',
            avatar: isOwn ? '#2196F3' : '#9C27B0',
            message: data.text || '',
            time: data.createdAt?.toDate()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '',
            isOwn: isOwn,
            image: data.image,
          } as Message;
        });
        setMessages(messages);
      });

    return () => unsubscribe();
  }, [collectionName]);

  const handleSend = async () => {
    if (inputText.trim() === '') return;
    
    const currentUser = auth().currentUser;
    if (!currentUser) return;
    
    try {
      await firestore().collection(collectionName).add({
        text: inputText,
        userUid: currentUser.uid,
        userName: currentUser.email?.split('@')[0] || 'User',
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      
      setInputText('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleAttachmentPress = () => {
    console.log('Attachment pressed');
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library', 'Browse Files'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          console.log('Action sheet button index:', buttonIndex);
          if (buttonIndex === 1) {
            handleTakePhoto();
          } else if (buttonIndex === 2) {
            handleChooseFromLibrary();
          } else if (buttonIndex === 3) {
            handleBrowseFiles();
          }
        }
      );
    } else {
      Alert.alert(
        'Attach File',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: handleTakePhoto },
          { text: 'Choose from Library', onPress: handleChooseFromLibrary },
          { text: 'Browse Files', onPress: handleBrowseFiles },
        ]
      );
    }
  };

  const handleTakePhoto = () => {
    console.log('Take photo pressed');
    launchCamera(
      {
        mediaType: 'photo' as MediaType,
        quality: 0.8,
      },
      (response) => {
        console.log('Camera response:', response);
        if (response.assets && response.assets[0] && response.assets[0].uri) {
          sendImageMessage(response.assets[0].uri);
        }
      }
    );
  };

  const handleChooseFromLibrary = () => {
    console.log('Choose from library pressed');
    launchImageLibrary(
      {
        mediaType: 'mixed' as MediaType,
        quality: 0.8,
      },
      (response) => {
        console.log('Library response:', response);
        if (response.assets && response.assets[0] && response.assets[0].uri) {
          sendImageMessage(response.assets[0].uri);
        }
      }
    );
  };

  const handleBrowseFiles = () => {
    Alert.alert('Browse Files', 'File browser functionality would be implemented here');
  };

  const sendImageMessage = async (imageUri: string) => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;
    
    try {
      await firestore().collection(collectionName).add({
        image: imageUri,
        userUid: currentUser.uid,
        userName: currentUser.email?.split('@')[0] || 'User',
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('Error sending image message:', error);
    }
  };

  const handleEmojiPress = () => {
    console.log('Emoji pressed');
    inputRef.current?.focus();
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View key={item.id} className="mb-4">
      <View className={`flex-row gap-3 ${item.isOwn ? 'flex-row-reverse' : ''}`}>
        {/* Avatar */}
        {!item.isOwn && (
          <View
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: item.avatar }}
          >
            <Text className="text-white text-xs font-bold">
              {item.initials}
            </Text>
          </View>
        )}

        {/* Message Bubble */}
        <View className={`flex-1 ${item.isOwn ? 'items-end' : 'items-start'}`}>
          {!item.isOwn && (
            <Text className="text-sm font-semibold text-gray-800 mb-1">
              {item.sender}
            </Text>
          )}
          <View
            className={`px-4 py-3 rounded-2xl ${
              item.isOwn
                ? 'bg-blue-500 rounded-br-none'
                : 'bg-white rounded-bl-none'
            }`}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            {item.image ? (
              <Image
                source={{ uri: item.image }}
                style={{
                  width: 200,
                  height: 200,
                  borderRadius: 8,
                  resizeMode: 'cover',
                }}
              />
            ) : (
              <Text
                className={`text-sm ${
                  item.isOwn ? 'text-white' : 'text-gray-800'
                }`}
              >
                {item.message}
              </Text>
            )}
          </View>
          <Text
            className={`text-xs mt-1 ${
              item.isOwn ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            {item.time}
          </Text>
        </View>

        {item.isOwn && (
          <View className="w-10 h-10" />
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#F9FAFB]">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <CustomHeader 
          title={groupName || 'Support Group'} 
          showBackButton={true} 
        />

        {/* Messages */}
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          inverted
        />

        {/* Input Area */}
        <View className="border-t border-gray-200 px-4 py-3 flex-row items-center gap-3">
          <TouchableOpacity onPress={handleAttachmentPress}>
            <Paperclip size={24} color="#999" />
          </TouchableOpacity>

          <View className="flex-1 flex-row items-center bg-gray-100 rounded-full px-4 py-2 gap-2">
            <TextInput
              ref={inputRef}
              className="flex-1 text-gray-800 text-sm"
              placeholder="Type a message..."
              placeholderTextColor="#999"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <TouchableOpacity onPress={handleEmojiPress}>
              <Smile size={20} color="#999" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            className="bg-blue-500 w-10 h-10 rounded-full flex items-center justify-center"
            onPress={handleSend}
          >
            <Send size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default GroupChatScreen;
