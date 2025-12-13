import React from 'react';
import { View, Text } from 'react-native';
import { Eye, Mic, Users, Check, Lock } from 'lucide-react-native';

const AssessmentItem = ({ icon: Icon, title, duration, status = 'locked' }) => {
  const getStatusContent = () => {
    switch (status) {
      case 'completed':
        return <View className="bg-[#DCFCE7] px-2 py-1 rounded-full ">
          <Text className="text-[#22C55E] text-xs font-semibold">Current</Text>
        </View>;
      case 'locked':
        return <View className="bg-white px-2 py-1 rounded-full">
          <Text className="text-gray-600 text-xs font-medium">Locked</Text>
        </View>;
      default:
        return null;
    }
  };

  const getIconColor = () => {
    switch (status) {
      case 'completed':
        return '#22C55E';
      case 'locked':
        return '#9CA3AF';
      default:
        return '#3B82F6';
    }
  };

  return (
    <View className={`rounded-2xl p-3 flex-row items-center justify-between ${status === 'locked' ? 'opacity-50' : 'bg-[#F0FDFA]'}`}
          style={status === 'locked' ? {} : {  borderColor: '#4A90E2',  }}>
      <View className="flex-row items-center space-x-3 ">
        <View className="w-12 h-12 rounded-full flex items-center justify-center mr-5" 
             style={{ backgroundColor: `${getIconColor()}20` }}>
          <Icon size={20} color={getIconColor()} />
        </View>
        <View>
          <Text className="text-gray-900 font-medium">{title}</Text>
          <Text className="text-gray-600 text-sm">{duration}</Text>
        </View>
      </View>
      
      {getStatusContent()}
    </View>
  );
};

const AssessmentOverview = () => {
  return (
    <View className=" rounded-2xl pt-5">
      <Text className="text-gray-900 text-lg font-semibold mb-4">Assessment Overview</Text>
      
      <View>

        <View className=' rounded-2xl border border-[#22C55E]'>
        <AssessmentItem 
          icon={Eye} 
          title="Eye Tracking" 
          duration="3-4 min" 
          status="completed"
          />
          </View>
        
        <View className="mt-2 rounded-2xl border border-[#d7d7d757]">
          <AssessmentItem 
            icon={Mic} 
            title="Speech Analysis" 
            duration="3-5 min" 
            status="locked"
          />
        </View>
        
        <View className="mt-2 rounded-2xl border border-[#d7d7d757]">
          <AssessmentItem 
            icon={Users} 
            title="MCQ Assessment" 
            duration="2-3 min" 
            status="locked"
          />
        </View>
      </View>
    </View>
  );
};

export default AssessmentOverview;
