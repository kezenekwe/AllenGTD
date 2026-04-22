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
import {useItemActions} from '@hooks/useItems';
import {database} from '@services/database';
import Item from '@services/database/models/Item';
import {Q} from '@nozbe/watermelondb';
import {createCalendarEvent} from '@services/calendar/CalendarService';


// ─── WaitingForScreen ─────────────────────────────────────────────────────

export default function WaitingForScreen() {
  const {directAddToCategory, completeItem: complete, isLoading: isSaving} = useItemActions();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [showPersonDialog, setShowPersonDialog] = useState(false);
  const [personText, setPersonText] = useState('');
  

  // ─── Custom Observable for Active Items Only ─────────────────────────

  useEffect(() => {
    const subscription = database
      .get<Item>('items')
      .query(
        Q.where('category', 'waiting'),
        Q.where('status', 'active'),
        Q.sortBy('created_at', Q.desc),
      )
      .observe()
      .subscribe(fetchedItems => {
        setItems(fetchedItems);
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

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
    await complete(item);
  };

  const handleDelete = (item: Item) => {
    Alert.alert('Remove item?', `"${item.text}"`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await database.write(async () => {
              await item.markAsDeleted();
            });
          } catch (error) {
            console.error('Error deleting item:', error);
            Alert.alert('Error', 'Failed to remove item');
          }
        },
      },
    ]);
  };

  // ─── Long Press ───────────────────────────────────────────────────────

  const handleLongPress = (item: Item) => {
    Alert.alert(item.text, undefined, [
      {
        text: 'Schedule Follow Up (Add to Calendar)',
        onPress: () => addToCalendar(item),
      },
      {
        text: 'Add to Next Actions',
        onPress: () => addToNextActions(item),
      },
      {text: 'Cancel', style: 'cancel'},
    ]);
  };

  const addToCalendar = async (item: Item) => {
    const eventId = await createCalendarEvent({
      title: `Follow up: ${item.text}`,
      notes: `Check in with ${item.waitingFor || 'team'} about: ${item.text}`,
    });
    if (eventId) {
      await database.write(async () => {
        await item.update(i => {
          i.hasCalendar = true;
          (i as any).calendarEventId = eventId;
        });
      });
      Alert.alert('Added to Calendar', `Follow-up reminder set for "${item.text}"`);
    }
  };

  const addToNextActions = async (item: Item) => {
    try {
      await database.write(async () => {
        await database.get<Item>('items').create(newItem => {
          newItem.text = `Follow up: ${item.text}`;
          newItem.category = 'nextActions';
          newItem.status = 'active';
          newItem.nextAction = `Follow up with ${item.waitingFor || 'team'}`;
        });
      });
      Alert.alert('Added to Next Actions', `"Follow up: ${item.text}" added`);
    } catch (error) {
      console.log('Error adding to next actions:', error);
      Alert.alert('Error', 'Failed to add to Next Actions');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────

  const renderItem = ({item}: {item: Item}) => {
    return (
      <TouchableOpacity
        style={styles.card}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={500}
        activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <Text style={styles.itemText}>{item.text}</Text>
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

        {/* Calendar Indicator */}
        {item.hasCalendar && (
          <View style={styles.metaContainer}>
            <View style={[styles.metaTag, styles.calendarTag]}>
              <Text style={styles.calendarText}>📅 Follow-up scheduled</Text>
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
              <Text style={styles.countText}>{items.length}</Text>
            </View>
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
        <Text style={styles.tipText}>
          💡 Hold an item to add to calendar or Next Actions
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
  tipText: {
    fontSize: 12,
    color: '#888',
    paddingHorizontal: 16,
    paddingTop: 8,
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
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
    fontWeight: '500',
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
  metaTag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
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
  longPressHint: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
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
  contextMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextMenu: {
    width: '80%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  contextMenuTitle: {
    fontSize: 14,
    color: '#666',
    padding: 16,
    paddingBottom: 12,
    textAlign: 'center',
  },
  contextMenuSectionTitle: {
    fontSize: 12,
    color: '#999',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  contextMenuDivider: {
    height: 1,
    backgroundColor: '#e5e5e5',
  },
  contextMenuItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  contextMenuItemText: {
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
    fontWeight: '500',
  },
  contextMenuDestructive: {
    color: '#f44336',
  },
  contextMenuCancel: {
    color: '#999',
  },
});
