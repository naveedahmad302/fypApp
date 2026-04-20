import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, ScrollView, SafeAreaView, ActivityIndicator, Text, Animated, Easing, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Camera, useCameraDevice, PhotoFile } from 'react-native-vision-camera';
import GazeVisualizationCard from './components/GazeVisualizationCard';
import StartTrackingButton from './components/StartTrackingButton';
import { useAuth } from '../../../context/AuthContext';
import { useAssessment } from '../../../context/AssessmentContext';
import { submitEyeTracking, healthCheck } from '../../../services/assessmentService';
import type { FrameMetadata } from '../../../services/assessmentService';
import { API_BASE_URL } from '../../../services/api';

const CAPTURE_INTERVAL_MS = 500;

// ── Multi-phase durations (ms) ──
const PHASE_FREE_GAZE_MS = 6000;
const PHASE_OBJECT_TRACKING_MS = 8000;
const PHASE_SOCIAL_STIMULUS_MS = 4000;
const TOTAL_TRACKING_MS =
  PHASE_FREE_GAZE_MS + PHASE_OBJECT_TRACKING_MS + PHASE_SOCIAL_STIMULUS_MS; // 18s

type Phase = 'idle' | 'free_gaze' | 'object_tracking' | 'social_stimulus';

const PHASE_LABELS: Record<Phase, string> = {
  idle: 'Ready',
  free_gaze: 'Phase 1: Free Gaze',
  object_tracking: 'Phase 2: Follow the Dot',
  social_stimulus: 'Phase 3: Social Stimulus',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DOT_AREA_SIZE = SCREEN_WIDTH - 80;

const EyeTrackingAnalysisScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { setEyeTrackingResult } = useAssessment();

  const [isTracking, setIsTracking] = useState(false);
  const [trackingProgress, setTrackingProgress] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<Phase>('idle');
  const [phaseMessage, setPhaseMessage] = useState('');

  const device = useCameraDevice('front');
  const camera = useRef<Camera>(null);
  const progressInterval = useRef<number | null>(null);
  const captureInterval = useRef<number | null>(null);
  const framesRef = useRef<string[]>([]);
  const metadataRef = useRef<FrameMetadata[]>([]);
  const completedRef = useRef(false);
  const trackingStartRef = useRef<number>(0);
  const phaseRef = useRef<Phase>('idle');

  // Moving dot animation for object tracking phase
  const dotX = useRef(new Animated.Value(0)).current;
  const dotY = useRef(new Animated.Value(0)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;
  const dotAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Social stimulus flash
  const socialFlashOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      console.log('[EyeTracking] Camera permission status:', status);
      setHasPermission(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    console.log('[EyeTracking] Front camera device:', device ? device.id : 'not available');
  }, [device]);

  const onCameraInitialized = useCallback(() => {
    console.log('[EyeTracking] Camera initialized and ready');
    setIsCameraReady(true);
  }, []);

  const onCameraError = useCallback((e: unknown) => {
    console.error('[EyeTracking] Camera error:', e);
  }, []);

  /** Determine which phase we're in based on elapsed time. */
  const getCurrentPhase = useCallback((elapsedMs: number): Phase => {
    if (elapsedMs < PHASE_FREE_GAZE_MS) return 'free_gaze';
    if (elapsedMs < PHASE_FREE_GAZE_MS + PHASE_OBJECT_TRACKING_MS) return 'object_tracking';
    return 'social_stimulus';
  }, []);

  /** Get the current stimulus position for the moving dot (normalised 0-1). */
  const getStimulusPosition = useCallback((): { x: number; y: number } | null => {
    if (phaseRef.current !== 'object_tracking') return null;
    return {
      x: (dotX as any).__getValue() / DOT_AREA_SIZE,
      y: (dotY as any).__getValue() / DOT_AREA_SIZE,
    };
  }, [dotX, dotY]);

  const captureFrame = useCallback(async () => {
    if (!camera.current) {
      console.warn('[EyeTracking] captureFrame: camera ref is null');
      return;
    }
    try {
      const photo: PhotoFile = await camera.current.takePhoto({
        qualityPrioritization: 'speed',
      } as any);

      const response = await fetch(`file://${photo.path}`);
      const blob = await response.blob();
      const base64 = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = (reader.result as string).split(',')[1];
          resolve(result || null);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });

      if (base64) {
        framesRef.current.push(base64);

        // Build per-frame metadata
        const elapsedMs = Date.now() - trackingStartRef.current;
        const phase = getCurrentPhase(elapsedMs);
        const stimPos = getStimulusPosition();
        const meta: FrameMetadata = {
          phase,
          timestamp_ms: elapsedMs,
          stimulus_x: stimPos?.x,
          stimulus_y: stimPos?.y,
        };
        metadataRef.current.push(meta);

        console.log(
          `[EyeTracking] Frame ${framesRef.current.length} captured (phase: ${phase})`,
        );
      }
    } catch (err) {
      console.warn('[EyeTracking] Frame capture failed:', err);
    }
  }, [getCurrentPhase, getStimulusPosition]);

  /** Start the moving dot animation for object tracking phase. */
  const startDotAnimation = useCallback(() => {
    Animated.timing(dotOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    const halfSize = DOT_AREA_SIZE;
    const moveTo = (x: number, y: number, duration: number) =>
      Animated.parallel([
        Animated.timing(dotX, {
          toValue: x,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(dotY, {
          toValue: y,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]);

    const sequence = Animated.loop(
      Animated.sequence([
        moveTo(halfSize, 0, 1500),
        moveTo(halfSize, halfSize, 1500),
        moveTo(0, halfSize, 1500),
        moveTo(0, 0, 1500),
      ]),
    );
    dotAnimationRef.current = sequence;
    sequence.start();
  }, [dotOpacity, dotX, dotY]);

  /** Stop the dot animation. */
  const stopDotAnimation = useCallback(() => {
    if (dotAnimationRef.current) {
      dotAnimationRef.current.stop();
      dotAnimationRef.current = null;
    }
    Animated.timing(dotOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [dotOpacity]);

  /** Flash for social stimulus (simulates attention-grabbing event). */
  const triggerSocialStimulus = useCallback(() => {
    Animated.sequence([
      Animated.timing(socialFlashOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(socialFlashOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(500),
      Animated.timing(socialFlashOpacity, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(socialFlashOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [socialFlashOpacity]);

  // ── Phase management effect ──
  useEffect(() => {
    if (!isTracking) {
      setCurrentPhase('idle');
      phaseRef.current = 'idle';
      setPhaseMessage('');
      return;
    }

    setCurrentPhase('free_gaze');
    phaseRef.current = 'free_gaze';
    setPhaseMessage('Look naturally at the screen');

    const phase2Timer = setTimeout(() => {
      if (!completedRef.current) {
        setCurrentPhase('object_tracking');
        phaseRef.current = 'object_tracking';
        setPhaseMessage('Follow the moving dot with your eyes');
        startDotAnimation();
      }
    }, PHASE_FREE_GAZE_MS);

    const phase3Timer = setTimeout(() => {
      if (!completedRef.current) {
        stopDotAnimation();
        setCurrentPhase('social_stimulus');
        phaseRef.current = 'social_stimulus';
        setPhaseMessage('Look at the screen — a stimulus will appear');
        triggerSocialStimulus();
      }
    }, PHASE_FREE_GAZE_MS + PHASE_OBJECT_TRACKING_MS);

    return () => {
      clearTimeout(phase2Timer);
      clearTimeout(phase3Timer);
      stopDotAnimation();
    };
  }, [isTracking, startDotAnimation, stopDotAnimation, triggerSocialStimulus]);

  // ── Capture & progress effect ──
  useEffect(() => {
    if (isTracking) {
      framesRef.current = [];
      metadataRef.current = [];
      setError(null);
      completedRef.current = false;
      trackingStartRef.current = Date.now();

      progressInterval.current = setInterval(() => {
        setTrackingProgress(prev => {
          if (prev >= 100) return 100;
          return prev + 1;
        });
      }, TOTAL_TRACKING_MS / 100);

      const scheduleCapture = async () => {
        await captureFrame();
        if (captureInterval.current !== null) {
          captureInterval.current = setTimeout(scheduleCapture, CAPTURE_INTERVAL_MS);
        }
      };
      captureInterval.current = setTimeout(scheduleCapture, CAPTURE_INTERVAL_MS);
    } else {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
      if (captureInterval.current) {
        clearTimeout(captureInterval.current);
        captureInterval.current = null;
      }
      setTrackingProgress(0);
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
      if (captureInterval.current) {
        clearTimeout(captureInterval.current);
        captureInterval.current = null;
      }
    };
  }, [isTracking, captureFrame]);

  // Trigger completion when progress reaches 100
  useEffect(() => {
    if (trackingProgress >= 100 && isTracking && !completedRef.current) {
      completedRef.current = true;
      handleTrackingComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingProgress]);

  const handleStartTracking = async () => {
    setError(null);
    try {
      await healthCheck();
      console.log('[EyeTracking] Backend reachable at', API_BASE_URL);
    } catch (err) {
      console.error('[EyeTracking] Backend unreachable:', err);
      setError(
        'Cannot reach backend server. Make sure:\n' +
        '1. Backend is running (poetry run fastapi dev app/main.py)\n' +
        '2. Run: adb reverse tcp:8000 tcp:8000',
      );
      return;
    }

    if (!isCameraReady) {
      console.warn('[EyeTracking] Camera not yet initialized, waiting...');
      setError('Camera is still initializing. Please wait a moment and try again.');
      return;
    }

    setIsTracking(true);
  };

  const handleStopTracking = () => {
    setIsTracking(false);
    stopDotAnimation();
  };

  const handleTrackingComplete = async () => {
    setIsTracking(false);
    stopDotAnimation();

    const frames = framesRef.current;
    const metadata = metadataRef.current;
    console.log('[EyeTracking] Tracking complete. Frames:', frames.length, 'Metadata:', metadata.length);

    if (frames.length === 0) {
      setError(
        'No camera frames were captured. Please ensure:\n' +
        '1. Camera permission is granted\n' +
        '2. The front camera is available',
      );
      return;
    }

    try {
      setIsSubmitting(true);
      console.log('[EyeTracking] Submitting', frames.length, 'frames with metadata to backend...');
      const result = await submitEyeTracking({
        user_id: user?.uid ?? 'anonymous',
        frames_base64: frames,
        frame_metadata: metadata.length > 0 ? metadata : undefined,
      });

      console.log(
        '[EyeTracking] Result — Score:', result.asd_risk_score,
        'Confidence:', result.confidence_score,
        'Eye detected:', result.eye_detected,
      );
      setEyeTrackingResult(result);
      navigation.navigate('TrackingStatusScreen' as never);
    } catch (err) {
      console.error('[EyeTracking] Submission failed:', err);
      setError(
        'Failed to analyze eye tracking data.\n' +
        'Make sure the backend is running and reachable.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1">
        <ScrollView className="flex-1 bg-[#F5F7FA]">
          <View className="p-4">
            <GazeVisualizationCard
              isTracking={isTracking}
              trackingProgress={trackingProgress}
            >
              {hasPermission && device ? (
                <Camera
                  ref={camera}
                  style={{ flex: 1, width: '100%' }}
                  device={device}
                  isActive={true}
                  photo={true}
                  video={false}
                  audio={false}
                  enableZoomGesture={false}
                  onInitialized={onCameraInitialized}
                  onError={onCameraError}
                />
              ) : null}
            </GazeVisualizationCard>

            {/* ─── Phase indicator & instruction ─── */}
            {isTracking && (
              <View className="mt-3 items-center">
                <View className="bg-blue-100 px-4 py-1.5 rounded-full mb-2">
                  <Text className="text-blue-700 text-xs font-semibold">
                    {PHASE_LABELS[currentPhase]}
                  </Text>
                </View>
                {phaseMessage ? (
                  <Text className="text-gray-600 text-sm text-center">
                    {phaseMessage}
                  </Text>
                ) : null}
              </View>
            )}

            {/* ─── Moving dot for object tracking phase ─── */}
            {isTracking && currentPhase === 'object_tracking' && (
              <View
                className="mt-4 self-center"
                style={{
                  width: DOT_AREA_SIZE,
                  height: DOT_AREA_SIZE * 0.6,
                  backgroundColor: '#F3F4F6',
                  borderRadius: 16,
                  overflow: 'hidden',
                }}
              >
                <Animated.View
                  style={{
                    position: 'absolute',
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: '#4A90E2',
                    opacity: dotOpacity,
                    transform: [
                      { translateX: dotX },
                      { translateY: dotY },
                    ],
                  }}
                />
              </View>
            )}

            {/* ─── Social stimulus flash overlay ─── */}
            {isTracking && currentPhase === 'social_stimulus' && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: '#FFD700',
                  opacity: socialFlashOpacity,
                  borderRadius: 16,
                }}
              />
            )}
          </View>

          {error && (
            <View className="mx-7 mb-4 bg-red-50 p-3 rounded-lg">
              <Text className="text-red-600 text-sm text-center">{error}</Text>
            </View>
          )}

          {/* Phase timeline (when tracking) */}
          {isTracking && (
            <View className="mx-7 mb-4 flex-row justify-between">
              {(['free_gaze', 'object_tracking', 'social_stimulus'] as Phase[]).map((p, idx) => {
                const isActive = currentPhase === p;
                const isPast =
                  (p === 'free_gaze' && (currentPhase === 'object_tracking' || currentPhase === 'social_stimulus')) ||
                  (p === 'object_tracking' && currentPhase === 'social_stimulus');
                return (
                  <View key={p} className="flex-1 items-center">
                    <View
                      className="h-1.5 w-full rounded-full mb-1"
                      style={{
                        backgroundColor: isActive ? '#4A90E2' : isPast ? '#22C55E' : '#D1D5DB',
                      }}
                    />
                    <Text
                      className="text-xs"
                      style={{ color: isActive ? '#4A90E2' : isPast ? '#22C55E' : '#9CA3AF' }}
                    >
                      {idx + 1}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Start Button */}
          <View className="px-7">
            <StartTrackingButton
              isTracking={isTracking}
              onStart={handleStartTracking}
              onStop={handleStopTracking}
            />
          </View>

          {/* Info text when idle */}
          {!isTracking && !isSubmitting && (
            <View className="mx-7 mt-4 bg-blue-50 p-4 rounded-xl border border-blue-200">
              <Text className="text-blue-800 text-xs leading-relaxed text-center">
                The assessment has 3 phases (~18 seconds total):{'\n'}
                1. Free Gaze (6s) — look naturally{'\n'}
                2. Object Tracking (8s) — follow a moving dot{'\n'}
                3. Social Stimulus (4s) — respond to visual cues
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Submission overlay */}
        {isSubmitting && (
          <View
            className="absolute inset-0 items-center justify-center bg-gray-50"
            style={{ opacity: 0.95 }}
          >
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text className="text-gray-600 mt-4">
              Analyzing eye tracking data across 8 dimensions...
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

export default EyeTrackingAnalysisScreen;
