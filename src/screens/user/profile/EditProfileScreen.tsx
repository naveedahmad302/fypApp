import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { User, Edit, Mail, Phone, Calendar, MapPin } from 'lucide-react-native';
import CustomText from '../../../components/CustomText';

const EditProfileScreen: React.FC = ({ navigation }: any) => {
  const [showToCommunity, setShowToCommunity] = useState(true);
  const [showActivity, setShowActivity] = useState(true);

  return (
    <ScrollView className="flex-1 bg-gray-50 px-5">
      

      <View className="items-center py-6">
        <View className="w-20 h-20 bg-blue-500 rounded-full items-center justify-center mb-2">
          <User size={32} color="white" />
          <View className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full items-center justify-center">
            <Edit size={12} color="white" />
          </View>
        </View>
        <CustomText className="text-blue-500 font-medium">Change Profile Picture</CustomText>
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
            defaultValue="Naveed Ahmad"
            placeholder="Enter full name"
          />
        </View>

        <CustomText className="text-gray-600 mb-2">Email</CustomText>
        <View className="flex-row items-center bg-[#F1F5F9] rounded-xl p-1 mb-4">
          <View className="pl-3">
            <Mail size={20} color="#666" />
          </View>
          <TextInput 
            className="flex-1 ml-3 text-base"
            defaultValue="naveed@gmail.com"
            placeholder="Enter email"
          />
        </View>

        <CustomText className="text-gray-600 mb-2">Phone Number</CustomText>
        <View className="flex-row items-center bg-[#F1F5F9] rounded-xl p-1 mb-4">
          <View className="pl-3">
            <Phone size={20} color="#666" />
          </View>
          <TextInput 
            className="flex-1 ml-3 text-base"
            defaultValue="+92 3440794561"
            placeholder="Enter phone number"
          />
        </View>

        <CustomText className="text-gray-600 mb-2">Date of Birth</CustomText>
        <View className="flex-row items-center bg-[#F1F5F9] rounded-xl p-1 mb-4">
          <View className="pl-3">
            <Calendar size={20} color="#666" />
          </View>
          <TextInput 
            className="flex-1 ml-3 text-base"
            defaultValue="05/15/1990"
            placeholder="MM/DD/YYYY"
          />
        </View>

        <CustomText className="text-gray-600 mb-2">Location</CustomText>
        <View className="flex-row items-center bg-[#F1F5F9] rounded-xl p-1 mb-4">
          <View className="pl-3">
            <MapPin size={20} color="#666" />
          </View>
          <TextInput 
            className="flex-1 ml-3 text-base"
            defaultValue="Gulberg, Islamabad"
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
            value={showToCommunity}
            onValueChange={setShowToCommunity}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
          />
        </View>

        <View className="flex-row items-center justify-between ">
          <View>
            <CustomText className="text-base font-medium">Show Activity Status</CustomText>
            <CustomText className="text-gray-500 text-sm">Let others see when you're online</CustomText>
          </View>
          <Switch
            value={showActivity}
            onValueChange={setShowActivity}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
          />
        </View>
      </View>
    </ScrollView>
  );
};

export default EditProfileScreen;
