import { NativeStackScreenProps } from '@react-navigation/native-stack';

// Authentication Stack Navigator Types
export type TAuthStackParamsList = {
  Splash: undefined;
  Welcome: undefined;
  Login: { email?: string; message?: string };
  Signup: undefined;
  ForgotPassword: undefined;
};

export type TAuthStackNavigationProps<T extends keyof TAuthStackParamsList> =
  NativeStackScreenProps<TAuthStackParamsList, T>;
