// src/screens/MultiDeviceSyncTestScreen.tsx
// Test screen for demonstrating multi-device sync (pull remote changes)

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { createLocalItem, db, LocalItem } from '../database/db';
import { useSync } from '../hooks/useSync';
import { useNetwork } from '../hooks/useNetwork';
import { syncService } from '../services/syncService';
import { saveAuthToken } from '../services/apiClient';

export default function MultiDeviceSyncTestScreen() {
  const [items, setItems] = useState<LocalItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { isSyncing, lastSyncTime, syncStatus, sync, error } = useSync(5 * 60 * 1000);
  const { isOffline } = useNetwork();

  /**
   * Load items from local database
   */
  const loadItems = async () => {
    const allItems = await db.items.toArray();
    allItems.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    setItems(allItems);
  };

  useEffect(() => {
    saveAuthToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwNDA5MDNiMS0wNGU2LTQyOTEtOTM4Ni0yZGEyYjVhMGVkMmIiLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20iLCJpYXQiOjE3NzYwMDU0MTcsImV4cCI6MTc3NjYxMDIxN30.AMrDecblcMVmvEFGJbRmF0WoC0nQa35ioXGrx-VKg_8');
    loadItems();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadItems();
  }, [isSyncing]);

  /**
   * Pull to refresh - triggers sync
   */
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await sync();
      await loadItems();
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Create item locally (simulates Device A creating item)
   */
  const createItemLocally = async () => {
    try {
      const deviceName = 'This Device';
      const timestamp = new Date().toLocaleTimeString();
      await createLocalItem(
        `Item from ${deviceName} at ${timestamp}`,
        'inbox'
      );
      await loadItems();
      Alert.alert(
        'Item Created',
        'Item created locally. Tap "Sync" to push to server.'
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to create item');
      console.error(err);
    }
  };

  /**
   * Manually pull changes
   */
  const pullChanges = async () => {
    try {
      const pulled = await syncService.pullChanges();
      await loadItems();
      
      if (pulled > 0) {
        Alert.alert('Success', `Pulled ${pulled} changes from server`);
      } else {
        Alert.alert('No Changes', 'No new changes on server');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pull changes');
      console.error(err);
    }
  };

  /**
   * Get sync token info
   */
  const showSyncToken = async () => {
    const token = await syncService.getLastSyncToken();
    Alert.alert(
      'Sync Token',
      token ? token : 'No sync token (initial sync needed)',
      [{ text: 'OK' }]
    );
  };

  /**
   * Force full sync
   */
  const forceFullSync = async () => {
    Alert.alert(
      'Force Full Sync',
      'This will re-download all items from server. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            try {
              const result = await syncService.forceFullSync();
              await loadItems();
              Alert.alert(
                'Full Sync Complete',
                `Pulled: ${result.pulled}, Pushed: ${result.pushed}`
              );
            } catch (err) {
              Alert.alert('Error', 'Full sync failed');
              console.error(err);
            }
          },
        },
      ]
    );
  };

  /**
   * Clear local database
   */
  const clearLocalData = async () => {
    Alert.alert(
      'Clear Local Data',
      'This will delete all local items. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await syncService.resetSync();
            await loadItems();
            Alert.alert('Success', 'Local data cleared');
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Multi-Device Sync Test</Text>

      {/* Instructions */}
      <View style={styles.instructionsCard}>
        <Text style={styles.instructionsTitle}>📱 Multi-Device Test:</Text>
        <Text style={styles.instructionsText}>
          1. Install app on 2 devices (A & B)
        </Text>
        <Text style={styles.instructionsText}>
          2. Login with same account on both
        </Text>
        <Text style={styles.instructionsText}>
          3. On Device A: Create item → Sync
        </Text>
        <Text style={styles.instructionsText}>
          4. On Device B: Pull changes
        </Text>
        <Text style={styles.instructionsText}>
          5. See item appear on Device B! ✨
        </Text>
      </View>

      {/* Sync Status */}
      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Sync Status</Text>
        <Text style={styles.statusText}>
          Last Sync: {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Never'}
        </Text>
        <Text style={styles.statusText}>
          Syncing: {isSyncing ? 'Yes' : 'No'}
        </Text>
        {syncStatus && (
          <>
            <Text style={styles.statusText}>Total Items: {syncStatus.totalItems}</Text>
            <Text style={styles.statusText}>Synced: {syncStatus.syncedItems}</Text>
            <Text style={styles.statusText}>
              Unsynced: {syncStatus.unsyncedItems}
            </Text>
            {syncStatus.lastPullTime && (
              <Text style={styles.statusText}>
                Last Pull: {new Date(syncStatus.lastPullTime).toLocaleTimeString()}
              </Text>
            )}
          </>
        )}
        {error && <Text style={styles.errorText}>Error: {error}</Text>}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.button}
          onPress={createItemLocally}
          disabled={isSyncing || isOffline}
        >
          <Text style={styles.buttonText}>📝 Create Item Locally</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={sync}
          disabled={isSyncing || isOffline}
        >
          <Text style={styles.buttonText}>
            {isSyncing ? '⏳ Syncing...' : '🔄 Full Sync (Push + Pull)'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.successButton]}
          onPress={pullChanges}
          disabled={isSyncing || isOffline}
        >
          <Text style={styles.buttonText}>⬇️ Pull Changes Only</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.infoButton]}
          onPress={showSyncToken}
          disabled={isSyncing || isOffline}
        >
          <Text style={styles.buttonText}>🔑 Show Sync Token</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.warningButton]}
          onPress={forceFullSync}
          disabled={isSyncing || isOffline}
        >
          <Text style={styles.buttonText}>🔃 Force Full Sync</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={clearLocalData}
          disabled={isSyncing || isOffline}
        >
          <Text style={styles.buttonText}>🗑️ Clear Local Data</Text>
        </TouchableOpacity>
      </View>

      {/* Items List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Items ({items.length})
          {items.length > 0 && (
            <Text style={styles.pullHint}> ⬇️ Pull to refresh</Text>
          )}
        </Text>

        {items.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No items yet</Text>
            <Text style={styles.emptyHint}>
              Create an item or pull from server
            </Text>
          </View>
        )}

        {items.map(item => (
          <View
            key={item.id}
            style={[
              styles.itemCard,
              item.syncedAt ? styles.syncedItem : styles.unsyncedItem,
            ]}
          >
            <View style={styles.itemHeader}>
              <Text style={styles.itemText}>{item.text}</Text>
              {item.syncedAt ? (
                <Text style={styles.syncBadge}>✓ Synced</Text>
              ) : (
                <Text style={styles.unsyncBadge}>⊘ Not Synced</Text>
              )}
            </View>

            <View style={styles.itemMeta}>
              <Text style={styles.metaText}>
                Category: <Text style={styles.metaValue}>{item.category}</Text>
              </Text>
              <Text style={styles.metaText}>
                Status: <Text style={styles.metaValue}>{item.status}</Text>
              </Text>
            </View>

            <View style={styles.itemMeta}>
              <Text style={styles.metaText}>
                Updated: {item.updatedAt.toLocaleTimeString()}
              </Text>
              {item.syncedAt && (
                <Text style={styles.metaText}>
                  Synced: {item.syncedAt.toLocaleTimeString()}
                </Text>
              )}
            </View>

            {item.serverId && (
              <Text style={styles.serverIdText}>
                Server ID: {item.serverId.substring(0, 20)}...
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* How it works */}
      <View style={styles.howItWorksCard}>
        <Text style={styles.howItWorksTitle}>How Pull Works:</Text>
        <Text style={styles.howItWorksText}>
          1. GET /api/sync?since=lastSyncToken
        </Text>
        <Text style={styles.howItWorksText}>
          2. Server returns changes after that token
        </Text>
        <Text style={styles.howItWorksText}>
          3. For each change:
        </Text>
        <Text style={styles.howItWorksText}>
             • If exists locally → Update
        </Text>
        <Text style={styles.howItWorksText}>
             • If new → Create locally
        </Text>
        <Text style={styles.howItWorksText}>
             • If deleted → Delete locally
        </Text>
        <Text style={styles.howItWorksText}>
          4. Save new syncToken for next pull
        </Text>
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
  instructionsCard: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#2E7D32',
  },
  instructionsText: {
    fontSize: 14,
    color: '#388E3C',
    marginBottom: 4,
  },
  statusCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
    marginTop: 8,
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
  primaryButton: {
    backgroundColor: '#2196F3',
  },
  successButton: {
    backgroundColor: '#4CAF50',
  },
  infoButton: {
    backgroundColor: '#00BCD4',
  },
  warningButton: {
    backgroundColor: '#FF9800',
  },
  dangerButton: {
    backgroundColor: '#f44336',
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
  pullHint: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999',
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
    borderLeftWidth: 4,
  },
  syncedItem: {
    borderLeftColor: '#4CAF50',
  },
  unsyncedItem: {
    borderLeftColor: '#FF9800',
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
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#999',
  },
  metaValue: {
    fontWeight: '600',
    color: '#666',
  },
  serverIdText: {
    fontSize: 10,
    color: '#bbb',
    marginTop: 4,
  },
  howItWorksCard: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  howItWorksTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1976D2',
  },
  howItWorksText: {
    fontSize: 13,
    color: '#1565C0',
    marginBottom: 3,
  },
});
