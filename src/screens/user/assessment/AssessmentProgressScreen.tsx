import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Volume2, Clock, Eye, Mic, Users, CheckCircle, ArrowRight, ChevronRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

interface AssessmentProgressScreenProps {
  navigation?: any;
}

const AssessmentProgressScreen: React.FC<AssessmentProgressScreenProps> = ({ navigation: navProp }) => {
  const navigation = useNavigation();

  const navigateToAssessment = (screenName: string) => {
    const nav = navProp || navigation;
    nav.navigate(screenName as any);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 ">
        <View className="px-6 py-8 bg-[#F5F7FA]">
          {/* Progress Header */}
          <View className=" bg-white p-4 rounded-lg mb-6 shad">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-gray-800 font-semibold">Assessment Progress</Text>
              <Text className="text-gray-500 text-sm">Step 2 of 3</Text>
            </View>
            <Text className="text-gray-500 text-sm mb-2">1 of 3 completed</Text>
            <Text className="text-gray-500 text-sm">25% Complete</Text>
          </View>

          {/* Current Assessment */}
          <View className=" p-4 rounded-lg mb-6 bg-white">
            <View className="bg-green-500 px-3 py-1 rounded-full self-start mb-4">
              <Text className="text-white text-xs font-medium">Current Assessment</Text>
            </View>
            
            <View className="items-center mb-6">
              <View className="w-16 h-16 bg-blue-500 rounded-full items-center justify-center mb-4">
                <Volume2 size={24} color="white" />
              </View>
              <Text className="text-gray-800 text-xl font-semibold mb-2">Speech Analysis</Text>
              <Text className="text-gray-500 text-center mb-2">
                Record and analyse speech patterns.
              </Text>
              <View className="flex-row items-center">
                <Clock size={16} color="#9CA3AF" />
                <Text className="text-gray-500 text-sm ml-1">3-5 min</Text>
              </View>
            </View>

            <TouchableOpacity 
              className="bg-blue-500 py-3 rounded-lg flex-row items-center justify-center"
              onPress={() => navigateToAssessment('RecordingScreen')}
            >
              <Text className="text-white font-semibold mr-2">Continue Assessment</Text>
              <ArrowRight size={16} color="white" />
            </TouchableOpacity>
          </View>

          {/* Assessment Overview */}
          <Text className="text-gray-800 text-lg font-semibold mb-4">Assessment Overview</Text>
          
          {/* Eye Tracking - Completed */}
          <View className="bg-blue-50 p-4 border-fuchsia-950 rounded-lg mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-blue-100 rounded-full items-center justify-center mr-3">
                <Eye size={16} color="#3B82F6" />
              </View>
              <Text className="text-gray-800 font-medium">Eye Tracking</Text>
            </View>
            <CheckCircle size={24} color="#10B981" />
          </View>

          {/* Speech Analysis - Current */}
          <View className="bg-green-50 p-4 rounded-lg mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-green-100 rounded-full items-center justify-center mr-3">
                <Mic size={16} color="#10B981" />
              </View>
                <Text className="text-gray-800 font-medium">Speech Analysis</Text>
    
            </View>
             <View className="bg-[#DCFCE7] px-2 py-1 rounded-full mt-1 self-start">
                  <Text className="text-green-600 text-xs">Current</Text>
                </View>
          </View>

          {/* MCQ Assessment - Locked */}
          <View className="bg-gray-50 p-4 rounded-lg mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-gray-200 rounded-full items-center justify-center mr-3">
                <Users size={16} color="#9CA3AF" />
              </View>
              <Text className="text-gray-500 font-medium">MCQ Assessment</Text>
            </View>
            <ChevronRight size={20} color="#9CA3AF" />
          </View>

          {/* Progress Summary */}
          <View className="mt-6 p-4 bg-gray-50 rounded-lg">
            <Text className="text-gray-700 font-medium mb-2">Next Steps</Text>
            <Text className="text-gray-600 text-sm leading-relaxed">
              Complete the Speech Analysis assessment to unlock the MCQ Assessment. 
              Each assessment helps us build a comprehensive profile of your cognitive patterns.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AssessmentProgressScreen;
