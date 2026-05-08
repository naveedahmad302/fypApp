import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Platform, PermissionsAndroid, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import RNFS from 'react-native-fs';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import SpeechRecordingCard from './components/SpeechRecordingCard';
import StartRecordingButton from './components/StartRecordingButton';
import { useAuth } from '../../../context/AuthContext';
import { useAssessment } from '../../../context/AssessmentContext';
import { submitSpeechAnalysis, healthCheck, SpeechMetrics, SpeechAnalysisResponse } from '../../../services/assessmentService';
import { API_BASE_URL } from '../../../services/api';

const audioRecorderPlayer = new AudioRecorderPlayer();
const MAX_RECORDING_DURATION_MS = 60000;
const CAPTURE_INTERVAL_MS = 1000; // Capture face every second during speech

interface RecordingScreenProps {
  navigation?: any;
}

// ── Helper Components ──

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext: string;
  color: 'blue' | 'purple' | 'green' | 'orange';
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, subtext, color }) => {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200',
    green: 'bg-green-50 border-green-200',
    orange: 'bg-orange-50 border-orange-200',
  };

  return (
    <View className={`${colorMap[color]} border rounded-xl p-3 mb-2 w-[48%]`}>
      <Text className="text-gray-500 text-xs mb-1">{label}</Text>
      <Text className="text-gray-800 text-xl font-bold">{value}</Text>
      <Text className="text-gray-400 text-xs">{subtext}</Text>
    </View>
  );
};

interface ScoreBarProps {
  label: string;
  score?: number;
  colorScheme: { bar: string; text: string };
}

const ScoreBar: React.FC<ScoreBarProps> = ({ label, score, colorScheme }) => {
  const displayScore = score !== undefined ? Math.round(score) : null;
  const widthPercent = displayScore !== null ? Math.min(100, Math.max(0, displayScore)) : 0;

  return (
    <View className="mb-3">
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-gray-700 text-sm">{label}</Text>
        <Text className={`text-sm font-semibold ${colorScheme.text}`}>
          {displayScore !== null ? `${displayScore}/100` : '--'}
        </Text>
      </View>
      <View className="bg-gray-200 h-2 rounded-full overflow-hidden">
        {displayScore !== null ? (
          <View
            className={`h-full rounded-full ${colorScheme.bar}`}
            style={{ width: `${widthPercent}%` }}
          />
        ) : (
          <View className="h-full rounded-full bg-gray-300 animate-pulse" style={{ width: '30%' }} />
        )}
      </View>
    </View>
  );
};

interface DetailItemProps {
  label: string;
  value: string;
}

const DetailItem: React.FC<DetailItemProps> = ({ label, value }) => (
  <View className="w-1/2 mb-2">
    <Text className="text-gray-500 text-xs">{label}</Text>
    <Text className="text-gray-800 text-sm font-medium">{value}</Text>
  </View>
);

interface BehaviorBadgeProps {
  label: string;
  detected: boolean;
  severity?: number;
}

