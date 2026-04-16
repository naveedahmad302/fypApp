import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ArrowLeft, ArrowRight, CheckCircle, Circle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../context/AuthContext';
import { useAssessment } from '../../../context/AssessmentContext';
import {
  fetchMCQQuestions,
  submitMCQAssessment,
  MCQQuestion,
} from '../../../services/assessmentService';

interface MCQQuestionScreenProps {
  navigation?: any;
}

const MCQQuestionScreen: React.FC<MCQQuestionScreenProps> = ({ navigation: navProp }) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { setMcqResult } = useAssessment();

  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchMCQQuestions();
      setQuestions(response.questions);
      setAnswers(new Array(response.questions.length).fill(null));
    } catch (err) {
      console.error('Failed to fetch questions:', err);
      setError('Failed to load questions. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (optionIndex: number) => {
    setSelectedOption(optionIndex);
  };

  const handleNext = async () => {
    if (selectedOption === null) {
      return;
    }

    const newAnswers = [...answers];
    newAnswers[currentQuestion] = selectedOption;
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedOption(newAnswers[currentQuestion + 1] ?? null);
    } else {
      await submitAnswers(newAnswers);
    }
  };

  const submitAnswers = async (finalAnswers: (number | null)[]) => {
    try {
      setSubmitting(true);
      const mcqAnswers = finalAnswers.map((option, index) => ({
        question_id: questions[index].id,
        selected_option: option ?? 0,
      }));

      const result = await submitMCQAssessment({
        user_id: user?.uid ?? 'anonymous',
        answers: mcqAnswers,
      });

      setMcqResult(result.assessment_id, result.asd_risk_score);

      const nav = navProp || navigation;
      nav.navigate('AssessmentCompleteScreen' as never);
    } catch (err) {
      console.error('Failed to submit MCQ assessment:', err);
      setError('Failed to submit answers. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setSelectedOption(answers[currentQuestion - 1] ?? null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={[]} className="flex-1 bg-[#F5F7FA]">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text className="text-gray-600 mt-4">Loading questions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && questions.length === 0) {
    return (
      <SafeAreaView edges={[]} className="flex-1 bg-[#F5F7FA]">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-red-500 text-center mb-4">{error}</Text>
          <TouchableOpacity
            onPress={loadQuestions}
            className="bg-[#4A90E2] px-6 py-3 rounded-lg"
          >
            <Text className="text-white font-medium">Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return null;
  }

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <SafeAreaView edges={[]} className="flex-1  bg-[#F5F7FA]">
      <View className="flex-1">
        {/* Progress Bar */}
        <View className="px-4 py-2 mx-4 mt-4">
          <View className="bg-white rounded-2xl p-4 shadow-lg shadow-gray-200" style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }}>
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-black text-md font-bold">Progress</Text>
              <Text className="text-gray-600 text-xs">Question {currentQuestion + 1} of {questions.length}</Text>
            </View>
            <View className="w-full h-1.5 bg-gray-200 rounded-full">
              <View 
                className="h-full bg-[#4A90E2] rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </View>
          </View>
        </View>

        {/* Question */}
        <View className="px-4 py-2 mx-4">
          <View className="bg-white rounded-2xl p-4 shadow-lg shadow-gray-200" style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}>
            <Text className="text-gray-800 text-lg font-semibold mb-4 leading-relaxed">
              {currentQuestion + 1}. {questions[currentQuestion].question}
            </Text>

            {/* Options */}
            <View className="py-5 max-h-80">
              {questions[currentQuestion].options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleOptionSelect(index)}
                  className={`p-3 rounded-lg border transition-all mb-3 ${
                    selectedOption === index
                      ? 'border-2 border-[#4A90E2] bg-[#DBEAFE]'
                      : 'border-2 border-gray-200 bg-white'
                  }`}
                >
                  <View className="flex-row items-start">
                    <View className="mr-3 mt-1">
                      {selectedOption === index ? (
                        <CheckCircle size={16} color="#4A90E2" />
                      ) : (
                        <Circle size={16} color="#9CA3AF" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className={`text-sm leading-relaxed ${
                        selectedOption === index ? 'text-[#4A90E2] font-medium' : 'text-gray-700'
                      }`}>
                        {option}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Error banner */}
        {error && (
          <View className="mx-8 mt-2 bg-red-50 p-3 rounded-lg">
            <Text className="text-red-600 text-sm text-center">{error}</Text>
          </View>
        )}
         
        {/* Navigation Buttons */}
        <View className="absolute bottom-0 left-0 right-0 px-4 py-3 mb-4">
          <View className="rounded-2xl p-4  " >
            <View className="flex-row space-x-3">
              {/* Previous Button */}
              <TouchableOpacity
                onPress={handlePrevious}
                disabled={currentQuestion === 0}
                className={`flex-1 py-4 rounded-lg mr-3 flex-row items-center justify-center ${
                  currentQuestion === 0
                    ? 'bg-gray-200 opacity-50'
                    : 'bg-gray-200'
                }`}
              >
                <ArrowLeft size={18} color={currentQuestion === 0 ? "#9CA3AF" : "#374151"} />
                <Text className={`ml-2 font-medium text-sm ${
                  currentQuestion === 0 ? "text-gray-400" : "text-gray-700"
                }`}>
                  Previous
                </Text>
              </TouchableOpacity>

              {/* Next Button */}
              <TouchableOpacity
                onPress={handleNext}
                disabled={selectedOption === null || submitting}
                className={`flex-1 rounded-lg  flex-row items-center justify-center ${
                  selectedOption === null
                    ? 'bg-[#4A90E2] '
                    : 'bg-[#4A90E2]'
                }`}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Text className={`mr-2 font-medium text-sm ${
                      selectedOption === null ? "text-white" : "text-white"
                    }`}>
                      {currentQuestion === questions.length - 1 ? 'Complete' : 'Next'}
                    </Text>
                    <ArrowRight size={18} color={selectedOption === null ? "white" : "white"} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default MCQQuestionScreen;
