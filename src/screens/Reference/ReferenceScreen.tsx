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
  Linking,
} from 'react-native';
import {useItemsByCategory, useItemActions} from '@hooks/useItems';
import {useToast} from '@components/Toast';
import {database} from '@services/database';
import Item from '@services/database/models/Item';

// ─── URL Detection ─────────────────────────────────────────────────────────

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const URL_TEST_REGEX = /https?:\/\/[^\s]+/;

interface TextSegment {
  type: 'text' | 'url';
  content: string;
}

function parseTextWithUrls(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  text.replace(URL_REGEX, (match, url, offset) => {
    // Add text before URL
    if (offset > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, offset),
      });
    }

    // Add URL
    segments.push({
      type: 'url',
      content: url,
    });

    lastIndex = offset + match.length;
    return match;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments.length > 0 ? segments : [{type: 'text', content: text}];
}

// ─── ReferenceScreen ───────────────────────────────────────────────────────

export default function ReferenceScreen() {
  const {items, isLoading} = useItemsByCategory('reference');
  const {directAddToCategory, isLoading: isSaving} = useItemActions();
  const {showToast, ToastComponent} = useToast();
  const [inputText, setInputText] = useState('');

  // ─── Stats ────────────────────────────────────────────────────────────

  const totalCount = items.length;
  const urlCount = items.filter(item => URL_TEST_REGEX.test(item.text)).length;

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleAdd = async () => {
    const text = inputText.trim();
    if (!text) return;

    try {
      await directAddToCategory(text, 'reference');
      setInputText('');
      showToast('Added to reference', 'success');
    } catch {
      showToast('Failed to add reference', 'error');
    }
  };

  const handleOpenUrl = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this URL');
      }
    } catch (error) {
      console.error('Error opening URL:', error);
      Alert.alert('Error', 'Failed to open URL');
    }
  };

  const handleDelete = (item: Item) => {
    Alert.alert(
      'Delete reference?',
      `"${item.text}"`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await database.write(async () => {
                await item.markAsDeleted();
              });
              showToast('Reference deleted', 'success');
            } catch (error) {
              console.error('Error deleting item:', error);
              showToast('Failed to delete reference', 'error');
            }
          },
        },
      ],
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────

  const renderTextWithLinks = (text: string) => {
    const segments = parseTextWithUrls(text);

    return (
      <Text style={styles.itemText}>
        {segments.map((segment, index) => {
          if (segment.type === 'url') {
            return (
              <Text
                key={index}
                style={styles.link}
                onPress={() => handleOpenUrl(segment.content)}>
                {segment.content}
              </Text>
            );
          }
          return <Text key={index}>{segment.content}</Text>;
        })}
      </Text>
    );
  };

  const renderItem = ({item}: {item: Item}) => {
    const hasUrl = URL_REGEX.test(item.text);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {renderTextWithLinks(item.text)}
        </View>

        {/* URL Badge */}
        {hasUrl && (
          <View style={styles.metaContainer}>
            <View style={styles.urlBadge}>
              <Text style={styles.urlBadgeText}>🔗 Contains link</Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item)}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📚</Text>
      <Text style={styles.emptyText}>No reference materials</Text>
      <Text style={styles.emptyHint}>
        Save articles, links, and information you might need later
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
              <Text style={styles.title}>Reference</Text>
              <Text style={styles.subtitle}>Info to keep</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{totalCount}</Text>
            </View>
          </View>
        </View>

        {/* Quick Add */}
        <View style={styles.quickAdd}>
          <TextInput
            style={styles.input}
            placeholder="Save a note or link..."
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
          <Text style={styles.sectionTitle}>Saved References</Text>
        </View>
        <Text style={styles.sectionDescription}>
          Store information, articles, and links. Tap any URL to open it in your
          browser.
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
    minHeight: 44,
    maxHeight: 100,
  },
  addButton: {
    backgroundColor: '#000',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
    minWidth: 64,
    alignSelf: 'flex-start',
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
  cardHeader: {
    marginBottom: 10,
  },
  itemText: {
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
    fontWeight: '400',
  },
  link: {
    color: '#007AFF',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  urlBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  urlBadgeText: {
    fontSize: 11,
    color: '#1976d2',
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
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
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 18,
  },
});
