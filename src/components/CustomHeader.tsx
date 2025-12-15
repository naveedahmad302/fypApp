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
  headerLeft?: React.ReactNode;
}

const CustomHeader: React.FC<CustomHeaderProps> = ({ 
  title, 
  showBackButton = false, 
  showActionButtons = false, 
  onCancel, 
  onSave,
  headerLeft
}) => {
  const navigation = useNavigation();

  const handleBackPress = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.headerContainer}>
      <View style={styles.headerLeftContainer}>
        {headerLeft ? (
          headerLeft
        ) : (
          <>
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
          </>
        )}
      </View>
      
      <Text style={[
        styles.headerTitle, 
        showBackButton && styles.titleWithBackButton,
        showActionButtons && styles.titleWithActionButtons
      ]}>
        {title}
      </Text>
      
      {/* {showActionButtons && onSave && (
        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={onSave}
        >
          <Save size={20} color="#3b82f6" />
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      )} */}
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    position: 'relative',
  },
  headerLeftContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    position: 'absolute',
    left: 50,
    right: 50,
    textAlign: 'center',
  },
  titleWithBackButton: {
    left: 50,
    right: 50,
  },
  titleWithActionButtons: {
    left: 80,
    right: 80,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 4,
  },
  saveButton: {
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
