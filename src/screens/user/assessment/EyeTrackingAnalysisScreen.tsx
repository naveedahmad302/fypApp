import React, { useState, useRef, useEffect } from 'react';
import { View, ScrollView, SafeAreaView, TouchableOpacity, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import TrackingStatusCard from './components/TrackingStatusCard';
import GazeVisualizationCard from './components/GazeVisualizationCard';
import StartTrackingButton from './components//StartTrackingButton';

const EyeTrackingAnalysisScreen: React.FC = () => {
  const navigation = useNavigation();
  const [isTracking, setIsTracking] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const devices = useCameraDevices();
  const device = devices.front;
  const camera = useRef<Camera>(null);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'authorized');
    })();
  }, []);

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
    navigation.navigate('TrackingStatusScreen');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1">
       
        
        {/* Content */}
        <ScrollView className="flex-1 bg-[#F5F7FA]">
          <View className="p-4 space-y-4">
            <GazeVisualizationCard isTracking={isTracking}>
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
            {/* Instructions */}
            <View className="bg-white rounded-2xl p-4 shadow-sm">
              <Text className="text-gray-900 text-lg font-semibold mb-2">Position Your Face</Text>
              <Text className="text-gray-600 text-sm leading-relaxed">
                Please position your face within the frame below. Ensure good lighting and keep your face visible throughout the assessment.
              </Text>
            </View>
            
            <TrackingStatusCard />
          </View>
        </ScrollView>
        
        {/* Start Button */}
        <View className="bg-white px-4 py-4 border-t border-gray-100">
          <StartTrackingButton 
            isTracking={isTracking}
            onStart={handleStartTracking}
            onStop={handleStopTracking}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

export default EyeTrackingAnalysisScreen;
