import React, { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { Mic, Volume2 } from 'lucide-react-native';

interface SpeechRecordingCardProps {
  children?: ReactNode;
  isRecording?: boolean;
  recordingProgress?: number;
  audioLevel?: number;
  recordingTime?: string;
}

const SpeechRecordingCard: React.FC<SpeechRecordingCardProps> = ({
  children,
  isRecording = false,
  recordingProgress = 0,
  audioLevel = 0,
  recordingTime = '0:00.0',
}) => {
  return (
    <View className="px-3">
      {/* Recording Status Card */}
      <View
        className="bg-white rounded-2xl shadow-lg p-4"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 1,
        }}>
        {/* <View className="flex-row items-center justify-between mb-3">
          <Text className="text-gray-900 text-lg font-semibold">Recording Status</Text>
          <View
            className={`px-3 py-1 rounded-full ${
              isRecording ? 'bg-red-100' : 'bg-blue-100'
            }`}>
            <Text
              className={`text-xs font-medium ${
                isRecording ? 'text-red-600' : 'text-blue-600'
              }`}>
              {isRecording ? `Recording ${recordingProgress}%` : 'Ready'}
            </Text>
          </View>
        </View> */}

        {/* Progress Bar */}
        {/* <View className="mb-4">
          <View className="bg-gray-200 h-2 rounded-full overflow-hidden">
            <View
              className={`h-full rounded-full transition-all duration-300 ${
                isRecording ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ width: `${recordingProgress}%` }}
            />
          </View>
        </View> */}

        {/* Timer Display */}
        <View className="items-center mb-3">
          <Text
            className={`text-4xl font-light ${
              isRecording ? 'text-red-500' : 'text-blue-500'
            }`}>
            {recordingTime}
          </Text>
          <Text className="text-gray-500 text-sm mt-1">
            {isRecording
              ? 'Recording in progress... (Max 1:00)'
              : 'Ready to record'}
          </Text>
        </View>

        {/* Audio Level Indicator */}
        <View className="flex-row items-center">
          <Volume2 size={18} color="#6B7280" />
          <View className="flex-1 mx-3 h-2 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{
                width: `${audioLevel}%`,
                backgroundColor: isRecording ? '#EF4444' : '#3B82F6',
              }}
            />
          </View>
          <Text className="text-gray-500 text-xs w-8">
            {Math.round(audioLevel)}%
          </Text>
        </View>
      </View>

      {/* Speaking Prompt Card */}
      <View
        className="bg-white rounded-2xl shadow-lg p-4 mt-4"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 1,
        }}>
        <View className="flex-row items-center mb-3">
          <Mic size={20} color="#4A90E2" />
          <Text className="text-gray-900 text-lg font-semibold ml-2">
            Speaking Prompt
          </Text>
        </View>
        <View className="bg-gray-50 p-4 rounded-xl">
          <Text className="text-gray-800 font-bold mb-2 text-center">
            Please describe what you did today
          </Text>
          <Text className="text-gray-500 text-sm text-center">
            Speak naturally and take your time. There is no right or wrong
            answer.
          </Text>
        </View>
      </View>

      {/* Audio Visualization / Eye Detection Area */}
      <View
        className="bg-white rounded-2xl shadow-lg p-4 mt-4"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 1,
        }}>
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-gray-900 text-lg font-semibold">
            Audio Waveform
          </Text>
          <View
            className={`w-2 h-2 rounded-full ${
              isRecording ? 'bg-green-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
        </View>

        <View className="bg-gray-900 rounded-xl h-48 flex items-center justify-center relative overflow-hidden">
          {children ? (
            children
          ) : (
            <View className="items-center">
              <Mic size={48} color="#9CA3AF" />
              <Text className="text-gray-400 text-xs mt-2">
                {isRecording
                  ? 'Recording active'
                  : 'Press start to begin recording'}
              </Text>
            </View>
          )}
        </View>

        {/* Status Text */}
        <View className="mt-4 flex-row items-center justify-center">
          <View
            className={`w-2 h-2 rounded-full mr-2 ${
              isRecording ? 'bg-green-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <Text className="text-gray-600 text-sm">
            {isRecording
              ? 'Recording active - Speak clearly'
              : 'Microphone ready - Position yourself comfortably'}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default SpeechRecordingCard;
