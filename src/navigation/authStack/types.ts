import { NativeStackScreenProps } from '@react-navigation/native-stack';

// Authentication Stack Navigator Types
export type TAuthStackParamsList = {
  
  Splash: undefined;
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  
  
};

export type TAuthStackNavigationProps<T extends keyof TAuthStackParamsList> =
  NativeStackScreenProps<TAuthStackParamsList, T>;
