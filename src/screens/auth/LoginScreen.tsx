import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Image } from 'react-native';
import Animated, { 
  FadeInDown, 
  FadeInUp, 
  FadeOut, 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { TAuthStackNavigationProps } from '../../navigation/authStack/types';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import CustomText from '../../components/CustomText';
import AlertModal from '../../components/AlertModal';
import { signIn, signInWithGoogle } from '../../firebase/auth';
import { getUserFromFirestore, createFirestoreDocumentForAuthUser } from '../../firebase/firestore';
import { SocialLogin } from '../../components/SocialLogin';
import { showSuccessToast, showErrorToast, showInfoToast } from '../../utils/toast';
import { debugAuthStatus, listAllFirestoreUsers } from '../../utils/debugAuth';

const LoginScreen: React.FC<TAuthStackNavigationProps<'Login'>> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertModalMessage, setAlertModalMessage] = useState('');
  const { setAuthenticated, setUser } = useAuth();

  // Animation values
  const buttonScale = useSharedValue(1);
  const emailInputBorderWidth = useSharedValue(1);
  const passwordInputBorderWidth = useSharedValue(1);
  const passwordOpacity = useSharedValue(1);

  useEffect(() => {
    // Trigger form animations after component mount
    setIsFormVisible(true);
  }, []);

  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  const animatedEmailInputStyle = useAnimatedStyle(() => {
    return {
      borderWidth: emailInputBorderWidth.value,
      borderColor: emailInputBorderWidth.value === 1 ? 'transparent' : '#3b82f6',
    };
  });

  const animatedPasswordInputStyle = useAnimatedStyle(() => {
    return {
      borderWidth: passwordInputBorderWidth.value,
      borderColor: passwordInputBorderWidth.value === 1 ? 'transparent' : '#3b82f6',
      opacity: passwordOpacity.value,
    };
  });

  const handleLogin = async () => {
  if (!email || !password) {
    showErrorToast('Please fill in all fields to continue.', 'Missing Information');
    return;
  }

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
  
  // Animate password field opacity during loading
  passwordOpacity.value = withTiming(0.7, { duration: 300 });

  try {
    console.log('Attempting login with email:', email);
    const user = await signIn(email, password);
    console.log('Firebase auth successful, user UID:', user.uid);
    
    // Fetch user data from Firestore
    let userData = await getUserFromFirestore(user.uid);
    console.log('Firestore user data:', userData);
    
    // If user doesn't have Firestore document, create one
    if (!userData) {
      console.log('Creating Firestore document for existing Auth user...');
      userData = await createFirestoreDocumentForAuthUser(user.uid, user.email || '', user.displayName || undefined);
      console.log('Created user data:', userData);
      showSuccessToast(`Welcome back! Your profile has been created.`, 'Login Successful');
    } else {
      showSuccessToast(`Welcome back, ${userData?.fullName || user.email}`, 'Login Successful');
    }
    
    setTimeout(() => {
      setAuthenticated(true);
      if (userData) {
        setUser(userData);
      }
    }, 1500);
  } catch (error: any) {
    console.log('Login error:', error.code, error.message);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/user-not-found') {
      showErrorToast('No account found with this email. Please sign up.', 'User Not Found');
    } else if (error.code === 'auth/wrong-password') {
      showErrorToast('Incorrect password. Please try again.', 'Wrong Password');
    } else if (error.code === 'auth/invalid-email') {
      showErrorToast('Invalid email address format.', 'Invalid Email');
    } else if (error.code === 'auth/user-disabled') {
      showErrorToast('This account has been disabled. Contact support.', 'Account Disabled');
    } else if (error.code === 'auth/too-many-requests') {
      showErrorToast('Too many failed attempts. Please try again later.', 'Too Many Requests');
    } else if (error.message && error.message.includes('User document does not exist')) {
      showErrorToast('User profile not found. Please complete your registration.', 'Profile Missing');
    } else {
      showErrorToast(`Login failed: ${error.message || 'Unknown error'}`, 'Login Error');
    }
  } finally {
    setIsLoading(false);
    // Restore password field opacity
    passwordOpacity.value = withTiming(1, { duration: 300 });
  }
};

