// src/screens/BackgroundSyncTestScreen.tsx
// Test screen for background sync functionality

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useBackgroundSync } from '../hooks/useBackgroundSync';
import { backgroundSyncService } from '../services/backgroundSyncService';
import { createLocalItem, db, LocalItem } from '../database/db';
import { saveAuthToken } from '../services/apiClient';

export default function BackgroundSyncTestScreen() {
  const {
    status,
    isSyncing,
    isSynced,
    isError,
    isOffline,
    lastSyncTime,
    lastSyncResult,
    error,
    syncCount,
    triggerSync,
    pauseSync,
    resumeSync,
  } = useBackgroundSync();

  const [items, setItems] = useState<LocalItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [timeUntilNext, setTimeUntilNext] = useState<number | null>(null);
  const [syncLog, setSyncLog] = useState<string[]>([]);

  /**
   * Load items
   */
  const loadItems = async () => {
    const allItems = await db.items.toArray();
    allItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    setItems(allItems);
  };

  useEffect(() => {
    saveAuthToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwNDA5MDNiMS0wNGU2LTQyOTEtOTM4Ni0yZGEyYjVhMGVkMmIiLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20iLCJpYXQiOjE3NzYwMDU0MTcsImV4cCI6MTc3NjYxMDIxN30.AMrDecblcMVmvEFGJbRmF0WoC0nQa35ioXGrx-VKg_8');
    loadItems();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadItems();
  }, [status]);

  /**
   * Update time until next sync
   */
  useEffect(() => {
    const interval = setInterval(() => {
      const time = backgroundSyncService.getTimeUntilNextSync();
      setTimeUntilNext(time);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Log status changes
   */
  useEffect(() => {
    const statusText = getStatusText(status);
    addToLog(`Status: ${statusText}`);
  }, [status]);

  /**
   * Create test item
   */
  const createTestItem = async () => {
    try {
      const itemNumber = items.length + 1;
      await createLocalItem(`Background Sync Test ${itemNumber}`, 'inbox');
      await loadItems();
      
      addToLog(`Created: Test item ${itemNumber}`);
      
      Alert.alert(
        'Item Created',
        'Item created locally. Will sync in background within 30 seconds.'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to create item');
      console.error(error);
    }
  };

  /**
   * Manual sync
   */
  const handleManualSync = async () => {
    try {
      addToLog('Manual sync triggered');
      await triggerSync();
    } catch (error) {
      Alert.alert('Error', 'Sync failed');
      console.error(error);
    }
  };

  /**
   * Pause/Resume sync
   */
  const handlePauseResume = () => {
    if (isPaused) {
      resumeSync();
      addToLog('Sync resumed');
      Alert.alert('Resumed', 'Background sync resumed');
    } else {
      pauseSync();
      addToLog('Sync paused');
      Alert.alert('Paused', 'Background sync paused');
    }
    setIsPaused(!isPaused);
  };

  /**
   * Reset sync count
   */
  const handleResetCount = async () => {
    await backgroundSyncService.resetSyncCount();
    addToLog('Sync count reset');
    Alert.alert('Reset', 'Sync count reset to 0');
  };

  /**
   * Add to log
   */
  const addToLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSyncLog(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 29)]);
  };

  /**
   * Clear log
   */
  const clearLog = () => {
    setSyncLog([]);
  };

  /**
   * Get status text
   */
  const getStatusText = (status: string): string => {
    switch (status) {
      case 'syncing':
        return 'Syncing...';
      case 'synced':
        return 'Synced';
      case 'error':
        return 'Error';
      case 'offline':
        return 'Offline';
      default:
        return 'Idle';
    }
  };

  /**
   * Get status color
   */
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'syncing':
        return '#2196F3';
      case 'synced':
        return '#4CAF50';
      case 'error':
        return '#f44336';
      case 'offline':
        return '#FF9800';
      default:
        return '#757575';
    }
  };

  /**
   * Format time
   */
  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Background Sync Test</Text>

      {/* Sync Status */}
      <View
        style={[
          styles.statusCard,
          { borderLeftColor: getStatusColor(status) },
        ]}
      >
        <View style={styles.statusHeader}>
          <Text style={styles.statusTitle}>
            Status: {getStatusText(status)}
          </Text>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(status) },
            ]}
          />
        </View>

        {lastSyncTime && (
          <Text style={styles.statusDetail}>
            Last Sync: {lastSyncTime.toLocaleTimeString()}
          </Text>
        )}

        {lastSyncResult && (
          <Text style={styles.statusDetail}>
            Last Result: Pushed {lastSyncResult.pushed}, Pulled{' '}
            {lastSyncResult.pulled}, Conflicts {lastSyncResult.conflicts}
          </Text>
        )}

        {error && (
          <Text style={styles.errorText}>Error: {error}</Text>
        )}

        <Text style={styles.statusDetail}>Total Syncs: {syncCount}</Text>

        {timeUntilNext !== null && !isPaused && (
          <Text style={styles.statusDetail}>
            Next Sync: {formatTime(timeUntilNext)}
          </Text>
        )}

        {isPaused && (
          <Text style={styles.pausedText}>⏸️ Sync Paused</Text>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructionsCard}>
        <Text style={styles.instructionsTitle}>🔄 How to Test:</Text>
        <Text style={styles.instructionsText}>
          1. Create items using button below
        </Text>
        <Text style={styles.instructionsText}>
          2. Leave app idle (don't touch anything)
        </Text>
        <Text style={styles.instructionsText}>
          3. Watch status change to "Syncing..." every 30s
        </Text>
        <Text style={styles.instructionsText}>
          4. See sync count increment automatically
        </Text>
        <Text style={styles.instructionsText}>
          5. Items get synced in background ✨
        </Text>
        <Text style={styles.instructionsText}>
          6. Press home button and return → Auto-sync!
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.button}
          onPress={createTestItem}
        >
          <Text style={styles.buttonText}>📝 Create Test Item</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.syncButton]}
          onPress={handleManualSync}
          disabled={isSyncing}
        >
          <Text style={styles.buttonText}>
            {isSyncing ? '⏳ Syncing...' : '🔄 Manual Sync'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            isPaused ? styles.resumeButton : styles.pauseButton,
          ]}
          onPress={handlePauseResume}
        >
          <Text style={styles.buttonText}>
            {isPaused ? '▶️ Resume Sync' : '⏸️ Pause Sync'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.resetButton]}
          onPress={handleResetCount}
        >
          <Text style={styles.buttonText}>🔄 Reset Count</Text>
        </TouchableOpacity>
      </View>

      {/* Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items ({items.length})</Text>

        {items.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No items</Text>
            <Text style={styles.emptyHint}>
              Create items and watch them sync automatically
            </Text>
          </View>
        )}

        {items.slice(0, 10).map(item => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemText}>{item.text}</Text>
              {item.syncedAt ? (
                <Text style={styles.syncBadge}>✓ Synced</Text>
              ) : (
                <Text style={styles.unsyncBadge}>⊘ Pending</Text>
              )}
            </View>
            <Text style={styles.itemMeta}>
              Created: {item.createdAt.toLocaleTimeString()}
            </Text>
            {item.syncedAt && (
              <Text style={styles.itemMeta}>
                Synced: {item.syncedAt.toLocaleTimeString()}
              </Text>
            )}
          </View>
        ))}

        {items.length > 10 && (
          <Text style={styles.moreItems}>
            ... and {items.length - 10} more
          </Text>
        )}
      </View>

      {/* Sync Log */}
      <View style={styles.section}>
        <View style={styles.logHeader}>
          <Text style={styles.sectionTitle}>Sync Log</Text>
          <TouchableOpacity onPress={clearLog}>
            <Text style={styles.clearLog}>Clear</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.logCard}>
          {syncLog.length === 0 ? (
            <Text style={styles.logEmpty}>No events yet</Text>
          ) : (
            syncLog.map((log, index) => (
              <Text key={index} style={styles.logEntry}>
                {log}
              </Text>
            ))
          )}
        </View>
      </View>

      {/* Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>ℹ️ Background Sync Info:</Text>
        <Text style={styles.infoText}>• Runs every 30 seconds</Text>
        <Text style={styles.infoText}>• Triggers on app foreground</Text>
        <Text style={styles.infoText}>• Skips if already syncing</Text>
        <Text style={styles.infoText}>• Skips if offline</Text>
        <Text style={styles.infoText}>• Shows status indicator</Text>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  statusCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#f44336',
    marginTop: 4,
  },
  pausedText: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '600',
    marginTop: 4,
  },
  instructionsCard: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1976D2',
  },
  instructionsText: {
    fontSize: 14,
    color: '#1565C0',
    marginBottom: 4,
  },
  actions: {
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#757575',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  syncButton: {
    backgroundColor: '#2196F3',
  },
  pauseButton: {
    backgroundColor: '#FF9800',
  },
  resumeButton: {
    backgroundColor: '#4CAF50',
  },
  resetButton: {
    backgroundColor: '#9C27B0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  emptyState: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 4,
  },
  emptyHint: {
    fontSize: 14,
    color: '#bbb',
    textAlign: 'center',
  },
  itemCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  syncBadge: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  unsyncBadge: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '600',
  },
  itemMeta: {
    fontSize: 12,
    color: '#999',
  },
  moreItems: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clearLog: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
  logCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    maxHeight: 200,
  },
  logEmpty: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  logEntry: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#666',
    marginBottom: 4,
  },
  infoCard: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#2E7D32',
  },
  infoText: {
    fontSize: 14,
    color: '#388E3C',
    marginBottom: 4,
  },
});
