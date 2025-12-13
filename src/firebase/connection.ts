import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

export interface ConnectionStatus {
  isConnected: boolean;
  auth: boolean;
  firestore: boolean;
  error?: string;
}

export const checkFirebaseConnection = async (): Promise<ConnectionStatus> => {
  const status: ConnectionStatus = {
    isConnected: false,
    auth: false,
    firestore: false,
  };

  try {
    // Test Auth connection
    try {
      // Simply try to access the auth module
      const currentUser = auth().currentUser;
      status.auth = true;
    } catch (authError: any) {
      console.error('Auth connection error:', authError);
      status.auth = false;
    }

    // Test Firestore connection
    try {
      // Try a simple read operation to test connectivity
      await firestore().collection('connection_test').limit(1).get();
      status.firestore = true;
    } catch (firestoreError: any) {
      console.error('Firestore connection error:', firestoreError);
      status.firestore = false;
    }

    // Overall connection status
    status.isConnected = status.auth && status.firestore;

    return status;
  } catch (error: any) {
    console.error('Firebase connection check failed:', error);
    status.error = error.message;
    return status;
  }
};

export const testFirebaseWrite = async (): Promise<boolean> => {
  try {
    const testDoc = {
      test: true,
      timestamp: firestore.FieldValue.serverTimestamp(),
    };
    
    await firestore().collection('connection_test').doc('test').set(testDoc);
    
    // Clean up test document
    await firestore().collection('connection_test').doc('test').delete();
    
    return true;
  } catch (error: any) {
    console.error('Firebase write test failed:', error);
    return false;
  }
};
