import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { CheckCircle, Award, TrendingUp, Target, Brain, Eye } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

interface AssessmentCompleteScreenProps {
    navigation?: any;
}

const AssessmentCompleteScreen: React.FC<AssessmentCompleteScreenProps> = ({ navigation: navProp }) => {
    const navigation = useNavigation();

    const handleViewResults = () => {
        const nav = navProp || navigation;
        nav.navigate('Report');
    };

    const handleBackToHome = () => {
        const nav = navProp || navigation;
        nav.navigate('Home');
    };

    return (
        <SafeAreaView className="flex-1 bg-[#F5F7FA]">
            <ScrollView className="flex-1 px-6 py-8">
                {/* Success Header */}
                <View className="items-center mb-8">
                    <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-4">
                        <CheckCircle size={40} color="#10B981" />
                    </View>
                    <Text className="text-2xl font-bold text-gray-800 mb-2">Assessment Complete!</Text>
                    <Text className="text-gray-600 text-center">
                        You've answered all 5 questions
                    </Text>
                </View>

                {/* Completion Stats */}
                <View className="bg-white rounded-2xl p-6 mb-6">
                    <Text className="text-lg font-semibold text-gray-800 mb-4">Summary</Text>

                    <View className="space-y-16">
                        <View className="flex-row items-center pb-2">

                            <View className="flex-1">
                                <Text className="text-gray-500 text-sm">Questions Answered</Text>
                            </View>
                            <Text className='font-medium'>5</Text>
                        </View>

                        <View className="flex-row items-center  pb-2">

                            <View className="flex-1">
                                <Text className="text-gray-500 text-sm">Time Taken</Text>
                            </View>
                            <Text className='font-medium'>~5 minutes</Text>

                        </View>

                        <View className="flex-row items-center">

                            <View className="flex-1">
                                <Text className="text-gray-500 text-sm">Status</Text>
                            </View>
                            <Text className='font-medium text-green-500'>Completed</Text>
                        </View>
                    </View>
                </View>

                {/* Achievement Badge */}
                {/* <View className="bg-gradient-to-r text from-[#4A90E2] to-[#6366F1] rounded-2xl p-6 mb-6">
                    <View className="flex-row items-center">
                        <View className="w-16 h-16 bg-white/20 rounded-full items-center justify-center mr-4">
                            <Award size={32} color="white" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-semibold text-lg mb-1">Achievement Unlocked!</Text>
                            <Text className="text-white/80 text-sm">
                                Comprehensive Assessment Completed
                            </Text>
                        </View>
                    </View>
                </View> */}

                {/* Next Steps */}
                {/* <View className="bg-white rounded-2xl p-6 mb-6">
                    <Text className="text-lg font-semibold text-gray-800 mb-3">What's Next?</Text>

                    <View className="space-y-3">
                        <View className="flex-row items-start">
                            <TrendingUp size={20} color="#4A90E2" className="mr-3 mt-0.5" />
                            <Text className="text-gray-600 text-sm flex-1">
                                View your detailed assessment results and insights
                            </Text>
                        </View>
                        <View className="flex-row items-start">
                            <Target size={20} color="#4A90E2" className="mr-3 mt-0.5" />
                            <Text className="text-gray-600 text-sm flex-1">
                                Track your progress over time
                            </Text>
                        </View>
                        <View className="flex-row items-start">
                            <Brain size={20} color="#4A90E2" className="mr-3 mt-0.5" />
                            <Text className="text-gray-600 text-sm flex-1">
                                Get personalized recommendations
                            </Text>
                        </View>
                    </View>
                </View> */}

                {/* Action Buttons */}
                <View className="space-y-3 mb-8">
                    <TouchableOpacity
                        onPress={handleViewResults}
                        className="bg-[#4A90E2] py-4 rounded-2xl flex-row items-center justify-center"
                    >
                        <Text className="text-white font-semibold text-lg mr-2">View Your Assessment Report</Text>
                        {/* <TrendingUp size={20} color="white" /> */}
                    </TouchableOpacity>

                   
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default AssessmentCompleteScreen;
