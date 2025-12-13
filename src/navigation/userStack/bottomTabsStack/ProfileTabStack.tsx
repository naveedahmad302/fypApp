import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { TProfileTabStackParamsList } from './types';
import ProfileScreen from '../../../screens/user/profile/ProfileScreen';
import EditProfileScreen from '../../../screens/user/profile/EditProfileScreen';
import CustomHeader from '../../../components/CustomHeader';

const Stack = createNativeStackNavigator<TProfileTabStackParamsList>();

const EditProfileWrapper: React.FC = () => {
  const navigation = useNavigation();

  useFocusEffect(
    React.useCallback(() => {
      const parent = navigation.getParent();
      if (parent) {
        parent.setOptions({
          tabBarStyle: { display: 'none' }
        });
      }

      return () => {
        if (parent) {
          parent.setOptions({
            tabBarStyle: {
              backgroundColor: 'white',
              height: 75,
              paddingTop: 8,
              paddingBottom: 8,
              shadowColor: '#3EB7FF',
              shadowOffset: {
                width:  0,
                height: 4,  
              },
              shadowOpacity: 0.44,
              shadowRadius: 16,
              elevation: 8,
              paddingHorizontal: 0,
            }
          });
        }
      };
    }, [navigation])
  );

  return <EditProfileScreen />;
};

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
        component={EditProfileWrapper}
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
