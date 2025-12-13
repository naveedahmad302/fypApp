import React, { ReactNode } from 'react';
import { View, Text, Image } from 'react-native';
import { Eye } from 'lucide-react-native';

interface GazeVisualizationCardProps {
  children?: ReactNode;
  isTracking?: boolean;
  trackingProgress?: number;
}

const GazeVisualizationCard: React.FC<GazeVisualizationCardProps> = ({
  children,
  isTracking = false,
  trackingProgress = 0
}) => {
  return (
    <View className='px-3'>
      <View className=' rounded-2xl p-2'>
        <Text className="text-[#4B5563] mb-4">Follow the visual cues while we analyze
          your gaze patterns</Text>
      </View>

      <View className="bg-white rounded-2xl shadow-lg p-4 "
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 1,
        }}>
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-gray-900 text-lg font-semibold">Tracking Status</Text>
          <View className={`px-3 py-1 rounded-full ${isTracking ? 'bg-[#ffb4b434]' : 'bg-blue-100'}`}>
            <Text className={`text-xs font-medium ${isTracking ? 'text-red-500' : 'text-[#4A90E2]'}`}>
              {isTracking ? `Recording ${trackingProgress}%` : 'Ready'}
            </Text>
          </View>
        </View>

        {/* Progress Line */}
        <View className="mb-4">
          <View className="bg-gray-200 h-2 rounded-full overflow-hidden">
            <View 
              className={`h-full rounded-full transition-all duration-300 ${isTracking ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{ width: `${trackingProgress}%` }}
            />
          </View>
        </View>

        <View className="flex-row justify-between">
          <Text className="text-[#6B7280] text-sm">
            {isTracking ? 'Tracking in progress...' : 'Position your face in the centre and click start'}
          </Text>
        </View>
      </View>
      
      <View className=" bg-white rounded-2xl p-4 mt-4 "
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 1,
        }}>
        <Text className="text-gray-900 text-lg font-semibold mb-4">Gaze Visualizations</Text>

        <View className="bg-gray-900 rounded-xl h-64 flex items-center justify-center relative overflow-hidden">
          {children ? (
            children
          ) : (
            <Image 
              source={require('../../../../../assets/images/eyes.png')}
              className="w-full h-full rounded-xl"
              resizeMode="cover"
            />
          )}
        </View>

        {/* Status Text */}
        <View className="mt-4 flex-row items-center justify-center">
          <View className={`w-2 h-2 rounded-full mr-2 ${isTracking ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
          <Text className="text-gray-600 text-sm">
            {isTracking ? 'Tracking active - Keep your face in frame' : 'Position your face in the frame'}
          </Text>
        </View>
      </View>

    </View>

  );
};

export default GazeVisualizationCard;
