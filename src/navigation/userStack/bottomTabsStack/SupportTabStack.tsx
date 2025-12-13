import React, { useCallback } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { TSupportTabStackParamsList } from './types';
import SupportScreen from '../../../screens/user/support/SupportScreen';
import GroupChatScreen from '../../../screens/user/support/GroupChatScreen';
import CustomHeader from '../../../components/CustomHeader';
import { TouchableOpacity, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';

const Stack = createNativeStackNavigator<TSupportTabStackParamsList>();

const GroupChatWrapper: React.FC<{ route: any }> = ({ route }) => {
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
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
                width: 0,
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

  return <GroupChatScreen route={route} />;
};

const SupportTabStack: React.FC = () => {
  return (
    <Stack.Navigator 
      screenOptions={({ navigation }) => ({
        headerShown: true,
        animation: 'slide_from_right',
        header: ({ options, route }) => {
          if (route.name === 'GroupChat') {
            const { groupName } = route.params as { groupName: string };
            return (
              <CustomHeader 
                title={groupName || 'Group Chat'} 
                headerLeft={
                  <TouchableOpacity 
                    onPress={() => navigation.goBack()}
                    className="p-2 -ml-2"
                  >
                    <ArrowLeft size={24} color="#1F2937" />
                  </TouchableOpacity>
                }
              />
            );
          }
          return <CustomHeader title="Support & Community" />;
        },
      })}
    >
      <Stack.Screen 
        name="Support" 
        component={SupportScreen} 
        options={{ headerShown: true }}
      />
      <Stack.Screen 
        name="GroupChat" 
        component={GroupChatWrapper} 
        options={{ 
          title: 'Parents Support Circle',
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default SupportTabStack;
