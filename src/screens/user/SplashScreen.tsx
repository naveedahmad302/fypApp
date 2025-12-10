import React, { useEffect, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TAuthStackNavigationProps } from '../../navigation/authStack/types';
import { Heart } from 'lucide-react-native';

const SplashScreen: React.FC<TAuthStackNavigationProps<'Splash'>> = ({ navigation }) => {
  const [dot1Opacity] = useState(new Animated.Value(0.3));
  const [dot2Opacity] = useState(new Animated.Value(0.3));
  const [dot3Opacity] = useState(new Animated.Value(0.3));

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Welcome');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation]);

  useEffect(() => {
    const animateDots = () => {
      // Animate dot 1
      Animated.sequence([
        Animated.timing(dot1Opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(dot1Opacity, {
          toValue: 0.3,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Animate dot 2 (delayed)
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(dot2Opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot2Opacity, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }, 300);

      // Animate dot 3 (delayed)
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(dot3Opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot3Opacity, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }, 600);
    };

    // Start animation immediately and repeat
    animateDots();
    const interval = setInterval(animateDots, 1200);

    return () => clearInterval(interval);
  }, [dot1Opacity, dot2Opacity, dot3Opacity]);

  return (
    <SafeAreaView className="flex-1 bg-[#4A90E2] items-center justify-center">
      {/* Logo Circle */}
      <View className="w-24 h-24 bg-white rounded-full items-center justify-center mb-8 shadow-lg">
        <Heart size={48} color="#3B82F6" strokeWidth={2} />
      </View>

      {/* Title */}
      <Text className="text-4xl font-bold text-white w-4/5 text-center mb-3">
        Autism Spectrum Detection
      </Text>

      {/* Subtitle */}
      <Text className="text-lg text-white text-center mb-16 opacity-90">
        Compassionate Assessment & Support
      </Text>

      {/* Loading Dots */}
      <View className="flex-row mb-8">
        <Animated.View 
          className="w-2 h-2 bg-white rounded-full mx-1" 
          style={{ opacity: dot1Opacity }}
        />
        <Animated.View 
          className="w-2 h-2 bg-white rounded-full mx-1" 
          style={{ opacity: dot2Opacity }}
        />
        <Animated.View 
          className="w-2 h-2 bg-white rounded-full mx-1" 
          style={{ opacity: dot3Opacity }}
        />
      </View>

      {/* Bottom Text */}
      <View className="absolute bottom-12 left-0 right-0 items-center">
        <Text className="text-white text-center opacity-80 px-8">
          Supporting Every Step of Your Journey
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default SplashScreen;
