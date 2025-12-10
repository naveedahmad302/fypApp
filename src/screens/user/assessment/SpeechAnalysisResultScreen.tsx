import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { RefreshCw, Check } from 'lucide-react-native';

interface SpeechAnalysisResultScreenProps {
  navigation?: any;
}

const SpeechAnalysisResultScreen: React.FC<SpeechAnalysisResultScreenProps> = ({ navigation: navProp }) => {
  const navigation = useNavigation();

  const handleTryAnother = () => {
    // Navigate back to recording screen to try again
    const nav = navProp || navigation;
    nav.navigate('RecordingScreen');
  };

  const handleComplete = () => {
    // Navigate to next assessment or summary
    const nav = navProp || navigation;
    nav.navigate('MCQAssessmentScreen');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 px-6 py-8">
        {/* Top Action Buttons */}
        <View className="flex-row justify-between mb-8">
          <TouchableOpacity 
            className="flex-1 mr-3 py-3 border-2 border-blue-500 rounded-lg items-center justify-center bg-white"
            onPress={handleTryAnother}
          >
            <RefreshCw size={20} color="#3B82F6" className="mr-2" />
            <Text className="text-blue-500 font-semibold text-lg">Try Another</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="flex-1 ml-3 py-3 bg-blue-500 rounded-lg items-center justify-center"
            onPress={handleComplete}
          >
            <Check size={20} color="white" className="mr-2" />
            <Text className="text-white font-semibold text-lg">Complete</Text>
          </TouchableOpacity>
        </View>

        {/* Speech Analysis Results Card */}
        <View className="bg-white rounded-2xl p-6 shadow-sm">
          <Text className="text-2xl font-bold text-gray-800 mb-6">Speech Analysis Results</Text>

          {/* Metrics Section */}
          <View className="flex-row justify-around mb-8">
            <View className="items-center">
              <Text className="text-4xl font-bold text-gray-800 mb-2">142</Text>
              <Text className="text-gray-500 text-sm">Words/min</Text>
            </View>
            <View className="items-center">
              <Text className="text-4xl font-bold text-gray-800 mb-2">0.8s</Text>
              <Text className="text-gray-500 text-sm">Avg. Pause</Text>
            </View>
          </View>

          {/* Speech Characteristics */}
          <View className="space-y-4 mb-8">
            <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
              <Text className="text-gray-700 font-medium">Speech Clarity</Text>
              <View className="bg-green-100 px-3 py-1 rounded-full">
                <Text className="text-green-700 font-medium text-sm">Good</Text>
              </View>
            </View>
            
            <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
              <Text className="text-gray-700 font-medium">Vocal Variation</Text>
              <View className="bg-yellow-100 px-3 py-1 rounded-full">
                <Text className="text-yellow-700 font-medium text-sm">Moderate</Text>
              </View>
            </View>
            
            <View className="flex-row justify-between items-center py-3">
              <Text className="text-gray-700 font-medium">Response Length</Text>
              <View className="bg-green-100 px-3 py-1 rounded-full">
                <Text className="text-green-700 font-medium text-sm">Appropriate</Text>
              </View>
            </View>
          </View>

          {/* Descriptive Text */}
          <View className="bg-blue-50 p-4 rounded-lg">
            <Text className="text-gray-600 text-sm leading-relaxed text-center">
              Speech patterns recorded and saved to your assessment profile. 
              Click Complete to proceed to the next assessment.
            </Text>
          </View>
        </View>

        {/* Additional Info */}
        <View className="mt-6 bg-white rounded-2xl p-4 shadow-sm">
          <Text className="text-gray-800 font-semibold mb-3">Analysis Details</Text>
          <View className="space-y-2">
            <View className="flex-row items-center">
              <View className="w-2 h-2 bg-green-500 rounded-full mr-3" />
              <Text className="text-gray-600 text-sm">Clear speech patterns detected</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-2 h-2 bg-blue-500 rounded-full mr-3" />
              <Text className="text-gray-600 text-sm">Normal speaking rate</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-2 h-2 bg-yellow-500 rounded-full mr-3" />
              <Text className="text-gray-600 text-sm">Moderate vocal variety</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SpeechAnalysisResultScreen;
