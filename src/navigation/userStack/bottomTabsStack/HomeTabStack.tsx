import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../../../screens/user/home/HomeScreen';
import AssessmentScreen from '../../../screens/user/assessment/AssessmentScreen';
import { useAuth } from '../../../context/AuthContext';
import CustomHeader from '../../../components/CustomHeader';

import { THomeTabStackParamsList } from './types';

const Stack = createNativeStackNavigator<THomeTabStackParamsList>();

const HomeTabStack: React.FC = () => {
  const { user } = useAuth();

  const getGreetingTitle = () => {
    if (user?.name) {
      return `Hello, ${user.name}`;
    }
    return 'Hello';
  };

  return (
    // @ts-ignore - React Navigation TypeScript issue with children prop
    <Stack.Navigator
      initialRouteName="Hello"
      screenOptions={{
        headerShown: true,
        animation: 'slide_from_right',
        header: () => <CustomHeader title={getGreetingTitle()} />,
      }}
    >
      <Stack.Screen name="Hello" component={HomeScreen as any} />
      <Stack.Screen name="Assessment" component={AssessmentScreen} />
      
    </Stack.Navigator>
  );
};

export default HomeTabStack;
