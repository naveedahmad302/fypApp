import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { User, Eye, Search, HelpCircle, Bell, Shield,SquarePen, Settings, ChevronRight, Wifi } from 'lucide-react-native';
import { TProfileStackNavigationProps } from '../../../navigation/userStack/types';
import AlertModal from '../../../components/AlertModal';
import { checkFirebaseConnection, ConnectionStatus } from '../../../firebase';

const ProfileScreen: React.FC<TProfileStackNavigationProps<'Profile'>> = ({ navigation }) => {
    const [alertModal, setAlertModal] = useState({
        visible: false,
        type: 'info' as 'success' | 'error' | 'warning' | 'info',
        title: '',
        message: '',
    });

    const handleEditProfile = () => {
        navigation.navigate('EditProfile' as any);
    };

    const checkFirebaseStatus = async () => {
        try {
            const status = await checkFirebaseConnection();
            
            if (status.isConnected) {
                setAlertModal({
                    visible: true,
                    type: 'success',
                    title: 'Firebase Connected',
                    message: 'Firebase Auth and Firestore are both working correctly!',
                });
            } else {
                let message = 'Firebase connection issues detected:\n\n';
                if (!status.auth) message += '• Firebase Auth: Not connected\n';
                if (!status.firestore) message += '• Firestore: Not connected\n';
                if (status.error) message += `\nError: ${status.error}`;
                
                setAlertModal({
                    visible: true,
                    type: 'error',
                    title: 'Firebase Connection Failed',
                    message,
                });
            }
        } catch (error: any) {
            setAlertModal({
                visible: true,
                type: 'error',
                title: 'Connection Check Failed',
                message: `Failed to check Firebase connection: ${error.message}`,
            });
        }
    };

  return (
    <ScrollView className="flex-1 bg-[#F9FAFB] px-7" showsVerticalScrollIndicator={false}>
      <View className=" mt-2 rounded-xl p-6" >
        <View className="items-center mb-2">
          <View className="w-24 h-24 bg-[#4A90E2] rounded-full items-center justify-center mb-4">
            <User size={36} color="white" />
          </View>
          <Text className="text-2xl font-radio-canada font-bold text-gray-900 mb-1">Naveed Ahmad</Text>
          <Text className="text-gray-500 font-radio-canada mb-1">naveed@gmail.com</Text>
          <Text className="text-gray-500 font-radio-canada mb-6">Member since January 2025</Text>
          
          <TouchableOpacity 
            className="bg-[#4A90E2] py-4 rounded-xl w-full flex-row items-center justify-center mb-3"
            onPress={() =>handleEditProfile()}
          >
            <SquarePen size={19} color="white" />
            <Text className="text-white text-center font-radio-canada font-medium ml-2">Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="bg-gray-100 py-3 rounded-xl w-full flex-row items-center justify-center"
            onPress={checkFirebaseStatus}
          >
            <Wifi size={18} color="#4A90E2" />
            <Text className="text-gray-700 text-center font-radio-canada font-medium ml-2">Test Firebase Connection</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="bg-white  rounded-xl p-5" style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}>
        <View className="flex-row">
          <View className="flex-1 items-center">
            <Text className="text-3xl font-radio-canada font-bold text-blue-500">3</Text>
            <Text className="text-gray-600 font-radio-canada mt-1">Assessments</Text>
          </View>
          <View className="w-px bg-gray-200" />
          <View className="flex-1 items-center">
            <Text className="text-3xl font-radio-canada font-bold text-blue-500">100%</Text>
            <Text className="text-gray-600 font-radio-canada mt-1">Complete</Text>
          </View>
        </View>
      </View>
        <Text className="text-lg font-radio-canada mt-4 font-bold mb-6 text-gray-900">Assessment Journey</Text>

      <View className="bg-white rounded-xl p-6" style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}>
        
        <View className="flex-row items-center mb-4">
          {/* <View className="w-10 h-10 bg-green-50 rounded-full items-center justify-center">
            <Eye size={20} color="#10b981" />
          </View> */}
          <Text className="flex-1  font-radio-canada font-medium text-gray-900">Eye Tracking</Text>
          <Text className="text-green-600 font-radio-canada font-medium">Completed</Text>
        </View>
        
        <View className="flex-row items-center mb-4">
          {/* <View className="w-10 h-10 bg-green-50 rounded-full items-center justify-center">
            <Search size={20} color="#10b981" />
          </View> */}
          <Text className="flex-1  font-radio-canada font-medium text-gray-900">Speech Analysis</Text>
          <Text className="text-green-600 font-radio-canada font-medium">Completed</Text>
        </View>
        
        <View className="flex-row items-center">
          {/* <View className="w-10 h-10 bg-green-50 rounded-full items-center justify-center">
            <HelpCircle size={20} color="#10b981" />
          </View> */}
          <Text className="flex-1 font-radio-canada font-medium text-gray-900">MCQ Assessment</Text>
          <Text className="text-green-600 font-radio-canada font-medium">Completed</Text>
        </View>
      </View>
        {/* <Text className="text-xl font-radio-canada mt-4 font-bold mb-6 text-gray-900">Settings</Text>

      <View className="bg-white  rounded-xl p-4" style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}>
        
        <TouchableOpacity className="flex-row items-center py-4">
          <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center">
            <Bell size={20} color="#3b82f6" />
          </View>
          <View className="flex-1 ml-4">
            <Text className="font-radio-canada font-medium text-gray-900">Notifications</Text>
            <Text className="text-gray-400 text-sm font-radio-canada mt-1">Manage notification preferences</Text>
          </View>
          <ChevronRight size={20} color="#9ca3af" />
        </TouchableOpacity>
        
        <TouchableOpacity className="flex-row items-center py-4">
          <View className="w-10 h-10 bg-green-50 rounded-full items-center justify-center">
            <Shield size={20} color="#10b981" />
          </View>
          <View className="flex-1 ml-4">
            <Text className="font-radio-canada font-medium text-gray-900">Privacy & Security</Text>
            <Text className="text-gray-400 text-sm font-radio-canada mt-1">Control your privacy and data</Text>
          </View>
          <ChevronRight size={20} color="#9ca3af" />
        </TouchableOpacity>
        
        <TouchableOpacity className="flex-row items-center py-4">
          <View className="w-10 h-10 bg-purple-50 rounded-full items-center justify-center">
            <HelpCircle size={20} color="#8b5cf6" />
          </View>
          <View className="flex-1 ml-4">
            <Text className="font-radio-canada font-medium text-gray-900">Help & Support</Text>
            <Text className="text-gray-400 text-sm font-radio-canada mt-1">Get help and contact support</Text>
          </View>
          <ChevronRight size={20} color="#9ca3af" />
        </TouchableOpacity>
        
        <TouchableOpacity className="flex-row items-center py-4">
          <View className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
            <Settings size={20} color="#6b7280" />
          </View>
          <View className="flex-1 ml-4">
            <Text className="font-radio-canada font-medium text-gray-900">Account Settings</Text>
          </View>
          <ChevronRight size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View> */}

      <TouchableOpacity 
        className="bg-white mt-6 mb-5 border border-red-400 rounded-xl p-4"
        onPress={() => console.log('Navigate to Support')}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <Text className="text-red-500 text-center font-radio-canada font-medium">Sign Out</Text>
      </TouchableOpacity>
      <View className="py-3 justify-center ">
        <Text className="text-center font-radio-canada font-thin text-gray-400">SpectrumCare v1.0.0</Text>
      </View>
      <AlertModal
        visible={alertModal.visible}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        onClose={() => setAlertModal(prev => ({ ...prev, visible: false }))}
      />
    </ScrollView>
  );
};

export default ProfileScreen;