import React, { useState, useRef, useEffect } from 'react';
import { View, ScrollView, SafeAreaView, TouchableOpacity, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
// import { ChevronLeft } from 'lucide-react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
// import TrackingStatusCard from './components/TrackingStatusCard';
import GazeVisualizationCard from './components/GazeVisualizationCard';
import StartTrackingButton from './components/StartTrackingButton';

const EyeTrackingAnalysisScreen: React.FC = () => {
  const navigation = useNavigation();
  const [isTracking, setIsTracking] = useState(false);
  const [trackingProgress, setTrackingProgress] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  const devices = useCameraDevices();
  const device = devices.front;
  const camera = useRef<Camera>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'authorized');
    })();
  }, []);

  useEffect(() => {
    if (isTracking) {
      // Start progress simulation
      progressInterval.current = setInterval(() => {
        setTrackingProgress(prev => {
          if (prev >= 100) {
            handleTrackingComplete();
            return 100;
          }
          // Even smaller increments for ultra-smooth progress
          return prev + 1;
        });
      }, 50); // Very fast updates for ultra-smooth animation
    } else {
      // Stop progress simulation
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
      setTrackingProgress(0);
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isTracking]);

  const handleBackPress = () => {
    if (isTracking) {
      setIsTracking(false);
    }
    navigation.goBack();
  };

  const handleStartTracking = () => {
    setIsTracking(true);
  };

  const handleStopTracking = () => {
    setIsTracking(false);
  };

  const handleTrackingComplete = () => {
    setIsTracking(false);
    // Navigate to the final screen after a short delay
    setTimeout(() => {
      navigation.navigate('TrackingStatusScreen');
    }, 1000);
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
              {hasPermission && device && isTracking && (
                <Camera
                  ref={camera}
                  style={{ flex: 1, width: '100%' }}
                  device={device}
                  isActive={isTracking}
                  video={true}
                  audio={false}
                  enableZoomGesture={false}
                />
              )}
            </GazeVisualizationCard>
          </View>
          
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
