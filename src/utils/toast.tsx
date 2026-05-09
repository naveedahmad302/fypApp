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
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  text2Style: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
    lineHeight: 20,
  },
  text2NumberOfLines: 10,
  style: {
    height: 'auto',
    minHeight: 60,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const toastConfig: ToastConfig = {
  success: props => (
    <BaseToast
      {...props}
      {...toastProps}
      style={[toastProps.style, styles.success]}
      renderLeadingIcon={() => (
        <CheckCircle size={25} color="#10B981" style={styles.icon} />
      )}
    />
  ),
  error: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      {...toastProps}
      style={[toastProps.style, styles.error]}
      renderLeadingIcon={() => (
        <XCircle size={25} color="#EF4444" style={styles.icon} />
      )}
    />
  ),
  warning: props => (
    <BaseToast
      {...props}
      {...toastProps}
      style={[toastProps.style, styles.warning]}
      renderLeadingIcon={() => (
        <AlertCircle size={25} color="#F59E0B" style={styles.icon} />
      )}
    />
  ),
  info: props => (
    <BaseToast
      {...props}
      {...toastProps}
      style={[toastProps.style, styles.info]}
      renderLeadingIcon={() => (
        <Info size={25} color="#3B82F6" style={styles.icon} />
      )}
    />
  ),
};

export const showSuccessToast = (text: string, title?: string) => {
  Toast.show({
    type: 'success',
    text1: title,
    text2: text,
    visibilityTime: 4000,
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
    visibilityTime: 7000,
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
    visibilityTime: 4000,
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
    visibilityTime: 4500,
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
    marginRight: -8,
  },
});