const handleGoogleSignIn = async () => {
  // Button press animation
  buttonScale.value = withSpring(0.95, { damping: 20, stiffness: 300 });
  setTimeout(() => {
    buttonScale.value = withSpring(1, { damping: 20, stiffness: 300 });
  }, 100);

  setIsGoogleLoading(true);

  try {
    const user = await signInWithGoogle();
    
    // Check if user exists in Firestore
    const userData = await getUserFromFirestore(user.uid);
    
    if (!userData) {
      // User not registered - show error and sign out
      showErrorToast('This Google account is not registered. Please sign up first.', 'Account Not Found');
      
      // Sign out from Firebase Auth to prevent unauthorized access
      import('../../firebase/auth').then(({ signOutUser }) => {
        signOutUser();
      });
      return;
    }
    
    showSuccessToast(`Welcome back, ${userData?.fullName || user.displayName || user.email}`, 'Login Successful');
    
    setTimeout(() => {
      setAuthenticated(true);
      setUser(userData);
    }, 1500);
  } catch (error: any) {
    showErrorToast('Failed to sign in with Google. Please try again.', 'Google Sign-In Failed');
  } finally {
    setIsGoogleLoading(false);
  }
};

// Input focus handlers
const handleEmailFocus = () => {
  emailInputBorderWidth.value = withSpring(2, { damping: 20, stiffness: 300 });
};

const handleEmailBlur = () => {
  emailInputBorderWidth.value = withSpring(1, { damping: 20, stiffness: 300 });
};

const handlePasswordFocus = () => {
  passwordInputBorderWidth.value = withSpring(2, { damping: 20, stiffness: 300 });
};

const handlePasswordBlur = () => {
  passwordInputBorderWidth.value = withSpring(1, { damping: 20, stiffness: 300 });
};

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FA]">
      <ScrollView contentContainerClassName="flex-grow justify-center p-5">
        <View className="w-full max-w-md mx-auto">
          {/* Animated Header */}
          {isFormVisible && (
            <Animated.View entering={FadeInDown.duration(800).springify()}>
              <CustomText weight={700} className="text-4xl font-bold text-center text-gray-900 mb-2">
                Welcome Back
              </CustomText>
              <CustomText weight={400} className="text-base text-center text-gray-600 mb-10">
                Sign in to continue your journey
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
                Email
              </CustomText>
              <Animated.View 
                className="flex-row items-center rounded-xl px-4 bg-gray-50"
                style={animatedEmailInputStyle}
              >
                <Mail size={20} color="#666" className="mr-3" />
                <TextInput
                  className="flex-1 py-2 text-lg text-gray-900"
                  placeholder="Enter your Email"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={handleEmailFocus}
                  onBlur={handleEmailBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#999"
                />
              </Animated.View>
            </Animated.View>

            {/* Password Input */}
            <Animated.View entering={FadeInUp.duration(600).delay(400).springify()}>
              <CustomText weight={500} className="text-base font-medium mb-2 mt-5 text-gray-800">
                Password
              </CustomText>
              <Animated.View 
                className="flex-row items-center rounded-xl px-4 bg-gray-50"
                style={animatedPasswordInputStyle}
              >
                <Lock size={20} color="#666" className="mr-3" />
                <TextInput
                  className="flex-1 py-2 text-lg text-gray-900"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#999"
                  onFocus={handlePasswordFocus}
                  onBlur={handlePasswordBlur}
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
              </Animated.View>
            </Animated.View>

            {/* Forgot Password */}
            <Animated.View entering={FadeInUp.duration(600).delay(500).springify()}>
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} className="self-end mb-6">
                <CustomText weight={500} className="text-sm text-[#4A90E2] font-medium">
                  Forgot Password?
                </CustomText>
              </TouchableOpacity>
            </Animated.View>

            {/* Sign In Button */}
            <Animated.View entering={FadeInUp.duration(600).delay(600).springify()}>
              <Animated.View style={animatedButtonStyle}>
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
              </Animated.View>
            </Animated.View>
            </Animated.View>
          )}

          {/* Sign Up Link */}
          <Animated.View entering={FadeInUp.duration(600).delay(700).springify()}>
            <View className="flex-row justify-center mb-8">
              <CustomText weight={400} className="text-sm text-gray-600">
                Don't have an account?
              </CustomText>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <CustomText weight={500} className="text-sm text-[#4A90E2] font-medium"> Sign Up</CustomText>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Google Sign-In */}
          <Animated.View entering={FadeInUp.duration(600).delay(800).springify()}>
            <Animated.View style={animatedButtonStyle}>
              <TouchableOpacity
                className="w-48 h-14 flex-row items-center justify-center border border-gray-200 rounded-xl py-3 bg-white mx-auto shadow-sm"
                onPress={handleGoogleSignIn}
                disabled={isGoogleLoading}
                activeOpacity={0.7}
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
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default LoginScreen;
