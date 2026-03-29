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
import {useProjectsWithSteps, ProjectWithSteps} from '@hooks/useProjectsWithSteps';
import {useItemActions} from '@hooks/useItems';
import {useToast} from '@components/Toast';
import {database} from '@services/database';

// ─── ProjectsScreen ────────────────────────────────────────────────────────

export default function ProjectsScreen() {
  const {items, isLoading} = useProjectsWithSteps();
  const {directAddToCategory, isLoading: isSaving} = useItemActions();
  const {showToast, ToastComponent} = useToast();
  const [inputText, setInputText] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(),
  );
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [planText, setPlanText] = useState('');

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleAdd = () => {
    const text = inputText.trim();
    if (!text) return;
    setShowPlanDialog(true);
  };

  const handleCreateProject = async () => {
    const text = inputText.trim();
    if (!text) return;

    const steps = planText
      .split('\n')
      .filter(s => s.trim())
      .map(s => s.trim());

    try {
      await directAddToCategory(text, 'projects', {
        projectPlan: planText || null,
        steps: steps.length > 0 ? steps : undefined,
      });
      setInputText('');
      setPlanText('');
      setShowPlanDialog(false);
      showToast('Project created', 'success');
    } catch {
      showToast('Failed to create project', 'error');
    }
  };

  const handleCancelDialog = () => {
    setPlanText('');
    setShowPlanDialog(false);
  };

  const toggleExpand = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleDelete = (item: ProjectWithSteps) => {
    Alert.alert('Delete project?', `"${item.text}"`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await database.write(async () => {
              const steps = await item.steps.fetch();
              await Promise.all(steps.map(step => step.markAsDeleted()));
              await item.markAsDeleted();
            });
            showToast('Project deleted', 'success');
          } catch (error) {
            console.error('Error deleting project:', error);
            showToast('Failed to delete project', 'error');
          }
        },
      },
    ]);
  };

  const handleAddToCalendar = (item: ProjectWithSteps) => {
    const now = new Date();
    const startDate = new Date(now.getTime() + 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const formatDate = (d: Date) => {
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const title = encodeURIComponent(item.text);
    const description = encodeURIComponent(
      item.projectPlan || 'Project from Allen GTD',
    );
    const dates = `${formatDate(startDate)}/${formatDate(endDate)}`;

    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${description}&dates=${dates}`;

    Linking.openURL(calendarUrl).catch(err => {
      Alert.alert('Error', 'Could not open calendar');
      console.error('Calendar error:', err);
    });
  };

  // ─── Render ───────────────────────────────────────────────────────────

  const renderItem = ({item}: {item: ProjectWithSteps}) => {
    const isExpanded = expandedProjects.has(item.id);
    const hasSteps = item.fetchedSteps && item.fetchedSteps.length > 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.itemText}>{item.text}</Text>
        </View>

        {/* Project Badge */}
        <View style={styles.metaContainer}>
          <View style={styles.projectBadge}>
            <Text style={styles.projectBadgeText}>📋 Project</Text>
          </View>
          {hasSteps && (
            <View style={styles.stepCountBadge}>
              <Text style={styles.stepCountText}>
                {item.fetchedSteps!.length} steps
              </Text>
            </View>
          )}
        </View>

        {/* Project Steps (Expandable) */}
        {hasSteps && (
          <>
            <TouchableOpacity
              style={styles.expandButton}
              onPress={() => toggleExpand(item.id)}>
              <Text style={styles.expandButtonText}>
                {isExpanded ? '▼ Hide plan' : '▶ Show plan'}
              </Text>
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.stepsContainer}>
                {item.fetchedSteps!.map((step, index) => (
                  <View key={`${item.id}-step-${index}`} style={styles.stepItem}>
                    <Text style={styles.stepNumber}>{index + 1}.</Text>
                    <Text style={styles.stepText}>{step.stepText}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Action Buttons */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.calendarButton}
            onPress={() => handleAddToCalendar(item)}>
            <Text style={styles.calendarButtonText}>📅 Add to Calendar</Text>
          </TouchableOpacity>
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
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyText}>No projects yet</Text>
      <Text style={styles.emptyHint}>
        Process multi-step items from inbox
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
              <Text style={styles.title}>Projects</Text>
              <Text style={styles.subtitle}>Multi-step outcomes</Text>
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
            placeholder="Project name..."
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
          <Text style={styles.sectionTitle}>Active Projects</Text>
        </View>
        <Text style={styles.sectionDescription}>
          Multi-step outcomes requiring more than one action. Review weekly to
          identify the next action for each project.
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
            extraData={expandedProjects} // Re-render when expand state changes
          />
        )}
      </KeyboardAvoidingView>

      {/* Toast */}
      <ToastComponent />

      {/* Plan Dialog */}
      {showPlanDialog && (
        <View style={styles.dialogOverlay}>
          <TouchableOpacity
            style={styles.dialogBackdrop}
            activeOpacity={1}
            onPress={handleCancelDialog}
          />
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Add Project Plan</Text>
            <Text style={styles.dialogLabel}>Project: {inputText}</Text>
            <Text style={styles.dialogSubtitle}>
              Describe the steps (one per line):
            </Text>
            <TextInput
              style={styles.dialogInput}
              placeholder={'Step 1\nStep 2\nStep 3...'}
              placeholderTextColor="#999"
              value={planText}
              onChangeText={setPlanText}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={styles.dialogButtonSecondary}
                onPress={handleCancelDialog}>
                <Text style={styles.dialogButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dialogButtonPrimary}
                onPress={handleCreateProject}>
                <Text style={styles.dialogButtonPrimaryText}>
                  Create Project
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
  projectBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  projectBadgeText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  stepCountBadge: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  stepCountText: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
  },
  expandButton: {
    paddingVertical: 6,
    marginBottom: 8,
  },
  expandButtonText: {
    fontSize: 12,
    color: '#666',
    textDecorationLine: 'underline',
  },
  stepsContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  stepItem: {
    flexDirection: 'row',
    gap: 8,
  },
  stepNumber: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
    minWidth: 20,
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  calendarButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  calendarButtonText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '500',
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
    minHeight: 120,
    marginBottom: 20,
    textAlignVertical: 'top',
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
