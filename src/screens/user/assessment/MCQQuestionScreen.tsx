import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { ArrowLeft, ArrowRight, CheckCircle, Circle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

interface MCQQuestionScreenProps {
  navigation?: any;
}

const MCQQuestionScreen: React.FC<MCQQuestionScreenProps> = ({ navigation: navProp }) => {
  const navigation = useNavigation();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);

  const questions = [
    {
      id: 1,
      question: "How often do you get lost in thought?",
      options: [
        "Never - always aware",
        "Rarely - stay focused",
        "Sometimes - when engaged",
        "Often - frequently absorbed",
        "Always - almost always lost"
      ]
    },
    {
      id: 2,
      question: "How do you approach complex problems?",
      options: [
        "Break into smaller steps",
        "Look for patterns",
        "Discuss with others",
        "Trust intuition",
        "Take time to reflect"
      ]
    },
    {
      id: 3,
      question: "How do you prefer to learn?",
      options: [
        "Hands-on experience",
        "Reading materials",
        "Visual aids",
        "Listening to explanations",
        "Trial and error"
      ]
    },
    {
      id: 4,
      question: "What describes your social energy?",
      options: [
        "Gain energy from social",
        "Need both social and alone",
        "Comfortable in both",
        "Prefer small groups",
        "Gain energy from solitude"
      ]
    },
    {
      id: 5,
      question: "How do you make decisions?",
      options: [
        "Logic and facts",
        "Gut feelings",
        "Consider others",
        "Weigh all options",
        "Quick decisions"
      ]
    }
  ];

  const handleOptionSelect = (optionIndex: number) => {
    setSelectedOption(optionIndex);
  };

  const handleNext = () => {
    if (selectedOption !== null) {
      const newAnswers = [...answers];
      newAnswers[currentQuestion] = selectedOption;
      setAnswers(newAnswers);

      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
        setSelectedOption(answers[currentQuestion + 1] ?? null);
      } else {
        // Navigate to completion screen
        const nav = navProp || navigation;
        nav.navigate('AssessmentCompleteScreen');
      }
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setSelectedOption(answers[currentQuestion - 1] ?? null);
    }
  };

  const handleBack = () => {
    const nav = navProp || navigation;
    nav.goBack();
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <SafeAreaView className="flex-1 bg-[#F5F7FA]">
      <View className="flex-1">
        {/* Progress Bar */}
        <View className="px-4 py-2 mx-4 mt-4">
          <View className="bg-white rounded-2xl p-4">
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
          <View className="bg-white rounded-2xl p-4">
            <Text className="text-gray-800 text-lg font-semibold mb-4 leading-relaxed">
              {questions[currentQuestion].question}
            </Text>

            {/* Options */}
            <View className="space-y-3 max-h-80">
              {questions[currentQuestion].options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleOptionSelect(index)}
                  className={`p-4 rounded-lg border transition-all ${
                    selectedOption === index
                      ? 'border-2 border-[#4A90E2] bg-[#DBEAFE]'
                      : 'border-2 border-gray-200 bg-white'
                  }`}
                >
                  <View className="flex-row items-start">
                    <View className="mr-3 mt-1">
                      {selectedOption === index ? (
                        <CheckCircle size={18} color="#4A90E2" />
                      ) : (
                        <Circle size={18} color="#9CA3AF" />
                      )}
                    </View>
                    <Text className={`flex-1 text-sm leading-relaxed ${
                      selectedOption === index ? 'text-[#4A90E2] font-medium' : 'text-gray-700'
                    }`}>
                      {option}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
         
        {/* Navigation Buttons */}
        <View className="px-4 py-3 mx-4 mb-4">
          <View className=" rounded-2xl p-4 border-t border-gray-100">
            <View className="flex-row space-x-3">
              {/* Previous Button */}
              <TouchableOpacity
                onPress={handlePrevious}
                disabled={currentQuestion === 0}
                className={`flex-1 py-3 rounded-lg flex-row items-center justify-center ${
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
                disabled={selectedOption === null}
                className={`flex-1 rounded-lg flex-row items-center justify-center ${
                  selectedOption === null
                    ? 'bg-gray-100 opacity-50'
                    : 'bg-[#4A90E2]'
                }`}
              >
                <Text className={`mr-2 font-medium text-sm ${
                  selectedOption === null ? "text-gray-400" : "text-white"
                }`}>
                  {currentQuestion === questions.length - 1 ? 'Complete' : 'Next'}
                </Text>
                <ArrowRight size={18} color={selectedOption === null ? "#9CA3AF" : "white"} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default MCQQuestionScreen;
