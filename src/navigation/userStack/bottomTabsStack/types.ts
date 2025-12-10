import { NavigatorScreenParams } from '@react-navigation/native';

export type TBottomTabsStackParamsList = {
  HomeTab: NavigatorScreenParams<THomeTabStackParamsList>;
  AssessmentTab: NavigatorScreenParams<TAssessmentTabStackParamsList>;
  ReportTab: NavigatorScreenParams<TReportTabStackParamsList>;
  SupportTab: NavigatorScreenParams<TSupportTabStackParamsList>;
  ProfileTab: NavigatorScreenParams<TProfileTabStackParamsList>;
};

export type THomeTabStackParamsList = {
  Home: undefined;
};

export type TAssessmentTabStackParamsList = {
  Assessment: undefined;
  EyeTrackingAnalysis: undefined;
  TrackingStatusScreen: undefined;
  RecordingScreen: undefined;
  AssessmentProgressScreen: undefined;
  MCQAssessmentScreen: undefined;
  MCQQuestionScreen: undefined;
  AssessmentComplete: undefined;
  AssessmentCompleteScreen: undefined;
  
};

export type TReportTabStackParamsList = {
  Report: undefined;
};

export type TSupportTabStackParamsList = {
  Support: undefined;
};

export type TProfileTabStackParamsList = {
  Profile: undefined;
  EditProfile: undefined;
};