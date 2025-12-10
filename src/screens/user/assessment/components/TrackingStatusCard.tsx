import React from 'react';
import { View, Text } from 'react-native';
import { Camera, CameraOff, CheckCircle, AlertCircle } from 'lucide-react-native';

const TrackingStatusCard = () => {
  return (
    <View className="bg-white rounded-2xl p-4 shadow-sm">
      <Text className="text-gray-900 text-lg font-semibold mb-4">Tracking Status</Text>
      
      {/* Camera Status */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <Camera size={20} color="#10B981" />
          <Text className="text-gray-900 font-medium ml-2">Camera Active</Text>
        </View>
        <CheckCircle size={20} color="#10B981" />
      </View>
      
      {/* Face Detection */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <CameraOff size={20} color="#F59E0B" />
          <Text className="text-gray-900 font-medium ml-2">Face Detection</Text>
        </View>
        <View className="flex-row items-center">
          <AlertCircle size={16} color="#F59E0B" />
          <Text className="text-amber-600 text-sm ml-1">Waiting...</Text>
        </View>
      </View>
      
      {/* Calibration Status */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <CheckCircle size={20} color="#9CA3AF" />
          <Text className="text-gray-900 font-medium ml-2">Calibration</Text>
        </View>
        <Text className="text-gray-500 text-sm">Not Started</Text>
      </View>
    </View>
  );
};

export default TrackingStatusCard;
