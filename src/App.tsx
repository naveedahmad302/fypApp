/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import '../global.css'; 
import { StatusBar, StyleSheet, useColorScheme, View, Text } from 'react-native';
import { Toast } from 'react-native-toast-message/lib/src/Toast';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import Navigation from './navigation';
import { NavigationContainerRef } from '@react-navigation/native';
import { useRef } from 'react';
import { TRouteNameRef, TRootParamsList } from './navigation/types';
import { FONTS } from './theme/fonts';
// import { GestureHandlerRootView } from 'react-native-gesture-handler';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const navigationRef = useRef<NavigationContainerRef<TRootParamsList>>(null);
  const routeNameRef = useRef<keyof TRouteNameRef>('BottomTabsStack');

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={styles.container} className="">
        {/* <GestureHandlerRootView> */}
          <Navigation navigationRef={navigationRef as any} routeNameRef={routeNameRef} />
          <Toast />
        {/* </GestureHandlerRootView> */}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Set default font family for the entire app
  text: {
    fontFamily: FONTS.radioCanada[400],
  },
});

export default App;
