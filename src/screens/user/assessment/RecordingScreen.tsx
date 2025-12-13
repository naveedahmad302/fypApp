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
        <SafeAreaView edges={[]} className="flex-1 bg-[#F3F4F6] ">
            <ScrollView className="flex-1">
                <View className="px-6 py-5">
                    {/* Header */}
                    <Text className="text-gray-500 text-sm mb-5 ">
                        Record your voice while responding to prompts
                    </Text>

                    {/* Recording Status */}
                    <View className="mb-5 bg-white p-3 rounded-2xl shadow-lg shadow-gray-200" style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 5,
                        elevation: 1,
                    }}>
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-gray-800 text-based font-radio-canada font-bold ml-2">Recording Status</Text>
                            <View className={`${isRecording ? 'bg-red-100' :
                                hasRecorded ? 'bg-[#DCFCE7]' :
                                    'bg-[#DCFCE7]'
                                } px-3 py-1 rounded-full`}>
                                <Text className={`${isRecording ? 'text-red-700' : 'text-[#15803D]'} text-xs font-radio-canada font-medium`}>
                                    {isRecording ? 'Recording' :
                                        hasRecorded ? 'Recorded' :
                                            'Ready'}
                                </Text>
                            </View>
                        </View>

                        <Text className={`${isRecording ? 'text-red-500' :
                            hasRecorded ? 'text-[#4A90E2]' :
                                'text-gray-400'
                            } text-5xl font-radio-canada font-light text-center mb-2`}>
                            {recordingTime}
                        </Text>
                        <Text className="text-gray-500 font-radio-canada text-center">
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
                                <Text className="text-gray-500 font-radio-canada text-xs text-center mt-1">
                                    {Math.max(0, 60 - Math.floor((Date.now() - startTimeRef.current) / 1000))}s remaining
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Speaking Prompt */}
                    <View className="mb-5 bg-white p-3 rounded-2xl shadow-lg shadow-gray-200" style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 5,
                        elevation: 1,
                    }}>
                        <Text className="text-gray-800 font-radio-canada text-base ml-2 font-bold mb-3">Speaking Prompt</Text>
                        <View className=" p-4 mx-2 rounded-lg bg-[#F3F4F6] ">
                            <Text className="text-gray-800 font-radio-canada font-bold mb-2  text-center">
                                Please describe what you did today
                            </Text>
                            <Text className="text-gray-500 font-radio-canada text-sm text-center">
                                Speak naturally and take your time. There's no right or wrong answer.
                            </Text>
                        </View>
                    </View>

                    {/* Audio Waveform */}
                    <View className="mb-5 bg-white p-3 rounded-2xl shadow-lg shadow-gray-200" style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 5,
                        elevation: 1,
                    }}>
                        <Text className="text-gray-800 font-radio-canada text-base font-bold mb-3">Audio Waveform</Text>
                        <View className="bg-gradient-to-b from-[#F8FAFC] to-[#F1F5F9] mx-2 rounded-xl items-center justify-center" style={{ height: 140 }}>
                            {isRecording ? (
                                <View className="flex-row items-center justify-center">
                                    {[...Array(40)].map((_, index) => {
                                        const intensity = audioLevel > (index * 2.5) ? 1 : 0.3;
                                        const height = isRecording 
                                            ? Math.sin(Date.now() / 200 + index * 0.3) * 30 + 
                                              Math.random() * 20 + 40
                                            : 30;
                                        const colorIntensity = audioLevel > (index * 2.5) ? 
                                            `rgba(239, 68, 68, ${intensity})` : 
                                            `rgba(229, 231, 235, ${intensity})`;
                                        
                                        return (
                                            <View
                                                key={index}
                                                className="rounded-full transition-all duration-150"
                                                style={{
                                                    width: index % 3 === 0 ? 3 : 2,
                                                    height: height,
                                                    backgroundColor: colorIntensity,
                                                    marginHorizontal: 1,
                                                    transform: [{ scaleY: intensity }],
                                                    shadowColor: audioLevel > (index * 2.5) ? '#EF4444' : 'transparent',
                                                    shadowOffset: { width: 0, height: 0 },
                                                    shadowOpacity: 0.3,
                                                    shadowRadius: 2,
                                                    elevation: audioLevel > (index * 2.5) ? 2 : 0,
                                                }}
                                            />
                                        );
                                    })}
                                </View>
                            ) : hasRecorded ? (
                                <View className="flex-row items-center justify-center">
                                    {[...Array(40)].map((_, index) => {
                                        const height = Math.sin(index * 0.4) * 25 + 
                                                      Math.cos(index * 0.2) * 15 + 45;
                                        return (
                                            <View
                                                key={index}
                                                className="bg-gradient-to-t from-[#3B82F6] to-[#60A5FA] rounded-full"
                                                style={{
                                                    width: index % 4 === 0 ? 3 : 2,
                                                    height: height,
                                                    marginHorizontal: 1,
                                                    opacity: 0.8,
                                                    shadowColor: '#3B82F6',
                                                    shadowOffset: { width: 0, height: 1 },
                                                    shadowOpacity: 0.2,
                                                    shadowRadius: 1,
                                                    elevation: 1,
                                                }}
                                            />
                                        );
                                    })}
                                </View>
                            ) : (
                                <View className="items-center justify-center">
                                    <Mic size={48} color="#9CA3AF" />
                                    <Text className="text-gray-400 font-radio-canada text-xs mt-2">Ready to record</Text>
                                </View>
                            )}
                        </View>
                        <View className="flex-row items-center mt-4">
                            <Volume1 size={20} color="#6B7280" />
                            <View className="flex-1 mx-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <View
                                    className={`h-full rounded-full transition-all duration-300 ${isRecording ? 'bg-gradient-to-r from-red-400 to-red-500' :
                                        hasRecorded ? 'bg-gradient-to-r from-blue-400 to-blue-500' :
                                            'bg-gray-400'
                                        }`}
                                    style={{ 
                                        width: `${isRecording ? audioLevel : hasRecorded ? 75 : 33}%`,
                                        shadowColor: isRecording ? '#EF4444' : hasRecorded ? '#3B82F6' : 'transparent',
                                        shadowOffset: { width: 0, height: 0 },
                                        shadowOpacity: 0.3,
                                        shadowRadius: 3,
                                        elevation: 2,
                                    }}
                                />
                            </View>
                            <Text className="text-gray-500 font-radio-canada text-xs w-10">
                                {Math.round(isRecording ? audioLevel : hasRecorded ? 75 : 33)}%
                            </Text>
                        </View>
                    </View>
                    {/* Action Buttons */}
                    {hasRecorded ? (
                        <View className="flex-row space-x-4 justify-center pb-5">
                            {/* Try Another Button */}
                            <TouchableOpacity
                                className="border mr-2 border-[#4A90E2] bg-white py-3 rounded-lg flex-row items-center justify-center px-3 flex-1"
                                onPress={handleTryAnother}
                            >
                                <RefreshCw size={20} color="#4A90E2" className="mr-2" />
                                <Text className="text-[#4A90E2] font-radio-canada font-semibold text-lg mr-2">Try Another</Text>
                            </TouchableOpacity>

                            {/* Complete Button */}
                            <TouchableOpacity
                                className="bg-[#4A90E2] py-3 ml-2 rounded-lg flex-row items-center justify-center px-3 flex-1"
                                onPress={handleComplete}
                            >
                                <Check size={20} color="white" className="mr-2" />
                                <Text className="text-white font-radio-canada font-semibold text-lg ml-2">Complete</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            className={`${isRecording ? 'bg-red-500' : 'bg-[#4A90E2]'} py-4 rounded-2xl flex-row items-center justify-center`}
                            onPress={handleRecordingPress}
                        >
                            {isRecording ? (
                                <>
                                    <MicOff size={20} color="white" className="mr-2" />
                                    <Text className="text-white font-radio-canada font-semibold text-lg ml-2">Stop Recording</Text>
                                </>
                            ) : (
                                <>
                                    <Mic size={20} color="white" className="mr-2 " />
                                    <Text className="text-white font-radio-canada font-bold text-lg ml-2">Start Recording</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                    {/* Speech Analysis Results - Show when recording is complete */}
                    {hasRecorded && (
                        <View className="mb-8">
                            <View className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200 border border-gray-100" style={{
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 5,
                                elevation: 1,
                            }}>
                                <Text className="text-xl font-bold font-radio-canada text-gray-800 mb-4">Speech Analysis Results</Text>

                                {/* Metrics Section */}
                                <View className="flex-row justify-around mb-6">
                                    <View className="items-cente">
                                        <Text className="text-3xl font-bold font-radio-canada text-gray-800 mb-1">142</Text>
                                        <Text className="text-gray-500 font-radio-canada text-xs">Words/min</Text>
                                    </View>
                                    <View className="items-center">
                                        <Text className="text-3xl font-bold font-radio-canada text-gray-800 mb-1">0.8s</Text>
                                        <Text className="text-gray-500 font-radio-canada text-xs">Avg. Pause</Text>
                                    </View>
                                </View>

                                {/* Speech Characteristics */}
                                <View className="space-y-3 mb-4">
                                    <View className="flex-row justify-between items-center py-2 border-b border-gray-100">
                                        <Text className="text-gray-700 font-radio-canada text-sm font-medium">Speech Clarity</Text>
                                        <View className="bg-[#DBEAFE] px-2 py-1 rounded-full">
                                            <Text className="text-[#4A90E2] font-radio-canada text-xs font-medium">Good</Text>
                                        </View>
                                    </View>

                                    <View className="flex-row justify-between items-center py-2 border-b border-gray-100">
                                        <Text className="text-gray-700 font-radio-canada text-sm font-medium">Vocal Variation</Text>
                                        <View className="bg-yellow-100 px-2 py-1 rounded-full">
                                            <Text className="text-yellow-700 font-radio-canada text-xs font-medium">Moderate</Text>
                                        </View>
                                    </View>

                                    <View className="flex-row justify-between items-center py-2">
                                        <Text className="text-gray-800 font-radio-canada text-lg font-semibold mb-4">Recording Controls</Text>
                                        <View className="bg-green-100 px-2 py-1 rounded-full">
                                            <Text className="text-green-700 font-radio-canada text-xs font-medium">Appropriate</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Descriptive Text */}
                                <View className="\ p-3 rounded-lg">
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
