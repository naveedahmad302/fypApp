import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { TProfileTabStackParamsList } from './types';
import ProfileScreen from '../../../screens/user/profile/ProfileScreen';
import EditProfileScreen from '../../../screens/user/profile/EditProfileScreen';
import CustomHeader from '../../../components/CustomHeader';

const Stack = createNativeStackNavigator<TProfileTabStackParamsList>();

const ProfileTabStack: React.FC = () => {
  return (
    // @ts-ignore - React Navigation TypeScript issue with children prop
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: true,
        animation: 'slide_from_right',
        header: () => <CustomHeader title="Profile" />,
      }}
    >
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen}
        options={({ navigation }) => ({
          header: () => (
            <CustomHeader 
              title="Edit Profile" 
              showActionButtons={true}
              onCancel={() => navigation.goBack()}
              onSave={() => {
                // Handle save functionality
                navigation.goBack();
              }}
            />
          ),
        })}
      />
    </Stack.Navigator>
  );
};

export default ProfileTabStack;
