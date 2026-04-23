import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: '996258236172-49328nk2f3vhe9ejufq125mis22b18n4.apps.googleusercontent.com', 
  offlineAccess: true,
});

// Sign in
export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await auth().signInWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error: any) {
    if (__DEV__) {
      console.error('Firebase auth error:', error.code, error.message);
    }
    // Preserve the original error code and message
    const customError = new Error(error.message);
    (customError as any).code = error.code;
    throw customError;
  }
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
    // Use a generic message for most errors to prevent user enumeration.
    // Only distinguish rate-limiting and clearly invalid input.
    if (error.code === 'auth/invalid-email') {
      throw new Error('Please enter a valid email address.');
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Too many requests. Please try again later.');
    }
    // For 'auth/user-not-found' and other errors, return success so the
    // caller shows the same green toast — attackers cannot enumerate emails.
    return { success: true };
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
