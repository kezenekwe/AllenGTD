import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, Animated} from 'react-native';

// ─── Toast Component ───────────────────────────────────────────────────────
// Simple toast notification for success/error/info messages
// Auto-dismisses after 2 seconds with fade animation

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
  onHide: () => void;
  duration?: number; // milliseconds, default 2000
}

export default function Toast({
  message,
  type,
  visible,
  onHide,
  duration = 2000,
}: ToastProps) {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      // Fade in, wait, fade out
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(duration),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onHide();
      });
    }
  }, [visible, fadeAnim, onHide, duration]);

  if (!visible) return null;

  const backgroundColor = {
    success: '#4caf50',
    error: '#f44336',
    info: '#2196f3',
  }[type];

  const icon = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  }[type];

  return (
    <Animated.View
      style={[
        styles.container,
        {backgroundColor, opacity: fadeAnim},
      ]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  icon: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 10,
  },
  message: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

// ─── Hook for Easy Toast Usage ────────────────────────────────────────────

export function useToast() {
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info' as 'success' | 'error' | 'info',
  });

  const showToast = (
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
  ) => {
    setToast({visible: true, message, type});
  };

  const hideToast = () => {
    setToast({...toast, visible: false});
  };

  const ToastComponent = () => (
    <Toast
      message={toast.message}
      type={toast.type}
      visible={toast.visible}
      onHide={hideToast}
    />
  );

  return {showToast, ToastComponent};
}
