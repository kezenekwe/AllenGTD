// src/screens/NetworkDetectionTestScreen.tsx
// Test screen for network detection and auto-sync

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNetwork } from '../hooks/useNetwork';
import { networkService } from '../services/networkService';
import { createLocalItem, db, LocalItem } from '../database/db';
import { syncService } from '../services/syncService';

export default function NetworkDetectionTestScreen() {
  const { isOnline, isOffline, connectionType, isInternetReachable } = useNetwork();
  const [items, setItems] = useState<LocalItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [syncLog, setSyncLog] = useState<string[]>([]);

  /**
   * Load items and stats
   */
  const loadData = async () => {
    const allItems = await db.items.orderBy('createdAt').reverse().toArray();
    setItems(allItems);

    const networkStats = await networkService.getStats();
    setStats(networkStats);
  };

  useEffect(() => {
    loadData();
  }, []);

  /**
   * Create offline item
   */
  const createOfflineItem = async () => {
    try {
      const itemNumber = items.length + 1;
      await createLocalItem(`Offline Item ${itemNumber}`, 'inbox');
      await loadData();
      
      addToLog(`Created: Offline Item ${itemNumber}`);
      
      Alert.alert(
        'Item Created',
        isOffline
          ? 'Created offline. Will sync when connection restored.'
          : 'Created online. Sync to push to server.'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to create item');
      console.error(error);
    }
  };

  /**
   * Create multiple offline items
   */
  const create3Items = async () => {
    try {
      for (let i = 1; i <= 3; i++) {
        await createLocalItem(`Batch Item ${i}`, 'inbox');
        addToLog(`Created: Batch Item ${i}`);
      }
      
      await loadData();
      
      Alert.alert(
        'Success',
        isOffline
          ? '3 items created offline. Will auto-sync when online.'
          : '3 items created. Sync to push to server.'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to create items');
      console.error(error);
    }
  };

  /**
   * Manual sync
   */
  const handleSync = async () => {
    if (isOffline) {
      Alert.alert(
        'Offline',
        'Cannot sync while offline. Items will auto-sync when connection restored.'
      );
      return;
    }

    try {
      addToLog('Manual sync started...');
      
      const result = await syncService.sync();
      
      addToLog(
        `Sync complete: Pushed ${result.pushed}, Pulled ${result.pulled}`
      );
      
      await loadData();
      
      Alert.alert(
        'Sync Complete',
        `Pushed: ${result.pushed}\nPulled: ${result.pulled}\nConflicts: ${result.conflicts.length}`
      );
    } catch (error) {
      addToLog('Sync failed');
      Alert.alert('Error', 'Sync failed');
      console.error(error);
    }
  };

  /**
   * Force sync check
   */
  const forceSyncCheck = async () => {
    try {
      addToLog('Force sync check...');
      await networkService.forceSyncCheck();
      await loadData();
      addToLog('Force sync check complete');
    } catch (error) {
      addToLog('Force sync check failed');
      console.error(error);
    }
  };

  /**
   * Refresh stats
   */
  const refreshStats = async () => {
    const networkStats = await networkService.getStats();
    setStats(networkStats);
    await loadData();
  };

  /**
   * Add to sync log
   */
  const addToLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSyncLog(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]);
  };

  /**
   * Clear log
   */
  const clearLog = () => {
    setSyncLog([]);
  };

  // Log network status changes
  useEffect(() => {
    addToLog(
      isOnline
        ? `✅ Online (${connectionType || 'Unknown'})`
        : '⚠️ Offline'
    );
  }, [isOnline, connectionType]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Network Detection Test</Text>

      {/* Network Status */}
      <View
        style={[
          styles.statusCard,
          isOnline ? styles.onlineCard : styles.offlineCard,
        ]}
      >
        <Text style={styles.statusIcon}>
          {isOnline ? '✅' : '⚠️'}
        </Text>
        <View style={styles.statusInfo}>
          <Text style={styles.statusTitle}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
          <Text style={styles.statusDetail}>
            Type: {connectionType || 'Unknown'}
          </Text>
          {isInternetReachable !== null && (
            <Text style={styles.statusDetail}>
              Internet: {isInternetReachable ? 'Reachable' : 'Not Reachable'}
            </Text>
          )}
        </View>
      </View>

      {/* Network Stats */}
      {stats && (
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Network Statistics</Text>
          
          {stats.offlineDuration !== null && (
            <Text style={styles.statsText}>
              Offline for: {Math.floor(stats.offlineDuration / 1000 / 60)} min
            </Text>
          )}
          
          {stats.lastOnlineTime && (
            <Text style={styles.statsText}>
              Last Online: {new Date(stats.lastOnlineTime).toLocaleString()}
            </Text>
          )}
          
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={refreshStats}
          >
            <Text style={styles.refreshButtonText}>🔄 Refresh Stats</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Instructions */}
      <View style={styles.instructionsCard}>
        <Text style={styles.instructionsTitle}>📱 How to Test:</Text>
        <Text style={styles.instructionsText}>
          1. Turn off WiFi/Mobile Data (go offline)
        </Text>
        <Text style={styles.instructionsText}>
          2. Create items using buttons below
        </Text>
        <Text style={styles.instructionsText}>
          3. Items saved locally (see "Unsynced" badge)
        </Text>
        <Text style={styles.instructionsText}>
          4. Turn WiFi/Mobile Data back on
        </Text>
        <Text style={styles.instructionsText}>
          5. Watch auto-sync happen! ✨
        </Text>
        <Text style={styles.instructionsText}>
          6. Items get "Synced" badge automatically
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.button}
          onPress={createOfflineItem}
        >
          <Text style={styles.buttonText}>📝 Create 1 Item</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={create3Items}
        >
          <Text style={styles.buttonText}>📝 Create 3 Items</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.syncButton,
            isOffline && styles.disabledButton,
          ]}
          onPress={handleSync}
          disabled={isOffline}
        >
          <Text style={styles.buttonText}>
            {isOffline ? '🔒 Sync (Offline)' : '🔄 Manual Sync'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.infoButton]}
          onPress={forceSyncCheck}
        >
          <Text style={styles.buttonText}>🔍 Force Sync Check</Text>
        </TouchableOpacity>
      </View>

      {/* Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items ({items.length})</Text>

        {items.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No items</Text>
            <Text style={styles.emptyHint}>Create items to test sync</Text>
          </View>
        )}

        {items.slice(0, 10).map(item => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemText}>{item.text}</Text>
              {item.syncedAt ? (
                <Text style={styles.syncBadge}>✓ Synced</Text>
              ) : (
                <Text style={styles.unsyncBadge}>⊘ Unsynced</Text>
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

      {/* Auto-Sync Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>🔄 Auto-Sync Triggers:</Text>
        <Text style={styles.infoText}>✓ When network becomes available</Text>
        <Text style={styles.infoText}>✓ App comes to foreground</Text>
        <Text style={styles.infoText}>✓ Periodic (every 5 minutes)</Text>
        <Text style={styles.infoText}>✓ Manual sync button</Text>
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
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  onlineCard: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  offlineCard: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  statusIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  statusDetail: {
    fontSize: 14,
    color: '#666',
  },
  statsCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  statsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  refreshButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 4,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '600',
  },
  instructionsCard: {
    backgroundColor: '#E8EAF6',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#3F51B5',
  },
  instructionsText: {
    fontSize: 14,
    color: '#5C6BC0',
    marginBottom: 4,
  },
  actions: {
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  syncButton: {
    backgroundColor: '#4CAF50',
  },
  infoButton: {
    backgroundColor: '#00BCD4',
  },
  disabledButton: {
    backgroundColor: '#BDBDBD',
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
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1976D2',
  },
  infoText: {
    fontSize: 14,
    color: '#1565C0',
    marginBottom: 4,
  },
});
