import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TReportTabStackParamsList } from './types';
import ReportScreen from '../../../screens/user/report/ReportScreen';

const Stack = createNativeStackNavigator<TReportTabStackParamsList>();

const ReportTabStack: React.FC = () => {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: true,
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen 
        name="Analysis Reports" 
        component={ReportScreen}
        options={{
          title: 'Analysis Reports',
        }}
      />
    </Stack.Navigator>
  );
};

export default ReportTabStack;
