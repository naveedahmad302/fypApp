import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TReportTabStackParamsList } from './types';
import ReportScreen from '../../../screens/user/report/ReportScreen';
import CustomHeader from '../../../components/CustomHeader';

const Stack = createNativeStackNavigator<TReportTabStackParamsList>();

const ReportTabStack: React.FC = () => {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: true,
        animation: 'slide_from_right',
        header: () => <CustomHeader title="Analysis Reports" />,
      }}
    >
      <Stack.Screen 
        name="Report" 
        component={ReportScreen}
      />
    </Stack.Navigator>
  );
};

export default ReportTabStack;
