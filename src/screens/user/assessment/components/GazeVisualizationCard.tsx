import React, { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { Eye } from 'lucide-react-native';

interface GazeVisualizationCardProps {
  children?: ReactNode;
  isTracking?: boolean;
}

const GazeVisualizationCard: React.FC<GazeVisualizationCardProps> = ({ 
  children,
  isTracking = false 
}) => {
  return (
    <View className="bg-white rounded-2xl p-4 shadow-sm">
      <Text className="text-gray-900 text-lg font-semibold mb-4">Gaze Visualization</Text>
      
      <View className="bg-gray-900 rounded-xl h-64 flex items-center justify-center relative overflow-hidden">
        {children || (
          <>
            {/* Face Detection Overlay */}
            <View className="absolute inset-0 flex items-center justify-center">
              <View className="w-32 h-32 border-2 border-blue-400 rounded-lg flex items-center justify-center">
                <View className="w-2 h-2 bg-blue-400 rounded-full" />
              </View>
            </View>
            
            {/* Corner Brackets */}
            <View className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-blue-400" />
            <View className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-blue-400" />
            <View className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-blue-400" />
            <View className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-blue-400" />
            
            {/* Center Icon */}
            <View className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <Eye size={32} color="#60A5FA" />
            </View>
          </>
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
  );
};

export default GazeVisualizationCard;
