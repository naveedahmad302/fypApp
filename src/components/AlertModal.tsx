import React from 'react';
import { Modal, View, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react-native';
import CustomText from './CustomText';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertModalProps {
  visible: boolean;
  onClose: () => void;
  type: AlertType;
  title: string;
  message: string;
  buttonText?: string;
  onButtonPress?: () => void;
}

const AlertModal: React.FC<AlertModalProps> = ({
  visible,
  onClose,
  type,
  title,
  message,
  buttonText = 'OK',
  onButtonPress,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={48} color="#10B981" />;
      case 'error':
        return <XCircle size={48} color="#EF4444" />;
      case 'warning':
        return <AlertCircle size={48} color="#F59E0B" />;
      case 'info':
        return <Info size={48} color="#3B82F6" />;
      default:
        return <Info size={48} color="#3B82F6" />;
    }
  };

  const getIconBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-100';
      case 'error':
        return 'bg-red-100';
      case 'warning':
        return 'bg-yellow-100';
      case 'info':
        return 'bg-blue-100';
      default:
        return 'bg-blue-100';
    }
  };

  const handleButtonPress = () => {
    if (onButtonPress) {
      onButtonPress();
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1">
        <View className="flex-1 justify-center items-center bg-black/50 px-5">
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            {/* Close Button */}
            <TouchableOpacity
              onPress={onClose}
              className="absolute top-4 right-4 p-2"
            >
              <X size={20} color="#6B7280" />
            </TouchableOpacity>

            {/* Icon */}
            <View className="items-center mb-4">
              <View className={`w-20 h-20 rounded-full items-center justify-center ${getIconBgColor()}`}>
                {getIcon()}
              </View>
            </View>

            {/* Title */}
            <CustomText weight={700} className="text-xl text-center text-gray-900 mb-3">
              {title}
            </CustomText>

            {/* Message */}
            <CustomText weight={400} className="text-base text-center text-gray-600 mb-6 leading-relaxed">
              {message}
            </CustomText>

            {/* Button */}
            <TouchableOpacity
              onPress={handleButtonPress}
              className="bg-[#4A90E2] py-3 rounded-xl items-center shadow-lg"
            >
              <CustomText weight={600} className="text-white text-base font-semibold">
                {buttonText}
              </CustomText>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default AlertModal;
