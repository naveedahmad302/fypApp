import firestore from '@react-native-firebase/firestore';
import { Timestamp } from '@react-native-firebase/firestore';

export interface IUser {
  uid: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  location?: string;
  profileImage?: string;
  showToCommunity?: boolean;
  showActivity?: boolean;
  createdAt: Timestamp;
}

// Save user data in Firestore
export const saveUserToFirestore = async (uid: string, email: string, fullName: string) => {
  try {
    await firestore().collection('users').doc(uid).set({
      uid,
      email,
      fullName,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Fetch user data from Firestore
export const getUserFromFirestore = async (uid: string) => {
  try {
    const doc = await firestore().collection('users').doc(uid).get();
    const exists = doc.exists;
    
    if (!exists) {
      return null;
    }
    
    const userData = doc.data() as IUser;
    return userData;
  } catch (error: any) {
    if (__DEV__) {
      console.error('Firestore error:', error);
    }
    throw new Error(`Failed to fetch user data: ${error.message}`);
  }
};

// Create Firestore document for existing Auth user
export const createFirestoreDocumentForAuthUser = async (uid: string, email: string, displayName?: string) => {
  try {
    await firestore().collection('users').doc(uid).set({
      uid,
      email,
      fullName: displayName || email.split('@')[0], // Use part before @ as default name
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    
    // Return the created user data
    return await getUserFromFirestore(uid);
  } catch (error: any) {
    if (__DEV__) {
      console.error('Error creating Firestore document:', error);
    }
    throw new Error(`Failed to create user profile: ${error.message}`);
  }
};

// Update user data in Firestore
export const updateUserInFirestore = async (uid: string, userData: Partial<IUser>) => {
  try {
    
    // Check if document exists first
    const docRef = firestore().collection('users').doc(uid);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw new Error('User document does not exist');
    }
    
    await docRef.update(userData);
  } catch (error: any) {
    if (__DEV__) {
      console.error('Firestore update error:', error);
    }
    throw new Error(error.message || 'Failed to update user data');
  }
};
