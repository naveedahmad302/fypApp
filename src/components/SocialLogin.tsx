import { View, TouchableOpacity, Text, ActivityIndicator, Image } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import {
  GoogleAuthProvider,
  getAuth,
  signInWithCredential,
} from '@react-native-firebase/auth';

import { signIn, signInWithGoogle } from '../firebase/auth';
import { getUserFromFirestore, saveUserToFirestore } from '../firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { showSuccessToast, showErrorToast } from '../utils/toast';

export const SocialLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { setAuthenticated, setUser } = useAuth();

  // Configure Google Sign-In
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '996258236172-49328nk2f3vhe9ejufq125mis22b18n4.apps.googleusercontent.com',
      offlineAccess: true,
    });
  }, []);

  const googleSignIn = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      // Check if Play Services is available
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      
      // Check if user is already signed in
      await GoogleSignin.signOut();
      
      // Sign in
      const userInfo = await GoogleSignin.signIn();
      
      // Create a Google credential with the token
      const googleCredential = GoogleAuthProvider.credential(userInfo.data?.idToken);
      
      // Sign-in the user with the credential
      const res = await signInWithCredential(getAuth(), googleCredential);

      // Check if user exists in Firestore
      const userData = await getUserFromFirestore(res?.user.uid);
      
      if (userData) {
        // User already exists, log them in
        showSuccessToast(`Welcome back, ${userData?.fullName}`, 'Login Successful')
        setTimeout(() => {
          setAuthenticated(true);
          setUser({
            name: userData.fullName,
            email: userData.email,
            uid: userData.uid
          });
        }, 1500);
      } else {
        // User doesn't exist, show error and redirect to signup
        showErrorToast('Account not found. Please sign up first.', 'Login Failed');
      }
      
      // Handle successful sign-in (update your app state, navigate, etc.)
      
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled the login flow
        showErrorToast('Sign in was cancelled', 'Login Cancelled');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // Operation (e.g., sign in) is in progress already
        showErrorToast('Sign in already in progress', 'Please wait');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        // Play services not available or outdated
        showErrorToast('Google Play Services not available or outdated', 'Error');
      } else {
        // Some other error happened
        showErrorToast('Failed to sign in with Google', 'Error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  return (
    <View className="flex-1 justify-center items-center mt-8 mb-10">
      <TouchableOpacity
        onPress={googleSignIn}
        disabled={isLoading}
        activeOpacity={0.7}
        className="p-4 w-1/2 bg-white border border-gray-200 rounded-2xl flex-row items-center justify-center"
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#000" />
        ) : (
          <>
            <Image 
              source={require('../../assets/images/google-logo.png')} 
              className="w-7 h-7 mr-2"
              resizeMode="contain"
            />
            <Text className="text-gray-800">
              Google
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};