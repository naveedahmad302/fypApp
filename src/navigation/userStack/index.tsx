import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomTabsStack } from './bottomTabsStack';
import { TUserStackParamsList } from './types';

const Stack = createNativeStackNavigator<TUserStackParamsList>();

const UserStack: React.FC = () => {

  return (
    <Stack.Navigator
      initialRouteName={'BottomTabsStack'}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="BottomTabsStack" component={BottomTabsStack} />
    </Stack.Navigator>
  );
};

export default UserStack;
