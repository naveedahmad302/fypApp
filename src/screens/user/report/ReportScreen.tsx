import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
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
                        <Icon name={iconName as any} size={20} color={color} />
                    </View>
                    <View className="ml-3">
                        <Text className="font-semibold text-gray-900">{title}</Text>
                        <Text className="text-green-500 text-sm">{status}</Text>
                    </View>
                </View>
                <Text className="text-xl font-bold text-gray-900">{score}</Text>
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
            <Text className="text-gray-600 text-sm mb-1 mt-2">Key Insights:</Text>
            {insights.map((insight, index) => (
                <Text key={index} className="text-gray-500 text-sm">{insight}</Text>
            ))}
        </View>
    );

    return (
        <ScrollView className="flex-1 bg-gray-50" >
            <View className="items-center py-8 bg-white">
                <View className="relative mb-6">
                    <View className="w-36 h-36 rounded-full border-8 border-blue-200 items-center justify-center">
                        <Text className="text-3xl font-normal font-radio-canada text-blue-500">66</Text>
                        <Text className="text-sm font-normal text-[#6B7280]">Overall Score</Text>
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
                <Text className="text-xl font-bold mb-2 text-gray-900">Assessment Report</Text>
                <Text className="text-gray-600 text-center font-radio-canada px-6">
                    All assessment modules have been
                    completed successfully.
                </Text>
            </View>

            <View className=" mx-4 mt-4 rounded-lg p-4">
                <Text className="text-lg font-semibold mb-4 text-gray-900">Assessment Results</Text>

                {/* Eye Tracking Assessment */}
                <View className="bg-white rounded-lg p-4 mb-4">
                    {renderAssessmentItem(
                        'eye-outline',
                        'Eye Tracking',
                        'Complete',
                        '72',
                        '72%',
                        '#3b82f6',
                        [
                            '• Good attention span',
                            '• Consistent gaze patterns'
                        ]
                    )}
                </View>

                {/* Speech Analysis Assessment */}
                <View className="bg-white rounded-lg p-4 mb-4">
                    {renderAssessmentItem(
                        'chatbubble-outline',
                        'Speech Analysis',
                        'Complete',
                        '58',
                        '58%',
                        '#10b981',
                        [
                            '• Clear articulation',
                            '• Moderate pace'
                        ]
                    )}
                </View>

                {/* MCQ Assessment */}
                <View className="bg-white rounded-lg p-4 mb-4">
                    {renderAssessmentItem(
                        'help-circle-outline',
                        'MCQ Assessment',
                        'Complete',
                        '65',
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
                    className="flex-1 bg-white border border-blue-500 py-4 rounded-2xl"
                    onPress={() => console.log('Share Report')}
                >
                    <Text className="text-blue-500 text-center font-medium">Share Report</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    className="flex-1 bg-blue-500 py-4 rounded-2xl"
                    onPress={() => console.log('Download PDF')}
                >
                    <Text className="text-white text-center font-medium">Download PDF</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

export default ReportScreen;