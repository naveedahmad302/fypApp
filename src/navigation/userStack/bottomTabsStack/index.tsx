import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeTabStack from './HomeTabStack';
import ReportTabStack from './ReportTabStack';
import AssessmentStack from './AssessmentStack';
import SupportTabStack from './SupportTabStack';
import ProfileTabStack from './ProfileTabStack';
import { TBottomTabsStackParamsList } from './types';
import { windowWidth } from '../../../utils';
import { Home, FileText, BarChart2, HelpCircle, User } from 'lucide-react-native';

const Tab = createBottomTabNavigator<TBottomTabsStackParamsList>();

// Tab icon components defined outside render
const HomeIcon = ({ color }: { color: string; size: number }) => (
  <Home color={color} />
);
const ReportIcon = ({ color }: { color: string; size: number }) => (
  <FileText color={color} />
);
const AssessmentIcon = ({ color }: { color: string; size: number }) => (
  <BarChart2 color={color} />
);
const SupportIcon = ({ color }: { color: string; size: number }) => (
  <HelpCircle color={color} />
);
const ProfileIcon = ({ color }: { color: string; size: number }) => (
  <User color={color} />
);

const BOTTOM_TAB_HEIGHT = 75;
export const tabBarStyle = {
  backgroundColor: 'white',
  height: BOTTOM_TAB_HEIGHT,
  paddingTop: 8,
  paddingBottom: 8,
  shadowColor: '#3EB7FF',
  // borderTopLeftRadius: 20,
  // borderTopRightRadius: 20,
  paddingHorizontal: 0,
  // Shadow
  shadowOffset: {
    width: 0,
    height: 4,  
  },
  shadowOpacity: 0.44,
  shadowRadius: 16,
  elevation: 8,
};

export const BottomTabsStack: React.FC = () => {
  return (
    // @ts-ignore - React Navigation TypeScript issue with children prop
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        headerShown: false,
        headerStyle: {
          backgroundColor: 'white',
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
          color: '#1F2937',
          textAlign: 'center',
          alignSelf: 'center',
        },
        tabBarActiveTintColor: '#3EB7FF',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: tabBarStyle,
        tabBarShowLabel: true,
        tabBarIconStyle: {
          height: 24,
          width: 24,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'System',
          marginTop: 3,
          marginBottom: 3,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeTabStack}
        options={{
          tabBarIcon: HomeIcon,
          tabBarLabel: 'Hello',
          title: 'Hello',
        }}
      />
      <Tab.Screen
        name="ReportTab"
        component={ReportTabStack}
        options={{
          tabBarIcon: ReportIcon,
          tabBarLabel: 'Report',
          title: 'Report',
        }}
      />
      <Tab.Screen
        name="AssessmentTab"
        component={AssessmentStack}
        options={{
          tabBarIcon: AssessmentIcon,
          tabBarLabel: 'Assessment',
          title: 'Assessment',
        }}
      />
      <Tab.Screen
        name="SupportTab"
        component={SupportTabStack}
        options={{
          tabBarIcon: SupportIcon,
          tabBarLabel: 'Support',
          title: 'Support',
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileTabStack}
        options={{
          tabBarIcon: ProfileIcon,
          tabBarLabel: 'Profile',
          title: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};
