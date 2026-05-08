/**
 * Auth state is owned by Firebase, not by React.
 *
 * Why a Firebase-driven listener rather than `useState(false)`:
 *
 *   * The previous implementation stored "logged in" purely in React
 *     local state, so a token revoked server-side (account disabled,
 *     security rotation, deleted user) was never reflected in the UI
 *     — the app stayed "logged in" until the user manually pressed
 *     Sign Out. With `auth().onAuthStateChanged` we react immediately
 *     when Firebase decides the session is no longer valid.
 *   * Token refresh is now driven by Firebase itself; we just listen
 *     for the resulting auth-state changes and re-fetch the Firestore
 *     profile when the UID changes.
 *   * Hot reload / app re-mount no longer drops the user back to the
 *     login screen — Firebase persists the session across restarts and
 *     the listener restores it on mount.
 *
 * The legacy `setAuthenticated(value)` and `setUser(user)` setters are
 * kept for backwards compatibility with the existing screens, but they
 * are now thin wrappers around the listener-driven state. Tests / older
 * call sites that expect to be able to flip `isAuthenticated = false`
 * still work; the next listener tick reconciles with the real Firebase
 * truth.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import auth, {
  FirebaseAuthTypes,
} from '@react-native-firebase/auth';

import {
  getUserFromFirestore,
  IUser,
  recordLoginInFirestore,
} from '../firebase/firestore';

interface AuthContextType {
  /** True once Firebase has replied with the persisted session state. */
  isAuthInitialized: boolean;
  isAuthenticated: boolean;
  user: IUser | null;
  /**
   * Force the local "authenticated" flag without going through
   * Firebase. Kept for legacy call sites; prefer `signOut` / explicit
   * Firebase methods.
   */
  setAuthenticated: (value: boolean) => void;
  /**
   * Replace the in-memory profile snapshot. Useful after writes to the
   * profile document so the UI updates without a Firestore round-trip.
   */
  setUser: (user: IUser | null) => void;
  updateUserProfile: (userData: Partial<IUser>) => void;
  refreshUserData: () => Promise<void>;
  /**
   * Sign the user out cleanly. Triggers the auth-state listener which
   * clears `user` and flips `isAuthenticated` to false.
   */
  signOut: () => Promise<void>;
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
  const [firebaseUser, setFirebaseUser] =
    useState<FirebaseAuthTypes.User | null>(null);
  const [user, setUser] = useState<IUser | null>(null);
  const [isAuthInitialized, setIsAuthInitialized] = useState(false);
  // We use a ref alongside state so the listener can drive synchronous
  // overrides (e.g. legacy setAuthenticated(false)) without racing the
  // next render.
  const localAuthOverride = useRef<boolean | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Keep Firestore profile fresh as the Firebase user changes.
  useEffect(() => {
    let cancelled = false;

    async function loadProfile(uid: string) {
      try {
        const data = await getUserFromFirestore(uid);
        if (!cancelled) setUser(data ?? null);
        // Best-effort lastLogin stamp. Failures are logged but never
        // block the login flow — losing the timestamp is preferable to
        // refusing the session.
        recordLoginInFirestore(uid).catch((error) => {
          console.warn('lastLogin write failed:', error);
        });
      } catch (error) {
        console.error('Profile load failed:', error);
        if (!cancelled) setUser(null);
      }
    }

    if (firebaseUser?.uid) {
      loadProfile(firebaseUser.uid);
    } else {
      setUser(null);
    }

    return () => {
      cancelled = true;
    };
  }, [firebaseUser?.uid]);

  // Single source of truth for auth state — Firebase itself.
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((next) => {
      setFirebaseUser(next);
      // Drop any local override once Firebase speaks; its truth wins.
      localAuthOverride.current = null;
      setIsAuthenticated(Boolean(next));
      setIsAuthInitialized(true);
    });
    return unsubscribe;
  }, []);

  // Also re-fetch the profile whenever the ID token rotates, in case
  // custom claims (e.g. role) changed server-side.
  useEffect(() => {
    const unsubscribe = auth().onIdTokenChanged((next) => {
      if (next?.uid && next.uid !== firebaseUser?.uid) {
        setFirebaseUser(next);
      }
    });
    return unsubscribe;
  }, [firebaseUser?.uid]);

  const updateUserProfile = useCallback((userData: Partial<IUser>) => {
    setUser((current) => (current ? { ...current, ...userData } : current));
  }, []);

  const refreshUserData = useCallback(async () => {
    if (!firebaseUser?.uid) return;
    try {
      const fresh = await getUserFromFirestore(firebaseUser.uid);
      if (fresh) setUser(fresh);
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  }, [firebaseUser?.uid]);

  const signOut = useCallback(async () => {
    try {
      await auth().signOut();
    } catch (error) {
      console.error('signOut failed:', error);
      // Ensure UI returns to logged-out even if Firebase itself errored.
      localAuthOverride.current = false;
      setIsAuthenticated(false);
      setUser(null);
    }
  }, []);

  const setAuthenticatedCompat = useCallback((value: boolean) => {
    // Legacy setter used by old screens. We honour it for the current
    // tick but expect the auth-state listener to reconcile shortly.
    localAuthOverride.current = value;
    setIsAuthenticated(value);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      isAuthInitialized,
      isAuthenticated,
      user,
      setAuthenticated: setAuthenticatedCompat,
      setUser,
      updateUserProfile,
      refreshUserData,
      signOut,
    }),
    [
      isAuthInitialized,
      isAuthenticated,
      user,
      setAuthenticatedCompat,
      updateUserProfile,
      refreshUserData,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
