import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Mic, MicOff, Volume1, ChevronLeft, RefreshCw, Check } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface RecordingScreenProps {
    navigation?: any;
}

const RecordingScreen: React.FC<RecordingScreenProps> = ({ navigation: navProp }) => {
    const navigation = useNavigation();
    const [isRecording, setIsRecording] = useState(false);
    const [hasRecorded, setHasRecorded] = useState(false);
    const [recordingTime, setRecordingTime] = useState('0:00.0');
    const [audioLevel, setAudioLevel] = useState(0);
    const intervalRef = useRef<number | null>(null);
    const recordingTimerRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        };
    }, []);

    const formatTime = (milliseconds: number): string => {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const tenths = Math.floor((milliseconds % 1000) / 100);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
    };

    const startRecording = () => {
        setIsRecording(true);
        setRecordingTime('0:00.0');
        startTimeRef.current = Date.now();

        // Start recording timer
        recordingTimerRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            setRecordingTime(formatTime(elapsed));

            // Check if 1 minute (60000ms) has passed
            if (elapsed >= 60000) {
                stopRecording();
            }
        }, 100) as unknown as number;

        // Simulate audio level changes
        intervalRef.current = setInterval(() => {
            setAudioLevel(Math.random() * 100);
        }, 200) as unknown as number;
    };

    const stopRecording = () => {
        setIsRecording(false);
        setHasRecorded(true);

        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        setAudioLevel(0);
    };

    const handleRerecord = () => {
        setHasRecorded(false);
        setRecordingTime('0:00.0');
        setAudioLevel(0);
    };

    const handleComplete = () => {
        const nav = navProp || navigation;
        nav.navigate('MCQAssessmentScreen');
    };

    const handleRecordingPress = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const navigateToAssessment = () => {
        const nav = navProp || navigation;
        nav.navigate('MCQAssessmentScreen');
    };

    const handleTryAnother = () => {
        handleRerecord();
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView className="flex-1">
                <View className="px-6 py-8">
                    {/* Header */}
                    <Text className="text-gray-500 text-sm mb-6">
                        Record your voice while responding to prompts
                    </Text>

                    {/* Recording Status */}
                    <View className="mb-8">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-gray-800 text-lg font-semibold">Recording Status</Text>
                            <View className={`${isRecording ? 'bg-red-500' :
                                    hasRecorded ? 'bg-[#4A90E2]' :
                                        'bg-[#4A90E2]'
                                } px-3 py-1 rounded-full`}>
                                <Text className="text-white text-xs font-medium">
                                    {isRecording ? 'Recording' :
                                        hasRecorded ? 'Recorded' :
                                            'Ready'}
                                </Text>
                            </View>
                        </View>

                        <Text className={`${isRecording ? 'text-red-500' :
                                hasRecorded ? 'text-[#4A90E2]' :
                                    'text-gray-400'
                            } text-4xl font-light text-center mb-2`}>
                            {recordingTime}
                        </Text>
                        <Text className="text-gray-500 text-center">
                            {isRecording ? 'Recording in progress... (Max 1:00)' :
                                hasRecorded ? 'Recording completed' :
                                    'Ready to record'}
                        </Text>

                        {/* Progress indicator for 1-minute limit */}
                        {isRecording && (
                            <View className="mt-4">
                                <View className="w-full h-2 bg-gray-200 rounded-full">
                                    <View
                                        className="h-full bg-red-500 rounded-full transition-all duration-100"
                                        style={{
                                            width: `${Math.min((Date.now() - startTimeRef.current) / 60000 * 100, 100)}%`
                                        }}
                                    />
                                </View>
                                <Text className="text-gray-500 text-xs text-center mt-1">
                                    {Math.max(0, 60 - Math.floor((Date.now() - startTimeRef.current) / 1000))}s remaining
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Speaking Prompt */}
                    <View className="mb-8">
                        <Text className="text-gray-800 text-lg font-semibold mb-4">Speaking Prompt</Text>
                        <View className="bg-gray-100 p-4 rounded-lg">
                            <Text className="text-gray-800 font-medium mb-2">
                                Please describe what you did today
                            </Text>
                            <Text className="text-gray-500 text-sm">
                                Speak naturally and take your time. There's no right or wrong answer.
                            </Text>
                        </View>
                    </View>

                    {/* Audio Waveform */}
                    <View className="mb-8">
                        <Text className="text-gray-800 text-lg font-semibold mb-4">Audio Waveform</Text>
                        <View className="bg-gray-100 p-8 rounded-lg items-center justify-center" style={{ height: 120 }}>
                            {isRecording ? (
                                <View className="flex-row items-center space-x-1">
                                    {[...Array(20)].map((_, index) => (
                                        <View
                                            key={index}
                                            className={`w-1 rounded-full ${audioLevel > (index * 5) ? 'bg-red-500' : 'bg-gray-300'
                                                }`}
                                            style={{ height: Math.random() * 60 + 20 }}
                                        />
                                    ))}
                                </View>
                            ) : hasRecorded ? (
                                <View className="flex-row items-center space-x-1">
                                    {[...Array(20)].map((_, index) => (
                                        <View
                                            key={index}
                                            className="w-1 bg-blue-400 rounded-full"
                                            style={{ height: Math.random() * 40 + 30 }}
                                        />
                                    ))}
                                </View>
                            ) : (
                                <Mic size={40} color="#9CA3AF" />
                            )}
                        </View>
                        <View className="flex-row items-center mt-4">
                            <Volume1 size={20} color="#9CA3AF" />
                            <View className="flex-1 mx-3 h-1 bg-gray-200 rounded-full">
                                <View
                                    className={`h-full rounded-full transition-all duration-200 ${isRecording ? 'bg-red-500' :
                                            hasRecorded ? 'bg-[#4A90E2]' :
                                                'bg-gray-400'
                                        }`}
                                    style={{ width: `${isRecording ? audioLevel : hasRecorded ? 75 : 33}%` }}
                                />
                            </View>
                        </View>
                    </View>
                    {/* Action Buttons */}
                    {hasRecorded ? (
                        <View className="space-y-3 pb-5">
                            {/* Try Another Button */}
                            <TouchableOpacity
                                className="border-2 border-[#4A90E2] bg-white py-4 rounded-lg flex-row items-center justify-center"
                                onPress={handleTryAnother}
                            >
                                <RefreshCw size={20} color="#4A90E2" className="mr-2" />
                                <Text className="text-[#4A90E2] font-semibold text-lg ml-2">Try Another</Text>
                            </TouchableOpacity>

                            {/* Complete Button */}
                            <TouchableOpacity
                                className="bg-[#4A90E2] py-4 rounded-lg flex-row items-center justify-center"
                                onPress={handleComplete}
                            >
                                <Check size={20} color="white" className="mr-2" />
                                <Text className="text-white font-semibold text-lg ml-2">Complete</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            className={`${isRecording ? 'bg-red-500' : 'bg-[#4A90E2]'} py-4 rounded-lg flex-row items-center justify-center`}
                            onPress={handleRecordingPress}
                        >
                            {isRecording ? (
                                <>
                                    <MicOff size={20} color="white" className="mr-2" />
                                    <Text className="text-white font-semibold text-lg ml-2">Stop Recording</Text>
                                </>
                            ) : (
                                <>
                                    <Mic size={20} color="white" className="mr-2" />
                                    <Text className="text-white font-semibold text-lg ml-2">Start Recording</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                    {/* Speech Analysis Results - Show when recording is complete */}
                    {hasRecorded && (
                        <View className="mb-8">
                            <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <Text className="text-xl font-bold text-gray-800 mb-4">Speech Analysis Results</Text>

                                {/* Metrics Section */}
                                <View className="flex-row justify-around mb-6">
                                    <View className="items-center">
                                        <Text className="text-3xl font-bold text-gray-800 mb-1">142</Text>
                                        <Text className="text-gray-500 text-xs">Words/min</Text>
                                    </View>
                                    <View className="items-center">
                                        <Text className="text-3xl font-bold text-gray-800 mb-1">0.8s</Text>
                                        <Text className="text-gray-500 text-xs">Avg. Pause</Text>
                                    </View>
                                </View>

                                {/* Speech Characteristics */}
                                <View className="space-y-3 mb-4">
                                    <View className="flex-row justify-between items-center py-2 border-b border-gray-100">
                                        <Text className="text-gray-700 text-sm font-medium">Speech Clarity</Text>
                                        <View className="bg-green-100 px-2 py-1 rounded-full">
                                            <Text className="text-green-700 text-xs font-medium">Good</Text>
                                        </View>
                                    </View>

                                    <View className="flex-row justify-between items-center py-2 border-b border-gray-100">
                                        <Text className="text-gray-700 text-sm font-medium">Vocal Variation</Text>
                                        <View className="bg-yellow-100 px-2 py-1 rounded-full">
                                            <Text className="text-yellow-700 text-xs font-medium">Moderate</Text>
                                        </View>
                                    </View>

                                    <View className="flex-row justify-between items-center py-2">
                                        <Text className="text-gray-700 text-sm font-medium">Response Length</Text>
                                        <View className="bg-green-100 px-2 py-1 rounded-full">
                                            <Text className="text-green-700 text-xs font-medium">Appropriate</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Descriptive Text */}
                                <View className="bg-blue-50 p-3 rounded-lg">
                                    <Text className="text-gray-600 text-xs leading-relaxed text-center">
                                        Speech patterns recorded and saved to your assessment profile.
                                        Click Complete to proceed to the next assessment.
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}


                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default RecordingScreen;
