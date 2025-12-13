import auth from '@react-native-firebase/auth';

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
    throw new Error(error.message);
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
