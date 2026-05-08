import React from 'react';
import { StyleSheet } from 'react-native';
import Toast, {
  BaseToast,
  BaseToastProps,
  ToastConfig,
} from 'react-native-toast-message';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react-native';

const toastProps: BaseToastProps = {
  text1Style: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 3,
  },
  text2Style: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
    lineHeight: 18,
  },
  text2NumberOfLines: 8,
  style: {
    height: 'auto',
    minHeight: 55,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 6,
  },
};

export const toastConfig: ToastConfig = {
  success: props => (
    <BaseToast
      {...props}
      {...toastProps}
      style={[toastProps.style, styles.success]}
      renderLeadingIcon={() => (
        <CheckCircle size={22} color="#10B981" style={styles.icon} />
      )}
    />
  ),
  error: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      {...toastProps}
      style={[toastProps.style, styles.error]}
      renderLeadingIcon={() => (
        <XCircle size={22} color="#EF4444" style={styles.icon} />
      )}
    />
  ),
  warning: props => (
    <BaseToast
      {...props}
      {...toastProps}
      style={[toastProps.style, styles.warning]}
      renderLeadingIcon={() => (
        <AlertCircle size={22} color="#F59E0B" style={styles.icon} />
      )}
    />
  ),
  info: props => (
    <BaseToast
      {...props}
      {...toastProps}
      style={[toastProps.style, styles.info]}
      renderLeadingIcon={() => (
        <Info size={22} color="#3B82F6" style={styles.icon} />
      )}
    />
  ),
};

export const showSuccessToast = (text: string, title?: string) => {
  Toast.show({
    type: 'success',
    text1: title,
    text2: text,
    visibilityTime: 3500,
    autoHide: true,
    swipeable: true,
    position: 'top',
  });
};

export const showErrorToast = (text: string, title?: string) => {
  Toast.show({
    type: 'error',
    text1: title,
    text2: text,
    visibilityTime: 6000,
    autoHide: true,
    swipeable: true,
    position: 'top',
  });
};

export const showInfoToast = (text: string, title?: string) => {
  Toast.show({
    type: 'info',
    text1: title,
    text2: text,
    visibilityTime: 3500,
    autoHide: true,
    swipeable: true,
    position: 'top',
  });
};

export const showWarningToast = (text: string, title?: string) => {
  Toast.show({
    type: 'warning',
    text1: title,
    text2: text,
    visibilityTime: 4000,
    autoHide: true,
    swipeable: true,
    position: 'top',
  });
};

const styles = StyleSheet.create({
  success: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    borderWidth: 1,
    borderColor: '#D1FAE5',
    zIndex: 1000000,
  },
  error: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    zIndex: 1000000,
  },
  warning: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    zIndex: 1000000,
  },
  info: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    zIndex: 1000000,
  },
  icon: {
    marginRight: -6,
  },
});