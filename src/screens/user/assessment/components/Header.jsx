import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

const Header = ({ title, showBackButton = false, onBackPress }) => {
  return (
    <View className="bg-white px-4 py-3 flex-row items-center justify-between border-b border-gray-100">
      <View className="flex-1">
        {showBackButton && (
          <TouchableOpacity 
            onPress={onBackPress}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-3"
          >
            <ChevronLeft size={20} color="#374151" />
          </TouchableOpacity>
        )}
      </View>
      
      <View className="flex-1 items-center">
        <Text className="text-gray-900 text-lg font-semibold">{title}</Text>
      </View>
      
      <View className="flex-1" />
    </View>
  );
};

export default Header;
