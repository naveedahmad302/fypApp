import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  RefreshCw,
  Check,
  AlertCircle,
  Mic,
  Activity,
  TrendingUp,
  Volume2,
  Brain,
  Repeat,
  Waves,
  Gauge,
} from 'lucide-react-native';
import { useAssessment } from '../../../context/AssessmentContext';
import type {
  BehavioralFlags,
  MfccPattern,
  PausePattern,
} from '../../../services/assessmentService';

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

const flagColor = (value: number): string => {
  if (value >= 0.7) return '#EF4444';
  if (value >= 0.4) return '#F59E0B';
  return '#22C55E';
};

const patternBadge = (
  pattern: MfccPattern | PausePattern,
): { color: string; bg: string } => {
  switch (pattern) {
    case 'varied':
    case 'natural':
      return { color: 'text-green-700', bg: 'bg-green-100' };
    case 'repetitive':
    case 'irregular':
      return { color: 'text-red-700', bg: 'bg-red-100' };
    case 'flat':
    case 'long':
    case 'rushed':
      return { color: 'text-yellow-700', bg: 'bg-yellow-100' };
    default:
      return { color: 'text-gray-700', bg: 'bg-gray-100' };
  }
};

const MetricRow = ({
  icon: Icon,
  iconColor,
  label,
  value,
  unit,
}: {
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
      {value}
      {unit ? ` ${unit}` : ''}
    </Text>
  </View>
);

const FlagBar = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) => {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const color = flagColor(value);
  return (
    <View className="mb-3">
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center">
          <Icon size={16} color={color} />
          <Text className="text-gray-700 text-sm font-medium ml-2">{label}</Text>
        </View>
        <Text className="text-sm font-bold" style={{ color }}>
          {pct}%
        </Text>
      </View>
      <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <View
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </View>
    </View>
  );
};

const FLAG_ORDER: Array<{
  key: keyof BehavioralFlags;
  label: string;
  icon: React.ElementType;
}> = [
  { key: 'monotone', label: 'Monotone', icon: Mic },
  { key: 'echolalia', label: 'Echolalia (Repetitive)', icon: Repeat },
  { key: 'rhythm_issue', label: 'Rhythm Irregularity', icon: Waves },
  { key: 'emotional_flatness', label: 'Emotional Flatness', icon: Brain },
];

