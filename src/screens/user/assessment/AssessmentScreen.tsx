import React from 'react';
import { View, ScrollView, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AssessmentProgressCard from './components/AssessmentProgressCard';
import CurrentAssessmentCard from './components/CurrentAssessmentCard';
import AssessmentOverview from './components/AssessmentOverview';

const AssessmentScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const handleStartEyeTracking = () => {
    navigation.navigate('EyeTrackingAnalysis');
  };

  const handleBackPress = () => {
    
    
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F9FAFB]">
      <ScrollView showsVerticalScrollIndicator={false}>

      <View className="flex-1">
        <ScrollView className="flex-1 bg-[#F9FAFB]">
          <View className="p-5 px-8 space-y-4">
            <AssessmentProgressCard />
            <CurrentAssessmentCard onPress={handleStartEyeTracking} />
            <AssessmentOverview />
          </View>
        </ScrollView>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AssessmentScreen;