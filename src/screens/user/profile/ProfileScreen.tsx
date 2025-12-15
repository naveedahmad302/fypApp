import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { User, Eye, Search, HelpCircle, Bell, Shield,SquarePen, Settings, ChevronRight, Wifi } from 'lucide-react-native';
import { TProfileStackNavigationProps } from '../../../navigation/userStack/types';
import { checkFirebaseConnection, ConnectionStatus } from '../../../firebase';
import { signOutUser } from '../../../firebase/auth';
import { useAuth } from '../../../context/AuthContext';
import { getUserFromFirestore, IUser } from '../../../firebase/firestore';
import { showSuccessToast, showErrorToast } from '../../../utils/toast';

const ProfileScreen: React.FC<TProfileStackNavigationProps<'Profile'>> = ({ navigation }) => {
    const { setAuthenticated, setUser, user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [userData, setUserData] = useState<IUser | null>(null);

    useEffect(() => {
        loadUserProfile();
    }, [user?.uid]);

    const loadUserProfile = async () => {
        if (!user?.uid) return;
        
        setIsLoading(true);
        try {
            const data = await getUserFromFirestore(user.uid);
            if (data) {
                setUserData(data);
            }
        } catch (error: any) {
            showErrorToast('Failed to load profile data', 'Error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditProfile = () => {
        navigation.navigate('EditProfile' as any);
    };

    const handleLogout = async () => {
        try {
            await signOutUser();
            showSuccessToast('You have been successfully logged out.', 'Logged Out');
            setAuthenticated(false);
            setUser(null);
        } catch (error: any) {
            showErrorToast(`Failed to log out: ${error.message}`, 'Logout Failed');
        }
    };

  return (
    <ScrollView className="flex-1 bg-[#F9FAFB] px-7" showsVerticalScrollIndicator={false}>
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text className="mt-4 text-gray-600">Loading profile...</Text>
        </View>
      ) : (
        <>
          <View className=" mt-2 rounded-xl p-6" >
            <View className="items-center mb-2">
              <View className="w-24 h-24 bg-[#4A90E2] rounded-full items-center justify-center mb-4 overflow-hidden">
                {userData?.profileImage ? (
                  <Image 
                    source={{ uri: userData.profileImage }} 
                    className="w-full h-full"
                    style={{ resizeMode: 'cover' }}
                  />
                ) : (
                  <User size={36} color="white" />
                )}
              </View>
              <Text className="text-2xl font-radio-canada font-bold text-gray-900 mb-1">
                {userData?.fullName || user?.name || 'User'}
              </Text>
              <Text className="text-gray-500 font-radio-canada mb-1">
                {userData?.email || user?.email || ''}
              </Text>
              <Text className="text-gray-500 font-radio-canada mb-6">
                {userData?.email ? `Member since ${userData.createdAt?.toDate()?.getFullYear() || new Date().getFullYear()}` : 'Please sign in'}
              </Text>
              
              <TouchableOpacity 
                className="bg-[#4A90E2] py-4 rounded-xl w-full flex-row items-center justify-center mb-3"
                onPress={() =>handleEditProfile()}
              >
                <SquarePen size={19} color="white" />
                <Text className="text-white text-center font-radio-canada font-medium ml-2">Edit Profile</Text>
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
              <View className="w-10 h-10 bg-green-50 rounded-full items-center justify-center">
                <HelpCircle size={20} color="#10b981" />
              </View>
              <Text className="flex-1 font-radio-canada font-medium text-gray-900">MCQ Assessment</Text>
              <Text className="text-green-600 font-radio-canada font-medium">Completed</Text>
            </View>
          </View>
          <TouchableOpacity 
              className="bg-white mt-6 mb-5 border border-red-400 rounded-xl p-4"
              onPress={handleLogout}
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
        </>
      )}
    </ScrollView>
  );
};

export default ProfileScreen;