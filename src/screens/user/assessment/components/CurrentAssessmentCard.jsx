import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Eye, Clock, ChevronRight } from 'lucide-react-native';

const CurrentAssessmentCard = ({ onPress }) => {
  return (
    <View className="bg-white rounded-2xl p-4 shadow-sm flex flex-col">
      <View className="bg-blue-100 px-3 py-1 rounded-full self-start mb-3 justify-center items-center">
        <Text className="text-blue-600 text-xs font-medium">Current Assessment</Text>
      </View>
      
      <View className="flex-col space-x-3 justify-center items-center gap-4">
        <View className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
          <Eye size={24} color="white" />
        </View>
        
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-900 text-lg font-semibold mb-1">Eye Tracking</Text>
          <Text className="text-gray-600 text-sm mb-3">
            Analyze gaze patterns and visual attention
          </Text>
          
          <View className=" items-center justify-between">
            <View className="flex-row items-center">
              <Clock size={16} color="#6B7280" />
              <Text className="text-gray-600 text-sm ml-1">3-5 min</Text>
            </View>
            
            <TouchableOpacity 
              onPress={onPress}
              className="bg-blue-500 px-4 py-2 rounded-xl flex-row items-center"
            >
              <Text className="text-white font-medium mr-1">Start</Text>
              <ChevronRight size={16} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

export default CurrentAssessmentCard;
