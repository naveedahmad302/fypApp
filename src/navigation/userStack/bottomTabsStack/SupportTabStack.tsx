import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TSupportTabStackParamsList } from './types';
import SupportScreen from '../../../screens/user/support/SupportScreen';

const Stack = createNativeStackNavigator<TSupportTabStackParamsList>();

const SupportTabStack: React.FC = () => {
  return (
    // @ts-ignore - React Navigation TypeScript issue with children prop
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="Support" component={SupportScreen} />
    </Stack.Navigator>
  );
};

export default SupportTabStack;
