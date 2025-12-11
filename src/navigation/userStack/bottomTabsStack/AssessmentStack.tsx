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
import CustomHeader from '../../../components/CustomHeader';

const Stack = createNativeStackNavigator<TAssessmentTabStackParamsList>();

const AssessmentStack: React.FC = () => {
  const getHeaderTitle = (route: any) => {
    const routeName = route.name;
    
    switch (routeName) {
      case 'Assessment':
        return 'Assessment Journey';
      case 'EyeTrackingAnalysis':
        return 'Eye Tracking';
      case 'TrackingStatusScreen':
        return 'Eye Tracking';
      case 'RecordingScreen':
        return 'Speech Analysis';
      case 'AssessmentProgressScreen':
        return 'Assessment Progress';
      case 'MCQAssessmentScreen':
        return 'MCQ Assessment';
      case 'MCQQuestionScreen':
        return 'MCQ Questions';
      case 'AssessmentCompleteScreen':
        return 'Assessment Complete';
      case 'AssessmentComplete':
        return 'Assessment Complete';
      default:
        return 'Assessment';
    }
  };

  const shouldShowBackButton = (routeName: string) => {
    return routeName !== 'Assessment';
  };

  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: true,
        animation: 'slide_from_right',
        header: ({ route }) => (
          <CustomHeader 
            title={getHeaderTitle(route)} 
            showBackButton={shouldShowBackButton(route.name)} 
          />
        ),
      }}
    >
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
