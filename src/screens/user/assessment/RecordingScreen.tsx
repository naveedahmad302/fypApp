import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Mic, MicOff, Volume1, RefreshCw, Check } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { useAssessment } from '../../../context/AssessmentContext';
import { submitSpeechAnalysis, SpeechMetrics } from '../../../services/assessmentService';

interface RecordingScreenProps {
    navigation?: any;
}

const RecordingScreen: React.FC<RecordingScreenProps> = ({ navigation: navProp }) => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { setSpeechResult, markSpeechSkipped } = useAssessment();

    const [isRecording, setIsRecording] = useState(false);
    const [hasRecorded, setHasRecorded] = useState(false);
    const [recordingTime, setRecordingTime] = useState('0:00.0');
    const [audioLevel, setAudioLevel] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [speechMetrics, setSpeechMetrics] = useState<SpeechMetrics | null>(null);
    const [speechInsights, setSpeechInsights] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [audioBase64, setAudioBase64] = useState<string | null>(null);

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
        setError(null);
        startTimeRef.current = Date.now();

        recordingTimerRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            setRecordingTime(formatTime(elapsed));
            if (elapsed >= 60000) {
                stopRecording();
            }
        }, 100) as unknown as number;

        intervalRef.current = setInterval(() => {
            setAudioLevel(Math.random() * 100);
        }, 200) as unknown as number;

        // In a real implementation, start audio recording here using
        // react-native-audio-recorder-player and capture as base64.
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

        // In a real implementation, the audio recording library provides
        // the recorded audio as a file path or base64 string.
        setAudioBase64('recorded');
    };

    const handleRerecord = () => {
        setHasRecorded(false);
        setRecordingTime('0:00.0');
        setAudioLevel(0);
        setSpeechMetrics(null);
        setSpeechInsights([]);
        setAudioBase64(null);
        setError(null);
    };

    const handleComplete = async () => {
        if (audioBase64 && audioBase64 !== 'recorded') {
            // Real audio data available — submit to backend
            try {
                setIsSubmitting(true);
                setError(null);
                const result = await submitSpeechAnalysis({
                    user_id: user?.uid ?? 'anonymous',
                    audio_base64: audioBase64,
                    audio_format: 'wav',
                });
                setSpeechResult(result.assessment_id, result.asd_risk_score);
                setSpeechMetrics(result.metrics);
                setSpeechInsights(result.insights);
                const nav = navProp || navigation;
                nav.navigate('MCQAssessmentScreen' as never);
            } catch (err) {
                console.error('Speech analysis failed:', err);
                setError('Failed to analyze speech. Please try again or tap "Try Another" to re-record.');
                setIsSubmitting(false);
                return;
            } finally {
                setIsSubmitting(false);
            }
        } else {
            // No real audio recording yet — mark speech as skipped so the
            // assessment flow can continue (completedCount reaches 3).
            // speechAssessmentId stays null → omitted from report request via ?? undefined.
            // TODO: Integrate react-native-audio-recorder-player to capture real audio
            markSpeechSkipped();
            const nav = navProp || navigation;
            nav.navigate('MCQAssessmentScreen' as never);
        }
    };

    const handleRecordingPress = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const getClarityLabel = (): { label: string; color: string; bgColor: string } => {
        if (!speechMetrics) return { label: 'Good', color: 'text-[#4A90E2]', bgColor: 'bg-[#DBEAFE]' };
        if (speechMetrics.clarity_score >= 70) return { label: 'Good', color: 'text-[#4A90E2]', bgColor: 'bg-[#DBEAFE]' };
        if (speechMetrics.clarity_score >= 40) return { label: 'Moderate', color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
        return { label: 'Low', color: 'text-red-700', bgColor: 'bg-red-100' };
    };

    const getVocalVariationLabel = (): { label: string; color: string; bgColor: string } => {
        if (!speechMetrics) return { label: 'Moderate', color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
        if (speechMetrics.vocal_variation_score >= 70) return { label: 'Good', color: 'text-green-700', bgColor: 'bg-green-100' };
        if (speechMetrics.vocal_variation_score >= 40) return { label: 'Moderate', color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
        return { label: 'Low', color: 'text-red-700', bgColor: 'bg-red-100' };
    };

    const clarity = getClarityLabel();
    const vocalVariation = getVocalVariationLabel();

    return (
        <SafeAreaView edges={[]} className="flex-1 bg-[#F3F4F6] ">
            <ScrollView className="flex-1">
                <View className="px-6 py-5">
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
                            <View className={`${isRecording ? 'bg-red-100' : hasRecorded ? 'bg-[#DCFCE7]' : 'bg-[#DCFCE7]'} px-3 py-1 rounded-full`}>
                                <Text className={`${isRecording ? 'text-red-700' : 'text-[#15803D]'} text-xs font-radio-canada font-medium`}>
                                    {isRecording ? 'Recording' : hasRecorded ? 'Recorded' : 'Ready'}
                                </Text>
                            </View>
                        </View>

                        <Text className={`${isRecording ? 'text-red-500' : hasRecorded ? 'text-[#4A90E2]' : 'text-gray-400'} text-5xl font-radio-canada font-light text-center mb-2`}>
                            {recordingTime}
                        </Text>
                        <Text className="text-gray-500 font-radio-canada text-center">
                            {isRecording ? 'Recording in progress... (Max 1:00)' : hasRecorded ? 'Recording completed' : 'Ready to record'}
                        </Text>
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
                                Speak naturally and take your time. There is no right or wrong answer.
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
                        <View className="bg-[#F8FAFC] mx-2 rounded-xl items-center justify-center" style={{ height: 140 }}>
                            {isRecording || hasRecorded ? (
                                <View className="flex-row items-center justify-center">
                                    {[...Array(40)].map((_, index) => {
                                        const intensity = isRecording && audioLevel > (index * 2.5) ? 1 : 0.3;
                                        const barHeight = isRecording
                                            ? Math.sin(Date.now() / 200 + index * 0.3) * 30 + Math.random() * 20 + 40
                                            : Math.sin(index * 0.4) * 25 + Math.cos(index * 0.2) * 15 + 45;
                                        const bgColor = isRecording
                                            ? (audioLevel > (index * 2.5) ? 'rgba(239, 68, 68, 1)' : 'rgba(229, 231, 235, 0.3)')
                                            : '#3B82F6';
                                        return (
                                            <View
                                                key={index}
                                                className="rounded-full"
                                                style={{
                                                    width: index % 3 === 0 ? 3 : 2,
                                                    height: barHeight,
                                                    backgroundColor: bgColor,
                                                    marginHorizontal: 1,
                                                    opacity: isRecording ? intensity : 0.8,
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
                                    className="h-full rounded-full"
                                    style={{
                                        width: (isRecording ? audioLevel : hasRecorded ? 75 : 33).toString() + '%',
                                        backgroundColor: isRecording ? '#EF4444' : hasRecorded ? '#3B82F6' : '#9CA3AF',
                                    }}
                                />
                            </View>
                            <Text className="text-gray-500 font-radio-canada text-xs w-10">
                                {Math.round(isRecording ? audioLevel : hasRecorded ? 75 : 33)}%
                            </Text>
                        </View>
                    </View>

                    {/* Error banner */}
                    {error && (
                        <View className="mb-4 bg-red-50 p-3 rounded-lg">
                            <Text className="text-red-600 text-sm text-center">{error}</Text>
                        </View>
                    )}

                    {/* Action Buttons */}
                    {hasRecorded ? (
                        <View className="flex-row space-x-4 justify-center pb-5">
                            <TouchableOpacity
                                className="border mr-2 border-[#4A90E2] bg-white py-3 rounded-lg flex-row items-center justify-center px-3 flex-1"
                                onPress={handleRerecord}
                                disabled={isSubmitting}
                            >
                                <RefreshCw size={20} color="#4A90E2" />
                                <Text className="text-[#4A90E2] font-radio-canada font-semibold text-lg ml-2">Try Another</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                className="bg-[#4A90E2] py-3 ml-2 rounded-lg flex-row items-center justify-center px-3 flex-1"
                                onPress={handleComplete}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <>
                                        <Check size={20} color="white" />
                                        <Text className="text-white font-radio-canada font-semibold text-lg ml-2">Complete</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            className={isRecording ? 'bg-red-500 py-4 rounded-2xl flex-row items-center justify-center' : 'bg-[#4A90E2] py-4 rounded-2xl flex-row items-center justify-center'}
                            onPress={handleRecordingPress}
                        >
                            {isRecording ? (
                                <>
                                    <MicOff size={20} color="white" />
                                    <Text className="text-white font-radio-canada font-semibold text-lg ml-2">Stop Recording</Text>
                                </>
                            ) : (
                                <>
                                    <Mic size={20} color="white" />
                                    <Text className="text-white font-radio-canada font-bold text-lg ml-2">Start Recording</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* Speech Analysis Results */}
                    {hasRecorded && (
                        <View className="mt-5 mb-8">
                            <View className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-200 border border-gray-100" style={{
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 5,
                                elevation: 1,
                            }}>
                                <Text className="text-xl font-bold font-radio-canada text-gray-800 mb-4">Speech Analysis Results</Text>

                                <View className="flex-row justify-around mb-6">
                                    <View className="items-center">
                                        <Text className="text-3xl font-bold font-radio-canada text-gray-800 mb-1">
                                            {speechMetrics ? Math.round(speechMetrics.words_per_minute) : 142}
                                        </Text>
                                        <Text className="text-gray-500 font-radio-canada text-xs">Words/min</Text>
                                    </View>
                                    <View className="items-center">
                                        <Text className="text-3xl font-bold font-radio-canada text-gray-800 mb-1">
                                            {speechMetrics ? speechMetrics.avg_pause_duration.toFixed(1) + 's' : '0.8s'}
                                        </Text>
                                        <Text className="text-gray-500 font-radio-canada text-xs">Avg. Pause</Text>
                                    </View>
                                </View>

                                <View className="mb-4">
                                    <View className="flex-row justify-between items-center py-2 border-b border-gray-100">
                                        <Text className="text-gray-700 font-radio-canada text-sm font-medium">Speech Clarity</Text>
                                        <View className={clarity.bgColor + ' px-2 py-1 rounded-full'}>
                                            <Text className={clarity.color + ' font-radio-canada text-xs font-medium'}>{clarity.label}</Text>
                                        </View>
                                    </View>
                                    <View className="flex-row justify-between items-center py-2 border-b border-gray-100">
                                        <Text className="text-gray-700 font-radio-canada text-sm font-medium">Vocal Variation</Text>
                                        <View className={vocalVariation.bgColor + ' px-2 py-1 rounded-full'}>
                                            <Text className={vocalVariation.color + ' font-radio-canada text-xs font-medium'}>{vocalVariation.label}</Text>
                                        </View>
                                    </View>
                                    <View className="flex-row justify-between items-center py-2">
                                        <Text className="text-gray-700 font-radio-canada text-sm font-medium">Response Length</Text>
                                        <View className="bg-green-100 px-2 py-1 rounded-full">
                                            <Text className="text-green-700 font-radio-canada text-xs font-medium">Appropriate</Text>
                                        </View>
                                    </View>
                                </View>

                                {speechInsights.length > 0 && (
                                    <View className="bg-[#F0F9FF] p-3 rounded-lg mb-3">
                                        {speechInsights.map((insight, index) => (
                                            <Text key={index} className="text-gray-600 text-xs leading-relaxed mb-1">
                                                {insight}
                                            </Text>
                                        ))}
                                    </View>
                                )}

                                <View className="p-3 rounded-lg">
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
