import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Heart, Users, Calendar, Star, ArrowRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TSupportTabStackParamsList } from '../../../navigation/userStack/bottomTabsStack/types';

const SupportScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<TSupportTabStackParamsList, 'Support'>>();
  
  const handleJoinParentsCircle = () => {
    navigation.navigate('GroupChat', { groupName: 'Parents Support Circle' });
  };

  const handleJoinWeeklyCheckIns = () => {
    navigation.navigate('GroupChat', { groupName: 'Weekly Check Ins' });
  };
  return (
    <ScrollView className="flex-1 bg-[#F9FAFB] px-7" showsVerticalScrollIndicator={false}>
      <View className="bg-white mt-6 rounded-xl p-4 mb-3" style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }}>
        <View className="flex-row items-center mb-3">
          <View className="w-12 h-12 bg-green-100 rounded-full items-center justify-center">
            <Heart  size={24} color="#10b981"  />
          </View>
          <Text className="text-lg font-radio-canada font-bold ml-3 text-gray-900">You're Not Alone</Text>
        </View>
        <Text className="text-gray-600 font-radio-canada leading-relaxed">
          Connect with others on similar journeys, share experiences, and 
          find support in our compassionate community. 
        </Text>
      </View>

      <View className=" rounded-xl mb-5">
        <Text className="text-lg font-radio-canada font-bold mb-4 text-gray-900">Community Groups</Text>
        
        <View className="mb-5 bg-white rounded-xl p-4" style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}>
          <View className="flex-row items-center mb-3">
            <View className="w-12 h-12 bg-blue-50 rounded-full items-center justify-center">
              <Users size={24} color="#3b82f6" />
            </View>
            <View className="flex-1 ml-4">
              <Text className="font-radio-canada font-bold text-base text-gray-900">Parents Support Circle</Text>
              <Text className="text-gray-500 text-sm font-radio-canada">Community • 234 members</Text>
            </View>
          </View>
          <Text className="text-gray-600 font-radio-canada mb-4 leading-relaxed">
            A supportive community for parents navigating the autism journey.
          </Text>
          <TouchableOpacity 
            className="bg-blue-500 py-3 px-6 rounded-xl flex-row items-center justify-center"
            onPress={handleJoinParentsCircle}
          >
            <Text className="text-white text-center font-radio-canada font-medium">Join Group</Text>
            <ArrowRight size={16} color="#ffffff" className="ml-2" />
          </TouchableOpacity>
        </View>

        <View className="bg-white rounded-xl p-4" style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}>
          <View className="flex-row items-center mb-3">
            <View className="w-12 h-12 bg-purple-50 rounded-full items-center justify-center">
              <Calendar size={24} color="#8b5cf6" />
            </View>
            <View className="flex-1 ml-4">
              <Text className="font-radio-canada font-bold text-gray-900 text-base">Weekly Check Ins</Text>
              <Text className="text-gray-500 text-sm font-radio-canada">Weekly Meetings • 39 members</Text>
            </View>
          </View>
          <Text className="text-gray-600 font-radio-canada mb-4 leading-relaxed">
            Regular virtual meetups for sharing progress and challenges.
          </Text>
          <TouchableOpacity 
            className="bg-blue-500 py-3 px-6 rounded-xl flex-row items-center justify-center"
            onPress={handleJoinWeeklyCheckIns}
          >
            <Text className="text-white text-center font-radio-canada font-medium">Join Group</Text>
            <ArrowRight size={16} color="#ffffff" className="ml-2" />
          </TouchableOpacity>
        </View>
      </View>

      {/* <View className="bg-white mx-4 mt-6 rounded-xl p-6" style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}>
        <Text className="text-xl font-radio-canada font-bold mb-6 text-gray-900">Educational Resources</Text>
        
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="font-radio-canada font-bold text-gray-900">Understanding Autism Spectrum</Text>
            <Star size={20} color="#fbbf24" />
          </View>
          <Text className="text-gray-500 text-sm font-radio-canada mb-3">Complete Guide • 45 min read</Text>
        </View>

        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="font-radio-canada font-bold text-gray-900">Communication Strategies</Text>
            <Star size={20} color="#fbbf24" />
          </View>
          <Text className="text-gray-500 text-sm font-radio-canada mb-3">Practical Guide • 20 min read</Text>
        </View>

        <View>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="font-radio-canada font-bold text-gray-900">Sensory Processing Tips</Text>
            <Star size={20} color="#fbbf24" />
          </View>
          <Text className="text-gray-500 text-sm font-radio-canada">Coping Strategies • 15 min read</Text>
        </View>
      </View> */}

      {/* <TouchableOpacity 
        className="bg-blue-500 mx-4 mt-6 mb-8 rounded-xl p-4"
        onPress={() => console.log('Navigate to Report')}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <Text className="text-white text-center font-radio-canada font-medium text-lg">View Assessment Results</Text>
      </TouchableOpacity> */}
    </ScrollView>
  );
};



export default SupportScreen;