const BehaviorBadge: React.FC<BehaviorBadgeProps> = ({ label, detected, severity }) => (
  <View
    className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${
      detected ? 'bg-red-100 border border-red-200' : 'bg-green-100 border border-green-200'
    }`}>
    <View className="flex-row items-center">
      <View
        className={`w-2 h-2 rounded-full mr-2 ${detected ? 'bg-red-500' : 'bg-green-500'}`}
      />
      <Text className={`text-xs font-medium ${detected ? 'text-red-700' : 'text-green-700'}`}>
        {label} {detected ? 'Detected' : 'Normal'}
      </Text>
      {detected && severity !== undefined && (
        <Text className="text-red-600 text-xs ml-1">({Math.round(severity)}%)</Text>
      )}
    </View>
  </View>
);

// ── Helper Functions ──

const getScoreColorScheme = (score?: number): { bar: string; text: string } => {
  if (score === undefined) return { bar: 'bg-gray-400', text: 'text-gray-400' };
  if (score >= 70) return { bar: 'bg-green-500', text: 'text-green-600' };
  if (score >= 40) return { bar: 'bg-yellow-500', text: 'text-yellow-600' };
  return { bar: 'bg-red-500', text: 'text-red-600' };
};

const getRiskLevel = (riskScore?: number): { label: string; color: string; bgColor: string } => {
  if (riskScore === undefined) return { label: 'Pending', color: 'text-gray-600', bgColor: 'bg-gray-100' };
  if (riskScore < 1.5) return { label: 'Low Risk', color: 'text-green-700', bgColor: 'bg-green-100' };
  if (riskScore < 3) return { label: 'Moderate Risk', color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
  return { label: 'High Risk', color: 'text-red-700', bgColor: 'bg-red-100' };
};

// ── Main Component ──

const RecordingScreen: React.FC<RecordingScreenProps> = ({ navigation: navProp }) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { setSpeechResult, markSpeechSkipped } = useAssessment();

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [recordingTime, setRecordingTime] = useState('0:00.0');
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [speechMetrics, setSpeechMetrics] = useState<SpeechMetrics | null>(null);
  const [speechInsights, setSpeechInsights] = useState<string[]>([]);
  const [speechResult, setSpeechResultState] = useState<SpeechAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);

  // Optional face detection state (simulates eye tracking integration)
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [faceDetectionEnabled, setFaceDetectionEnabled] = useState(false);

  // Refs
  const maxDurationTimerRef = useRef<number | null>(null);
  const recordedPathRef = useRef<string | null>(null);
  const isStoppingRef = useRef(false);
  const progressInterval = useRef<number | null>(null);
  const captureInterval = useRef<number | null>(null);
  const framesRef = useRef<string[]>([]);
  const waveformAnimation = useRef(new Animated.Value(0)).current;

  // Camera device (optional - for face detection during speech)
  const cameraDevice = useCameraDevice('front');
  const cameraRef = useRef<Camera>(null);

  // ── Permission & Cleanup ──
  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasCameraPermission(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
      if (progressInterval.current) clearInterval(progressInterval.current);
      if (captureInterval.current) clearTimeout(captureInterval.current);
      audioRecorderPlayer.removeRecordBackListener();
      audioRecorderPlayer.stopRecorder().catch(() => {});
    };
  }, []);

  // ── Waveform Animation ──
  useEffect(() => {
    if (isRecording) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(waveformAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(waveformAnimation, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [isRecording, waveformAnimation]);

  // ── Permissions ──
  const requestMicPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') { return true; }
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'This app needs access to your microphone to record speech for analysis.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  // ── Recording Control ──
  const startRecording = async () => {
    try {
      const hasPermission = await requestMicPermission();
      if (!hasPermission) {
        setError('Microphone permission is required. Please allow it in your device settings.');
        return;
      }

      setError(null);
      setIsRecording(true);
      setHasRecorded(false);
      setRecordingTime('0:00.0');
      setRecordingProgress(0);
      setAudioLevel(0);
      framesRef.current = [];

      // Backend health check
      try {
        await healthCheck();
        console.log('[Speech] Backend reachable at', API_BASE_URL);
      } catch (err) {
        console.warn('[Speech] Backend unreachable:', err);
      }

      // Start audio recording
      const path = Platform.select({
        android: `${RNFS.CachesDirectoryPath}/speech_recording.mp4`,
        ios: 'speech_recording.m4a',
      });
      await audioRecorderPlayer.startRecorder(path, undefined, true);
      recordedPathRef.current = path ?? null;

      // Progress listener
      audioRecorderPlayer.addRecordBackListener((e) => {
        const position = Math.floor(e.currentPosition);
        setRecordingTime(audioRecorderPlayer.mmssss(position));
        const progress = Math.min(100, (position / MAX_RECORDING_DURATION_MS) * 100);
        setRecordingProgress(progress);

        // Audio level metering
        const meter = e.currentMetering ?? -60;
        const normalised = Math.max(0, Math.min(100, ((meter + 60) / 60) * 100));
        setAudioLevel(normalised);
      });

      // Auto-stop after max duration
      maxDurationTimerRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_RECORDING_DURATION_MS) as unknown as number;

    } catch (err) {
      console.error('[Speech] Failed to start recording:', err);
      setError('Failed to start recording. Please check microphone permissions.');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }

    try {
      const resultPath = await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();

      setIsRecording(false);
      setHasRecorded(true);
      setRecordingProgress(100);
      setAudioLevel(0);

      // Read file as base64
      const filePath = resultPath.startsWith('file://') ? resultPath.slice(7) : resultPath;
      const base64Data = await RNFS.readFile(filePath, 'base64');
      setAudioBase64(base64Data);
      console.log('[Speech] Recording saved, base64 length:', base64Data.length);

    } catch (err) {
      console.error('[Speech] Failed to stop recording:', err);
      setError('Failed to save recording. Please try again.');
      setIsRecording(false);
    } finally {
      isStoppingRef.current = false;
    }
  };

  const handleRerecord = () => {
    setHasRecorded(false);
    setRecordingTime('0:00.0');
    setRecordingProgress(0);
    setAudioLevel(0);
    setSpeechMetrics(null);
    setSpeechInsights([]);
    setSpeechResultState(null);
    setAudioBase64(null);
    setError(null);
    recordedPathRef.current = null;
    framesRef.current = [];
  };

  const handleComplete = async () => {
    if (audioBase64) {
      try {
        setIsSubmitting(true);
        setError(null);

        // Check backend connectivity
        try {
          await healthCheck();
        } catch (healthErr) {
          console.error('[Speech] Backend health check failed:', healthErr);
          setError(
            'Backend server is not reachable.\n' +
            'Please ensure the server is running and check your network connection.'
          );
          setIsSubmitting(false);
          return;
        }

        // user_id is no longer sent: the backend derives it from the verified ID token.
        const result = await submitSpeechAnalysis({
          audio_base64: audioBase64,
          audio_format: 'mp4',
        });

        setSpeechResult(result);
        setSpeechResultState(result);
        setSpeechMetrics(result.metrics);
        setSpeechInsights(result.insights);

        const nav = navProp || navigation;
        nav.navigate('MCQAssessmentScreen' as never);
      } catch (err) {
        console.error('[Speech] Analysis failed:', err);

        let errorMessage = 'Failed to analyze speech.\n';
        if (err instanceof Error) {
          if (err.message.includes('Network')) {
            errorMessage += 'Network connection failed. Please check your internet connection.';
          } else {
            errorMessage += `Error: ${err.message}`;
          }
        }
        setError(errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      markSpeechSkipped();
      const nav = navProp || navigation;
      nav.navigate('MCQAssessmentScreen' as never);
    }
  };

  // ── Audio Waveform Visualization ──
  const renderWaveform = useCallback(() => {
    return (
      <View className="flex-row items-center justify-center h-full px-4">
        {[...Array(40)].map((_, index) => {
          const animatedHeight = waveformAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [
              20 + Math.sin(index * 0.3) * 15,
              40 + Math.sin(index * 0.5 + Date.now() / 1000) * 20,
            ],
          });

          const intensity = isRecording && audioLevel > (index * 2.5) ? 1 : 0.3;
          const baseHeight = isRecording
            ? Math.sin(Date.now() / 200 + index * 0.3) * 30 + Math.random() * 20 + 40
            : Math.sin(index * 0.4) * 25 + Math.cos(index * 0.2) * 15 + 45;

          return (
            <Animated.View
              key={index}
              className="rounded-full mx-0.5"
              style={{
                width: index % 3 === 0 ? 3 : 2,
                height: isRecording ? animatedHeight : baseHeight,
                backgroundColor: isRecording
                  ? (audioLevel > (index * 2.5) ? '#EF4444' : 'rgba(229, 231, 235, 0.3)')
                  : '#3B82F6',
                opacity: isRecording ? intensity : 0.8,
              }}
            />
          );
        })}
      </View>
    );
  }, [isRecording, audioLevel, waveformAnimation]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1">
        <ScrollView className="flex-1 bg-gray-50">
          <View className="py-4">
            {/* Main Recording Card */}
            <SpeechRecordingCard
              isRecording={isRecording}
              recordingProgress={recordingProgress}
              audioLevel={audioLevel}
              recordingTime={recordingTime}>
              {renderWaveform()}
            </SpeechRecordingCard>

            {/* Error Banner */}
            {error && (
              <View className="mx-4 mt-4 bg-red-50 p-3 rounded-lg">
                <Text className="text-red-600 text-sm text-center">{error}</Text>
              </View>
            )}

            {/* Optional: Face Detection Integration Hint */}
            {/* {!isRecording && !hasRecorded && hasCameraPermission && cameraDevice && (
              <View className="mx-4 mt-4 bg-blue-50 p-3 rounded-xl border border-blue-200">
                <Text className="text-blue-800 text-xs leading-relaxed text-center">
                  Tip: Face detection can be enabled to analyze gaze patterns during speech.
                  This provides additional behavioral insights for the assessment.
                </Text>
              </View>
            )} */}

            {/* Recording Controls */}
            <View className="px-4 mt-6">
              <StartRecordingButton
                isRecording={isRecording}
                hasRecorded={hasRecorded}
                isSubmitting={isSubmitting}
                onStart={startRecording}
                onStop={stopRecording}
                onRerecord={handleRerecord}
                onComplete={handleComplete}
              />
            </View>

            {/* Info Card when idle */}
            {!isRecording && !hasRecorded && !isSubmitting && (
              <View className="mx-4 mt-4 bg-white p-4 rounded-xl border border-gray-200">
                <Text className="text-gray-600 text-xs leading-relaxed text-center">
                  <Text className="font-semibold">Instructions:</Text>{'\n'}
                  1. Speak clearly into the microphone{'\n'}
                  2. Describe your day or any topic you prefer{'\n'}
                  3. Recording will auto-stop after 60 seconds{'\n'}
                  4. You can re-record if needed
                </Text>
              </View>
            )}

            {/* Speech Analysis Results */}
            {hasRecorded && (
              <View className="mx-4 mt-6 mb-8">
                <View
                  className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 5,
                    elevation: 1,
                  }}>
                  <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-xl font-bold text-gray-800">
                      Speech Analysis Results
                    </Text>
                    {speechMetrics && (
                      <View className={`px-3 py-1 rounded-full ${getRiskLevel(speechResult?.asd_risk_score).bgColor}`}>
                        <Text className={`text-xs font-semibold ${getRiskLevel(speechResult?.asd_risk_score).color}`}>
                          {getRiskLevel(speechResult?.asd_risk_score).label}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Primary Metrics Grid */}
                  <View className="flex-row flex-wrap justify-between mb-6">
                    <MetricCard
                      label="Words/Min"
                      value={speechMetrics ? Math.round(speechMetrics.words_per_minute) : '--'}
                      subtext="Speaking rate"
                      color="blue"
                    />
                    <MetricCard
                      label="Avg Pause"
                      value={speechMetrics ? `${speechMetrics.avg_pause_duration.toFixed(2)}s` : '--'}
                      subtext="Pause duration"
                      color="purple"
                    />
                    <MetricCard
                      label="Duration"
                      value={speechMetrics ? `${speechMetrics.duration_sec.toFixed(1)}s` : '--'}
                      subtext="Recording time"
                      color="green"
                    />
                    <MetricCard
                      label="Pauses"
                      value={speechMetrics ? speechMetrics.pause_count : '--'}
                      subtext="Total pauses"
                      color="orange"
                    />
                  </View>

                  {/* Scores with Progress Bars */}
                  <View className="mb-4">
                    <Text className="text-sm font-semibold text-gray-700 mb-3">Speech Quality Scores</Text>

                    <ScoreBar
                      label="Speech Clarity"
                      score={speechMetrics?.clarity_score}
                      colorScheme={getScoreColorScheme(speechMetrics?.clarity_score)}
                    />
                    <ScoreBar
                      label="Vocal Variation"
                      score={speechMetrics?.vocal_variation_score}
                      colorScheme={getScoreColorScheme(speechMetrics?.vocal_variation_score)}
                    />
                    <ScoreBar
                      label="Prosody (Melody)"
                      score={speechMetrics?.prosody_score}
                      colorScheme={getScoreColorScheme(speechMetrics?.prosody_score)}
                    />
                    <ScoreBar
                      label="Rhythm Variability"
                      score={speechMetrics?.rhythm_variability}
                      colorScheme={getScoreColorScheme(speechMetrics?.rhythm_variability)}
                    />
                  </View>

                  {/* Pitch & Energy Metrics */}
                  {speechMetrics && (
                    <View className="mb-4 bg-gray-50 rounded-xl p-4">
                      <Text className="text-sm font-semibold text-gray-700 mb-3">Acoustic Features</Text>
                      <View className="flex-row flex-wrap">
                        <DetailItem label="Pitch Mean" value={`${speechMetrics.pitch_mean.toFixed(1)} Hz`} />
                        <DetailItem label="Pitch Std" value={`${speechMetrics.pitch_std.toFixed(1)} Hz`} />
                        <DetailItem label="Energy Mean" value={`${speechMetrics.energy_mean.toFixed(3)}`} />
                        <DetailItem label="Voiced Fraction" value={`${(speechMetrics.voiced_fraction * 100).toFixed(1)}%`} />
                        <DetailItem label="Pitch Jitter" value={`${speechMetrics.pitch_jitter.toFixed(3)}`} />
                        <DetailItem label="Energy Shimmer" value={`${speechMetrics.energy_shimmer.toFixed(3)}`} />
                        <DetailItem label="Hesitations" value={speechMetrics.hesitation_count.toString()} />
                        <DetailItem label="Monotone Score" value={`${speechMetrics.monotone_score.toFixed(1)}`} />
                      </View>
                    </View>
                  )}

                  {/* Behavioral Flags */}
                  {speechMetrics && (
                    <View className="mb-4">
                      <Text className="text-sm font-semibold text-gray-700 mb-3">Behavioral Indicators</Text>
                      <View className="flex-row flex-wrap">
                        <BehaviorBadge
                          label="Monotone"
                          detected={speechMetrics.monotone_score > 50}
                          severity={speechMetrics.monotone_score}
                        />
                        <BehaviorBadge
                          label="Echolalia"
                          detected={false}
                        />
                        <BehaviorBadge
                          label="Rhythm Issues"
                          detected={speechMetrics.rhythm_variability < 30}
                        />
                        <BehaviorBadge
                          label="Atypical Prosody"
                          detected={speechMetrics.prosody_score < 40}
                        />
                      </View>
                    </View>
                  )}

                  {/* ASD Risk Assessment */}
                  {speechMetrics && (
                    <View className="mb-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100">
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-sm font-semibold text-gray-700">ASD Risk Assessment</Text>
                        <Text className="text-2xl font-bold text-blue-600">
                          {speechResult?.asd_risk_score?.toFixed(1) || '--'}
                        </Text>
                      </View>
                      <View className="bg-gray-200 h-2 rounded-full overflow-hidden mb-2">
                        <View
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${Math.min(100, (speechResult?.asd_risk_score || 0) * 100 / 5)}%` }}
                        />
                      </View>
                      <Text className="text-xs text-gray-500">
                        Confidence: {speechResult?.confidence ? `${(speechResult.confidence * 100).toFixed(1)}%` : 'N/A'}
                      </Text>
                    </View>
                  )}

                  {/* Insights */}
                  {speechInsights.length > 0 && (
                    <View className="bg-blue-50 p-4 rounded-xl mb-4">
                      <Text className="text-sm font-semibold text-blue-800 mb-2">Key Insights</Text>
                      {speechInsights.map((insight, index) => (
                        <View key={index} className="flex-row items-start mb-2">
                          <View className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 mr-2" />
                          <Text className="text-blue-700 text-xs leading-relaxed flex-1">{insight}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Action Note */}
                  <View className="p-3 rounded-lg bg-gray-50">
                    <Text className="text-gray-600 text-xs leading-relaxed text-center">
                      Speech patterns analyzed and saved to your assessment profile.
                      Click Complete to proceed to the next assessment.
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Submission Overlay */}
        {isSubmitting && (
          <View
            className="absolute inset-0 items-center justify-center bg-gray-50"
            style={{ opacity: 0.95 }}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="text-gray-600 mt-4">
              Analyzing speech patterns...
            </Text>
            <Text className="text-gray-400 mt-1 text-xs">
              This may take a few seconds
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default RecordingScreen;
