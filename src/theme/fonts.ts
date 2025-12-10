// Font configuration
export const FONTS = {
  radioCanada: {
    300: 'System', // Fallback to system font until Radio Canada is added
    400: 'System', 
    500: 'System',
    600: 'System',
    700: 'System',
  }
} as const;

// Hook for loading fonts (temporarily disabled until fonts are added)
export const useRadioCanadaFont = () => {
  // Return true to indicate fonts are "loaded" (using system fonts for now)
  return [true] as const;
};

// Future font loading setup (uncomment after adding font files):
/*
import { useFonts } from 'expo-font';

export const useRadioCanadaFont = () => {
  return useFonts({
    [FONTS.radioCanada[300]]: require('../../assets/fonts/RadioCanada-Light.otf'),
    [FONTS.radioCanada[400]]: require('../../assets/fonts/RadioCanada-Regular.otf'),
    [FONTS.radioCanada[500]]: require('../../assets/fonts/RadioCanada-Medium.otf'),
    [FONTS.radioCanada[600]]: require('../../assets/fonts/RadioCanada-SemiBold.otf'),
    [FONTS.radioCanada[700]]: require('../../assets/fonts/RadioCanada-Bold.otf'),
  });
};
*/
// src/theme/fonts.ts
export const Fonts = {
  regular: 'RadioCanada-Regular',
  medium: 'RadioCanada-Medium',
  semiBold: 'RadioCanada-SemiBold',
  bold: 'RadioCanada-Bold',
};