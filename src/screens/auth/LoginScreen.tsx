import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { TAuthStackNavigationProps } from '../../navigation/authStack/types';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import CustomText from '../../components/CustomText';
import AlertModal from '../../components/AlertModal';
import { signIn } from '../../firebase/auth';
import { getUserFromFirestore } from '../../firebase/firestore';

const LoginScreen: React.FC<TAuthStackNavigationProps<'Login'>> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [alertModal, setAlertModal] = useState({
    visible: false,
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    title: '',
    message: '',
  });
  const { setAuthenticated } = useAuth();

  const showAlert = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    setAlertModal({ visible: true, type, title, message });
  };

  const handleLogin = async () => {
  if (!email || !password) {
    showAlert('error', 'Missing Information', 'Please fill in all fields to continue.');
    return;
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showAlert('error', 'Invalid Email', 'Please enter a valid email address.');
    return;
  }

  setIsLoading(true);

  try {
    const user = await signIn(email, password);
    showAlert('success', 'Login Successful', `Welcome back, ${user.email || 'User'}`);
    
    setTimeout(() => {
      setAuthenticated(true); // Update your context
    }, 1500);
  } catch (error: any) {
    showAlert('error', 'Login Failed', error.message);
  } finally {
    setIsLoading(false);
  }
};

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FA]">
      <ScrollView contentContainerClassName="flex-grow justify-center p-5">
        <View className="w-full max-w-md mx-auto">
          <CustomText weight={700} className="text-4xl font-bold text-center text-gray-900 mb-2">
            Welcome Back
          </CustomText>
          <CustomText weight={400} className="text-base text-center text-gray-600 mb-10">
            Sign in to continue your journey
          </CustomText>
          <View className='bg-[#FFFFFF] p-5 rounded-3xl shadow-2xl shadow-[#000000] mb-10 '>
            {/* Email Input */}
            <View className="mb-5">
              <CustomText weight={500} className="text-base font-medium mb-2 text-gray-800">
                Email
              </CustomText>
              <View className="flex-row items-center rounded-xl px-4 bg-gray-50">
                <Mail size={20} color="#666" className="mr-3" />
                <TextInput
                  className="flex-1 py-4 text-base text-gray-900"
                  placeholder="Enter your Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            {/* Password Input */}
            <View className="mb-5">
              <CustomText weight={500} className="text-base font-medium mb-2 text-gray-800">
                Password
              </CustomText>
              <View className="flex-row items-center  rounded-xl px-4 bg-gray-50">
                <Lock size={20} color="#666" className="mr-3" />
                <TextInput
                  className="flex-1 py-4 text-base text-gray-900"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  className="p-1"
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#666" />
                  ) : (
                    <Eye size={20} color="#666" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} className="self-end mb-6">
              <CustomText weight={500} className="text-sm text-[#4A90E2] font-medium">
                Forgot Password?
              </CustomText>
            </TouchableOpacity>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            className="bg-[#4A90E2] py-4 rounded-2xl items-center mb-6 shadow-lg"
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <CustomText weight={600} className="text-white text-base font-semibold">Sign In</CustomText>
            )}
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View className="flex-row justify-center mb-8">
            <CustomText weight={400} className="text-sm text-gray-600">
              Don't have an account?
            </CustomText>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <CustomText weight={500} className="text-sm text-[#4A90E2] font-medium"> Sign Up</CustomText>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View className="flex-row items-center mb-6">
            <View className="flex-1 h-px bg-gray-200" />
            <CustomText weight={400} className="px-4 text-sm text-gray-600">or continue with</CustomText>
            <View className="flex-1 h-px bg-gray-200" />
          </View>

          {/* Google Button */}
          <TouchableOpacity className="w-48 h-14 flex-row items-center justify-center border border-gray-200 rounded-xl py-3 bg-white mx-auto">
            <Image 
              source={require('../../../assets/images/google-logo.png')} 
              style={{ width: 24, height: 24, marginRight: 12 }}
              resizeMode="contain"
            />
            <CustomText weight={500} className="text-base text-gray-800 font-medium">Google</CustomText>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Alert Modal */}
      <AlertModal
        visible={alertModal.visible}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        onClose={() => setAlertModal({ ...alertModal, visible: false })}
      />
    </SafeAreaView>
  );
};

export default LoginScreen;
