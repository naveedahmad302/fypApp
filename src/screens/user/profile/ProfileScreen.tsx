import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { User, Eye, Search, HelpCircle, Bell, Shield, Settings, ChevronRight } from 'lucide-react-native';
import { TProfileStackNavigationProps } from '../../../navigation/userStack/types';

const ProfileScreen: React.FC<TProfileStackNavigationProps<'Profile'>> = ({ navigation }) => {
    const handleEditProfile = () => {
        navigation.navigate('EditProfile' as any);
    };
  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="items-center py-8 bg-white">
        <View className="w-20 h-20 bg-blue-500 rounded-full items-center justify-center mb-4">
          <User size={32} color="white" />
        </View>
        <Text className="text-xl font-bold mb-1">Naveed Ahmed</Text>
        <Text className="text-gray-500 mb-1">naveed@example.com</Text>
        <Text className="text-gray-500 mb-4">Member since January 2025</Text>
        
        <TouchableOpacity 
          className="bg-blue-500 px-6 py-2 rounded-lg"
          onPress={() =>handleEditProfile()}
        >
          <Text className="text-white font-medium">Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row bg-white mx-4 mt-4 rounded-lg">
        <View className="flex-1 items-center py-4">
          <Text className="text-2xl font-bold text-blue-500">3</Text>
          <Text className="text-gray-600">Assessments</Text>
        </View>
        <View className="w-px bg-gray-200" />
        <View className="flex-1 items-center py-4">
          <Text className="text-2xl font-bold text-blue-500">100%</Text>
          <Text className="text-gray-600">Complete</Text>
        </View>
      </View>

      <View className="bg-white mx-4 mt-4 rounded-lg p-4">
        <Text className="text-lg font-semibold mb-4">Assessment Journey</Text>
        
        <View className="flex-row items-center mb-3">
          <Eye size={20} color="#10b981" />
          <Text className="flex-1 ml-3">Eye Tracking</Text>
          <Text className="text-green-500 font-medium">Completed</Text>
        </View>
        
        <View className="flex-row items-center mb-3">
          <Search size={20} color="#10b981" />
          <Text className="flex-1 ml-3">Speech Analysis</Text>
          <Text className="text-green-500 font-medium">Completed</Text>
        </View>
        
        <View className="flex-row items-center">
          <HelpCircle size={20} color="#10b981" />
          <Text className="flex-1 ml-3">MCQ Assessment</Text>
          <Text className="text-green-500 font-medium">Completed</Text>
        </View>
      </View>

      <View className="bg-white mx-4 mt-4 rounded-lg p-4">
        <Text className="text-lg font-semibold mb-4">Settings</Text>
        
        <TouchableOpacity className="flex-row items-center py-3">
          <View className="w-8 h-8 bg-blue-100 rounded-full items-center justify-center">
            <Bell size={16} color="#3b82f6" />
          </View>
          <Text className="flex-1 ml-3">Notifications</Text>
          <Text className="text-gray-400">Manage notification preferences</Text>
          <ChevronRight size={16} color="#9ca3af" />
        </TouchableOpacity>
        
        <TouchableOpacity className="flex-row items-center py-3">
          <View className="w-8 h-8 bg-green-100 rounded-full items-center justify-center">
            <Shield size={16} color="#10b981" />
          </View>
          <Text className="flex-1 ml-3">Privacy & Security</Text>
          <Text className="text-gray-400">Control your privacy and data</Text>
          <ChevronRight size={16} color="#9ca3af" />
        </TouchableOpacity>
        
        <TouchableOpacity className="flex-row items-center py-3">
          <View className="w-8 h-8 bg-purple-100 rounded-full items-center justify-center">
            <HelpCircle size={16} color="#8b5cf6" />
          </View>
          <Text className="flex-1 ml-3">Help & Support</Text>
          <Text className="text-gray-400">Get help and contact support</Text>
          <ChevronRight size={16} color="#9ca3af" />
        </TouchableOpacity>
        
        <TouchableOpacity className="flex-row items-center py-3">
          <View className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
            <Settings size={16} color="#6b7280" />
          </View>
          <Text className="flex-1 ml-3">Account Settings</Text>
          <ChevronRight size={16} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        className="bg-white mx-4 mt-4 rounded-lg p-4"
        onPress={() => console.log('Navigate to Support')}
      >
        <Text className="text-red-500 text-center font-medium">Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default ProfileScreen;