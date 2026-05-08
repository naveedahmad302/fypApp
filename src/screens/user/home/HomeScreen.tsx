import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import Svg, { Circle } from 'react-native-svg';
import { 
  THomeTabStackParamsList,
  TBottomTabsStackParamsList 
} from '../../../navigation/userStack/bottomTabsStack/types';
import { Users, ArrowRight} from 'lucide-react-native';
import { useAssessment } from '../../../context/AssessmentContext';

type HomeScreenNavigationProp = CompositeScreenProps<
  NativeStackScreenProps<THomeTabStackParamsList, 'Hello'>,
  BottomTabScreenProps<TBottomTabsStackParamsList>
>;

type Props = HomeScreenNavigationProp;

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { completedCount, eyeTrackingComplete, speechComplete, mcqComplete } = useAssessment();
  const progressPercent = completedCount === 0 ? 0 : completedCount === 1 ? 33 : completedCount === 2 ? 66 : 100;

  const getNextStep = () => {
    if (!eyeTrackingComplete) return { step: 1, name: 'Eye Assessment', desc: 'Analyse gaze patterns and visual attention', time: '3-4 min' };
    if (!speechComplete) return { step: 2, name: 'Speech Analysis', desc: 'Record and analyse speech patterns', time: '3-5 min' };
    if (!mcqComplete) return { step: 3, name: 'MCQ Assessment', desc: 'Complete comprehensive questionnaire', time: '15-20 min' };
    return { step: 3, name: 'All Complete', desc: 'View your assessment report', time: '' };
  };

  const nextStep = getNextStep();

  return (
    // <SafeAreaView className="flex-1 bg-[#F5F7FA]">
      <ScrollView className="flex-1  bg-[#F5F7FA] py-7 px-7" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className=" shadow-sm justify-center items-center pb-7">
          <Text className="text-black font-radio-canada text-lg font-semibold mb-1">Your Assessment Journey</Text>
          <Text className="text-gray-500 text-sm">Step {completedCount} of 3 • {completedCount === 3 ? 'All assessments complete!' : 'Continue where you left off'}</Text>
        </View>

        {/* Progress Section */}
        <View className="  rounded-xl">
          {/* Circular Progress */}
          <View className="items-center mb-6">
            <View className="relative mb-6">
              {/* SVG Progress Circle */}
              <View className="absolute inset-0 w-36 h-36 items-center justify-center">
                <Svg width="144" height="144" className="absolute">
                  {/* Background Circle */}
                  <Circle
                    cx="72"
                    cy="72"
                    r="64"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                    fill="none"
                  />
                  {/* Progress Circle */}
                  <Circle
                    cx="72"
                    cy="72"
                    r="64"
                    stroke="#3b82f6"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 64}`}
                    strokeDashoffset={`${2 * Math.PI * 64 * (1 - progressPercent / 100)}`}
                    strokeLinecap="round"
                    transform={`rotate(-90 72 72)`}
                    opacity={completedCount > 0 ? 1 : 0}
                  />
                </Svg>
              </View>
              
              {/* Center Content */}
              <View className={`w-36 h-36 rounded-full items-center justify-center ${completedCount > 0 ? 'bg-[#F5F7FA]' : 'bg-white'}`}>
                <Text className={`text-3xl font-bold font-radio-canada ${completedCount > 0 ? 'text-blue-600' : 'text-blue-500'}`}>{completedCount}</Text>
                <Text className="text-sm font-normal text-[#6B7280]">of 3</Text>
              </View>
            </View>

            {/* Progress Text */}
            <View className="flex-row items-center">
              <Text className="text-yellow-500 text-lg mr-2">⭐</Text>
              <Text className={`font-medium ${completedCount > 0 ? 'text-blue-700' : 'text-gray-700'}`}>{progressPercent}% Complete</Text>
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
              <Text className="text-[#4A90E2] text-sm px-3 py-1 rounded-2xl bg-[#DBEAFE] self-center">{completedCount === 3 ? 'Assessment Complete' : `Next: Step ${nextStep.step} of 3`}</Text>
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
            <Text className="text-xl font-bold text-center mb-2">{nextStep.name}</Text>
            <Text className="text-gray-600 text-center mb-1 text-sm">{nextStep.desc}</Text>
            {nextStep.time ? <Text className="text-[#6B7280] text-center rounded-xl text-sm mb-6 px-3 py-1 mt-2 bg-[#F3F4F6] self-center">{nextStep.time}</Text> : <View className="mb-6" />}

            {/* Continue Button */}
            <TouchableOpacity
              className="bg-[#4A90E2] rounded-2xl py-4 flex-row items-center justify-center"
              onPress={() => {
                // @ts-ignore - We know this navigation is valid
                if (completedCount === 3) {
                  navigation.getParent()?.navigate('ReportTab' as never, { screen: 'Report' } as never);
                } else {
                  navigation.getParent()?.navigate('AssessmentTab' as never, { screen: 'Assessment' } as never);
                }
              }}
            >
              <Text className="text-white font-radio-canada-bold font-semibold text-lg mr-2">{completedCount === 3 ? 'View Report' : completedCount > 0 ? 'Continue Assessment' : 'Start Assessment'}</Text>
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
