import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Eye, Clock, ChevronRight } from 'lucide-react-native';

const CurrentAssessmentCard = ({ onPress }) => {
  return (
    <View className="bg-white rounded-2xl p-5 shadow-lg shadow-gray-200" style={{
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      marginTop: 20,
    }}>
      <View className="items-center mb-4">
        <Text className="text-[#4A90E2] text-sm px-4 py-1.5 rounded-2xl bg-[#DBEAFE]">
          Current Assessment
        </Text>
      </View>

      <View className="items-center">
        <View className="w-16 h-16 bg-[#DBEAFE] rounded-full items-center justify-center mb-4">
          <Eye size={28} color="#4A90E2" />
        </View>

        <View className="w-full">
          <Text className="text-center text-gray-900 text-xl font-bold mb-1.5">Eye Tracking</Text>
          <Text className="text-center text-gray-600 text-sm mb-5 px-2">
            Analyze gaze patterns and visual attention
          </Text>

          <View className="flex-row items-center justify-center mb-3">
            <View className="flex-row items-center">
              <Clock size={16} color="#6B7280" />
              <Text className="text-gray-600 text-sm ml-1.5 self-center">3-5 min</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={onPress}
            className="w-full bg-[#4A90E2] rounded-2xl py-3.5 flex-row items-center justify-center"
          >
            <Text className="text-white font-radio-canada-bold font-semibold text-lg mr-2">
              Next
            </Text>
            <ChevronRight size={18} color="white" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default CurrentAssessmentCard;
