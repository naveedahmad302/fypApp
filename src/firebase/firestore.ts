import firestore from '@react-native-firebase/firestore';

export interface IUser {
  uid: string;
  email: string;
  fullName: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
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
