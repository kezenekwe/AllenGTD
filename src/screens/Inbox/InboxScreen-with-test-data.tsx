import React, {useState} from 'react';
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
import {useInboxItems, useItemActions} from '@hooks/useItems';
import Item from '@services/database/models/Item';
import {database, itemsCollection} from '@services/database';

// ─── Dummy Data ────────────────────────────────────────────────────────────

const DUMMY_ITEMS = [
  'Buy groceries for the week',
  'Call dentist to schedule appointment',
  'Review Q1 budget report',
  'Plan weekend trip to Portland',
  'Research new project management tools',
  'Send birthday card to Mom',
  'Fix leaky faucet in bathroom',
  'Book flight for conference in May',
  'Read "Getting Things Done" book',
  'Update resume and LinkedIn profile',
];

// ─── InboxScreen ───────────────────────────────────────────────────────────

export default function InboxScreen() {
  const {items, isLoading} = useInboxItems();
  const {addToInbox, deleteItem, isLoading: isSaving} = useItemActions();
  const [inputText, setInputText] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleAdd = async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    await addToInbox(text);
  };

  const handleDelete = (item: Item) => {
    Alert.alert('Delete item?', `"${item.text}"`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteItem(item),
      },
    ]);
  };

  const loadDummyData = async () => {
    setIsSeeding(true);
    try {
      await database.write(async () => {
        for (const text of DUMMY_ITEMS) {
          await itemsCollection.create(item => {
            item.text = text;
            item.category = 'inbox';
            item.status = 'active';
            item.hasCalendar = false;
          });
        }
      });
      Alert.alert('Success', `Added ${DUMMY_ITEMS.length} dummy items to test the UI!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to load dummy data');
      console.error(error);
    } finally {
      setIsSeeding(false);
    }
  };

  const clearAllItems = () => {
    Alert.alert(
      'Clear All Items?',
      `This will delete all ${items.length} items from the inbox.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await database.write(async () => {
                for (const item of items) {
                  await item.markAsDeleted();
                }
              });
            } catch (error) {
              console.error('Error clearing items:', error);
            }
          },
        },
      ],
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────

  const renderItem = ({item}: {item: Item}) => (
    <View style={styles.card}>
      <Text style={styles.itemText}>{item.text}</Text>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.processButton}
          onPress={() => {
            Alert.alert('Coming in Task 1.7', 'GTD Workflow dialog goes here');
          }}>
          <Text style={styles.processButtonText}>Process</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.trashButton}
          onPress={() => handleDelete(item)}>
          <Text style={styles.trashIcon}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.emptyText}>Your inbox is empty</Text>
      
      {/* Test button for Task 1.4 */}
      <TouchableOpacity
        style={styles.dummyButton}
        onPress={loadDummyData}
        disabled={isSeeding}>
        <Text style={styles.dummyButtonText}>
          {isSeeding ? 'Loading...' : '🧪 Load Dummy Data (Test)'}
        </Text>
      </TouchableOpacity>
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
              <Text style={styles.title}>Allen</Text>
              <Text style={styles.subtitle}>Getting Things Done</Text>
            </View>
            
            {/* Clear all button (only show if items exist) */}
            {items.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearAllItems}>
                <Text style={styles.clearButtonText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Quick Add */}
        <View style={styles.quickAdd}>
          <TextInput
            style={styles.input}
            placeholder="What's on your mind?"
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

        {/* List header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Inbox</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{items.length}</Text>
          </View>
        </View>
        <Text style={styles.sectionDescription}>
          Capture everything that comes to mind. Process each item to determine
          what it is and where it belongs.
        </Text>

        {/* Item list */}
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
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  clearButtonText: {
    fontSize: 12,
    color: '#ff4444',
    fontWeight: '500',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  countBadge: {
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
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
  itemText: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
    marginBottom: 10,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  processButton: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  processButtonText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  trashButton: {
    padding: 4,
    marginLeft: 'auto',
    opacity: 0.4,
  },
  trashIcon: {
    fontSize: 16,
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
    marginBottom: 20,
  },
  dummyButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 10,
  },
  dummyButtonText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
});
