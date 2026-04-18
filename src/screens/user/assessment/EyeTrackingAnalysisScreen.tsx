import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, ScrollView, SafeAreaView, ActivityIndicator, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Camera, useCameraDevice, PhotoFile } from 'react-native-vision-camera';
import GazeVisualizationCard from './components/GazeVisualizationCard';
import StartTrackingButton from './components/StartTrackingButton';
import { useAuth } from '../../../context/AuthContext';
import { useAssessment } from '../../../context/AssessmentContext';
import { submitEyeTracking, healthCheck } from '../../../services/assessmentService';
import { API_BASE_URL } from '../../../services/api';

const CAPTURE_INTERVAL_MS = 500;
const TRACKING_DURATION_MS = 5000;

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

  const device = useCameraDevice('front');
  const camera = useRef<Camera>(null);
  const progressInterval = useRef<number | null>(null);
  const captureInterval = useRef<number | null>(null);
  const framesRef = useRef<string[]>([]);
  const completedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      console.log('[EyeTracking] Camera permission status:', status);
      console.log('[EyeTracking] Front camera device:', device ? device.id : 'not available');
      setHasPermission(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    console.log('[EyeTracking] Front camera device:', device ? device.id : 'not available');
  }, [device]);

  const onCameraInitialized = useCallback(() => {
    console.log('[EyeTracking] Camera initialized and ready');
    console.log('[EyeTracking] Device:', device);
    setIsCameraReady(true);
  }, []);

  const onCameraError = useCallback((e: unknown) => {
    console.error('[EyeTracking] Camera error:', e);
  }, []);

  const captureFrame = useCallback(async () => {
    if (!camera.current) {
      console.warn('[EyeTracking] captureFrame: camera ref is null');
      return;
    }
    try {
      const photo: PhotoFile = await camera.current.takePhoto({
        qualityPrioritization: 'speed',
      } as any);
      console.log('[EyeTracking] Photo taken:', photo.path);

      // Read photo as base64 using fetch on the file URI
      const response = await fetch(`file://${photo.path}`);
      const blob = await response.blob();
      console.log('[EyeTracking] Blob size:', blob.size);
      const base64 = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = (reader.result as string).split(',')[1];
          resolve(result || null);
        };
        reader.onerror = (e) => {
          console.warn('[EyeTracking] FileReader error:', e);
          resolve(null);
        };
        reader.readAsDataURL(blob);
      });
      if (base64) {
        framesRef.current.push(base64);
        console.log('[EyeTracking] Frame captured. Total frames:', framesRef.current.length);
      } else {
        console.warn('[EyeTracking] base64 conversion returned null');
      }
    } catch (err) {
      console.warn('[EyeTracking] Frame capture failed:', err);
    }
  }, []);

  useEffect(() => {
    if (isTracking) {
      framesRef.current = [];
      setError(null);

      completedRef.current = false;

      // Progress animation
      progressInterval.current = setInterval(() => {
        setTrackingProgress(prev => {
          if (prev >= 100) {
            return 100;
          }
          return prev + 1;
        });
      }, TRACKING_DURATION_MS / 100);

      // Capture frames sequentially — wait for each capture to finish
      // before scheduling the next to avoid overlapping async camera calls.
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
    // Verify backend is reachable before starting
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
  };

  const handleTrackingComplete = async () => {
    setIsTracking(false);

    const frames = framesRef.current;
    console.log('[EyeTracking] Tracking complete. Frames captured:', frames.length);

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
      console.log('[EyeTracking] Submitting', frames.length, 'frames to backend...');
      const result = await submitEyeTracking({
        user_id: user?.uid ?? 'anonymous',
        frames_base64: frames,
      });

      console.log('[EyeTracking] Submission success. Score:', result.asd_risk_score, 'Confidence:', result.confidence_score);
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
        {/* Content */}
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
          </View>

          {error && (
            <View className="mx-7 mb-4 bg-red-50 p-3 rounded-lg">
              <Text className="text-red-600 text-sm text-center">{error}</Text>
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
        </ScrollView>

        {/* Submission overlay — rendered on top so Camera stays mounted */}
        {isSubmitting && (
          <View
            className="absolute inset-0 items-center justify-center bg-gray-50"
            style={{ opacity: 0.95 }}
          >
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text className="text-gray-600 mt-4">Analyzing eye tracking data...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default EyeTrackingAnalysisScreen;
