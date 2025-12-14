import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: '996258236172-49328nk2f3vhe9ejufq125mis22b18n4.apps.googleusercontent.com', 
  offlineAccess: true,
});

// Sign in
export const signIn = async (email: string, password: string) => {
  const userCredential = await auth().signInWithEmailAndPassword(email, password);
  return userCredential.user;
};

// Sign up with email & password
export const signUp = async (email: string, password: string) => {
  try {
    const userCredential = await auth().createUserWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error: any) {
    // Preserve the original error code and message
    const customError = new Error(error.message);
    (customError as any).code = error.code;
    throw customError;
  }
};

// Sign out
export const signOutUser = async () => {
  try {
    await auth().signOut();
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (email: string) => {
  try {
    await auth().sendPasswordResetEmail(email);
    return { success: true };
  } catch (error: any) {
    let errorMessage = 'Failed to send reset email. Please try again.';
    
    switch (error.code) {
      case 'auth/invalid-email':
        errorMessage = 'The email address is not valid.';
        break;
      case 'auth/user-not-found':
        errorMessage = 'No user found with this email address.';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many requests. Please try again later.';
        break;
    }
    
    throw new Error(errorMessage);
  }
};

// Google Sign-In
export const signInWithGoogle = async () => {
  try {
    // Check if device supports Google Play Services
    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });

    // Get user info from Google
    const userInfo = await GoogleSignin.signIn();

    // Create Google credential with Firebase
    const googleCredential = auth.GoogleAuthProvider.credential(userInfo.data?.idToken || '');

    // Sign in with Firebase
    const userCredential = await auth().signInWithCredential(googleCredential);
    return userCredential.user;
  } catch (error: any) {
    // Preserve the original error code and message
    const customError = new Error(error.message);
    (customError as any).code = error.code;
    throw customError;
  }
};
