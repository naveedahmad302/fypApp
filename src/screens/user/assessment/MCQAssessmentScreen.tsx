import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Users, Clock, Eye, Mic, CheckCircle, ArrowRight, ChevronRight, FileText } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

interface MCQAssessmentScreenProps {
  navigation?: any;
}

const MCQAssessmentScreen: React.FC<MCQAssessmentScreenProps> = ({ navigation: navProp }) => {
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
          <View className=" bg-white p-4 rounded-lg mb-6 shadow-sm">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-gray-800 font-semibold">Assessment Progress</Text>
              <Text className="text-gray-500 text-sm">Step 3 of 3</Text>
            </View>
            <Text className="text-gray-500 text-sm mb-2">2 of 3 completed</Text>
            <Text className="text-gray-500 text-sm">66% Complete</Text>
          </View>

          {/* Current Assessment */}
          <View className=" p-4 rounded-lg mb-6 bg-white">
            <View className="bg-[#DBEAFE] text-blue-400 px-3 py-1 rounded-full self-start mb-4">
              <Text className="text-white text-xs font-medium">Current Assessment</Text>
            </View>
            
            <View className="items-center mb-6">
              <View className="w-16 h-16 bg-[#4A90E2] rounded-full items-center justify-center mb-4">
                <FileText size={24} color="white" />
              </View>
              <Text className="text-gray-800 text-xl font-semibold mb-2">MCQ Assessment</Text>
              <Text className="text-gray-500 text-center mb-2">
                Complete comprehensive questionnaire.
              </Text>
              <View className="flex-row items-center">
                <Clock size={16} color="#9CA3AF" />
                <Text className="text-gray-500 text-sm ml-1">15-20 min</Text>
              </View>
            </View>

            <TouchableOpacity 
              className="bg-[#4A90E2] py-3 rounded-lg flex-row items-center justify-center"
              onPress={() => navigateToAssessment('MCQQuestionScreen')}
            >
              <Text className="text-white font-semibold mr-2">Start Assessment</Text>
              <ArrowRight size={16} color="white" />
            </TouchableOpacity>
          </View>

          {/* Assessment Overview */}
          <Text className="text-gray-800 text-lg font-semibold mb-4">Assessment Overview</Text>
          
          {/* Eye Tracking - Completed */}
          <View className="bg-blue-50 p-4 border border-gray-200 rounded-lg mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-blue-100 rounded-full items-center justify-center mr-3">
                <Eye size={16} color="#3B82F6" />
              </View>
              <Text className="text-gray-800 font-medium">Eye Tracking</Text>
            </View>
            <CheckCircle size={24} color="#10B981" />
          </View>

          {/* Speech Analysis - Completed */}
          <View className="bg-green-50 p-4 rounded-lg mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-green-100 rounded-full items-center justify-center mr-3">
                <Mic size={16} color="#10B981" />
              </View>
              <Text className="text-gray-800 font-medium">Speech Analysis</Text>
            </View>
            <CheckCircle size={24} color="#10B981" />
          </View>

          {/* MCQ Assessment - Current */}
          <View className="bg-orange-50 p-4 rounded-lg mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-orange-100 rounded-full items-center justify-center mr-3">
                <Users size={16} color="#F97316" />
              </View>
              <Text className="text-gray-800 font-medium">MCQ Assessment</Text>
            </View>
            <View className="bg-orange-100 px-2 py-1 rounded-full">
              <Text className="text-blue-400 text-xs font-medium">Current</Text>
            </View>
          </View>

          {/* Progress Summary */}
          <View className="mt-6 p-4 bg-gray-50 rounded-lg">
            <Text className="text-gray-700 font-medium mb-2">Final Step</Text>
            <Text className="text-gray-600 text-sm leading-relaxed">
              Complete the MCQ Assessment to finish your comprehensive evaluation. 
              This final assessment helps us understand your cognitive patterns and preferences.
            </Text>
          </View>

          {/* Assessment Benefits
          <View className="mt-6 bg-white rounded-lg p-4 shadow-sm">
            <Text className="text-gray-800 font-semibold mb-3">What to Expect</Text>
            <View className="space-y-3">
              <View className="flex-row items-start">
                <View className="w-2 h-2 bg-[#4A90E2] rounded-full mr-3 mt-2" />
                <Text className="text-gray-600 text-sm flex-1">Multiple choice questions covering various cognitive aspects</Text>
              </View>
              <View className="flex-row items-start">
                <View className="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2" />
                <Text className="text-gray-600 text-sm flex-1">No right or wrong answers - respond honestly</Text>
              </View>
              <View className="flex-row items-start">
                <View className="w-2 h-2 bg-green-500 rounded-full mr-3 mt-2" />
                <Text className="text-gray-600 text-sm flex-1">Takes approximately 15-20 minutes to complete</Text>
              </View>
            </View>
          </View> */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default MCQAssessmentScreen;
