import { RefObject } from 'react';
import { TAuthStackParamsList } from './authStack/types';
import { TUserStackParamsList } from './userStack/types';
import { NavigationContainerRef } from '@react-navigation/native';
import {
  TBottomTabsStackParamsList,
  THomeTabStackParamsList,
  TAssessmentTabStackParamsList,
  TReportTabStackParamsList,
  TProfileTabStackParamsList
} from './userStack/bottomTabsStack/types';

export type TRootParamsList = TAuthStackParamsList & TUserStackParamsList;
export type TRouteNameRef = TAuthStackParamsList &
  TUserStackParamsList &
  TBottomTabsStackParamsList &
  THomeTabStackParamsList &
  TAssessmentTabStackParamsList &
  TReportTabStackParamsList &
  TProfileTabStackParamsList;

export interface INavigationProps {
  navigationRef: RefObject<NavigationContainerRef<TRootParamsList>> | null;
  routeNameRef: RefObject<keyof TRouteNameRef>;
}
