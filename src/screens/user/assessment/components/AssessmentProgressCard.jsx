import React from 'react';
import { View, Text } from 'react-native';

const AssessmentProgressCard = () => {
  return (
    <View className="bg-white rounded-2xl p-4 shadow-sm">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-gray-900 text-lg font-semibold">Assessment Progress</Text>
        <View className="bg-blue-100 px-3 py-1 rounded-full">
          <Text className="text-blue-600 text-xs font-medium">Step 1 of 3</Text>
        </View>
      </View>
      
      <View className="mb-3">
        <View className="bg-gray-200 h-2 rounded-full overflow-hidden">
          <View className="bg-blue-500 h-full rounded-full" style={{ width: '0%' }} />
        </View>
      </View>
      
      <View className="flex-row justify-between">
        <Text className="text-gray-600 text-sm">0 of 3 completed</Text>
        <Text className="text-gray-900 text-sm font-medium">0% Complete</Text>
      </View>
    </View>
  );
};

export default AssessmentProgressCard;
