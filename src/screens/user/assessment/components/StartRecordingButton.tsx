import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { Mic, MicOff, Check, RefreshCw } from 'lucide-react-native';

interface StartRecordingButtonProps {
  isRecording: boolean;
  hasRecorded: boolean;
  isSubmitting?: boolean;
  onStart?: () => void;
  onStop?: () => void;
  onRerecord?: () => void;
  onComplete?: () => void;
}

const StartRecordingButton: React.FC<StartRecordingButtonProps> = ({
  isRecording,
  hasRecorded,
  isSubmitting = false,
  onStart,
  onStop,
  onRerecord,
  onComplete,
}) => {
  if (hasRecorded) {
    return (
      <View className="flex-row space-x-4 justify-center">
        <TouchableOpacity
          className="border mr-2 border-blue-500 bg-white py-3 rounded-xl flex-row items-center justify-center px-3 flex-1"
          onPress={onRerecord}
          disabled={isSubmitting}
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }}>
          <RefreshCw size={20} color="#3B82F6" />
          <Text className="text-blue-500 font-semibold text-lg ml-2">
            Try Another
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-blue-500 py-3 ml-2 rounded-xl flex-row items-center justify-center px-3 flex-1"
          onPress={onComplete}
          disabled={isSubmitting}
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }}>
          {isSubmitting ? (
            <Text className="text-white font-semibold">Processing...</Text>
          ) : (
            <>
              <Check size={20} color="white" />
              <Text className="text-white font-semibold text-lg ml-2">
                Complete
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={isRecording ? onStop : onStart}
      disabled={isSubmitting}
      className={`rounded-xl py-4 flex-row items-center justify-center shadow-lg ${
        isRecording ? 'bg-red-500' : 'bg-blue-500'
      }`}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      }}>
      {isRecording ? (
        <>
          <MicOff size={20} color="white" />
          <Text className="text-white font-semibold text-lg ml-2">
            Stop Recording
          </Text>
        </>
      ) : (
        <>
          <Mic size={20} color="white" />
          <Text className="text-white font-semibold text-lg ml-2">
            Start Recording
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

export default StartRecordingButton;