const SpeechAnalysisResultScreen: React.FC<SpeechAnalysisResultScreenProps> = ({
  navigation: navProp,
}) => {
  const navigation = useNavigation();
  const {
    speechScore,
    speechMetrics,
    speechInsights,
    speechFeatures,
    speechBehavioralFlags,
    speechLikelihood,
    speechConfidence,
    speechExplanation,
    speechDetected,
  } = useAssessment();

  const riskScore = speechScore ?? 0;
  const metrics = speechMetrics;
  const insights = speechInsights;
  const features = speechFeatures;
  const flags = speechBehavioralFlags;
  const likelihoodPct =
    typeof speechLikelihood === 'number' ? Math.round(speechLikelihood * 100) : Math.round(riskScore);
  const confidencePct =
    typeof speechConfidence === 'number' ? Math.round(speechConfidence * 100) : null;

  const riskInfo = getRiskInfo(riskScore);
  const clarity = getLevelLabel(metrics?.clarity_score ?? 0);
  const vocalVariation = getLevelLabel(metrics?.vocal_variation_score ?? 0);
  const prosody = getLevelLabel(metrics?.prosody_score ?? 0);
  const mfccPatternBadge = features ? patternBadge(features.mfcc_pattern) : null;
  const pausePatternBadge = features ? patternBadge(features.pause_pattern) : null;

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
            <View
              className="w-28 h-28 rounded-full border-[6px] items-center justify-center"
              style={{ borderColor: riskInfo.color + '40' }}
            >
              <Text className="text-3xl font-bold" style={{ color: riskInfo.color }}>
                {likelihoodPct}
              </Text>
              <Text className="text-xs text-gray-500">ASD Likelihood</Text>
            </View>
          </View>

          <View className="items-center mb-3 flex-row justify-center">
            <View className={`${riskInfo.bg} px-4 py-1 rounded-full mr-2`}>
              <Text className="text-sm font-semibold" style={{ color: riskInfo.color }}>
                {riskInfo.label}
              </Text>
            </View>
            {confidencePct !== null && (
              <View className="bg-gray-100 px-3 py-1 rounded-full">
                <Text className="text-xs font-semibold text-gray-700">
                  Confidence {confidencePct}%
                </Text>
              </View>
            )}
          </View>

          {!speechDetected && (
            <View className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mt-2">
              <Text className="text-yellow-800 text-xs">
                Very little speech detected in the recording — results have limited reliability.
              </Text>
            </View>
          )}

          {speechExplanation ? (
            <View className="mt-2">
              <Text className="text-gray-600 text-sm leading-relaxed text-center">
                {speechExplanation}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ─── Behavioral Flags ─── */}
        {flags && (
          <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <Text className="text-base font-semibold text-gray-800 mb-3">
              Behavioral Indicators
            </Text>
            {FLAG_ORDER.map(({ key, label, icon }) => (
              <FlagBar key={key} icon={icon} label={label} value={flags[key] ?? 0} />
            ))}
          </View>
        )}

        {/* ─── Feature Summary ─── */}
        {features && (
          <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <Text className="text-base font-semibold text-gray-800 mb-3">Feature Summary</Text>

            <View className="mb-3">
              <View className="flex-row items-center justify-between mb-1">
                <View className="flex-row items-center">
                  <TrendingUp size={16} color="#6366F1" />
                  <Text className="text-gray-700 text-sm font-medium ml-2">Pitch Variation</Text>
                </View>
                <Text className="text-sm font-bold text-gray-900">
                  {Math.round(features.pitch_variation * 100)}%
                </Text>
              </View>
              <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(features.pitch_variation * 100)}%`,
                    backgroundColor: '#6366F1',
                  }}
                />
              </View>
            </View>

            <View className="mb-3">
              <View className="flex-row items-center justify-between mb-1">
                <View className="flex-row items-center">
                  <Volume2 size={16} color="#0EA5E9" />
                  <Text className="text-gray-700 text-sm font-medium ml-2">Energy Variation</Text>
                </View>
                <Text className="text-sm font-bold text-gray-900">
                  {Math.round(features.energy_variation * 100)}%
                </Text>
              </View>
              <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(features.energy_variation * 100)}%`,
                    backgroundColor: '#0EA5E9',
                  }}
                />
              </View>
            </View>

            <View className="flex-row items-center justify-between py-2 border-t border-gray-100">
              <Text className="text-gray-700 text-sm font-medium">MFCC Pattern</Text>
              {mfccPatternBadge && (
                <View className={`${mfccPatternBadge.bg} px-3 py-1 rounded-full`}>
                  <Text className={`${mfccPatternBadge.color} text-xs font-medium capitalize`}>
                    {features.mfcc_pattern}
                  </Text>
                </View>
              )}
            </View>
            <View className="flex-row items-center justify-between py-2">
              <Text className="text-gray-700 text-sm font-medium">Pause Pattern</Text>
              {pausePatternBadge && (
                <View className={`${pausePatternBadge.bg} px-3 py-1 rounded-full`}>
                  <Text className={`${pausePatternBadge.color} text-xs font-medium capitalize`}>
                    {features.pause_pattern}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ─── Detailed Metrics ─── */}
        <View className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <Text className="text-base font-semibold text-gray-800 mb-2">Speech Metrics</Text>

          <MetricRow
            icon={Mic}
            iconColor="#3B82F6"
            label="Words / Min"
            value={metrics ? Math.round(metrics.words_per_minute) : '—'}
          />
          <MetricRow
            icon={Activity}
            iconColor="#8B5CF6"
            label="Avg Pause Duration"
            value={metrics ? metrics.avg_pause_duration.toFixed(2) : '—'}
            unit="s"
          />
          <MetricRow
            icon={Activity}
            iconColor="#64748B"
            label="Pause Count"
            value={metrics ? metrics.pause_count : '—'}
          />
          <MetricRow
            icon={Activity}
            iconColor="#94A3B8"
            label="Hesitations"
            value={metrics ? metrics.hesitation_count : '—'}
          />
          <MetricRow
            icon={TrendingUp}
            iconColor="#F59E0B"
            label="Pitch Mean"
            value={metrics ? metrics.pitch_mean.toFixed(1) : '—'}
            unit="Hz"
          />
          <MetricRow
            icon={TrendingUp}
            iconColor="#6366F1"
            label="Pitch Std Dev"
            value={metrics ? metrics.pitch_std.toFixed(1) : '—'}
            unit="Hz"
          />
          <MetricRow
            icon={Gauge}
            iconColor="#EC4899"
            label="Pitch Jitter"
            value={metrics ? metrics.pitch_jitter.toFixed(2) : '—'}
            unit="Hz"
          />
          <MetricRow
            icon={Volume2}
            iconColor="#0EA5E9"
            label="Energy Mean"
            value={metrics ? metrics.energy_mean.toFixed(3) : '—'}
          />
          <MetricRow
            icon={Waves}
            iconColor="#14B8A6"
            label="Energy Shimmer"
            value={metrics ? metrics.energy_shimmer.toFixed(3) : '—'}
          />
          <MetricRow
            icon={Activity}
            iconColor="#EF4444"
            label="Speech Rate Variability"
            value={metrics ? metrics.speech_rate_variability.toFixed(2) : '—'}
          />
          <MetricRow
            icon={Mic}
            iconColor="#22C55E"
            label="Voiced Fraction"
            value={metrics ? `${Math.round(metrics.voiced_fraction * 100)}%` : '—'}
          />
          <MetricRow
            icon={Mic}
            iconColor="#22C55E"
            label="Monotone Score"
            value={metrics ? Math.round(metrics.monotone_score) : '—'}
            unit="/ 100"
          />

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
              <Text className={`${vocalVariation.color} font-medium text-xs`}>
                {vocalVariation.label}
              </Text>
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
            This is an automated screening indicator only — NOT a diagnosis. Please consult a
            qualified healthcare professional for a comprehensive evaluation.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SpeechAnalysisResultScreen;
