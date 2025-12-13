import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { RefreshCw, Check, Eye, Clock, Target } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import CustomText from '../../../components/CustomText';

interface TrackingStatusScreenProps {
  navigation?: any;
}

const TrackingStatusScreen: React.FC<TrackingStatusScreenProps> = ({ navigation: navProp }) => {
  const navigation = useNavigation();
  const [progress] = useState(100); // Fixed at 100%
  const [isRecording, setIsRecording] = useState(false); // Set to false since no recording
  const [gazePoints] = useState(25); // Fixed final value
  const [avgFixation] = useState('1.8s'); // Fixed final value

  useEffect(() => {
    // No progress animation needed - screen shows completed results
  }, []);

  const handleTryAgain = () => {
    // Go back to eye tracking screen
    const nav = navProp || navigation;
    nav.goBack();
  };

  const handleComplete = () => {
    // Navigate to recording screen or next assessment
    const nav = navProp || navigation;
    nav.navigate('SpeechProgressScreen');
  };

  return (
    <SafeAreaView edges={[]} className="flex-1 bg-[#F7F8FA]">
      <ScrollView contentContainerClassName="flex-grow justify-center p-5">
        <View className="w-full max-w-md mx-auto">
          {/* Tracking Status Header */}
          

          {/* Progress Bar */}
          <View className='bg-[#FFFFFF] p-5 rounded-2xl shadow-lg shadow-gray-200 mb-6' style={{
            
             shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 1,
          }}>
            <View className="flex-row justify-between items-center mb-6">
            <CustomText weight={700} className="text-lg font-bold text-gray-900">
              Tracking Status
            </CustomText>
            <View className={`${isRecording ? 'bg-red-500' : 'bg-[#DBEAFE]'} px-3 py-1 rounded-full`}>
              <CustomText weight={500} className="text-[#4A90E2] text-sm font-medium">
                {isRecording ? 'Tracking' : 'Complete'}
              </CustomText>
            </View>
          </View>
            <View className="w-full h-2 bg-gray-200 rounded-full mb-3">
              <View 
                className={`h-full rounded-full transition-all duration-300 ${
                  isRecording ? 'bg-[#4A90E2]' : 'bg-[#4A90E2]'
                }`}
                style={{ width: `${progress}%` }}
              />
            </View>
            <CustomText weight={400} className="text-gray-600 text-sm">
              {isRecording ? `Recording... ${progress}% complete` : 'Recording Complete'}
            </CustomText>
          </View>

          {/* Gaze Visualization */}
          <View className='bg-[#FFFFFF] p-5 rounded-2xl shadow-lg shadow-gray-200 mb-6' style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 1,
          }}>
            <CustomText weight={600} className="text-lg font-bold text-gray-800 mb-4">Gaze Visualization</CustomText>
            <View className="bg-[#F3F4F6] p-8 rounded-2xl items-center justify-center" style={{ height: 200 }}>
              {/* Face outline with tracking points */}
              <View className="relative">
                {/* Face outline */}
                <View className="w-20 h-24 border-2 border-gray-300 rounded-full relative">
                  {/* Eyes with tracking indicators */}
                  <View className="absolute top-6 left-3 w-3 h-2 bg-gray-300 rounded-full">
                    {isRecording && (
                      <View className="absolute -top-1 -left-1 w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                    )}
                  </View>
                  <View className="absolute top-6 right-3 w-3 h-2 bg-gray-300 rounded-full">
                    {isRecording && (
                      <View className="absolute -top-1 -right-1 w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                    )}
                  </View>
                  {/* Mouth */}
                  <View className="absolute bottom-6 left-1/2 w-4 h-1 bg-gray-300 rounded-full transform -translate-x-1/2" />
                </View>
                
                {/* Tracking indicator */}
                {isRecording && (
                  <View className="absolute -top-2 -right-2">
                    <Eye size={16} color="#EF4444" className="animate-pulse" />
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row mb-6">
            <TouchableOpacity 
              className="flex-1 border border-[#4A90E2] py-4 rounded-2xl mr-3 flex-row items-center justify-center"
              onPress={handleTryAgain}
            >
              <RefreshCw size={20} color="#4A90E2" />
              <CustomText weight={500} className="text-[#4A90E2] font-semibold ml-2">Try Again</CustomText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="flex-1 bg-[#4A90E2] py-4 rounded-2xl ml-3 flex-row items-center justify-center shadow-lg"
              onPress={handleComplete}
              disabled={isRecording}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 1,
              }}
            >
              <Check size={20} color="white" />
              <CustomText weight={600} className="text-white font-semibold ml-2">Complete</CustomText>
            </TouchableOpacity>
          </View>

          {/* Preliminary Results */}
          <View className='bg-white p-4 rounded-2xl'>
            <CustomText weight={600} className="text-lg bg-white font-semibold text-[#4A90E2] mb-4">Preliminary Results</CustomText>
            
            <View className="flex-row mb-6">
              <View className="flex-1 bg-[#F3F4F6] p-4 rounded-2xl mr-3 items-center shadow-sm" style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 1,
              }}>
                <Target size={24} color="#374151" className="mb-2" />
                <CustomText weight={700} className="text-gray-900 text-2xl font-bold mb-1">{gazePoints}</CustomText>
                <CustomText weight={400} className="text-gray-600 text-sm text-center">Gaze Points</CustomText>
              </View>
              
              <View className="flex-1 bg-[#F3F4F6] p-4 rounded-2xl ml-3 items-center shadow-sm" style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 1,
              }}>
                <Clock size={24} color="#374151" className="mb-2" />
                <CustomText weight={700} className="text-gray-900 text-2xl font-bold mb-1">{avgFixation}</CustomText>
                <CustomText weight={400} className="text-gray-600 text-sm text-center">Avg. Fixation</CustomText>
              </View>
            </View>

            <View className="bg-[#F0FDFA] p-4 rounded-2xl border border-[#22C55E]">
              <CustomText weight={400} className="text-gray-600 text-sm text-center">
                {isRecording 
                  ? 'Eye tracking in progress. Please maintain focus on the center point.'
                  : 'Results saved to your assessment profile.\nClick Complete to proceed to next assessment.'
                }
              </CustomText>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TrackingStatusScreen;
