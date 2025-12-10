import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, Text, View } from 'react-native';
import { ChevronLeft, Save } from 'lucide-react-native';

import { TProfileTabStackParamsList } from './types';
import ProfileScreen from '../../../screens/user/profile/ProfileScreen';
import EditProfileScreen from '../../../screens/user/profile/EditProfileScreen';

const Stack = createNativeStackNavigator<TProfileTabStackParamsList>();

const ProfileTabStack: React.FC = () => {
  return (
    // @ts-ignore - React Navigation TypeScript issue with children prop
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen}
        options={({ navigation }) => ({
          title: '',
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              className="flex-row items-center px-2"
            >
              <ChevronLeft size={20} color="#3b82f6" />
              <Text className="text-blue-500 text-base font-medium ml-1">Cancel</Text>
            </TouchableOpacity>
          ),
          headerTitle: () => (
            <View className="flex-1 items-center justify-center">
              <Text className="text-lg font-semibold text-center">Edit Profile</Text>
            </View>
          ),
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => {
                // Handle save functionality
                // console.log('Save profile');
                navigation.goBack();
              }}
              className="flex-row items-center px-2"
            >
              <Save size={20} color="#3b82f6" />
              <Text className="text-blue-500 text-base font-medium ml-1">Save</Text>
            </TouchableOpacity>
          ),
        })}
      />
    </Stack.Navigator>
  );
};

export default ProfileTabStack;
