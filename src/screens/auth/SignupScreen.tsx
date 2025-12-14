import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { TAuthStackNavigationProps } from '../../navigation/authStack/types';
import { Mail, Lock, User, Eye, EyeOff, Check, Square } from 'lucide-react-native';
import CustomText from '../../components/CustomText';
import { signUp, signInWithGoogle } from '../../firebase/auth';
import { saveUserToFirestore, getUserFromFirestore } from '../../firebase/firestore';
import { SocialLogin } from '../../components/SocialLogin';
import { showSuccessToast, showErrorToast, showWarningToast } from '../../utils/toast';

const SignupScreen: React.FC<TAuthStackNavigationProps<'Signup'>> = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); 
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const { setAuthenticated, setUser } = useAuth();

  const handleSignup = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      showErrorToast('Please fill in all fields', 'Missing Information');
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showErrorToast('Please enter a valid email address.', 'Invalid Email');
      return;
    }
    
    if (password !== confirmPassword) {
      showErrorToast('Passwords do not match', 'Password Mismatch');
      return;
    }   
    
    if (password.length < 6) {
      showErrorToast('Password must be at least 6 characters', 'Weak Password');
      return;
    }
    
    if (!agreeToTerms) {
      showErrorToast('Please agree to the Terms of Service and Privacy Policy', 'Terms Not Accepted');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Create user with email and password
      const user = await signUp(email, password);
      
      // Save additional user data to Firestore
      await saveUserToFirestore(user.uid, email, fullName);
      
      showSuccessToast('Your account has been created successfully!', 'Account Created');
      
      // Navigate to login after a short delay
      setTimeout(() => {
        // Clear form
        setFullName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setAgreeToTerms(false);
        
        // Navigate to login screen
        navigation.navigate('Login', { 
          email: email, // Pre-fill email in login
        });
        showSuccessToast('Please sign in with your new account', 'Account Created');
      }, 1500);
      
    } catch (error: any) {
      // Handle different Firebase Auth errors
      let errorMessage = 'An error occurred during signup. Please try again.';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'The email address is not valid.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'The password is too weak. Please choose a stronger password.';
      }
      
      showErrorToast(errorMessage, 'Signup Failed');
    } finally {
      setIsLoading(false);
    }
  };

