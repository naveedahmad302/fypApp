import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, Mic, FileText, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../../context/AuthContext';
import { fetchReport, ReportResponse } from '../../../services/assessmentService';

const ReportScreen: React.FC = () => {
  const { user } = useAuth();

  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadReport();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.uid])
  );

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchReport(user?.uid ?? 'anonymous');
      setReport(data);
    } catch (err) {
      console.error('Failed to load report:', err);
      setError('No report available yet. Complete an assessment first.');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string): string => {
    switch (level.toLowerCase()) {
      case 'low': return '#22C55E';
      case 'moderate': return '#F59E0B';
      case 'high': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getRiskBgColor = (level: string): string => {
    switch (level.toLowerCase()) {
      case 'low': return 'bg-green-100';
      case 'moderate': return 'bg-yellow-100';
      case 'high': return 'bg-red-100';
      default: return 'bg-gray-100';
    }
  };

  const getRiskTextColor = (level: string): string => {
    switch (level.toLowerCase()) {
      case 'low': return 'text-green-700';
      case 'moderate': return 'text-yellow-700';
      case 'high': return 'text-red-700';
      default: return 'text-gray-700';
    }
  };

  const toggleModule = (moduleName: string) => {
    setExpandedModule(expandedModule === moduleName ? null : moduleName);
  };

  if (loading) {
    return (
      <SafeAreaView edges={[]} className="flex-1 bg-[#F5F7FA]">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text className="text-gray-600 mt-4">Loading report...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !report) {
    return (
      <SafeAreaView edges={[]} className="flex-1 bg-[#F5F7FA]">
        <View className="flex-1 items-center justify-center px-6">
          <AlertTriangle size={48} color="#F59E0B" />
          <Text className="text-gray-700 text-lg font-semibold mt-4 mb-2">No Report Available</Text>
          <Text className="text-gray-500 text-center mb-6">{error || 'Complete an assessment to see your report.'}</Text>
          <TouchableOpacity
            onPress={loadReport}
            className="bg-[#4A90E2] px-6 py-3 rounded-lg"
          >
            <Text className="text-white font-medium">Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const overallScore = Math.round(report.overall_score);
  const riskColor = getRiskColor(report.risk_level);

  const modules = [
    {
      name: 'Eye Tracking',
      icon: Eye,
      data: report.eye_tracking,
      color: '#3B82F6',
    },
    {
      name: 'Speech Analysis',
      icon: Mic,
      data: report.speech_analysis,
      color: '#8B5CF6',
    },
    {
      name: 'MCQ Assessment',
      icon: FileText,
      data: report.mcq_assessment,
      color: '#F59E0B',
    },
  ];

  return (
    <SafeAreaView edges={[]} className="flex-1 bg-[#F5F7FA]">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 py-5">
          {/* Overall Score */}
          <View className="items-center mb-6">
            <View className="relative mb-4">
              <View className="w-36 h-36 rounded-full border-8 items-center justify-center" style={{ borderColor: riskColor + '40' }}>
                <Text className="text-3xl font-bold" style={{ color: riskColor }}>{overallScore}</Text>
                <Text className="text-sm text-[#6B7280]">Overall Score</Text>
              </View>
            </View>
            <View className={getRiskBgColor(report.risk_level) + ' px-4 py-1 rounded-full'}>
              <Text className={getRiskTextColor(report.risk_level) + ' font-semibold text-sm'}>
                {report.risk_level.charAt(0).toUpperCase() + report.risk_level.slice(1)} Risk
              </Text>
            </View>
          </View>

          {/* Module Results */}
          <Text className="text-lg font-bold text-gray-800 mb-3">Assessment Results</Text>

          {modules.map((mod) => (
            <TouchableOpacity
              key={mod.name}
              className="bg-white rounded-2xl p-4 mb-3 shadow-sm"
              onPress={() => toggleModule(mod.name)}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: mod.color + '20' }}>
                    <mod.icon size={20} color={mod.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-800 font-semibold">{mod.name}</Text>
                    <Text className="text-gray-500 text-xs">
                      {mod.data.status === 'completed' ? 'Completed' : 'Not completed'}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-lg font-bold mr-2" style={{ color: mod.color }}>
                    {Math.round(mod.data.score)}
                  </Text>
                  {expandedModule === mod.name ? (
                    <ChevronUp size={16} color="#9CA3AF" />
                  ) : (
                    <ChevronDown size={16} color="#9CA3AF" />
                  )}
                </View>
              </View>

              {/* Expanded insights */}
              {expandedModule === mod.name && mod.data.insights.length > 0 && (
                <View className="mt-3 pt-3 border-t border-gray-100">
                  {mod.data.insights.map((insight, idx) => (
                    <Text key={idx} className="text-gray-600 text-sm mb-1 leading-relaxed">
                      {insight}
                    </Text>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          ))}

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <View className="bg-white rounded-2xl p-5 mt-3 mb-6 shadow-sm">
              <Text className="text-lg font-bold text-gray-800 mb-3">Recommendations</Text>
              {report.recommendations.map((rec, idx) => (
                <View key={idx} className="flex-row mb-2">
                  <Text className="text-[#4A90E2] mr-2 font-bold">{idx + 1}.</Text>
                  <Text className="text-gray-600 text-sm flex-1 leading-relaxed">{rec}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Disclaimer */}
          <View className="bg-yellow-50 p-4 rounded-xl mb-6 border border-yellow-200">
            <Text className="text-yellow-800 text-xs leading-relaxed text-center">
              This is a screening tool and not a diagnostic instrument. Please consult
              a healthcare professional for a comprehensive evaluation.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ReportScreen;
