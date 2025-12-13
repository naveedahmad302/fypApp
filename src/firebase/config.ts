import { App } from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';

export const initializeFirebase = async () => {
  try {
    // Check if Firebase is already initialized
    if (!App.apps.length) {
      await App.initializeApp();
      console.log('Firebase initialized successfully');
    }
    return true;
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    return false;
  }
};

// Initialize Firebase when this module is imported
initializeFirebase().then(initialized => {
  if (initialized) {
    console.log('Firebase is ready to use');
  } else {
    console.error('Failed to initialize Firebase');
  }
});

export { auth };
// Re-export other Firebase services you're using
export { firestore } from '@react-native-firebase/firestore';
