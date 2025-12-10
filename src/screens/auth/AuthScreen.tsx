import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { TAuthStackNavigationProps } from '../../navigation/authStack/types';

const AuthScreen: React.FC<TAuthStackNavigationProps<'Login'>> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('signup');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const { setAuthenticated } = useAuth();

  const handleSubmit = async () => {
    console.log('Submitting form for tab:', activeTab);
    if (!formData.email || !formData.password || (activeTab === 'signup' && !formData.fullName)) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      Alert.alert('Success', activeTab === 'signup' ? 'Account created successfully!' : 'Login successful!');
      setAuthenticated(true);
    }, 2000);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-50"
    >
      <ScrollView contentContainerClassName="flex-grow justify-center p-4">
        <View className="max-w-md w-full bg-white rounded-3xl shadow-lg p-8 mx-auto">
          {/* Header */}
          <View className="items-center mb-8">
            <Text className="text-2xl font-bold text-gray-800 mb-2">
              Join SpectrumCare
            </Text>
            <Text className="text-sm text-gray-600">
              Create your account or sign in
            </Text>
          </View>

          {/* Tab Switcher */}
          <View className="bg-gray-100 rounded-xl p-1 flex-row mb-6">
            <TouchableOpacity
              onPress={() => {
                console.log('Switching to tab: signup');
                setActiveTab('signup');
              }}
              className={`flex-1 py-2 px-4 rounded-lg ${
                activeTab === 'signup' ? 'bg-white shadow-sm' : ''
              }`}
              activeOpacity={0.7}
            >
              <Text className={`text-sm font-medium text-center ${
                activeTab === 'signup' ? 'text-gray-800' : 'text-gray-600'
              }`}>
                Sign Up
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => {
                console.log('Switching to tab: Login');
                setActiveTab('Login');
              }}
              className={`flex-1 py-2 px-4 rounded-lg ${
                activeTab === 'Login' ? 'bg-white shadow-sm' : ''
              }`}
              activeOpacity={0.7}
            >
              <Text className={`text-sm font-medium text-center ${
                activeTab === 'Login' ? 'text-gray-800' : 'text-gray-600'
              }`}>
                Sign In
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View className="gap-5">
            {/* Full Name Field - Only for Sign Up */}
            {activeTab === 'signup' && (
              <View>
                <Text className="text-sm font-medium text-gray-800 mb-2">
                  Full Name
                </Text>
                <TextInput
                  placeholder="Enter your full name"
                  value={formData.fullName}
                  onChangeText={(text) => setFormData({...formData, fullName: text})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            )}

            {/* Email Field */}
            <View>
              <Text className="text-sm font-medium text-gray-800 mb-2">
                Email+
              </Text>
              <TextInput
                placeholder="Enter your email"
                value={formData.email}
                onChangeText={(text) => setFormData({...formData, email: text})}
                keyboardType="email-address"
                autoCapitalize="none"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Password Field */}
            <View>
              <Text className="text-sm font-medium text-gray-800 mb-2">
                Password
              </Text>
              <TextInput
                placeholder={activeTab === 'signup' ? 'Create a password' : 'Enter your password'}
                value={formData.password}
                onChangeText={(text) => setFormData({...formData, password: text})}
                secureTextEntry
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              className="w-full bg-blue-500 active:bg-blue-600 rounded-xl py-4 mt-6 shadow-lg"
              activeOpacity={0.8}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-center text-base font-semibold">
                  {activeTab === 'signup' ? 'Create Account' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default AuthScreen;
