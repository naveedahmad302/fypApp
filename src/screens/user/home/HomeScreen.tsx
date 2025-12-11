import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { 
  THomeTabStackParamsList,
  TBottomTabsStackParamsList 
} from '../../../navigation/userStack/bottomTabsStack/types';
import { Users, ArrowRight} from 'lucide-react-native';

type HomeScreenNavigationProp = CompositeScreenProps<
  NativeStackScreenProps<THomeTabStackParamsList, 'Hello'>,
  BottomTabScreenProps<TBottomTabsStackParamsList>
>;

type Props = HomeScreenNavigationProp;

const styles = StyleSheet.create({
  rotate45: {
    transform: [{ rotate: '45deg' }]
  },
  rotateMinus45: {
    transform: [{ rotate: '-45deg' }]
  }
});

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  return (
    // <SafeAreaView className="flex-1 bg-[#F5F7FA]">
      <ScrollView className="flex-1  bg-[#F5F7FA] py-7 px-5" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className=" shadow-sm justify-center items-center pb-7">
          <Text className="text-black font-radio-canada text-lg font-semibold mb-1">Your Assessment Journey</Text>
          <Text className="text-gray-500 text-sm">Step 0 of 3 • Continue where you left off</Text>
        </View>

        {/* Progress Section */}
        <View className="  rounded-xl">
          {/* Circular Progress */}
          <View className="items-center mb-6">
            <View className="relative mb-6">
              <View className="w-36 h-36 rounded-full border-8 shadow-sm items-center justify-center">
                <Text className="text-3xl font-bold font-radio-canada text-blue-500">0</Text>
                <Text className="text-sm font-normal text-[#6B7280]">of 3</Text>
              </View>
              <View className="absolute inset-0 w-36 h-36">
                <View
                  className="w-full h-full rounded-full border-8"
                  style={{
                    borderTopColor: '#e5e7eb',
                    borderRightColor: '#e5e7eb',
                    borderBottomColor: '#e5e7eb',
                    borderLeftColor: '#e5e7eb',
                    transform: [{ rotate: '45deg' }]
                  }}
                />
                <View
                  className="absolute inset-0 w-36 h-36 rounded-full"
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: '#3b82f6',
                    borderRightWidth: 0,
                    borderBottomWidth: 0,
                    borderLeftWidth: 0,
                    transform: [{ rotate: '45deg' }]
                  }}
                />
              </View>
            </View>

            {/* Progress Text */}
            <View className="flex-row items-center">
              <Text className="text-yellow-500 text-lg mr-2">⭐</Text>
              <Text className="text-gray-700 font-medium">0% Complete</Text>
            </View>
          </View>

          {/* Next Step Card */}
          <View className="bg-white rounded-2xl p-5  shadow-lg shadow-gray-500/40 shadow-opacity-40" 
          style={{
            elevation: 5, // for Android
            shadowColor: '#000', // for iOS
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          }}>
            <View className="items-center mb-3">
              <Text className="text-[#4A90E2] text-sm px-3 py-1 rounded-2xl bg-[#DBEAFE] self-center">Next: Step 1 of 3</Text>
            </View>

            {/* User Icon */}
            <View className="items-center mb-4">
              <View className="w-14 h-14 bg-[#4A90E2] rounded-full items-center justify-center shadow-md shadow-blue-500/30" style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 5,
              }}>
                <Users size={25} color="white" />
              </View>
            </View>
            {/* Assessment Info */}
            <Text className="text-xl font-bold text-center mb-2">Eye Assessment</Text>
            <Text className="text-gray-600 text-center mb-1 text-sm">Analyse gaze patterns and visual attention</Text>
            <Text className="text-[#6B7280] text-center rounded-xl text-sm mb-6 px-3 py-1 mt-2 bg-[#F3F4F6] self-center">3-4 min</Text>

            {/* Continue Button */}
            <TouchableOpacity
              className="bg-[#4A90E2] rounded-2xl py-4 flex-row items-center justify-center"
              onPress={() => {
                // @ts-ignore - We know this navigation is valid
                navigation.getParent()?.navigate('AssessmentTab', { screen: 'Assessment' });
              }}
            >
              <Text className="text-white font-radio-canada-bold font-semibold text-lg mr-2">Start Assessment</Text>
             <ArrowRight size={18} color="#ffffff" strokeWidth={1.75} absoluteStrokeWidth />
            </TouchableOpacity>

            {/* Helper Text */}
            {/* <Text className="text-gray-500 text-center text-xs mt-3">
              You'll continue with MCQ Assessment
            </Text> */}
          </View>
        </View>

        {/* Additional Options */}
        {/* <View className="flex-1 p-4 mb-8">
          <View className="flex-row justify-between">
            <TouchableOpacity
              className="bg-white rounded-lg p-4 flex-1 mr-2 items-center shadow-sm"
              onPress={() => navigation.navigate('Reports' as any)}
            >
              <Text className="text-2xl mb-2">📊</Text>
              <Text className="font-medium">View Reports</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-white rounded-lg p-4 flex-1 ml-2 items-center shadow-sm"
              onPress={() => navigation.navigate('Profile' as any)}
            >
              <Text className="text-2xl mb-2">👤</Text>
              <Text className="font-medium">Profile</Text>
            </TouchableOpacity>
          </View>
        </View> */}
      </ScrollView>
    // </SafeAreaView>
  );
};

export default HomeScreen;