import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { RefreshCw, Check, AlertCircle, Mic, Activity, TrendingUp, Volume2 } from 'lucide-react-native';
import { useAssessment } from '../../../context/AssessmentContext';

interface SpeechAnalysisResultScreenProps {
  navigation?: any;
}

const getRiskInfo = (score: number) => {
  if (score < 30) return { color: '#22C55E', bg: 'bg-green-100', label: 'Low Risk' };
  if (score < 60) return { color: '#F59E0B', bg: 'bg-yellow-100', label: 'Moderate Risk' };
  return { color: '#EF4444', bg: 'bg-red-100', label: 'High Risk' };
};

const getLevelLabel = (score: number): { label: string; color: string; bg: string } => {
  if (score >= 70) return { label: 'Good', color: 'text-green-700', bg: 'bg-green-100' };
  if (score >= 40) return { label: 'Moderate', color: 'text-yellow-700', bg: 'bg-yellow-100' };
  return { label: 'Low', color: 'text-red-700', bg: 'bg-red-100' };
};

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
      <Text className="text-gray-700 font-medium ml-2 text-sm">{label}</Text>
    </View>
    <Text className="text-gray-900 font-bold text-sm">
      {value}{unit ? ` ${unit}` : ''}
    </Text>
  </View>
);

const SpeechAnalysisResultScreen: React.FC<SpeechAnalysisResultScreenProps> = ({ navigation: navProp }) => {
  const navigation = useNavigation();
  const { speechScore, speechMetrics, speechInsights } = useAssessment();

  const riskScore = speechScore ?? 0;
  const metrics = speechMetrics;
  const insights = speechInsights;
  const riskInfo = getRiskInfo(riskScore);
  const clarity = getLevelLabel(metrics?.clarity_score ?? 0);
  const vocalVariation = getLevelLabel(metrics?.vocal_variation_score ?? 0);
  const prosody = getLevelLabel(metrics?.prosody_score ?? 0);

  const handleTryAnother = () => {
    const nav = navProp || navigation;
    nav.navigate('RecordingScreen');
  };

  const handleComplete = () => {
    const nav = navProp || navigation;
    nav.navigate('MCQAssessmentScreen');
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FA]">
      <ScrollView className="flex-1 px-5 py-5">

        {/* ─── ASD Risk Score ─── */}
        <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-4">Speech Analysis Results</Text>

          <View className="items-center mb-4">
            <View className="w-28 h-28 rounded-full border-[6px] items-center justify-center" style={{ borderColor: riskInfo.color + '40' }}>
              <Text className="text-3xl font-bold" style={{ color: riskInfo.color }}>
                {Math.round(riskScore)}
              </Text>
              <Text className="text-xs text-gray-500">ASD Risk</Text>
            </View>
          </View>

          <View className="items-center mb-3">
            <View className={`${riskInfo.bg} px-4 py-1 rounded-full`}>
              <Text className="text-sm font-semibold" style={{ color: riskInfo.color }}>
                {riskInfo.label}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── Detailed Metrics ─── */}
        <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <Text className="text-base font-semibold text-gray-800 mb-2">Speech Metrics</Text>

          <MetricRow icon={Mic} iconColor="#3B82F6" label="Words / Min" value={metrics ? Math.round(metrics.words_per_minute) : '—'} />
          <MetricRow icon={Activity} iconColor="#8B5CF6" label="Avg Pause Duration" value={metrics ? metrics.avg_pause_duration.toFixed(2) : '—'} unit="s" />
          <MetricRow icon={TrendingUp} iconColor="#F59E0B" label="Pitch Mean" value={metrics ? metrics.pitch_mean.toFixed(1) : '—'} unit="Hz" />
          <MetricRow icon={TrendingUp} iconColor="#6366F1" label="Pitch Std Dev" value={metrics ? metrics.pitch_std.toFixed(1) : '—'} unit="Hz" />
          <MetricRow icon={Volume2} iconColor="#0EA5E9" label="Energy Mean" value={metrics ? metrics.energy_mean.toFixed(2) : '—'} />
          <MetricRow icon={Activity} iconColor="#EF4444" label="Speech Rate Variability" value={metrics ? metrics.speech_rate_variability.toFixed(2) : '—'} />
          <MetricRow icon={Mic} iconColor="#22C55E" label="Monotone Score" value={metrics ? Math.round(metrics.monotone_score) : '—'} unit="/ 100" />

          {/* Last row — no border */}
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center flex-1">
              <TrendingUp size={18} color="#3B82F6" />
              <Text className="text-gray-700 font-medium ml-2 text-sm">Prosody Score</Text>
            </View>
            <Text className="text-gray-900 font-bold text-sm">
              {metrics ? Math.round(metrics.prosody_score) : '—'} / 100
            </Text>
          </View>
        </View>

        {/* ─── Quality Labels ─── */}
        <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <Text className="text-base font-semibold text-gray-800 mb-3">Speech Characteristics</Text>

          <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
            <Text className="text-gray-700 font-medium text-sm">Speech Clarity</Text>
            <View className={`${clarity.bg} px-3 py-1 rounded-full`}>
              <Text className={`${clarity.color} font-medium text-xs`}>{clarity.label}</Text>
            </View>
          </View>
          <View className="flex-row justify-between items-center py-3 border-b border-gray-100">
            <Text className="text-gray-700 font-medium text-sm">Vocal Variation</Text>
            <View className={`${vocalVariation.bg} px-3 py-1 rounded-full`}>
              <Text className={`${vocalVariation.color} font-medium text-xs`}>{vocalVariation.label}</Text>
            </View>
          </View>
          <View className="flex-row justify-between items-center py-3">
            <Text className="text-gray-700 font-medium text-sm">Prosody</Text>
            <View className={`${prosody.bg} px-3 py-1 rounded-full`}>
              <Text className={`${prosody.color} font-medium text-xs`}>{prosody.label}</Text>
            </View>
          </View>
        </View>

        {/* ─── Insights ─── */}
        {insights.length > 0 && (
          <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <Text className="text-base font-semibold text-gray-800 mb-3">Insights</Text>
            {insights.map((insight, idx) => (
              <View key={idx} className="flex-row mb-2">
                <AlertCircle size={14} color="#6B7280" style={{ marginTop: 2 }} />
                <Text className="text-gray-600 text-sm ml-2 flex-1 leading-relaxed">
                  {insight}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ─── Action Buttons ─── */}
        <View className="flex-row mb-4">
          <TouchableOpacity
            className="flex-1 mr-3 py-3 border border-[#4A90E2] rounded-2xl items-center justify-center bg-white flex-row"
            onPress={handleTryAnother}
          >
            <RefreshCw size={20} color="#4A90E2" />
            <Text className="text-[#4A90E2] font-semibold ml-2">Try Another</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 ml-3 py-3 bg-[#4A90E2] rounded-2xl items-center justify-center flex-row"
            onPress={handleComplete}
          >
            <Check size={20} color="white" />
            <Text className="text-white font-semibold ml-2">Complete</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Disclaimer ─── */}
        <View className="bg-yellow-50 p-4 rounded-xl mb-6 border border-yellow-200">
          <Text className="text-yellow-800 text-xs leading-relaxed text-center">
            This is an automated screening indicator only — NOT a diagnosis.
            Please consult a qualified healthcare professional for a comprehensive evaluation.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SpeechAnalysisResultScreen;
