// src/components/SyncStatusIndicator.tsx
// Visual indicator showing sync status

import React from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { useBackgroundSync } from '../hooks/useBackgroundSync';

interface SyncStatusIndicatorProps {
  position?: 'top' | 'bottom';
  compact?: boolean;
}

export default function SyncStatusIndicator({
  position = 'bottom',
  compact = false,
}: SyncStatusIndicatorProps) {
  const {
    status,
    isSyncing,
    isSynced,
    isError,
    isOffline,
    lastSyncTime,
    error,
  } = useBackgroundSync();

  const [fadeAnim] = React.useState(new Animated.Value(0));
  const [showIndicator, setShowIndicator] = React.useState(false);

  React.useEffect(() => {
    // Show indicator when syncing or error
    const shouldShow = isSyncing || isError || (isSynced && !compact);

    setShowIndicator(shouldShow);

    Animated.timing(fadeAnim, {
      toValue: shouldShow ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Auto-hide synced indicator after 3 seconds
    if (isSynced && !compact) {
      const timeout = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowIndicator(false);
        });
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [isSyncing, isSynced, isError, compact, fadeAnim]);

  if (!showIndicator && fadeAnim._value === 0) {
    return null;
  }

  const getStatusColor = () => {
    if (isError) return '#f44336';
    if (isOffline) return '#FF9800';
    if (isSyncing) return '#2196F3';
    if (isSynced) return '#4CAF50';
    return '#757575';
  };

  const getStatusIcon = () => {
    if (isError) return '❌';
    if (isOffline) return '⚠️';
    if (isSyncing) return '🔄';
    if (isSynced) return '✓';
    return '○';
  };

  const getStatusText = () => {
    if (isError) return `Sync failed${error ? `: ${error}` : ''}`;
    if (isOffline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (isSynced && lastSyncTime) {
      const timeAgo = getTimeAgo(lastSyncTime);
      return `Synced ${timeAgo}`;
    }
    return 'Ready to sync';
  };

  const getTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 120) return '1 min ago';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 7200) return '1 hour ago';
    return `${Math.floor(seconds / 3600)} hours ago`;
  };

  if (compact) {
    // Compact version - just a dot with animation
    return (
      <Animated.View style={[styles.compactContainer, { opacity: fadeAnim }]}>
        <View
          style={[
            styles.compactDot,
            { backgroundColor: getStatusColor() },
          ]}
        >
          {isSyncing && (
            <ActivityIndicator size="small" color="#fff" />
          )}
        </View>
      </Animated.View>
    );
  }

  // Full version - banner with text
  return (
    <Animated.View
      style={[
        styles.container,
        position === 'top' ? styles.topPosition : styles.bottomPosition,
        { backgroundColor: getStatusColor() },
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: position === 'top' ? [-50, 0] : [50, 0],
              }),
            },
          ],
        },
      ]}
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color="#fff" style={styles.icon} />
      ) : (
        <Text style={styles.icon}>{getStatusIcon()}</Text>
      )}
      <Text style={styles.text}>{getStatusText()}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  topPosition: {
    top: 0,
    paddingTop: 44, // Account for status bar
  },
  bottomPosition: {
    bottom: 0,
    paddingBottom: 32, // Account for home indicator
  },
  icon: {
    marginRight: 8,
    fontSize: 16,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  compactContainer: {
    width: 12,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  compactDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
