import React, { createContext, useContext, useState, ReactNode } from 'react';
import { IUser } from '../firebase/firestore';

interface AuthContextType {
  isAuthenticated: boolean;
  setAuthenticated: (value: boolean) => void;
  user: IUser | null;
  setUser: (user: IUser | null) => void;
  updateUserProfile: (userData: Partial<IUser>) => void;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<IUser | null>(null);

  const updateUserProfile = (userData: Partial<IUser>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
    }
  };

  const refreshUserData = async () => {
    if (user?.uid) {
      try {
        const { getUserFromFirestore } = await import('../firebase/firestore');
        const freshUserData = await getUserFromFirestore(user.uid);
        if (freshUserData) {
          setUser(freshUserData);
        }
      } catch (error) {
        console.error('Failed to refresh user data:', error);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, setAuthenticated, user, setUser, updateUserProfile, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
};
