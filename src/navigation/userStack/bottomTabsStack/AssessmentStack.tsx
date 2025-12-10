import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TAssessmentTabStackParamsList } from './types';
import AssessmentScreen from '../../../screens/user/assessment/AssessmentScreen';
import EyeTrackingAnalysisScreen from '../../../screens/user/assessment/EyeTrackingAnalysisScreen';
import TrackingStatusScreen from '../../../screens/user/assessment/TrackingStatusScreen';
import RecordingScreen from '../../../screens/user/assessment/RecordingScreen';
import AssessmentProgressScreen from '../../../screens/user/assessment/AssessmentProgressScreen';
import MCQAssessmentScreen from '../../../screens/user/assessment/MCQAssessmentScreen';
import MCQQuestionScreen from '../../../screens/user/assessment/MCQQuestionScreen';
import AssessmentCompleteScreen from '../../../screens/user/assessment/AssessmentCompleteScreen';

const Stack = createNativeStackNavigator<TAssessmentTabStackParamsList>();

const AssessmentStack: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="Assessment" component={AssessmentScreen} />
      <Stack.Screen name="EyeTrackingAnalysis" component={EyeTrackingAnalysisScreen} />
      <Stack.Screen name="TrackingStatusScreen" component={TrackingStatusScreen} />
      <Stack.Screen name="RecordingScreen" component={RecordingScreen} />
      <Stack.Screen name="AssessmentProgressScreen" component={AssessmentProgressScreen} />
      <Stack.Screen name="MCQAssessmentScreen" component={MCQAssessmentScreen} />
      <Stack.Screen name="MCQQuestionScreen" component={MCQQuestionScreen} />
      <Stack.Screen name="AssessmentCompleteScreen" component={AssessmentCompleteScreen} />
      <Stack.Screen name="AssessmentComplete" component={MCQAssessmentScreen} />
    </Stack.Navigator>
  );
};

export default AssessmentStack;
