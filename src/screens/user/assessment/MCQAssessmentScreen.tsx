import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Users, Clock, Eye, Mic, CheckCircle, ArrowRight, ChevronRight, FileText, Check } from 'lucide-react-native';
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
    <ScrollView className="flex-1">
      <View className="px-6 py-8 bg-[#F5F7FA]">
        {/* Progress Header */}
        <View className="bg-white rounded-2xl p-4 shadow-lg shadow-gray-200" style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 1,
        }}>
          <View className="bg-white rounded-2xl p-2 shadow-sm">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-gray-900 text-lg font-semibold">Assessment Progress</Text>
              <View className="bg-blue-100 px-3 py-1 rounded-full">
                <Text className="text-[#4A90E2] text-xs font-medium">Step 3 of 3</Text>
              </View>
            </View>
            <View className="mb-3">
              <View className="bg-gray-200 h-2 rounded-full overflow-hidden">
                <View className="bg-[#4A90E2] h-full rounded-full" style={{ width: '66%' }} />
              </View>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-[#6B7280] text-sm">2 of 3 completed</Text>
              <Text className="text-[#6B7280] text-sm font-medium">66% Complete</Text>
            </View>
          </View>
        </View>

        {/* Current Assessment */}
        <View className="bg-white rounded-2xl p-5 shadow-lg shadow-gray-200" style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
          marginTop: 20,
        }}>
          <View className="items-center mb-4">
            <Text className="text-[#4A90E2] text-sm px-4 py-1.5 rounded-2xl bg-[#DBEAFE]">
              Current Assessment
            </Text>
          </View>
          
          <View className="items-center">
            <View className="w-16 h-16 bg-[#DBEAFE] rounded-full items-center justify-center mb-4">
              <Users size={28} color="#4A90E2" />

            </View>
            <View className="w-full">
              <Text className="text-center text-gray-900 text-xl font-bold mb-1.5">MCQ Assessment</Text>
              <Text className="text-center text-gray-600 text-sm mb-5 px-2">
                Complete comprehensive questionnaire
              </Text>
              <View className="flex-row items-center justify-center mb-3">
                <View className="flex-row items-center">
                  <Clock size={16} color="#6B7280" />
                  <Text className="text-gray-600 text-sm ml-1.5 self-center">15-20 min</Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={() => navigateToAssessment('MCQQuestionScreen')}
                className="w-full bg-[#4A90E2] rounded-2xl py-3.5 flex-row items-center justify-center"
              >
                <Text className="text-white font-semibold text-lg mr-2">
                  Start Assessment
                </Text>
                <ArrowRight size={18} color="white" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Assessment Overview */}
        <View className="rounded-2xl pt-5">
          <Text className="text-gray-900 text-lg font-semibold mb-4">Assessment Overview</Text>
          
          <View>
            <View className='rounded-2xl border border-[#4A90E2]'>
              <View className="bg-white rounded-xl p-3 flex-row items-center justify-between">
                <View className="flex-row items-center space-x-3">
                  <View className="w-12 h-12 rounded-full flex items-center justify-center mr-5" 
                       style={{ backgroundColor: '#4A90E220' }}>
                    <Eye size={20} color="#4A90E2" />
                  </View>
                  <View>
                    <Text className="text-gray-900 font-medium">Eye Tracking</Text>
                    <Text className="text-gray-600 text-sm">3-4 min</Text>
                  </View>
                </View>
                <Check size={20} color="#4A90E2" />
              </View>
            </View>
            
            <View className="mt-2 rounded-2xl">
              <View className="bg-white rounded-xl p-3 flex-row items-center justify-between" 
                    style={{ borderWidth: 0.5, borderColor: '#4A90E2' }}>
                <View className="flex-row items-center space-x-3">
                  <View className="w-12 h-12 rounded-full flex items-center justify-center mr-5" 
                       style={{ backgroundColor: '#4A90E220' }}>
                    <Mic size={20} color="#4A90E2" />
                  </View>
                  <View>
                    <Text className="text-gray-900 font-medium">Speech Analysis</Text>
                    <Text className="text-gray-600 text-sm">3-5 min</Text>
                  </View>
                </View>
                <Check size={20} color="#4A90E2" />
              </View>
            </View>
            
            <View className="mt-2 rounded-2xl">
              <View className="bg-white rounded-xl p-3 flex-row items-center justify-between">
                <View className="flex-row items-center space-x-3">
                  <View className="w-12 h-12 rounded-full flex items-center justify-center mr-5" 
                       style={{ backgroundColor: '#4A90E220' }}>
                    <Users size={20} color="#4A90E2" />
                  </View>
                  <View>
                    <Text className="text-gray-900 font-medium">MCQ Assessment</Text>
                    <Text className="text-gray-600 text-sm">15-20 min</Text>
                  </View>
                </View>
                <View className="bg-[#DCFCE7] px-2 py-1 rounded-full">
                  <Text className="text-green-600 text-xs font-medium">Current</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Progress Summary
        <View className="mt-6 p-4 bg-gray-50 rounded-lg">
          <Text className="text-gray-700 font-medium mb-2">Final Step</Text>
          <Text className="text-gray-600 text-sm leading-relaxed">
            Complete the MCQ Assessment to finish your comprehensive evaluation. 
            This final assessment helps us understand your cognitive patterns and preferences.
          </Text>
        </View> */}
      </View>
    </ScrollView>
  );
};

export default MCQAssessmentScreen;
