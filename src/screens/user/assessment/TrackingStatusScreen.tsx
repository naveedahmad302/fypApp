import React from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { RefreshCw, Check, Clock, Target, Eye, Activity, AlertCircle, TrendingUp, Zap, Focus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import CustomText from '../../../components/CustomText';
import { useAssessment } from '../../../context/AssessmentContext';

interface TrackingStatusScreenProps {
  navigation?: any;
}

/** Map a 0-100 risk score to a colour and label. */
const getRiskInfo = (score: number) => {
  if (score < 30) return { color: '#22C55E', bg: 'bg-green-100', label: 'Low Risk' };
  if (score < 60) return { color: '#F59E0B', bg: 'bg-yellow-100', label: 'Moderate Risk' };
  return { color: '#EF4444', bg: 'bg-red-100', label: 'High Risk' };
};

/** Map a 0-100 confidence score to a colour and label. */
const getConfidenceInfo = (score: number) => {
  if (score >= 70) return { color: '#22C55E', label: 'High' };
  if (score >= 40) return { color: '#F59E0B', label: 'Medium' };
  return { color: '#EF4444', label: 'Low' };
};

/** A single metric row with icon, label and value. */
const MetricRow = ({ icon: Icon, iconColor, label, value, unit }: {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  value: string | number;
  unit?: string;
}) => (
  <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
    <View className="flex-row items-center flex-1">
      <Icon size={18} color={iconColor} />
      <CustomText weight={500} className="text-gray-700 ml-2 text-sm">{label}</CustomText>
    </View>
    <CustomText weight={700} className="text-gray-900 text-sm">
      {value}{unit ? ` ${unit}` : ''}
    </CustomText>
  </View>
);

const TrackingStatusScreen: React.FC<TrackingStatusScreenProps> = ({ navigation: navProp }) => {
  const navigation = useNavigation();
  const {
    eyeTrackingScore,
    eyeTrackingMetrics,
    eyeTrackingConfidence,
    eyeTrackingInsights,
  } = useAssessment();

  const riskScore = eyeTrackingScore ?? 0;
  const confidence = eyeTrackingConfidence ?? 0;
  const metrics = eyeTrackingMetrics;
  const insights = eyeTrackingInsights;
  const riskInfo = getRiskInfo(riskScore);
  const confInfo = getConfidenceInfo(confidence);

  const handleTryAgain = () => {
    const nav = navProp || navigation;
    nav.goBack();
  };

  const handleComplete = () => {
    const nav = navProp || navigation;
    nav.navigate('SpeechProgressScreen' as never);
  };

  return (
    <SafeAreaView edges={[]} className="flex-1 bg-[#F7F8FA]">
      <ScrollView contentContainerClassName="flex-grow p-5">
        <View className="w-full max-w-md mx-auto">

          {/* ─── Header: ASD Risk Score ─── */}
          <View className="bg-white p-5 rounded-2xl shadow-lg shadow-gray-200 mb-4" style={{
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
          }}>
            <CustomText weight={700} className="text-lg text-gray-900 mb-4">Eye Tracking Results</CustomText>

            {/* Big score circle */}
            <View className="items-center mb-4">
              <View className="w-28 h-28 rounded-full border-[6px] items-center justify-center" style={{ borderColor: riskInfo.color + '40' }}>
                <CustomText weight={700} className="text-3xl" style={{ color: riskInfo.color }}>
                  {Math.round(riskScore)}
                </CustomText>
                <CustomText weight={400} className="text-xs text-gray-500">ASD Risk</CustomText>
              </View>
            </View>

            {/* Risk label */}
            <View className="items-center mb-3">
              <View className={`${riskInfo.bg} px-4 py-1 rounded-full`}>
                <CustomText weight={600} className="text-sm" style={{ color: riskInfo.color }}>
                  {riskInfo.label}
                </CustomText>
              </View>
            </View>

            {/* Confidence bar */}
            <View className="bg-gray-50 p-3 rounded-xl">
              <View className="flex-row items-center justify-between mb-1">
                <CustomText weight={500} className="text-gray-600 text-xs">Confidence</CustomText>
                <CustomText weight={600} className="text-xs" style={{ color: confInfo.color }}>
                  {Math.round(confidence)}% — {confInfo.label}
                </CustomText>
              </View>
              <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <View className="h-full rounded-full" style={{ width: `${Math.min(confidence, 100)}%`, backgroundColor: confInfo.color }} />
              </View>
            </View>
          </View>

          {/* ─── Detailed Metrics ─── */}
          <View className="bg-white p-5 rounded-2xl shadow-lg shadow-gray-200 mb-4" style={{
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
          }}>
            <CustomText weight={600} className="text-base text-gray-800 mb-2">Gaze Metrics</CustomText>

            <MetricRow icon={Target} iconColor="#3B82F6" label="Gaze Points" value={metrics?.gaze_points_count ?? 0} />
            <MetricRow icon={Clock} iconColor="#8B5CF6" label="Avg Fixation Duration" value={metrics ? metrics.avg_fixation_duration.toFixed(2) : '0.00'} unit="s" />
            <MetricRow icon={TrendingUp} iconColor="#3B82F6" label="Attention Score" value={metrics ? Math.round(metrics.attention_score) : 0} unit="/ 100" />
            <MetricRow icon={Focus} iconColor="#6366F1" label="Gaze Pattern" value={metrics?.gaze_pattern_type ?? 'N/A'} />
            <MetricRow icon={Zap} iconColor="#F59E0B" label="Saccade Frequency" value={metrics ? metrics.saccade_frequency.toFixed(1) : '0.0'} unit="/ min" />
            <MetricRow icon={Activity} iconColor="#EF4444" label="Blink Rate" value={metrics ? metrics.blink_rate.toFixed(1) : '0.0'} unit="/ min" />
            <MetricRow icon={Eye} iconColor="#22C55E" label="Left Eye Openness" value={metrics ? (metrics.left_eye_openness * 100).toFixed(0) : '0'} unit="%" />
            <MetricRow icon={Eye} iconColor="#22C55E" label="Right Eye Openness" value={metrics ? (metrics.right_eye_openness * 100).toFixed(0) : '0'} unit="%" />

            {/* Last row — no bottom border */}
            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center flex-1">
                <Target size={18} color="#0EA5E9" />
                <CustomText weight={500} className="text-gray-700 ml-2 text-sm">Joint Attention</CustomText>
              </View>
              <CustomText weight={700} className="text-gray-900 text-sm">
                {metrics ? Math.round(metrics.joint_attention_score) : 0} / 100
              </CustomText>
            </View>
          </View>

          {/* ─── Insights ─── */}
          {insights.length > 0 && (
            <View className="bg-white p-5 rounded-2xl shadow-lg shadow-gray-200 mb-4" style={{
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
            }}>
              <CustomText weight={600} className="text-base text-gray-800 mb-3">Insights</CustomText>
              {insights.map((insight, idx) => (
                <View key={idx} className="flex-row mb-2">
                  <AlertCircle size={14} color="#6B7280" style={{ marginTop: 2 }} />
                  <CustomText weight={400} className="text-gray-600 text-sm ml-2 flex-1 leading-relaxed">
                    {insight}
                  </CustomText>
                </View>
              ))}
            </View>
          )}

          {/* ─── Action Buttons ─── */}
          <View className="flex-row mb-4">
            <TouchableOpacity
              className="flex-1 border border-[#4A90E2] py-4 rounded-2xl mr-3 flex-row items-center justify-center"
              onPress={handleTryAgain}
            >
              <RefreshCw size={20} color="#4A90E2" />
              <CustomText weight={500} className="text-[#4A90E2] font-semibold ml-2">Try Again</CustomText>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 bg-[#4A90E2] py-4 rounded-2xl ml-3 flex-row items-center justify-center shadow-lg"
              onPress={handleComplete}
              style={{
                shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 1,
              }}
            >
              <Check size={20} color="white" />
              <CustomText weight={600} className="text-white font-semibold ml-2">Complete</CustomText>
            </TouchableOpacity>
          </View>

          {/* ─── Disclaimer ─── */}
          <View className="bg-yellow-50 p-4 rounded-xl mb-4 border border-yellow-200">
            <CustomText weight={400} className="text-yellow-800 text-xs leading-relaxed text-center">
              This is an automated screening indicator only — NOT a diagnosis.
              Please consult a qualified healthcare professional for a comprehensive evaluation.
            </CustomText>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TrackingStatusScreen;
