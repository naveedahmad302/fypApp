import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
//
import AuthStack from './authStack';
import UserStack from './userStack';
import { AuthProvider, useAuth } from '../context/AuthContext';
//
import { INavigationProps } from './types';

const NavigationContent = ({ navigationRef, routeNameRef }: INavigationProps) => {
  // hooks
  const { isAuthenticated } = useAuth();

  const onReady = () => {
    routeNameRef.current = navigationRef?.current?.getCurrentRoute()
      ?.name as any;
  };

  // return
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
