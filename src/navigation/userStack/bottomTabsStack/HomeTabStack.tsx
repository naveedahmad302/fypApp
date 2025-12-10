import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../../../screens/user/home/HomeScreen';
import AssessmentScreen from '../../../screens/user/assessment/AssessmentScreen';


import { THomeTabStackParamsList } from './types';

const Stack = createNativeStackNavigator<THomeTabStackParamsList>();

const HomeTabStack: React.FC = () => {
  return (
    // @ts-ignore - React Navigation TypeScript issue with children prop
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: true,
        animation: 'slide_from_right',
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Assessment" component={AssessmentScreen} />
      
    </Stack.Navigator>
  );
};

export default HomeTabStack;
