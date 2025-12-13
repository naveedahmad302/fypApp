import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Eye, Mic, HelpCircle, Users, Share2, Download } from 'lucide-react-native';
import { TReportTabStackNavigationProps } from '../../../navigation/userStack/types';

const ReportScreen: React.FC<TReportTabStackNavigationProps<'Report'>> = ({ navigation }) => {
    const renderAssessmentItem = (
        iconName: string,
        title: string,
        status: string,
        score: string,
        progress: string,
        color: string,
        insights: string[]
    ) => (
        <View className="mb-6" key={title}>
            <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                    <View
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{ backgroundColor: `${color}20` }}
                    >
                        {iconName === 'eye-outline' && <Eye size={20} color={color} />}
                        {iconName === 'chatbubble-outline' && <Mic size={20} color={color} />}
                        {iconName === 'help-circle-outline' && <Users size={20} color={color} />}
                    </View>
                    <View className="ml-3">
                        <Text className="font-radio-canada font-bold text-gray-900">{title}</Text>
                        <Text className="text-green-500 text-sm font-radio-canada">{status}</Text>
                    </View>
                </View>
                <View className="flex-row items-center ">
                    <Text className="text-xl font-radio-canada font-bold text-gray-900">{score.split(' ')[0]}</Text>
                    <Text className="text-sm text-gray-500 ml-1 font-radio-canada">Score</Text>
                </View>
            </View>
            <View className="h-2 rounded-full bg-gray-200">
                <View
                    className="h-2 rounded-full"
                    style={{
                        width: progress,
                        backgroundColor: color
                    }}
                />
            </View>
            <Text className="text-gray-600 text-sm font-radio-canada mb-2 mt-4 ml-10 font-bold">Key Insights:</Text>
            {insights.map((insight, index) => (
                <Text key={index} className="text-gray-500 text-sm font-radio-canada ml-12 mb-1">{insight}</Text>
            ))}
        </View>
    );

    return (
        <ScrollView className="flex-1 bg-[#F9FAFB]" >
            <View className="items-center py-8 ">
                <View className="relative mb-6">
                    <View className="w-36 h-36 rounded-full border-8 border-blue-200 items-center justify-center">
                        <Text className="text-3xl font-radio-canada font-normal text-blue-500">66</Text>
                        <Text className="text-sm font-radio-canada font-normal text-[#6B7280]">Overall Score</Text>
                    </View>
                    <View className="absolute inset-0 w-36 h-36">
                        <View
                            className="w-full h-full rounded-full border-8 border-blue-500"
                            style={{
                                borderTopColor: '#3b82f6',
                                borderRightColor: '#3b82f6',
                                borderBottomColor: '#e5e7eb',
                                borderLeftColor: '#e5e7eb',
                                transform: [{ rotate: '45deg' }]
                            }}
                        />
                    </View>
                </View>
                <Text className="text-xl font-radio-canada font-bold mb-2 text-gray-900">Assessment Report</Text>
                <Text className="text-gray-600 text-center font-radio-canada px-6">
                    All assessment modules have been
                    completed successfully.
                </Text>
            </View>

            <View className=" mx-4 mt-4 rounded-lg p-4">
                <Text className="text-lg font-radio-canada font-semibold mb-4 text-gray-900">Assessment Results</Text>

                {/* Eye Tracking Assessment */}
                <View className="bg-white rounded-xl  p-4 mb-4" style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3,
                }}>
                    {renderAssessmentItem(
                        'eye-outline',
                        'Eye Tracking',
                        'Complete',
                        '72 Score',
                        '72%',
                        '#3b82f6',
                        [
                            '• Good attention span',
                            '• Consistent gaze patterns'
                        ]
                    )}
                </View>

                {/* Speech Analysis Assessment */}
                <View className="bg-white rounded-xl p-4 mb-4" style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3,
                }}>
                    {renderAssessmentItem(
                        'chatbubble-outline',
                        'Speech Analysis',
                        'Complete',
                        '58 Score',
                        '58%',
                        '#10b981',
                        [
                            '• Clear articulation',
                            '• Moderate pace'
                        ]
                    )}
                </View>

                {/* MCQ Assessment */}
                <View className="bg-white rounded-xl p-4 mb-4" style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3,
                }}>
                    {renderAssessmentItem(
                        'help-circle-outline',
                        'MCQ Assessment',
                        'Complete',
                        '65 Score',
                        '65%',
                        '#8b5cf6',
                        [
                            '• Comprehensive responses',
                            '• Thoughtful answers'
                        ]
                    )}
                </View>
            </View>

            <View className="flex-row mx-8 mb-6" style={{gap:10}}>
                <TouchableOpacity
                    className="flex-1 bg-white border border-blue-500 py-4 rounded-xl flex-row items-center justify-center"
                    onPress={() => console.log('Share Report')}
                >
                    <Share2 size={20} color="#3b82f6" />
                    <Text className="text-blue-500 text-center font-radio-canada font-medium ml-2">Share Report</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    className="flex-1 bg-blue-500 py-4 rounded-xl flex-row items-center justify-center"
                    onPress={() => console.log('Download PDF')}
                >
                    <Download size={20} color="#ffffff" />
                    <Text className="text-white text-center font-radio-canada font-medium ml-2">Download PDF</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

export default ReportScreen;