const handleGoogleSignUp = async () => {
  setIsGoogleLoading(true);

  try {
    const user = await signInWithGoogle();
    
    // Check if user already exists in Firestore
    const existingUserData = await getUserFromFirestore(user.uid);
    
    if (existingUserData) {
      // User already exists, navigate to login
      showInfoToast('An account with this Google account already exists. Please sign in.', 'Account Exists');
      setTimeout(() => {
        navigation.navigate('Login', { 
          email: user.email || ''
        });
      }, 1500);
    } else {
      // Create new user profile for Google sign-up
      if (user.email && user.displayName) {
        await saveUserToFirestore(user.uid, user.email, user.displayName);
        
        showSuccessToast('Your account has been created successfully!', 'Account Created');
        
        setTimeout(() => {
          setAuthenticated(true);
          setUser({
            name: user.displayName || '',
            email: user.email || '',
            uid: user.uid
          });
        }, 1500);
      }
    }
  } catch (error: any) {
    showErrorToast('Failed to sign up with Google. Please try again.', 'Google Sign-Up Failed');
  } finally {
    setIsGoogleLoading(false);
  }
};

  return (
    <SafeAreaView edges={[]} className="flex-1 bg-[#F7F8FA]">
      <ScrollView contentContainerClassName="flex-grow justify-center p-5">
        <View className="w-full max-w-md mx-auto">
          <CustomText weight={700} className="text-4xl font-bold text-center text-gray-900 mb-2">
            Create Account
          </CustomText>
          <CustomText weight={400} className="text-base text-center text-gray-600 mb-10">
            Join our supportive community today
          </CustomText>
          
          <View className='bg-[#FFFFFF] p-5 rounded-3xl shadow-2xl shadow-[#000000] mb-10'>
            {/* Full Name Input */}
            <View className="mb-5">
              <CustomText weight={500} className="text-base font-medium mb-2 text-gray-800">
                Full Name
              </CustomText>
              <View className="flex-row items-center rounded-xl px-4 bg-gray-50">
                <User size={20} color="#666" className="mr-3" />
                <TextInput
                  className="flex-1 py-4 text-base text-gray-900"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            {/* Email Input */}
            <View className="mb-5">
              <CustomText weight={500} className="text-base font-medium mb-2 text-gray-800">
                Email
              </CustomText>
              <View className="flex-row items-center rounded-xl px-4 bg-gray-50">
                <Mail size={20} color="#666" className="mr-3" />
                <TextInput
                  className="flex-1 py-4 text-base text-gray-900"
                  placeholder="Enter your email"
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
              <View className="flex-row items-center rounded-xl px-4 bg-gray-50">
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

            {/* Confirm Password Input */}
            <View className="mb-5">
              <CustomText weight={500} className="text-base font-medium mb-2 text-gray-800">
                Confirm Password
              </CustomText>
              <View className="flex-row items-center rounded-xl px-4 bg-gray-50">
                <Lock size={20} color="#666" className="mr-3" />
                <TextInput
                  className="flex-1 py-4 text-base text-gray-900"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="p-1"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} color="#666" />
                  ) : (
                    <Eye size={20} color="#666" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Terms and Conditions */}
            <View className="flex-row items-start mb-2">
              <TouchableOpacity 
                onPress={() => setAgreeToTerms(!agreeToTerms)}
                className="mt-1 mr-3"
              >
                {agreeToTerms ? (
                  <Check size={20} color="#4A90E2" />
                ) : (
                  <Square size={20} color="#666" />
                )}
              </TouchableOpacity>
              <View className="flex-1">
                <CustomText weight={400} className="text-sm text-gray-600 leading-relaxed">
                  I agree to the{' '}
                  <CustomText weight={500} className="text-sm text-[#4A90E2]">
                    Terms of Service
                  </CustomText>
                  {' '}and{' '}
                  <CustomText weight={500} className="text-sm text-[#4A90E2]">
                    Privacy Policy
                  </CustomText>
                </CustomText>
              </View>
            </View>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            className="bg-[#4A90E2] py-4 rounded-2xl items-center mb-6 shadow-lg"
            onPress={handleSignup}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <CustomText weight={600} className="text-white text-base font-semibold">Create Account</CustomText>
            )}
          </TouchableOpacity>

          {/* Sign In Link */}
          <View className="flex-row justify-center mb-8">
            <CustomText weight={400} className="text-sm text-gray-600">
              Already have an account?
            </CustomText>
            <TouchableOpacity onPress={() => navigation.navigate('Login', {})}>
              <CustomText weight={500} className="text-sm text-[#4A90E2] font-medium"> Sign In</CustomText>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View className="flex-row items-center mb-6">
            <View className="flex-1 h-px bg-gray-200" />
            <CustomText weight={400} className="px-4 text-sm text-gray-600">or continue with</CustomText>
            <View className="flex-1 h-px bg-gray-200" />
          </View>

          {/* Google Button */}
          <SocialLogin />
          {/* <TouchableOpacity 
            className="w-48 h-14 flex-row items-center justify-center border border-gray-200 rounded-xl py-3 bg-white mx-auto"
            onPress={handleGoogleSignUp}
            disabled={isGoogleLoading}
          >
            {isGoogleLoading ? (
              <ActivityIndicator color="#666" size="small" />
            ) : (
              <>
                <Image 
                  source={require('../../../assets/images/google-logo.png')} 
                  style={{ width: 24, height: 24, marginRight: 12 }}
                  resizeMode="contain"
                />
                <CustomText weight={500} className="text-base text-gray-800 font-medium">Google</CustomText>
              </>
            )}
          </TouchableOpacity> */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SignupScreen;