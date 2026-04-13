// src/screens/ConflictResolutionTestScreen.tsx
// Test screen for demonstrating conflict resolution (last-write-wins)

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { db, LocalItem } from '../database/db';
import { syncService, ConflictInfo } from '../services/syncService';
import { saveAuthToken } from '../services/apiClient';
import { useNetwork } from '../hooks/useNetwork';

export default function ConflictResolutionTestScreen() {
  const [items, setItems] = useState<LocalItem[]>([]);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [syncing, setSyncing] = useState(false);
  const { isOffline } = useNetwork();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  /**
   * Load items from database
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

  /**
   * Create test item for conflict testing
   */
  const createTestItem = async () => {
    try {
      const now = new Date();
      const testItem: LocalItem = {
        id: `test_${Date.now()}`,
        serverId: null,
        text: 'Test Item for Conflict Resolution',
        category: 'inbox',
        status: 'active',
        nextAction: null,
        waitingFor: null,
        projectPlan: null,
        hasCalendar: false,
        createdAt: now,
        updatedAt: now,
        syncedAt: null,
        pendingDelete: false,
      };

      await db.items.add(testItem);
      await loadItems();
      Alert.alert('Created', 'Test item created. Sync it to server first.');
    } catch (error) {
      Alert.alert('Error', 'Failed to create item');
      console.error(error);
    }
  };

  /**
   * Edit item locally (simulates editing on Device A)
   */
  const startEdit = (item: LocalItem) => {
    setEditingItemId(item.id);
    setEditText(item.text);
  };

  const saveEdit = async () => {
    if (!editingItemId) return;

    try {
      await db.items.update(editingItemId, {
        text: editText,
        updatedAt: new Date(), // Update timestamp
        syncedAt: null as any, // Mark as unsynced
      });

      setEditingItemId(null);
      setEditText('');
      await loadItems();

      Alert.alert(
        'Edited',
        'Item updated locally. Now sync to see conflict resolution in action!'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update item');
      console.error(error);
    }
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setEditText('');
  };

  /**
   * Sync with conflict detection
   */
  const handleSync = async () => {
    setSyncing(true);
    setConflicts([]);

    try {
      const result = await syncService.sync();

      await loadItems();

      if (result.conflicts.length > 0) {
        setConflicts(result.conflicts);
        
        const conflictSummary = result.conflicts
          .map(
            (c, i) =>
              `${i + 1}. ${c.resolution === 'remote_wins' ? 'Remote' : 'Local'} won - ${c.reason}`
          )
          .join('\n\n');

        Alert.alert(
          'Conflicts Resolved',
          `Found ${result.conflicts.length} conflict(s):\n\n${conflictSummary}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Sync Complete',
          `Pulled: ${result.pulled}, Pushed: ${result.pushed}, No conflicts`
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Sync failed');
      console.error(error);
    } finally {
      setSyncing(false);
    }
  };

  /**
   * Simulate editing on another device
   */
  const simulateRemoteEdit = () => {
    Alert.alert(
      'Simulate Remote Edit',
      'To test conflicts:\n\n' +
        '1. Edit item on this device (Device A)\n' +
        '2. Edit same item on another device (Device B)\n' +
        '3. Sync Device B first\n' +
        '4. Sync Device A\n' +
        '5. Conflict will be detected!\n\n' +
        'The device that syncs last will see the conflict resolution.',
      [{ text: 'Got it!' }]
    );
  };

  /**
   * Show conflict details
   */
  const showConflictDetails = (conflict: ConflictInfo) => {
    const winner = conflict.resolution === 'remote_wins' ? 'Remote' : 'Local';
    const loser = conflict.resolution === 'remote_wins' ? 'Local' : 'Remote';

    Alert.alert(
      'Conflict Details',
      `Winner: ${winner}\n\n` +
        `Reason: ${conflict.reason}\n\n` +
        `Local Version:\n` +
        `Text: "${conflict.localVersion.text}"\n` +
        `Updated: ${new Date(conflict.localVersion.updatedAt).toLocaleString()}\n\n` +
        `Remote Version:\n` +
        `Text: "${conflict.remoteVersion.text}"\n` +
        `Updated: ${new Date(conflict.remoteVersion.updated_at).toLocaleString()}`,
      [{ text: 'OK' }]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Conflict Resolution Test</Text>

      {/* Instructions */}
      <View style={styles.instructionsCard}>
        <Text style={styles.instructionsTitle}>🔀 How to Test Conflicts:</Text>
        <Text style={styles.instructionsText}>
          1. Create test item → Sync to server
        </Text>
        <Text style={styles.instructionsText}>
          2. On Device A: Edit item to "Version A"
        </Text>
        <Text style={styles.instructionsText}>
          3. On Device B: Edit same item to "Version B"
        </Text>
        <Text style={styles.instructionsText}>
          4. Sync Device A first (pushes "Version A")
        </Text>
        <Text style={styles.instructionsText}>
          5. Sync Device B (detects conflict!)
        </Text>
        <Text style={styles.instructionsText}>
          6. Last-write-wins: Newer timestamp wins
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.button}
          onPress={createTestItem}
          disabled={syncing || isOffline}
        >
          <Text style={styles.buttonText}>📝 Create Test Item</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.syncButton]}
          onPress={handleSync}
          disabled={syncing || isOffline}
        >
          <Text style={styles.buttonText}>
            {syncing ? '⏳ Syncing...' : '🔄 Sync (Check Conflicts)'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.infoButton]}
          onPress={simulateRemoteEdit}
        >
          <Text style={styles.buttonText}>ℹ️ How to Test</Text>
        </TouchableOpacity>
      </View>

      {/* Conflicts Detected */}
      {conflicts.length > 0 && (
        <View style={styles.conflictsSection}>
          <Text style={styles.conflictsTitle}>
            ⚠️ Conflicts Resolved ({conflicts.length})
          </Text>
          {conflicts.map((conflict, index) => (
            <TouchableOpacity
              key={index}
              style={styles.conflictCard}
              onPress={() => showConflictDetails(conflict)}
            >
              <View style={styles.conflictHeader}>
                <Text style={styles.conflictResolution}>
                  {conflict.resolution === 'remote_wins' ? '🌐 Remote Won' : '📱 Local Won'}
                </Text>
                <Text style={styles.conflictTap}>Tap for details</Text>
              </View>
              <Text style={styles.conflictReason}>{conflict.reason}</Text>
              <Text style={styles.conflictItem}>
                Item: {conflict.remoteVersion.text.substring(0, 40)}...
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Items List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items ({items.length})</Text>

        {items.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No items</Text>
            <Text style={styles.emptyHint}>Create a test item to begin</Text>
          </View>
        )}

        {items.map(item => (
          <View key={item.id} style={styles.itemCard}>
            {editingItemId === item.id ? (
              // Edit mode
              <View>
                <TextInput
                  style={styles.editInput}
                  value={editText}
                  onChangeText={setEditText}
                  placeholder="Edit item text..."
                  multiline
                />
                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={[styles.editButton, styles.saveButton]}
                    onPress={saveEdit}
                  >
                    <Text style={styles.editButtonText}>💾 Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editButton, styles.cancelButton]}
                    onPress={cancelEdit}
                  >
                    <Text style={styles.editButtonText}>✖️ Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // View mode
              <View>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemText}>{item.text}</Text>
                  {item.syncedAt ? (
                    <Text style={styles.syncBadge}>✓ Synced</Text>
                  ) : (
                    <Text style={styles.unsyncBadge}>⊘ Unsynced</Text>
                  )}
                </View>

                <View style={styles.itemMeta}>
                  <Text style={styles.metaText}>
                    Category: {item.category}
                  </Text>
                  <Text style={styles.metaText}>
                    Updated: {item.updatedAt.toLocaleTimeString()}
                  </Text>
                  {item.syncedAt && (
                    <Text style={styles.metaText}>
                      Synced: {item.syncedAt.toLocaleTimeString()}
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.editItemButton}
                  onPress={() => startEdit(item)}
                  disabled={syncing || isOffline}
                >
                  <Text style={styles.editItemButtonText}>✏️ Edit Item</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Conflict Resolution Strategy */}
      <View style={styles.strategyCard}>
        <Text style={styles.strategyTitle}>Last-Write-Wins Strategy:</Text>
        <Text style={styles.strategyText}>
          1. Compare updated_at timestamps
        </Text>
        <Text style={styles.strategyText}>
          2. If remote.updated_at {'>'} local.updated_at:
        </Text>
        <Text style={styles.strategyIndent}>→ Remote wins (take server version)</Text>
        <Text style={styles.strategyText}>
          3. If local.updated_at {'>'} remote.updated_at:
        </Text>
        <Text style={styles.strategyIndent}>→ Local wins (keep local, push to server)</Text>
        <Text style={styles.strategyText}>
          4. If timestamps equal:
        </Text>
        <Text style={styles.strategyIndent}>→ Check for unsynced changes</Text>
        <Text style={styles.strategyIndent}>→ Prefer local if unsynced</Text>
        <Text style={styles.strategyIndent}>→ Otherwise take remote</Text>
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
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#E65100',
  },
  instructionsText: {
    fontSize: 14,
    color: '#EF6C00',
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
  infoButton: {
    backgroundColor: '#00BCD4',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  conflictsSection: {
    marginBottom: 16,
  },
  conflictsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#d32f2f',
  },
  conflictCard: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  conflictHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conflictResolution: {
    fontSize: 16,
    fontWeight: '600',
    color: '#c62828',
  },
  conflictTap: {
    fontSize: 12,
    color: '#999',
  },
  conflictReason: {
    fontSize: 14,
    color: '#d32f2f',
    marginBottom: 4,
  },
  conflictItem: {
    fontSize: 12,
    color: '#666',
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
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    marginRight: 8,
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
    marginBottom: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  editItemButton: {
    backgroundColor: '#E3F2FD',
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  editItemButtonText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '600',
  },
  editInput: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 4,
    fontSize: 16,
    marginBottom: 8,
    minHeight: 60,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flex: 1,
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#f44336',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  strategyCard: {
    backgroundColor: '#E8EAF6',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  strategyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#3F51B5',
  },
  strategyText: {
    fontSize: 13,
    color: '#5C6BC0',
    marginBottom: 3,
  },
  strategyIndent: {
    fontSize: 13,
    color: '#5C6BC0',
    marginLeft: 16,
    marginBottom: 3,
  },
});
