import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Save } from 'lucide-react-native';

interface CustomHeaderProps {
  title: string;
  showBackButton?: boolean;
  showActionButtons?: boolean;
  onCancel?: () => void;
  onSave?: () => void;
}

const CustomHeader: React.FC<CustomHeaderProps> = ({ 
  title, 
  showBackButton = false, 
  showActionButtons = false, 
  onCancel, 
  onSave 
}) => {
  const navigation = useNavigation();

  const handleBackPress = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.headerContainer}>
      {showBackButton && (
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleBackPress}
        >
          <ChevronLeft size={24} color="#000000" />
        </TouchableOpacity>
      )}
      
      {showActionButtons && onCancel && (
        <TouchableOpacity 
          style={styles.cancelButton} 
          onPress={onCancel}
        >
          <ChevronLeft size={20} color="#3b82f6"/>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      )}
      
      <Text style={[
        styles.headerTitle, 
        showBackButton && styles.titleWithBackButton,
        showActionButtons && styles.titleWithActionButtons
      ]}>
        {title}
      </Text>
      
      {showActionButtons && onSave && (
        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={onSave}
        >
          <Save size={20} color="#3b82f6" />
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: 40,
    paddingBottom: 15,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  titleWithBackButton: {
    left: 30,
  },
  titleWithActionButtons: {
    left: 60,
    right: 60,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
    padding: 4,
  },
  cancelButton: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  cancelButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 4,
  },
  saveButton: {
    position: 'absolute',
    right: 16,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  saveButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 4,
  },
});

export default CustomHeader;
