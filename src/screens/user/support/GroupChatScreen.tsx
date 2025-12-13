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
  Animated,
  Alert,
  ActionSheetIOS,
} from 'react-native';
import { launchImageLibrary, launchCamera, MediaType } from 'react-native-image-picker';
import { Paperclip, Smile, Send } from 'lucide-react-native';
import { useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TSupportTabStackParamsList } from '../../../navigation/userStack/bottomTabsStack/types';
import CustomHeader from '../../../components/CustomHeader';

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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'Minhaj',
      initials: 'MN',
      avatar: '#9C27B0',
      message: 'Good morning everyone! Hope you all have a wonderful day ahead �',
      time: '8:30 AM',
      isOwn: false,
    },
    {
      id: '2',
      sender: 'Javeria',
      initials: 'JA',
      avatar: '#9C27B0',
      message:
        'Thanks Minhaj! Just wanted to share that my son made great progress with his speech therapy this week.',
      time: '8:45 AM',
      isOwn: false,
    },
    {
      id: '3',
      sender: 'You',
      initials: 'YOU',
      avatar: '#2196F3',
      message:
        "That's wonderful news Javeria! Celebrating these milestones with you! 🎉",
      time: '8:50 AM',
      isOwn: true,
    },
    {
      id: '4',
      sender: 'Naveed',
      initials: 'NA',
      avatar: '#2196F3',
      message: 'Hello there!',
      time: '9:00 AM',
      isOwn: false,
    },
  ]);

  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (inputText.trim() === '') return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      sender: 'You',
      initials: 'YOU',
      avatar: '#2196F3',
      message: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOwn: true,
    };
    
    setMessages([...messages, newMessage]);
    setInputText('');
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
    // For Android, you might need to use DocumentPicker
    Alert.alert('Browse Files', 'File browser functionality would be implemented here');
  };

  const sendImageMessage = (imageUri: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      sender: 'You',
      initials: 'YOU',
      avatar: '#2196F3',
      message: '',
      image: imageUri,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOwn: true,
    };
    
    setMessages([...messages, newMessage]);
  };

  const handleEmojiPress = () => {
    console.log('Emoji pressed');
    // Focus the input and show emoji keyboard
    inputRef.current?.focus();
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F9FAFB]">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <CustomHeader 
          title={groupName || 'Parents Support Circle'} 
          showBackButton={true} 
        />

      {/* Messages */}
      <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        {/* Today Badge */}
        <View className="flex-row justify-center mb-6">
          <View className="bg-gray-200 rounded-full px-3 py-1">
            <Text className="text-xs font-medium text-gray-600">Today</Text>
          </View>
        </View>

        {/* Messages List */}
        {messages.map((msg) => (
          <View key={msg.id} className="mb-4">
            <View
              className={`flex-row gap-3 ${msg.isOwn ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              {!msg.isOwn && (
                <View
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: msg.avatar }}
                >
                  <Text className="text-white text-xs font-bold">
                    {msg.initials}
                  </Text>
                </View>
              )}

              {/* Message Bubble */}
              <View className={`flex-1 ${msg.isOwn ? 'items-end' : 'items-start'}`}>
                {!msg.isOwn && (
                  <Text className="text-sm font-semibold text-gray-800 mb-1">
                    {msg.sender}
                  </Text>
                )}
                <View
                  className={`px-4 py-3 rounded-2xl ${
                    msg.isOwn
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
                  {msg.image ? (
                    <Image
                      source={{ uri: msg.image }}
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
                        msg.isOwn ? 'text-white' : 'text-gray-800'
                      }`}
                    >
                      {msg.message}
                    </Text>
                  )}
                </View>
                <Text
                  className={`text-xs mt-1 ${
                    msg.isOwn ? 'text-gray-500' : 'text-gray-400'
                  }`}
                >
                  {msg.time}
                </Text>
              </View>

              {msg.isOwn && (
                <View className="w-10 h-10" />
              )}
            </View>
          </View>
        ))}
      </ScrollView>

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
