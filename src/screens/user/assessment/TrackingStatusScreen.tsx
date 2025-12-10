import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { RefreshCw, Check, Eye, Clock, Target } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

interface TrackingStatusScreenProps {
  navigation?: any;
}

const TrackingStatusScreen: React.FC<TrackingStatusScreenProps> = ({ navigation: navProp }) => {
  const navigation = useNavigation();
  const [progress, setProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(true);
  const [gazePoints, setGazePoints] = useState(0);
  const [avgFixation, setAvgFixation] = useState('0.0s');

  useEffect(() => {
    // Simulate recording progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          setIsRecording(false);
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 200);

    // Simulate gaze data collection
    const gazeInterval = setInterval(() => {
      setGazePoints(prev => Math.min(prev + 1, 25));
      setAvgFixation(`${(Math.random() * 2 + 1.5).toFixed(1)}s`);
    }, 800);

    return () => {
      clearInterval(progressInterval);
      clearInterval(gazeInterval);
    };
  }, []);

  const handleTryAgain = () => {
    // Reset and go back to eye tracking
    setProgress(0);
    setIsRecording(true);
    setGazePoints(0);
    const nav = navProp || navigation;
    nav.goBack();
  };

  const handleComplete = () => {
    // Navigate to recording screen or next assessment
    const nav = navProp || navigation;
    nav.navigate('AssessmentProgressScreen');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1">
        <View className="px-6 py-8">
          {/* Tracking Status Header */}
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-gray-800 text-xl font-semibold">Tracking Status</Text>
            <View className={`${isRecording ? 'bg-red-500' : 'bg-green-500'} px-3 py-1 rounded-full`}>
              <Text className="text-white text-sm font-medium">
                {isRecording ? 'Recording' : 'Complete'}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View className="mb-6">
            <View className="w-full h-2 bg-gray-200 rounded-full mb-2">
              <View 
                className={`h-full rounded-full transition-all duration-300 ${
                  isRecording ? 'bg-blue-500' : 'bg-green-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </View>
            <Text className="text-gray-500 text-sm">
              {isRecording ? `Recording... ${progress}% complete` : 'Recording Complete'}
            </Text>
          </View>

          {/* Gaze Visualization */}
          <View className="mb-8">
            <Text className="text-gray-800 text-lg font-semibold mb-4">Gaze Visualization</Text>
            <View className="bg-gray-100 p-8 rounded-lg items-center justify-center" style={{ height: 200 }}>
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
          <View className="flex-row mb-8">
            <TouchableOpacity 
              className="flex-1 border border-blue-500 py-3 rounded-lg mr-3 flex-row items-center justify-center"
              onPress={handleTryAgain}
            >
              <RefreshCw size={20} color="#3B82F6" />
              <Text className="text-blue-500 font-semibold ml-2">Try Again</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="flex-1 bg-blue-500 py-3 rounded-lg ml-3 flex-row items-center justify-center"
              onPress={handleComplete}
              disabled={isRecording}
            >
              <Check size={20} color="white" />
              <Text className="text-white font-semibold ml-2">Complete</Text>
            </TouchableOpacity>
          </View>

          {/* Preliminary Results */}
          <View>
            <Text className="text-blue-500 text-lg font-semibold mb-4">Preliminary Results</Text>
            
            <View className="flex-row mb-6">
              <View className="flex-1 bg-gray-50 p-4 rounded-lg mr-3 items-center">
                <Target size={24} color="#374151" className="mb-2" />
                <Text className="text-gray-800 text-2xl font-bold mb-1">{gazePoints}</Text>
                <Text className="text-gray-500 text-sm text-center">Gaze Points</Text>
              </View>
              
              <View className="flex-1 bg-gray-50 p-4 rounded-lg ml-3 items-center">
                <Clock size={24} color="#374151" className="mb-2" />
                <Text className="text-gray-800 text-2xl font-bold mb-1">{avgFixation}</Text>
                <Text className="text-gray-500 text-sm text-center">Avg. Fixation</Text>
              </View>
            </View>

            <View className="bg-blue-50 p-4 rounded-lg">
              <Text className="text-gray-600 text-sm text-center">
                {isRecording 
                  ? 'Eye tracking in progress. Please maintain focus on the center point.'
                  : 'Results saved to your assessment profile.\nClick Complete to proceed to next assessment.'
                }
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TrackingStatusScreen;
