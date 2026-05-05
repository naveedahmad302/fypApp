import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import Animated, { 
  FadeInDown, 
  FadeInUp, 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TAuthStackNavigationProps } from '../../navigation/authStack/types';
import { Mail, ArrowLeft } from 'lucide-react-native';
import CustomText from '../../components/CustomText';
import { sendPasswordResetEmail } from '../../firebase/auth';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

const ForgotPasswordScreen: React.FC<TAuthStackNavigationProps<'ForgotPassword'>> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);

  // Animation values
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    // Trigger form animations after component mount
    setIsFormVisible(true);
  }, []);

  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  const handleResetPassword = async () => {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showErrorToast('Please enter a valid email address.', 'Invalid Email');
      return;
    }

    // Button press animation
    buttonScale.value = withSpring(0.95, { damping: 20, stiffness: 300 });
    setTimeout(() => {
      buttonScale.value = withSpring(1, { damping: 20, stiffness: 300 });
    }, 100);

    setIsLoading(true);

    try {
      await sendPasswordResetEmail(email);
      showSuccessToast(
        'We\'ve sent a password reset link to your email. Please check your inbox and follow the instructions.',
        'Email Sent'
      );
      setEmail('');
    } catch (error: any) {
      showErrorToast(error.message, 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FA]">
      <ScrollView contentContainerClassName="flex-grow justify-center p-5">
        <View className="w-full max-w-md mx-auto">
          {/* Animated Header */}
          {isFormVisible && (
            <Animated.View entering={FadeInDown.duration(800).springify()}>
              <CustomText weight={700} className="text-4xl font-bold text-center text-gray-900 mb-2">
                Forgot Password
              </CustomText>
              <CustomText weight={400} className="text-base text-center text-gray-600 mb-10">
                Enter your email address and we'll send you a link to reset your password
              </CustomText>
            </Animated.View>
          )}
          
          {/* Animated Form Container */}
          {isFormVisible && (
            <Animated.View 
              entering={FadeInUp.duration(800).delay(200).springify()}
              className='bg-[#FFFFFF] p-5 rounded-3xl shadow-2xl shadow-[#000000] mb-10' 
              style={{
                shadowColor: "#000",
                shadowOffset: {
                  width: 0,
                  height: 4,
                },
                shadowOpacity: 0.3,
                shadowRadius: 4.65,
                elevation: 8,
              }}
            >
            {/* Email Input */}
            <Animated.View entering={FadeInUp.duration(600).delay(300).springify()}>
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
            </Animated.View>

            {/* Instructions */}
            <Animated.View entering={FadeInUp.duration(600).delay(400).springify()}>
              <View className="bg-blue-50 p-4 rounded-xl mb-6">
                <CustomText weight={400} className="text-sm text-blue-800 text-center">
                  Make sure to check your spam folder if you don't receive the email within a few minutes.
                </CustomText>
              </View>
            </Animated.View>
            </Animated.View>
          )}

          {/* Submit Button */}
          <Animated.View entering={FadeInUp.duration(600).delay(500).springify()}>
            <Animated.View style={animatedButtonStyle}>
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
            </Animated.View>
          </Animated.View>

          {/* Back to Login Link */}
          <Animated.View entering={FadeInUp.duration(600).delay(600).springify()}>
            <View className="flex-row justify-center mt-10">
              <CustomText weight={400} className="text-sm text-gray-600">
                Remember your password?
              </CustomText>
              <TouchableOpacity onPress={() => navigation.navigate('Login', {})}>
                <CustomText weight={500} className="text-sm text-[#4A90E2] font-medium"> Sign In</CustomText>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </ScrollView>
      
    </SafeAreaView>
  );
};

export default ForgotPasswordScreen;
