import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CheckCircle, ArrowRight, RotateCcw } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../context/AuthContext';
import { useAssessment } from '../../../context/AssessmentContext';
import { generateReport } from '../../../services/assessmentService';

interface AssessmentCompleteScreenProps {
  navigation?: any;
}

const AssessmentCompleteScreen: React.FC<AssessmentCompleteScreenProps> = ({ navigation: navProp }) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const {
    eyeTrackingAssessmentId,
    speechAssessmentId,
    mcqAssessmentId,
    eyeTrackingComplete,
    speechComplete,
    mcqComplete,
    completedCount,
    setReportGenerated,
    resetAssessment,
  } = useAssessment();

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      await generateReport({
        user_id: user?.uid ?? 'anonymous',
        eye_tracking_assessment_id: eyeTrackingAssessmentId ?? undefined,
        speech_assessment_id: speechAssessmentId ?? undefined,
        mcq_assessment_id: mcqAssessmentId ?? undefined,
      });

      setReportGenerated(true);

      // Navigate to the Report tab
      const nav = navProp || navigation;
      // @ts-ignore - cross-tab navigation
      nav.getParent()?.navigate('ReportTab', { screen: 'Report' });
    } catch (err) {
      console.error('Report generation failed:', err);
      setError('Failed to generate report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartOver = () => {
    resetAssessment();
    const nav = navProp || navigation;
    nav.navigate('Assessment' as never);
  };

  return (
    <SafeAreaView edges={[]} className="flex-1 bg-[#F5F7FA]">
      <View className="flex-1 justify-center px-6">
        {/* Success Icon */}
        <View className="items-center mb-8">
          <View className="w-24 h-24 bg-green-100 rounded-full items-center justify-center mb-4">
            <CheckCircle size={48} color="#22C55E" />
          </View>
          <Text className="text-2xl font-bold text-gray-800 mb-2">Assessment Complete!</Text>
          <Text className="text-gray-500 text-center">
            You have completed {completedCount} of 3 assessments.
          </Text>
        </View>

        {/* Module Status */}
        <View className="bg-white rounded-2xl p-5 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-800 mb-4">Assessment Summary</Text>

          <View className="flex-row items-center mb-3">
            <View className={`w-3 h-3 rounded-full mr-3 ${eyeTrackingComplete ? 'bg-green-500' : 'bg-gray-300'}`} />
            <Text className="text-gray-700 flex-1">Eye Tracking Analysis</Text>
            <Text className={eyeTrackingComplete ? 'text-green-600 font-medium' : 'text-gray-400'}>
              {eyeTrackingComplete ? 'Done' : 'Skipped'}
            </Text>
          </View>

          <View className="flex-row items-center mb-3">
            <View className={`w-3 h-3 rounded-full mr-3 ${speechComplete ? 'bg-green-500' : 'bg-gray-300'}`} />
            <Text className="text-gray-700 flex-1">Speech Analysis</Text>
            <Text className={speechComplete ? 'text-green-600 font-medium' : 'text-gray-400'}>
              {speechComplete ? 'Done' : 'Skipped'}
            </Text>
          </View>

          <View className="flex-row items-center">
            <View className={`w-3 h-3 rounded-full mr-3 ${mcqComplete ? 'bg-green-500' : 'bg-gray-300'}`} />
            <Text className="text-gray-700 flex-1">MCQ Assessment</Text>
            <Text className={mcqComplete ? 'text-green-600 font-medium' : 'text-gray-400'}>
              {mcqComplete ? 'Done' : 'Skipped'}
            </Text>
          </View>
        </View>

        {/* Error banner */}
        {error && (
          <View className="bg-red-50 p-3 rounded-lg mb-4">
            <Text className="text-red-600 text-sm text-center">{error}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <TouchableOpacity
          className="bg-[#4A90E2] py-4 rounded-2xl flex-row items-center justify-center mb-3"
          onPress={handleGenerateReport}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Text className="text-white font-semibold text-lg mr-2">Generate Report</Text>
              <ArrowRight size={20} color="white" />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="border border-gray-300 py-4 rounded-2xl flex-row items-center justify-center"
          onPress={handleStartOver}
          disabled={isGenerating}
        >
          <RotateCcw size={18} color="#6B7280" />
          <Text className="text-gray-600 font-medium text-base ml-2">Start Over</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default AssessmentCompleteScreen;
