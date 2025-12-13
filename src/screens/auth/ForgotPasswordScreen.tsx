import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TAuthStackNavigationProps } from '../../navigation/authStack/types';
import { Mail, ArrowLeft } from 'lucide-react-native';
import CustomText from '../../components/CustomText';
import { sendPasswordResetEmail } from '../../firebase/auth';
import AlertModal from '../../components/AlertModal';

const ForgotPasswordScreen: React.FC<TAuthStackNavigationProps<'ForgotPassword'>> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [alertModal, setAlertModal] = useState({
    visible: false,
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    title: '',
    message: '',
  });

  const showAlert = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    setAlertModal({ visible: true, type, title, message });
  };

  const handleResetPassword = async () => {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert('error', 'Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      await sendPasswordResetEmail(email);
      showAlert(
        'success',
        'Email Sent',
        'We\'ve sent a password reset link to your email. Please check your inbox and follow the instructions.'
      );
      setEmail('');
    } catch (error: any) {
      showAlert('error', 'Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FA]">
      <ScrollView contentContainerClassName="flex-grow justify-center p-5">
        <View className="w-full max-w-md mx-auto">
          {/* Back Button
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            className="flex-row items-center mb-6"
          >
            <ArrowLeft size={20} color="#4A90E2" />
            <CustomText weight={500} className="text-[#4A90E2] text-base ml-2">
              Back to Login
            </CustomText>
          </TouchableOpacity> */}

          {/* Header */}
          <CustomText weight={700} className="text-4xl font-bold text-center text-gray-900 mb-2">
            Forgot Password
          </CustomText>
          <CustomText weight={400} className="text-base text-center text-gray-600 mb-10">
            Enter your email address and we'll send you a link to reset your password
          </CustomText>

          {/* Form Card */}
          <View className='bg-[#FFFFFF] p-5 rounded-3xl shadow-2xl shadow-[#000000] mb-10'>
            {/* Email Input */}
            <View className="mb-6">
              <CustomText weight={500} className="text-base font-medium mb-2 text-gray-800">
                Email Address
              </CustomText>
              <View className="flex-row items-center rounded-xl px-4 bg-gray-50">
                <Mail size={20} color="#9CA3AF" className="mr-3" />
                <TextInput
                  className="flex-1 py-4 text-base text-gray-900"
                  placeholder="Enter your email address"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            {/* Instructions */}
            <View className="bg-blue-50 p-4 rounded-xl mb-6">
              <CustomText weight={400} className="text-sm text-blue-800 text-center">
                Make sure to check your spam folder if you don't receive the email within a few minutes.
              </CustomText>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            className="bg-[#4A90E2] py-4 rounded-2xl items-center mt-2"
            onPress={handleResetPassword}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <CustomText weight={600} className="text-white text-base font-semibold">
                Send Reset Link
              </CustomText>
            )}
          </TouchableOpacity>

          {/* Back to Login Link */}
          <View className="flex-row justify-center mt-10">
            <CustomText weight={400} className="text-sm text-gray-600">
              Remember your password?
            </CustomText>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <CustomText weight={500} className="text-sm text-[#4A90E2] font-medium"> Sign In</CustomText>
            </TouchableOpacity>
          </View>
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

export default ForgotPasswordScreen;
