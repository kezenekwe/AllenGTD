// src/screens/SyncTestScreen.tsx
// Test screen for demonstrating offline sync functionality

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { createLocalItem, getUnsyncedItems, db, LocalItem } from '../database/db';
import { useSync } from '../hooks/useSync';
import { useNetwork } from '../hooks/useNetwork';
import { syncService } from '../services/syncService';
import { saveAuthToken } from '../services/apiClient';

export default function SyncTestScreen() {
  const [items, setItems] = useState<LocalItem[]>([]);
  const [unsyncedItems, setUnsyncedItems] = useState<LocalItem[]>([]);
  const { isSyncing, lastSyncTime, syncStatus, sync, error } = useSync(5 * 60 * 1000);
  const { isOffline } = useNetwork();

  /**
   * Load items from local database
   */
  const loadItems = async () => {
    const allItems = await db.items.toArray();
    const unsynced = await getUnsyncedItems();
    setItems(allItems);
    setUnsyncedItems(unsynced);
  };

  useEffect(() => {
    // Store test auth token so apiClient can authenticate sync requests
    saveAuthToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwNDA5MDNiMS0wNGU2LTQyOTEtOTM4Ni0yZGEyYjVhMGVkMmIiLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20iLCJpYXQiOjE3NzYwMDU0MTcsImV4cCI6MTc3NjYxMDIxN30.AMrDecblcMVmvEFGJbRmF0WoC0nQa35ioXGrx-VKg_8');
    loadItems();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadItems();
  }, [isSyncing]); // Reload after sync

  /**
   * Create item offline (not synced)
   */
  const createOfflineItem = async () => {
    try {
      const itemNumber = items.length + 1;
      await createLocalItem(`Offline Item ${itemNumber}`, 'inbox');
      await loadItems();
      Alert.alert('Success', 'Item created locally (not synced yet)');
    } catch (err) {
      Alert.alert('Error', 'Failed to create item');
      console.error(err);
    }
  };

  /**
   * Create 3 items for testing
   */
  const create3Items = async () => {
    try {
      await createLocalItem('Test Item 1 (Offline)', 'inbox');
      await createLocalItem('Test Item 2 (Offline)', 'nextActions');
      await createLocalItem('Test Item 3 (Offline)', 'projects');
      await loadItems();
      Alert.alert('Success', '3 items created locally');
    } catch (err) {
      Alert.alert('Error', 'Failed to create items');
      console.error(err);
    }
  };

  /**
   * Manually trigger sync
   */
  const handleSync = async () => {
    try {
      await sync();
      await loadItems();
      
      if (error) {
        Alert.alert('Sync Error', error);
      } else {
        Alert.alert('Success', 'Sync completed!');
      }
    } catch (err) {
      Alert.alert('Error', 'Sync failed');
      console.error(err);
    }
  };

  /**
   * Reset database (for testing)
   */
  const resetDatabase = async () => {
    Alert.alert(
      'Reset Database',
      'This will delete all local data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await syncService.resetSync();
            await loadItems();
            Alert.alert('Success', 'Database reset');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Sync Test Screen</Text>

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
            <Text style={styles.statusText}>
              Pending Deletes: {syncStatus.pendingDeletes}
            </Text>
          </>
        )}
        {error && <Text style={styles.errorText}>Error: {error}</Text>}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.button}
          onPress={createOfflineItem}
          disabled={isSyncing || isOffline}
        >
          <Text style={styles.buttonText}>Create 1 Offline Item</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={create3Items}
          disabled={isSyncing || isOffline}
        >
          <Text style={styles.buttonText}>Create 3 Offline Items</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.syncButton]}
          onPress={handleSync}
          disabled={isSyncing || isOffline}
        >
          <Text style={styles.buttonText}>
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={resetDatabase}
          disabled={isSyncing || isOffline}
        >
          <Text style={styles.buttonText}>Reset Database</Text>
        </TouchableOpacity>
      </View>

      {/* Unsynced Items */}
      {unsyncedItems.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Unsynced Items ({unsyncedItems.length})
          </Text>
          {unsyncedItems.map(item => (
            <View key={item.id} style={styles.itemCard}>
              <Text style={styles.itemText}>{item.text}</Text>
              <Text style={styles.itemMeta}>
                Category: {item.category} • Local ID: {item.id.substring(0, 15)}...
              </Text>
              <Text style={styles.itemMeta}>
                Server ID: {item.serverId || 'Not synced'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* All Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All Items ({items.length})</Text>
        {items.map(item => (
          <View
            key={item.id}
            style={[
              styles.itemCard,
              item.syncedAt ? styles.syncedItem : styles.unsyncedItem,
            ]}
          >
            <Text style={styles.itemText}>{item.text}</Text>
            <Text style={styles.itemMeta}>Category: {item.category}</Text>
            <Text style={styles.itemMeta}>Status: {item.status}</Text>
            <Text style={styles.itemMeta}>
              Synced: {item.syncedAt ? '✓' : '✗'}
            </Text>
            {item.serverId && (
              <Text style={styles.itemMeta}>
                Server ID: {item.serverId.substring(0, 20)}...
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>How to Test:</Text>
        <Text style={styles.instructionsText}>
          1. Turn off WiFi/Mobile Data (go offline)
        </Text>
        <Text style={styles.instructionsText}>
          2. Tap "Create 3 Offline Items"
        </Text>
        <Text style={styles.instructionsText}>
          3. See items appear in "Unsynced Items"
        </Text>
        <Text style={styles.instructionsText}>
          4. Turn WiFi/Mobile Data back on (go online)
        </Text>
        <Text style={styles.instructionsText}>5. Tap "Sync Now"</Text>
        <Text style={styles.instructionsText}>
          6. Items should sync to server and get Server IDs
        </Text>
      </View>
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
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  syncButton: {
    backgroundColor: '#4CAF50',
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
  itemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  instructions: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 32,
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
});
