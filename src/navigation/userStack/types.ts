import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  TBottomTabsStackParamsList,
  THomeTabStackParamsList,
  TAssessmentTabStackParamsList,
  TReportTabStackParamsList,
  TProfileTabStackParamsList  
} from './bottomTabsStack/types';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';

// User Stack Navigator Types
export type TUserStackParamsList = {
  Welcome: undefined;
  BottomTabsStack: NavigatorScreenParams<TBottomTabsStackParamsList>;
};

export type TUserStackNavigationProps<T extends keyof TUserStackParamsList> =
  NativeStackScreenProps<TUserStackParamsList, T>;

export type BottomBarStackNavigationProps<
  T extends keyof TBottomTabsStackParamsList,
> = CompositeScreenProps<
  BottomTabScreenProps<TBottomTabsStackParamsList, T>,
  NativeStackScreenProps<TUserStackParamsList, 'BottomTabsStack'>
>;

export type THomeTabStackNavigationProps<
  T extends keyof THomeTabStackParamsList,
> = CompositeScreenProps<
  NativeStackScreenProps<THomeTabStackParamsList, T>,
  CompositeScreenProps<
    BottomTabScreenProps<TBottomTabsStackParamsList>,
    NativeStackScreenProps<TUserStackParamsList, 'BottomTabsStack'>
  >
>;

export type TReportTabStackNavigationProps<
  T extends keyof TReportTabStackParamsList,
> = CompositeScreenProps<
  NativeStackScreenProps<TReportTabStackParamsList, T>,
  CompositeScreenProps<
    BottomTabScreenProps<TBottomTabsStackParamsList>,
    NativeStackScreenProps<TUserStackParamsList, 'BottomTabsStack'>
  >
>;

export type TAssessmentTabStackNavigationProps<
  T extends keyof TAssessmentTabStackParamsList,
> = CompositeScreenProps<
  NativeStackScreenProps<TAssessmentTabStackParamsList, T>,
  CompositeScreenProps<
    BottomTabScreenProps<TBottomTabsStackParamsList>,
    NativeStackScreenProps<TUserStackParamsList, 'BottomTabsStack'>
  >
>;

export type TProfileStackNavigationProps<
  T extends keyof TProfileTabStackParamsList,
> = CompositeScreenProps<
  NativeStackScreenProps<TProfileTabStackParamsList, T>,
  CompositeScreenProps<
    BottomTabScreenProps<TBottomTabsStackParamsList>,
    NativeStackScreenProps<TUserStackParamsList, 'BottomTabsStack'>
  >
>;
