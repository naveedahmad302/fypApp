import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { THomeTabStackNavigationProps } from '../../../navigation/userStack/types';
import { SafeAreaView } from 'react-native-safe-area-context';

const styles = StyleSheet.create({
  rotate45: {
    transform: [{ rotate: '45deg' }]
  },
  rotateMinus45: {
    transform: [{ rotate: '-45deg' }]
  }
});

const HomeScreen: React.FC<THomeTabStackNavigationProps<'Home'>> = ({ navigation }) => {
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="0 p-6 shadow-sm justify-center items-center">
          <Text className="text-black font-radio-canada text-base mb-1">Hello NAVEED</Text>
          <Text className="text-gray-500 text-sm">Step 0 of 3 • Continue where you left off</Text>
        </View>

        {/* Progress Section */}
        <View className="bg-gray-50 mx-4  rounded-xl shadow-sm">
          {/* Circular Progress */}
          <View className="items-center mb-6">
            <View className="relative">
              {/* Progress Circle Background */}
              <View className="w-20 h-20 rounded-full border-4 border-gray-200 items-center justify-center">
                {/* Progress Arc - This would typically be implemented with SVG or a progress library */}
                <View className="w-16 h-16 rounded-full border-4 border-[#4A90E2] border-t-transparent items-center justify-center" style={styles.rotate45}>
                  <View style={styles.rotateMinus45}>
                    <Text className="text-2xl font-bold text-[#4A90E2]">2</Text>
                    <Text className="text-xs text-gray-500 text-center">of 4</Text>
                  </View>
                </View>
              </View>
            </View>
            
            {/* Progress Text */}
            <View className="flex-row items-center mt-4">
              <Text className="text-yellow-500 text-lg mr-2">⭐</Text>
              <Text className="text-gray-700 font-medium">50% Complete</Text>
            </View>
          </View>

          {/* Next Step Card */}
          <View className="bg-gray-50 rounded-xl p-4">
            <Text className="text-gray-600 text-sm mb-3">Next: Step 3 of 4</Text>
            
            {/* User Icon */}
            <View className="items-center mb-4">
              <View className="w-12 h-12 bg-teal-500 rounded-full items-center justify-center">
                <Text className="text-white text-xl">👥</Text>
              </View>
            </View>

            {/* Assessment Info */}
            <Text className="text-xl font-bold text-center mb-2">MCQ Assessment</Text>
            <Text className="text-gray-600 text-center mb-1">Comprehensive questionnaire</Text>
            <Text className="text-gray-500 text-center text-sm mb-6">15-20 min</Text>

            {/* Continue Button */}
            <TouchableOpacity
              className="bg-[#4A90E2] rounded-lg py-4 flex-row items-center justify-center"
              onPress={() => navigation.navigate('AssessmentScreen' as any)}
            >
              <Text className="text-white font-semibold text-base mr-2">Continue Assessment</Text>
              <Text className="text-white">→</Text>
            </TouchableOpacity>

            {/* Helper Text */}
            <Text className="text-gray-500 text-center text-xs mt-3">
              You'll continue with MCQ Assessment
            </Text>
          </View>
        </View>

        {/* Additional Options */}
        <View className="flex-1 p-4 mb-8">
          <View className="flex-row justify-between">
            <TouchableOpacity
              className="bg-white rounded-lg p-4 flex-1 mr-2 items-center shadow-sm"
              onPress={() => navigation.navigate('Reports' as any)}
            >
              <Text className="text-2xl mb-2">📊</Text>
              <Text className="font-medium">View Reports</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="bg-white rounded-lg p-4 flex-1 ml-2 items-center shadow-sm"
              onPress={() => navigation.navigate('Profile' as any)}
            >
              <Text className="text-2xl mb-2">👤</Text>
              <Text className="font-medium">Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HomeScreen;