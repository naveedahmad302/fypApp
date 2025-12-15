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
    if (!doc.exists) return null;
    return doc.data() as IUser;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Update user data in Firestore
export const updateUserInFirestore = async (uid: string, userData: Partial<IUser>) => {
  try {
    console.log('Attempting to update user:', uid, 'with data:', userData);
    
    // Check if document exists first
    const docRef = firestore().collection('users').doc(uid);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw new Error('User document does not exist');
    }
    
    await docRef.update(userData);
    console.log('User data updated successfully');
  } catch (error: any) {
    console.error('Firestore update error:', error);
    throw new Error(error.message || 'Failed to update user data');
  }
};
