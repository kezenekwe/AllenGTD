import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import {useItemActions} from '@hooks/useItems';
import {database, itemsCollection} from '@services/database';
import Item from '@services/database/models/Item';
import {Q} from '@nozbe/watermelondb';

// ─── WaitingForScreen ──────────────────────────────────────────────────────

export default function WaitingForScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const {directAddToCategory, completeItem, isLoading: isSaving} = useItemActions();
  const [inputText, setInputText] = useState('');
  const [showPersonDialog, setShowPersonDialog] = useState(false);
  const [personText, setPersonText] = useState('');

  // ─── Custom Observable (includes both active and completed) ──────────────

  useEffect(() => {
    const subscription = itemsCollection
      .query(
        Q.where('category', 'waiting'),
        Q.sortBy('created_at', Q.desc),
      )
      .observe()
      .subscribe({
        next: updatedItems => {
          setItems(updatedItems);
          setIsLoading(false);
        },
        error: err => {
          console.error('Error observing waiting items:', err);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  // ─── Stats ────────────────────────────────────────────────────────────

  const activeCount = items.filter(i => i.status === 'active').length;
  const completedCount = items.filter(i => i.status === 'completed').length;

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleAdd = () => {
    const text = inputText.trim();
    if (!text) return;
    setShowPersonDialog(true);
  };

  const handleCreateWaiting = async () => {
    const text = inputText.trim();
    const person = personText.trim();
    if (!text || !person) return;

    await directAddToCategory(text, 'waiting', {
      waitingFor: person,
    });

    setInputText('');
    setPersonText('');
    setShowPersonDialog(false);
  };

  const handleCancelDialog = () => {
    setPersonText('');
    setShowPersonDialog(false);
  };

  const handleComplete = async (item: Item) => {
    await completeItem(item);
  };

  const handleDelete = (item: Item) => {
    Alert.alert('Delete item?', `"${item.text}"`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await database.write(async () => {
              await item.markAsDeleted();
            });
          } catch (error) {
            console.error('Error deleting item:', error);
            Alert.alert('Error', 'Failed to delete item');
          }
        },
      },
    ]);
  };

  const handleFollowUp = (item: Item) => {
    const now = new Date();
    const startDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000); // 30 min meeting

    const formatDate = (d: Date) => {
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const title = encodeURIComponent(`Follow up: ${item.text}`);
    const description = encodeURIComponent(
      `Follow up with ${item.waitingFor || 'team'} about: ${item.text}`,
    );
    const dates = `${formatDate(startDate)}/${formatDate(endDate)}`;

    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${description}&dates=${dates}`;

    Linking.openURL(calendarUrl).catch(err => {
      Alert.alert('Error', 'Could not open calendar');
      console.error('Calendar error:', err);
    });
  };

  // ─── Render ───────────────────────────────────────────────────────────

  const renderItem = ({item}: {item: Item}) => {
    const isCompleted = item.status === 'completed';

    return (
      <View style={[styles.card, isCompleted && styles.cardCompleted]}>
        <View style={styles.cardHeader}>
          <Text
            style={[
              styles.itemText,
              isCompleted && styles.itemTextCompleted,
            ]}>
            {item.text}
          </Text>
        </View>

        {/* Waiting For Badge */}
        {item.waitingFor && (
          <View style={styles.metaContainer}>
            <View style={styles.waitingBadge}>
              <Text style={styles.waitingBadgeText}>
                ⏳ Waiting for: {item.waitingFor}
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {!isCompleted && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.followUpButton}
              onPress={() => handleFollowUp(item)}>
              <Text style={styles.followUpButtonText}>📅 Follow-up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.completeButton}
              onPress={() => handleComplete(item)}>
              <Text style={styles.completeButtonText}>✓ Complete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDelete(item)}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Completed State */}
        {isCompleted && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedBadgeText}>✓ Completed</Text>
          </View>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>⏳</Text>
      <Text style={styles.emptyText}>Nothing waiting</Text>
      <Text style={styles.emptyHint}>
        Delegate tasks and track them here
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>Waiting For</Text>
              <Text style={styles.subtitle}>Delegated & tracking</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{activeCount}</Text>
            </View>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{activeCount}</Text>
            <Text style={styles.statLabel}>Waiting</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{completedCount}</Text>
            <Text style={styles.statLabel}>Received</Text>
          </View>
        </View>

        {/* Quick Add */}
        <View style={styles.quickAdd}>
          <TextInput
            style={styles.input}
            placeholder="What are you waiting for?"
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
            editable={!isSaving}
          />
          <TouchableOpacity
            style={[styles.addButton, isSaving && styles.addButtonDisabled]}
            onPress={handleAdd}
            disabled={isSaving || !inputText.trim()}>
            {isSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.addButtonText}>Add</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Items</Text>
        </View>
        <Text style={styles.sectionDescription}>
          Track delegated tasks and items you're waiting to receive. Set
          follow-up reminders to check in.
        </Text>

        {/* Item List */}
        {isLoading ? (
          <ActivityIndicator style={styles.loader} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={styles.list}
            extraData={items.map(i => i.status).join(',')} // Re-render on status changes
          />
        )}
      </KeyboardAvoidingView>

      {/* Person Dialog */}
      {showPersonDialog && (
        <View style={styles.dialogOverlay}>
          <TouchableOpacity
            style={styles.dialogBackdrop}
            activeOpacity={1}
            onPress={handleCancelDialog}
          />
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Who are you waiting for?</Text>
            <Text style={styles.dialogLabel}>Task: {inputText}</Text>
            <Text style={styles.dialogSubtitle}>
              Enter the person or team:
            </Text>
            <TextInput
              style={styles.dialogInput}
              placeholder="e.g., Sarah from marketing"
              placeholderTextColor="#999"
              value={personText}
              onChangeText={setPersonText}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateWaiting}
            />
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={styles.dialogButtonSecondary}
                onPress={handleCancelDialog}>
                <Text style={styles.dialogButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dialogButtonPrimary}
                onPress={handleCreateWaiting}>
                <Text style={styles.dialogButtonPrimaryText}>
                  Add to Waiting For
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {flex: 1},
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontStyle: 'italic',
    fontWeight: '400',
    color: '#000',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
    letterSpacing: 1,
  },
  countBadge: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  countText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickAdd: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    paddingBottom: 0,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#000',
    backgroundColor: '#fff',
  },
  addButton: {
    backgroundColor: '#000',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
    minWidth: 64,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  sectionDescription: {
    fontSize: 12,
    color: '#999',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    lineHeight: 18,
  },
  list: {
    padding: 12,
    gap: 8,
  },
  loader: {
    marginTop: 40,
  },
  card: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  cardCompleted: {
    backgroundColor: '#f9f9f9',
    opacity: 0.6,
  },
  cardHeader: {
    marginBottom: 8,
  },
  itemText: {
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
    fontWeight: '500',
  },
  itemTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  waitingBadge: {
    backgroundColor: '#fff3e0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ffe0b2',
  },
  waitingBadgeText: {
    fontSize: 11,
    color: '#f57c00',
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  followUpButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  followUpButtonText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '500',
  },
  completeButton: {
    backgroundColor: '#000',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  deleteButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  completedBadge: {
    backgroundColor: '#e8f5e9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  completedBadgeText: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 40,
    opacity: 0.3,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    marginBottom: 6,
  },
  emptyHint: {
    fontSize: 12,
    color: '#ccc',
  },
  dialogOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dialog: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  dialogTitle: {
    fontSize: 20,
    fontStyle: 'italic',
    fontWeight: '400',
    color: '#000',
    marginBottom: 8,
  },
  dialogLabel: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
    marginBottom: 12,
  },
  dialogSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  dialogInput: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#000',
    marginBottom: 20,
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  dialogButtonSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dialogButtonSecondaryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  dialogButtonPrimary: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dialogButtonPrimaryText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});
