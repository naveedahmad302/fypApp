import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Volume2, Clock, Eye, Mic, Users, CheckCircle, Check, ArrowRight, ChevronRight,CircleCheckBig } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import CustomText from '../../../components/CustomText';

// Define types for AssessmentItem props
interface AssessmentItemProps {
  icon: React.ComponentType<any>;
  title: string;
  duration: string;
  status?: 'completed' | 'current' | 'locked';
}

// AssessmentItem component
const AssessmentItem: React.FC<AssessmentItemProps> = ({ icon: Icon, title, duration, status = 'locked' }) => {
  const getStatusContent = () => {
    switch (status) {
      case 'completed':
        return <View className="bg-[#DBEAFE] px-2 py-1 rounded-full ">
          {/* <Text className="text-[#4A90E2] text-xs font-semibold">Completed</Text> */}
          <CircleCheckBig color={'#4A90E2'} />  
        </View>;
      case 'current':
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
        return '#4A90E2';
      case 'current':
        return '#22C55E';
      case 'locked':
        return '#9CA3AF';
      default:
        return '#3B82F6';
    }
  };

  return (
    <View className={`rounded-2xl p-3 flex-row items-center justify-between ${status === 'locked' ? 'opacity-50' : status === 'current' ? 'bg-[#DCFCE7]' : 'bg-[#DBEAFE]'}`}
          style={status === 'locked' ? {} : {  borderColor: status === 'current' ? '#22C55E' : '#4A90E2',  }}>
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

// AssessmentOverview component
const AssessmentOverview = () => {
  return (
    <View className=" rounded-2xl pt-5">
      <Text className="text-gray-900 text-lg font-semibold mb-4">Assessment Overview</Text>
      
      <View>
        <View className=' rounded-2xl border border-[#4A90E2]'>
        <AssessmentItem 
          icon={Eye} 
          title="Eye Tracking" 
          duration="3-4 min" 
          status="completed"
          />
          </View>
        
        <View className="mt-2 rounded-2xl border border-[#22C55E]">
          <AssessmentItem 
            icon={Mic} 
            title="Speech Analysis" 
            duration="3-5 min" 
            status="current"
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

interface SpeechProgressScreenProps {
  navigation?: any;
}

const SpeechProgressScreen: React.FC<SpeechProgressScreenProps> = ({ navigation: navProp }) => {
  const navigation = useNavigation();

  const navigateToAssessment = (screenName: string) => {
    const nav = navProp || navigation;
    nav.navigate(screenName as any);
  };

  return (
      <ScrollView className="flex-1 bg-[#F7F8FA]">
        <View className="p-5">
          {/* Progress Header */}
          <View className='bg-[#FFFFFF] p-5 rounded-2xl shadow-lg shadow-gray-200 mb-6' style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 1,
          }}>
            <View className="flex-row items-center justify-between mb-4">
              <CustomText weight={600} className="text-lg font-semibold text-gray-800">Assessment Progress</CustomText>
              <View className="bg-[#DBEAFE] px-3 py-1 rounded-full">
                <CustomText weight={500} className="text-[#4A90E2] text-xs font-medium">Step 2 of 3</CustomText>
              </View>
            </View>
            <View className="mb-3">
              <View className="bg-gray-200 h-2 rounded-full overflow-hidden">
                <View className="bg-[#4A90E2] h-full rounded-full" style={{ width: '25%' }} />
              </View>
            </View>
            <View className="flex-row justify-between">
              <CustomText weight={400} className="text-[#6B7280] text-sm">1 of 3 completed</CustomText>
              <CustomText weight={500} className="text-[#6B7280] text-sm font-medium">25% Complete</CustomText>
            </View>
          </View>

          {/* Current Assessment */}
          <View className='bg-[#FFFFFF] p-5 rounded-2xl shadow-lg shadow-gray-200 mb-6' style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 1,
          }}>
            <View className="items-center mb-4">
              <CustomText weight={500} className="text-[#4A90E2] text-sm px-4 py-1.5 rounded-2xl bg-[#DBEAFE]">
                Current Assessment
              </CustomText>
            </View>
            
            <View className="items-center">
              <View className="w-16 h-16 bg-[#DBEAFE] rounded-full items-center justify-center mb-4">
                <Volume2 size={28} color="#4A90E2" />
              </View>
              <View className="w-full">
                <CustomText weight={700} className="text-center text-gray-900 text-xl font-bold mb-1.5">Speech Analysis</CustomText>
                <CustomText weight={400} className="text-center text-gray-600 text-sm mb-5 px-2">
                  Record and analyse speech patterns
                </CustomText>
                <View className="flex-row items-center justify-center mb-3">
                  <View className="flex-row items-center">
                    <Clock size={16} color="#6B7280" />
                    <CustomText weight={400} className="text-gray-600 text-sm ml-1.5 self-center">3-5 min</CustomText>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => navigateToAssessment('RecordingScreen')}
                  className="w-full bg-[#4A90E2] rounded-2xl py-3.5 flex-row items-center justify-center shadow-lg"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4,
                    elevation: 1,
                  }}
                >
                  <CustomText weight={600} className="text-white font-semibold text-lg mr-2">
                    Next
                  </CustomText>
                  <ArrowRight size={18} color="white" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Assessment Overview */}
          <AssessmentOverview />

          {/* Progress Summary
          <View className="mt-6 p-4 bg-gray-50 rounded-lg">
            <Text className="text-gray-700 font-medium mb-2">Next Steps</Text>
            <Text className="text-gray-600 text-sm leading-relaxed">
              Complete the Speech Analysis assessment to unlock the MCQ Assessment. 
              Each assessment helps us build a comprehensive profile of your cognitive patterns.
            </Text>
          </View> */}
        </View>
      </ScrollView>
  );
};

export default SpeechProgressScreen;
