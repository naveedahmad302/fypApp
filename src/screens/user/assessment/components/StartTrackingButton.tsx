import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { Play, Square } from 'lucide-react-native';

interface StartTrackingButtonProps {
  isTracking: boolean;
  onStart?: () => void;
  onStop?: () => void;
}

const StartTrackingButton: React.FC<StartTrackingButtonProps> = ({ 
  isTracking,
  onStart,
  onStop
}) => {
  const handlePress = () => {
    if (isTracking) {
      onStop?.();
    } else {
      onStart?.();
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      className={`${isTracking ? 'bg-red-500' : 'bg-blue-500'} rounded-xl py-4 flex-row items-center justify-center shadow-lg`}
    >
      {isTracking ? (
        <Square size={20} color="white" />
      ) : (
        <Play size={20} color="white" />
      )}
      <Text className="text-white font-semibold text-lg ml-2">
        {isTracking ? 'Stop Tracking' : 'Start Tracking'}
      </Text>
    </TouchableOpacity>
  );
};

export default StartTrackingButton;
