import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, ScrollView, SafeAreaView, ActivityIndicator, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Camera, useCameraDevices, PhotoFile } from 'react-native-vision-camera';
import GazeVisualizationCard from './components/GazeVisualizationCard';
import StartTrackingButton from './components/StartTrackingButton';
import { useAuth } from '../../../context/AuthContext';
import { useAssessment } from '../../../context/AssessmentContext';
import { submitEyeTracking } from '../../../services/assessmentService';

const CAPTURE_INTERVAL_MS = 500;
const TRACKING_DURATION_MS = 5000;

const EyeTrackingAnalysisScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { setEyeTrackingResult } = useAssessment();

  const [isTracking, setIsTracking] = useState(false);
  const [trackingProgress, setTrackingProgress] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const devices = useCameraDevices();
  const device = devices.front;
  const camera = useRef<Camera>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const captureInterval = useRef<NodeJS.Timeout | null>(null);
  const framesRef = useRef<string[]>([]);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'authorized');
    })();
  }, []);

  const captureFrame = useCallback(async () => {
    if (!camera.current) {
      return;
    }
    try {
      const photo: PhotoFile = await camera.current.takePhoto({
        qualityPrioritization: 'speed',
      });

      // Read photo as base64 using fetch on the file URI
      const response = await fetch(`file://${photo.path}`);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        if (base64) {
          framesRef.current.push(base64);
        }
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.warn('Frame capture failed:', err);
    }
  }, []);

  useEffect(() => {
    if (isTracking) {
      framesRef.current = [];
      setError(null);

      // Progress animation
      progressInterval.current = setInterval(() => {
        setTrackingProgress(prev => {
          if (prev >= 100) {
            handleTrackingComplete();
            return 100;
          }
          return prev + 1;
        });
      }, TRACKING_DURATION_MS / 100);

      // Capture frames periodically
      captureInterval.current = setInterval(() => {
        captureFrame();
      }, CAPTURE_INTERVAL_MS);
    } else {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
      if (captureInterval.current) {
        clearInterval(captureInterval.current);
        captureInterval.current = null;
      }
      setTrackingProgress(0);
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      if (captureInterval.current) {
        clearInterval(captureInterval.current);
      }
    };
  }, [isTracking]);

  const handleStartTracking = () => {
    setIsTracking(true);
  };

  const handleStopTracking = () => {
    setIsTracking(false);
  };

  const handleTrackingComplete = async () => {
    setIsTracking(false);

    const frames = framesRef.current;
    if (frames.length === 0) {
      // No frames captured — still navigate but without backend call
      navigation.navigate('TrackingStatusScreen' as never);
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await submitEyeTracking({
        user_id: user?.uid ?? 'anonymous',
        frames_base64: frames,
      });

      setEyeTrackingResult(result.assessment_id, result.asd_risk_score);
      navigation.navigate('TrackingStatusScreen' as never);
    } catch (err) {
      console.error('Eye tracking submission failed:', err);
      setError('Failed to analyze eye tracking data. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text className="text-gray-600 mt-4">Analyzing eye tracking data...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
              {hasPermission && device && isTracking && (
                <Camera
                  ref={camera}
                  style={{ flex: 1, width: '100%' }}
                  device={device}
                  isActive={isTracking}
                  photo={true}
                  video={false}
                  audio={false}
                  enableZoomGesture={false}
                />
              )}
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
      </View>
    </SafeAreaView>
  );
};

export default EyeTrackingAnalysisScreen;
