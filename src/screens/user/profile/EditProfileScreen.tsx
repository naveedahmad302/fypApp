import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, ActivityIndicator, Image, Alert, Modal, TouchableWithoutFeedback } from 'react-native';
import { User, Edit, Mail, Phone, Calendar as CalendarIcon, MapPin, Save, Camera } from 'lucide-react-native';
import CalendarPicker from 'react-native-calendar-picker';
import CustomText from '../../../components/CustomText';
import { useAuth } from '../../../context/AuthContext';
import { getUserFromFirestore, updateUserInFirestore, IUser } from '../../../firebase/firestore';
import { showSuccessToast, showErrorToast } from '../../../utils/toast';
import { launchImageLibrary } from 'react-native-image-picker';

const EditProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [userData, setUserData] = useState<Partial<IUser>>({
    fullName: '',
    email: '',
    phoneNumber: '',
    dateOfBirth: '',
    location: '',
    profileImage: '',
    showToCommunity: true,
    showActivity: true,
  });

  useEffect(() => {
    loadUserData();
  }, [user?.uid]);

  const loadUserData = async () => {
    if (!user?.uid) return;
    
    setIsLoading(true);
    try {
      const data = await getUserFromFirestore(user.uid);
      if (data) {
        setUserData({
          fullName: data.fullName || '',
          email: data.email || '',
          phoneNumber: data.phoneNumber || '',
          dateOfBirth: data.dateOfBirth || '',
          location: data.location || '',
          profileImage: data.profileImage || '',
          showToCommunity: data.showToCommunity ?? true,
          showActivity: data.showActivity ?? true,
        });
      }
    } catch (error: any) {
      showErrorToast('Failed to load profile data', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.uid) {
      showErrorToast('User not authenticated', 'Error');
      return;
    }
    
    setIsSaving(true);
    try {
      // Filter out undefined fields and only send defined data
      const updateData = Object.fromEntries(
        Object.entries(userData).filter(([_, value]) => value !== undefined && value !== '')
      );
      
      console.log('Updating user data:', updateData);
      await updateUserInFirestore(user.uid, updateData);
      showSuccessToast('Profile updated successfully!', 'Success');
      
      // Safe navigation back
      if (navigation && navigation.goBack) {
        navigation.goBack();
      }
    } catch (error: any) {
      console.error('Profile update error:', error);
      showErrorToast(`Failed to update profile: ${error.message}`, 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const validateDateFormat = (dateString: string): boolean => {
    if (!dateString || dateString.trim() === '') return true;
    
    const cleanDate = dateString.trim();
    const regex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
    
    if (!regex.test(cleanDate)) {
      return false;
    }
    
    const [month, day, year] = cleanDate.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    
    return date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day;
  };

  const updateField = (field: keyof typeof userData, value: any) => {
    if (field === 'dateOfBirth' && value) {
      const date = new Date(value);
      const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      setUserData(prev => ({ ...prev, [field]: formattedDate }));
      setShowCalendar(false);
    } else {
      setUserData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleDateSelect = (date: Date) => {
    updateField('dateOfBirth', date);
  };

  const handleImagePicker = () => {
    Alert.alert(
      'Profile Picture',
      'Choose an option',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Choose from Gallery',
          onPress: () => {
            const options = {
              mediaType: 'photo' as const,
              quality: 0.7 as any,
              maxWidth: 500,
              maxHeight: 500,
            };
            
            launchImageLibrary(options, (response) => {
              if (response.didCancel || response.errorMessage) {
                return;
              }
              
              if (response.assets && response.assets[0]) {
                const imageUri = response.assets[0].uri;
                if (imageUri) {
                  updateField('profileImage', imageUri);
                }
              }
            });
          },
        },
      ]
    );
  };

  return (
    <ScrollView className="flex-1 bg-gray-50 px-5">
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#3b82f6" />
          <CustomText className="mt-4 text-gray-600">Loading profile data...</CustomText>
        </View>
      ) : (
        <>
          <View className="flex-1 items-center justify-center mt-4">
            <TouchableOpacity onPress={handleImagePicker} className="relative">
              <View className="w-20 h-20 bg-[#4A90E2] rounded-full items-center justify-center mb-2 overflow-hidden">
                {userData.profileImage ? (
                  <Image 
                    source={{ uri: userData.profileImage }} 
                    className="w-full h-full"
                    style={{ resizeMode: 'cover' }}
                  />
                ) : (
                  <User size={32} color="white" />
                )}
              </View>
              <View className="absolute bottom-9 right-10 w-8 h-8 bg-green-500 rounded-full items-center justify-center border-2 border-white z-10">
                <Camera size={14} color="white" />
              </View>
              <CustomText className="text-[#4A90E2] font-medium">Change Profile Picture</CustomText>
            </TouchableOpacity>
          </View>

          <View className="bg-white px-4 py-3 mt-2 rounded-2xl" style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}>
            <CustomText className="text-gray-600 mb-2">Full Name</CustomText>
            <View className="flex-row items-center bg-[#F1F5F9] rounded-xl p-1 mb-4">
              <View className="pl-3">
                <User size={20} color="#666" />
              </View>
              <TextInput 
                className="flex-1 ml-3 text-base"
                value={userData.fullName}
                onChangeText={(value) => updateField('fullName', value)}
                placeholder="Enter full name"
              />
            </View>

            <CustomText className="text-gray-600 mb-2">Email</CustomText>
            <View className="flex-row items-center bg-gray-100 rounded-xl p-1 mb-4">
              <View className="pl-3">
                <Mail size={20} color="#999" />
              </View>
              <TextInput 
                className="flex-1 ml-3 text-base text-gray-500"
                value={userData.email}
                editable={false}
                placeholder="Email cannot be changed"
              />
            </View>

        <CustomText className="text-gray-600 mb-2">Phone Number</CustomText>
        <View className="flex-row items-center bg-[#F1F5F9] rounded-xl p-1 mb-4">
          <View className="pl-3">
            <Phone size={20} color="#666" />
          </View>
          <TextInput 
            className="flex-1 ml-3 text-base"
            value={userData.phoneNumber}
            onChangeText={(value) => updateField('phoneNumber', value)}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
          />
        </View>

        <CustomText className="text-gray-600 mb-2">Date of Birth</CustomText>
        <TouchableOpacity 
          onPress={() => setShowCalendar(true)}
          className="flex-row items-center bg-[#F1F5F9] rounded-xl p-1 mb-4"
        >
          <View className="pl-3">
            <CalendarIcon size={20} color="#666" />
          </View>
          <Text className="ml-3 text-base text-gray-800 py-3">
            {userData.dateOfBirth || 'Select your date of birth'}
          </Text>
        </TouchableOpacity>

        <Modal
          visible={showCalendar}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCalendar(false)}
        >
          <TouchableWithoutFeedback onPress={() => setShowCalendar(false)}>
            <View className="flex-1 bg-black/50 justify-center items-center p-4">
              <View className="w-full bg-white rounded-xl p-4">
                <CalendarPicker
                  onDateChange={handleDateSelect}
                  selectedStartDate={userData.dateOfBirth ? new Date(userData.dateOfBirth) : null}
                  maxDate={new Date()}
                  width={350}
                  selectedDayColor="#3b82f6"
                  selectedDayTextColor="#ffffff"
                  todayBackgroundColor="#e0e7ff"
                  todayTextColor="#3b82f6"
                  textStyle={{
                    fontFamily: 'System',
                    color: '#1f2937',
                  }}
                  selectedRangeStartStyle={{
                    backgroundColor: '#3b82f6',
                  }}
                  selectedRangeEndStyle={{
                    backgroundColor: '#3b82f6',
                  }}
                  selectedRangeStyle={{
                    backgroundColor: '#93c5fd',
                  }}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <CustomText className="text-gray-600 mb-2">Location</CustomText>
        <View className="flex-row items-center bg-[#F1F5F9] rounded-xl p-1 mb-4">
          <View className="pl-3">
            <MapPin size={20} color="#666" />
          </View>
          <TextInput 
            className="flex-1 ml-3 text-base"
            value={userData.location}
            onChangeText={(value) => updateField('location', value)}
            placeholder="Enter location"
          />
        </View>

        {/* <CustomText className="text-gray-600 mb-2">Bio</CustomText>
        <TextInput 
          className="border border-gray-200 rounded-lg p-3 h-20"
          multiline
          defaultValue="Parent of a wonderful child on the spectrum. Passionate about autism awareness and advocacy."
          placeholder="Tell us about yourself..."
        /> */}
      </View>

      <View className="bg-white px-4 py-4 mt-6 mb-10 rounded-2xl" style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}>
        <CustomText className="text-lg font-semibold mb-4">Privacy Settings</CustomText>
        
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <CustomText className="text-base font-medium">Show Profile to Community</CustomText>
            <CustomText className="text-gray-500 text-sm">Let others see when you're online</CustomText>
          </View>
          <Switch
            value={userData.showToCommunity}
            onValueChange={(value) => updateField('showToCommunity', value)}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
          />
        </View>

        <View className="flex-row items-center justify-between ">
          <View>
            <CustomText className="text-base font-medium">Show Activity Status</CustomText>
            <CustomText className="text-gray-500 text-sm">Let others see when you're online</CustomText>
          </View>
          <Switch
            value={userData.showActivity}
            onValueChange={(value) => updateField('showActivity', value)}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
          />
        </View>
      </View>

      {/* Save Button */}
      <View className="px-4 mt-6 mb-10">
        <TouchableOpacity
          className="bg-[#4A90E2] py-4 rounded-xl flex-row items-center justify-center"
          onPress={handleSave}
          disabled={isSaving || isLoading}
        >
          {isSaving ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Save size={20} color="white" />
              <CustomText className="text-white font-medium ml-2">Save Changes</CustomText>
            </>
          )}
        </TouchableOpacity>
      </View>
      
        </>
      )}
    </ScrollView>
  );
};

export default EditProfileScreen;
