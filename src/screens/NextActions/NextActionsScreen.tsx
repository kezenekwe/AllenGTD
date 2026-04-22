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
} from 'react-native';
import {useItemsByCategory, useItemActions} from '@hooks/useItems';
import {useToast} from '@components/Toast';
import Item from '@services/database/models/Item';
import {itemRepository} from '@services/database/repositories/ItemRepository';
import {createCalendarEvent} from '@services/calendar/CalendarService';
import {database} from '@services/database';

// ─── NextActionsScreen ─────────────────────────────────────────────────────

export default function NextActionsScreen() {
  const {items, isLoading} = useItemsByCategory('nextActions');
  const {deleteItem, completeItem, directAddToCategory, isLoading: isSaving} =
    useItemActions();
  const {showToast, ToastComponent} = useToast();
  const [inputText, setInputText] = useState('');
  const [completedCount, setCompletedCount] = useState(0);

  // Load completed count on mount and when items change
  useEffect(() => {
    loadCompletedCount();
  }, [items]); // Reload count when items change

  const loadCompletedCount = async () => {
    const count = await itemRepository.countCompleted();
    setCompletedCount(count);
  };

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleAdd = async () => {
    const text = inputText.trim();
    if (!text) return;

    try {
      await directAddToCategory(text, 'nextActions', {nextAction: text});
      setInputText('');
      showToast('Action added', 'success');
    } catch {
      showToast('Failed to add action', 'error');
    }
  };

  const handleComplete = async (item: Item) => {
    try {
      await completeItem(item);
      showToast('Action completed', 'success');
    } catch {
      showToast('Failed to complete action', 'error');
    }
  };

  const handleDelete = (item: Item) => {
    Alert.alert('Delete action?', `"${item.text}"`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem(item);
            showToast('Action deleted', 'success');
          } catch {
            showToast('Failed to delete action', 'error');
          }
        },
      },
    ]);
  };

  const handleLongPress = (item: Item) => {
    if (item.hasCalendar) {
      Alert.alert('Already on calendar', `"${item.text}" is already scheduled.`);
      return;
    }
    Alert.alert(
      'Add to Calendar',
      `Schedule "${item.text}"?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Add to Calendar',
          onPress: () => addToCalendar(item),
        },
      ],
    );
  };

  const addToCalendar = async (item: Item) => {
    const eventId = await createCalendarEvent({
      title: item.text,
      notes: item.nextAction || undefined,
    });
    if (eventId) {
      await database.write(async () => {
        await item.update(i => {
          i.hasCalendar = true;
          (i as any).calendarEventId = eventId;
        });
      });
      showToast('Added to calendar', 'success');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────

  const renderItem = ({item}: {item: Item}) => (
    <TouchableOpacity
      style={styles.card}
      onLongPress={() => handleLongPress(item)}
      activeOpacity={0.85}
      delayLongPress={400}>
      <View style={styles.cardHeader}>
        <Text style={styles.itemText}>{item.text}</Text>
      </View>

      {/* Next Action Details */}
      {item.nextAction && (
        <View style={styles.metaContainer}>
          <View style={styles.metaTag}>
            <Text style={styles.metaText}>Next: {item.nextAction}</Text>
          </View>
        </View>
      )}

      {/* Calendar Indicator */}
      {item.hasCalendar && (
        <View style={styles.metaContainer}>
          <View style={[styles.metaTag, styles.calendarTag]}>
            <Text style={styles.calendarText}>📅 On calendar</Text>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.cardActions}>
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
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>⚡</Text>
      <Text style={styles.emptyText}>No next actions yet</Text>
      <Text style={styles.emptyHint}>
        Process inbox items to add actions here
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
          <Text style={styles.title}>Next Actions</Text>
          <Text style={styles.subtitle}>Things you can do now</Text>
        </View>

        {/* Quick Add */}
        <View style={styles.quickAdd}>
          <TextInput
            style={styles.input}
            placeholder="Add a next action..."
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
            disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.addButtonText}>Add</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Current Actions</Text>
        </View>
        <Text style={styles.sectionDescription}>
          Single tasks that can be done now. Review regularly and take action
          on items as you have time and energy.
        </Text>
        <Text style={styles.tipText}>💡 Hold an item to add it to your calendar</Text>

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
          />
        )}
      </KeyboardAvoidingView>

      {/* Toast */}
      <ToastComponent />
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
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontStyle: 'italic',
    fontWeight: '400',
    color: '#000',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
    letterSpacing: 1,
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
    paddingBottom: 4,
    lineHeight: 18,
  },
  tipText: {
    fontSize: 12,
    color: '#888',
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontStyle: 'italic',
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
  cardHeader: {
    marginBottom: 8,
  },
  itemText: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
    fontWeight: '400',
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  metaTag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  calendarTag: {
    backgroundColor: '#f0f0f0',
  },
  calendarText: {
    fontSize: 11,
    color: '#000',
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  completeButton: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
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
});
