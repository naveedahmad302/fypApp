import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { TAuthStackNavigationProps } from '../../navigation/authStack/types';
import { Heart, Shield, Users } from 'lucide-react-native';

const WelcomeScreen: React.FC<TAuthStackNavigationProps<'Welcome'>> = ({ navigation }) => {
  return (
    <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center p-4">
      <View className="w-full max-w-md">
        {/* Logo Section */}
        <View className="items-center mb-12">
          <View className="w-20 h-20 bg-[#4A90E2] rounded-full items-center justify-center mb-6 shadow-lg">
            <Heart size={36} color="#fff" />
          </View>
          
          <Text className="text-3xl font-bold text-center text-gray-800 mb-1">
            Welcome to
          </Text>
          <Text className="text-3xl font-bold text-center text-gray-800 mb-4">
            Autism Spectrum Detection
          </Text>
          
          <Text className="text-base text-center text-gray-600 leading-relaxed px-8">
            A safe, supportive platform for autism spectrum assessment and community support
          </Text>
        </View>

        {/* Feature Cards */}
        <View className="space-y-4 mb-12">
          {/* Safe & Private Card */}
          <View className="bg-white rounded-2xl p-5 flex-row items-start shadow-sm border border-gray-100">
            <View className="w-12 h-12 bg-[#DBEAFE] rounded-full items-center justify-center mr-4 flex-shrink-0">
              <Shield size={24} color="#4A90E2" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-800 mb-1">
                Safe & Private
              </Text>
              <Text className="text-sm text-gray-600 leading-relaxed">
                Your data is protected and confidential
              </Text>
            </View>
          </View>

          {/* Supportive Community Card */}
          <View className="bg-white rounded-2xl p-5 flex-row items-start shadow-sm border border-gray-100">
            <View className="w-12 h-12 bg-[#DBEAFE] rounded-full items-center justify-center mr-4 flex-shrink-0">
              <Users size={24} color="#4A90E2" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-800 mb-1">
                Supportive Community
              </Text>
              <Text className="text-sm text-gray-600 leading-relaxed">
                Connect with others on similar journeys
              </Text>
            </View>
          </View>
        </View>

        {/* Get Started Button */}
        <TouchableOpacity 
          className="w-full bg-[#4A90E2] rounded-2xl py-4 items-center shadow-lg"
          onPress={() => navigation.navigate('Login')}
        >
          <Text className="text-white text-bases font-semibold">Get Started</Text>
        </TouchableOpacity>
      </View>  
    </SafeAreaView>
  );
};

export default WelcomeScreen;