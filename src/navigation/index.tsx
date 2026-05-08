import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
//
import AuthStack from './authStack';
import UserStack from './userStack';
import { AuthProvider, useAuth } from '../context/AuthContext';
//
import { INavigationProps } from './types';

/**
 * Splash shown while Firebase resolves the persisted session on cold
 * start. Without it we'd flash the AuthStack for one frame for users
 * who are already signed in, which looked like an unwanted logout.
 */
const AuthSplash = () => (
  <View
    style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F9FAFB',
    }}
  >
    <ActivityIndicator size="large" color="#4A90E2" />
  </View>
);

const NavigationContent = ({ navigationRef, routeNameRef }: INavigationProps) => {
  const { isAuthenticated, isAuthInitialized } = useAuth();

  const onReady = () => {
    routeNameRef.current = navigationRef?.current?.getCurrentRoute()
      ?.name as any;
  };

  if (!isAuthInitialized) {
    return <AuthSplash />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => onReady()}
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: 'transparent',
        },
      }}
      onStateChange={() => {
        const currentRouteName =
          navigationRef?.current?.getCurrentRoute()?.name;
        routeNameRef.current = currentRouteName as any;
      }}
    >
      {isAuthenticated ? <UserStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

const Navigation = ({ navigationRef, routeNameRef }: INavigationProps) => {
  return (
    <AuthProvider>
      <NavigationContent navigationRef={navigationRef} routeNameRef={routeNameRef} />
    </AuthProvider>
  );
};

export default Navigation;
