import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { FONTS } from '../theme/fonts';

interface CustomTextProps extends TextProps {
  weight?: keyof typeof FONTS.radioCanada;
  children: React.ReactNode;
}

const CustomText: React.FC<CustomTextProps> = ({ 
  weight = 400, 
  style, 
  children, 
  ...props 
}) => {
  return (
    <Text 
      style={[styles.text, { fontFamily: FONTS.radioCanada[weight] }, style]}
      {...props}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    // Default text styles
  },
});

export default CustomText;
