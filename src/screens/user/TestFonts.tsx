import React from 'react';
import { View, StyleSheet } from 'react-native';
import CustomText from '../../components/CustomText';

const TestFonts = () => (
  <View style={styles.container}>
    <CustomText variant="regular" className="text-lg mb-2">
      Radio Canada Regular
    </CustomText>
    <CustomText variant="medium" className="text-lg mb-2">
      Radio Canada Medium
    </CustomText>
    <CustomText variant="semiBold" className="text-lg mb-2">
      Radio Canada SemiBold
    </CustomText>
    <CustomText variant="bold" className="text-lg mb-2">
      Radio Canada Bold
    </CustomText>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});

export default TestFonts;
