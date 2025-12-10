import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { CheckCircle, Users, Calendar, Star } from 'lucide-react-native';
import { TUserStackNavigationProps } from '../../../navigation/userStack/types';

const SupportScreen: React.FC = () => {
  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-green-100 mx-4 mt-4 rounded-lg p-4">
        <View className="flex-row items-center mb-2">
          <CheckCircle size={24} color="#10b981" />
          <Text className="text-lg font-semibold ml-2">You're Not Alone</Text>
        </View>
        <Text className="text-gray-700">
          Connect with others on similar journeys, share experiences, and 
          find support in our compassionate community. 
        </Text>
      </View>

      <View className="bg-white mx-4 mt-4 rounded-lg p-4">
        <Text className="text-lg font-semibold mb-4">Community Groups</Text>
        
        <View className="mb-4">
          <View className="flex-row items-center mb-2">
            <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center">
              <Users size={20} color="#3b82f6" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="font-semibold">Parents Support Circle</Text>
              <Text className="text-gray-500 text-sm">Community • 234 members</Text>
            </View>
          </View>
          <Text className="text-gray-600 mb-3">
            A supportive community for parents navigating the autism journey.
          </Text>
          <TouchableOpacity className="bg-blue-500 py-2 px-4 rounded-lg">
            <Text className="text-white text-center font-medium">Join Group</Text>
          </TouchableOpacity>
        </View>

        <View>
          <View className="flex-row items-center mb-2">
            <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center">
              <Calendar size={20} color="#8b5cf6" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="font-semibold">Weekly Check Ins</Text>
              <Text className="text-gray-500 text-sm">Weekly Meetings • 39 members</Text>
            </View>
          </View>
          <Text className="text-gray-600 mb-3">
            Regular virtual meetups for sharing progress and challenges.
          </Text>
          <TouchableOpacity className="bg-blue-500 py-2 px-4 rounded-lg">
            <Text className="text-white text-center font-medium">Join Group</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="bg-white mx-4 mt-4 rounded-lg p-4">
        <Text className="text-lg font-semibold mb-4">Educational Resources</Text>
        
        <View className="mb-4">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="font-medium">Understanding Autism Spectrum</Text>
            <Star size={20} color="#fbbf24" />
          </View>
          <Text className="text-gray-500 text-sm mb-2">Complete Guide • 45 min read</Text>
        </View>

        <View className="mb-4">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="font-medium">Communication Strategies</Text>
            <Star size={20} color="#fbbf24" />
          </View>
          <Text className="text-gray-500 text-sm mb-2">Practical Guide • 20 min read</Text>
        </View>

        <View>
          <View className="flex-row items-center justify-between mb-1">
            <Text className="font-medium">Sensory Processing Tips</Text>
            <Star size={20} color="#fbbf24" />
          </View>
          <Text className="text-gray-500 text-sm">Coping Strategies • 15 min read</Text>
        </View>
      </View>

      <TouchableOpacity 
        className="bg-blue-500 mx-4 mt-4 mb-6 rounded-lg p-4"
        onPress={() => console.log('Navigate to Report')}
      >
        <Text className="text-white text-center font-medium text-lg">View Assessment Results</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};



export default SupportScreen;
