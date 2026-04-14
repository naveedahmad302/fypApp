import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// Debug utility to check authentication and Firestore status
export const debugAuthStatus = async () => {
  console.log('=== AUTHENTICATION DEBUG ===');
  
  // Check current Firebase Auth user
  const currentUser = auth().currentUser;
  console.log('Current Firebase Auth user:', currentUser ? {
    uid: currentUser.uid,
    email: currentUser.email,
    emailVerified: currentUser.emailVerified,
    isAnonymous: currentUser.isAnonymous,
    metadata: {
      creationTime: currentUser.metadata.creationTime,
      lastSignInTime: currentUser.metadata.lastSignInTime,
    }
  } : 'No user logged in');
  
  // If user is logged in, check Firestore
  if (currentUser && currentUser.uid) {
    try {
      const doc = await firestore().collection('users').doc(currentUser.uid).get();
      const exists = await doc.exists;
      console.log('Firestore document exists:', exists);
      
      if (exists) {
        const userData = doc.data();
        console.log('Firestore user data:', userData);
        if (!userData) {
          console.log('Document exists but data is undefined - this is the issue!');
        }
      } else {
        console.log('No Firestore document found for this user');
        console.log('This is likely the cause of the login issue!');
        console.log('User UID that needs Firestore document:', currentUser.uid);
      }
    } catch (error: any) {
      console.error('Error checking Firestore:', error);
    }
  }
  
  console.log('=== END DEBUG ===');
};

// Utility to list all users in Firestore (for debugging only)
export const listAllFirestoreUsers = async () => {
  try {
    console.log('=== LISTING ALL FIRESTORE USERS ===');
    const snapshot = await firestore().collection('users').get();
    
    if (snapshot.empty) {
      console.log('No users found in Firestore');
    } else {
      snapshot.forEach((doc) => {
        console.log(`User: ${doc.id}`, doc.data());
      });
    }
    
    console.log('=== END LIST ===');
  } catch (error: any) {
    console.error('Error listing users:', error);
  }
};
