import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeInUp,
  interpolate,
} from 'react-native-reanimated';
import { TAuthStackNavigationProps } from '../../navigation/authStack/types';
import { Mail, ArrowLeft } from 'lucide-react-native';
import CustomText from '../../components/CustomText';
import { sendPasswordResetEmail } from '../../firebase/auth';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedView = Animated.createAnimatedComponent(View);

const ForgotPasswordScreen: React.FC<TAuthStackNavigationProps<'ForgotPassword'>> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Animation values
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(50);
  const buttonScale = useSharedValue(1);
  const loadingProgress = useSharedValue(0);

  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 600 });
    slideAnim.value = withTiming(0, { duration: 600 });
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: slideAnim.value }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const loadingStyle = useAnimatedStyle(() => ({
    opacity: loadingProgress.value,
    transform: [{ scale: interpolate(loadingProgress.value, [0, 1], [0.8, 1]) }],
  }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.95, { stiffness: 400, damping: 17 });
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { stiffness: 400, damping: 17 });
  };

  const handleResetPassword = async () => {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showErrorToast('Please enter a valid email address.', 'Invalid Email');
      return;
    }

    setIsLoading(true);
    loadingProgress.value = withTiming(1, { duration: 300 });

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
      loadingProgress.value = withTiming(0, { duration: 200 });
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FA]">
      <ScrollView contentContainerClassName="flex-grow justify-center p-5">
        <AnimatedView style={containerStyle} className="w-full max-w-md mx-auto">
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
          <AnimatedView entering={FadeInUp.delay(50).duration(500)}>
            <CustomText weight={700} className="text-4xl font-bold text-center text-gray-900 mb-2">
              Forgot Password
            </CustomText>
            <CustomText weight={400} className="text-base text-center text-gray-600 mb-10">
              Enter your email address and we'll send you a link to reset your password
            </CustomText>
          </AnimatedView>

          {/* Form Card */}
          <AnimatedView entering={FadeInUp.delay(150).duration(500)} className='bg-[#FFFFFF] p-5 rounded-3xl shadow-2xl shadow-[#000000] mb-10'>
            {/* Email Input */}
            <AnimatedView entering={FadeInUp.delay(250).duration(400)} className="mb-6">
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
            </AnimatedView>

            {/* Instructions */}
            <AnimatedView entering={FadeInUp.delay(350).duration(400)} className="bg-blue-50 p-4 rounded-xl mb-6">
              <CustomText weight={400} className="text-sm text-blue-800 text-center">
                Make sure to check your spam folder if you don't receive the email within a few minutes.
              </CustomText>
            </AnimatedView>
          </AnimatedView>

          {/* Submit Button */}
          <AnimatedPressable
            style={buttonAnimatedStyle}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            className="bg-[#4A90E2] py-4 rounded-2xl items-center mt-2 overflow-hidden"
            onPress={handleResetPassword}
            disabled={isLoading}
          >
            <AnimatedView style={loadingStyle} className="absolute inset-0 bg-[#3B7DD8]" pointerEvents="none" />
            {isLoading ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="#fff" size="small" />
                <CustomText weight={600} className="text-white text-base font-semibold ml-2">Sending...</CustomText>
              </View>
            ) : (
              <CustomText weight={600} className="text-white text-base font-semibold">
                Send Reset Link
              </CustomText>
            )}
          </AnimatedPressable>

          {/* Back to Login Link */}
          <AnimatedView entering={FadeInUp.delay(550).duration(400)} className="flex-row justify-center mt-10">
            <CustomText weight={400} className="text-sm text-gray-600">
              Remember your password?
            </CustomText>
            <TouchableOpacity onPress={() => navigation.navigate('Login', {})}>
              <CustomText weight={500} className="text-sm text-[#4A90E2] font-medium"> Sign In</CustomText>
            </TouchableOpacity>
          </AnimatedView>
        </AnimatedView>
      </ScrollView>
      
    </SafeAreaView>
  );
};

export default ForgotPasswordScreen;
