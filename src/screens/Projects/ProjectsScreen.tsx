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
  Modal,
} from 'react-native';
import {useProjectsWithSteps, ProjectWithSteps} from '@hooks/useProjectsWithSteps';
import {useItemActions} from '@hooks/useItems';
import {database} from '@services/database';
import ProjectStep from '@services/database/models/ProjectStep';
import Item from '@services/database/models/Item';
import {createCalendarEvent} from '@services/calendar/calendarService';

// ─── ProjectsScreen ────────────────────────────────────────────────────────

export default function ProjectsScreen() {
  const {items, isLoading} = useProjectsWithSteps();
  const {directAddToCategory, isLoading: isSaving} = useItemActions();
  const [inputText, setInputText] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [planText, setPlanText] = useState('');
  
  // Edit mode state
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editPlanText, setEditPlanText] = useState('');
  
  // Context menu state
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [selectedStep, setSelectedStep] = useState<{step: ProjectStep; project: ProjectWithSteps} | null>(null);

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

    await directAddToCategory(text, 'projects', {
      projectPlan: planText || null,
      steps: steps.length > 0 ? steps : undefined,
    });

    setInputText('');
    setPlanText('');
    setShowPlanDialog(false);
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
          } catch (error) {
            console.error('Error deleting project:', error);
            Alert.alert('Error', 'Failed to delete project');
          }
        },
      },
    ]);
  };

  // ─── Edit Plan Handlers ───────────────────────────────────────────────

  const handleStartEdit = (item: ProjectWithSteps) => {
    const stepsText = item.fetchedSteps
      ? item.fetchedSteps.map(s => s.stepText).join('\n')
      : '';
    setEditPlanText(stepsText);
    setEditingProject(item.id);
    if (!expandedProjects.has(item.id)) {
      toggleExpand(item.id);
    }
  };

  const handleSaveEdit = async (item: ProjectWithSteps) => {
    try {
      const newSteps = editPlanText
        .split('\n')
        .filter(s => s.trim())
        .map(s => s.trim());

      // Fetch old steps BEFORE the write transaction (JSI mode requires reads outside writes)
      const oldSteps = await item.steps.fetch();

      // Build a map of stepText -> isCompleted to preserve completion state
      const completionByText = new Map<string, boolean>();
      for (const step of oldSteps) {
        completionByText.set(step.stepText, step.isCompleted);
      }

      await database.write(async () => {
        const projectStepsCollection = database.get<ProjectStep>('project_steps');

        const deletions = oldSteps.map(step => step.prepareMarkAsDeleted());

        const creations = newSteps.map((stepText, i) =>
          projectStepsCollection.prepareCreate(step => {
            step._raw.project_id = item.id;
            step.stepText = stepText;
            step.stepOrder = i;
            step.isCompleted = completionByText.get(stepText) ?? false;
          }),
        );

        const update = item.prepareUpdate(project => {
          project.projectPlan = editPlanText || null;
        });

        await database.batch(...deletions, ...creations, update);
      });

      setEditingProject(null);
      setEditPlanText('');
    } catch (error) {
      console.error('Error updating steps:', error);
      Alert.alert('Error', `Failed to update steps: ${error}`);
    }
  };

  const handleCancelEdit = () => {
    setEditingProject(null);
    setEditPlanText('');
  };

  // ─── Context Menu Handlers ────────────────────────────────────────────

  const handleLongPress = (step: ProjectStep, project: ProjectWithSteps) => {
    setSelectedStep({step, project});
    setContextMenuVisible(true);
  };

  const handleAddToNextActions = async () => {
    if (!selectedStep) return;
    
    try {
      await database.write(async () => {
        const itemsCollection = database.get<Item>('items');
        await itemsCollection.create(item => {
          item.text = selectedStep.step.stepText;
          item.category = 'nextActions';
          item.status = 'active';
          item.nextAction = selectedStep.step.stepText;
        });
      });
      
      setContextMenuVisible(false);
      setSelectedStep(null);
      Alert.alert('Success', 'Added to Next Actions');
    } catch (error) {
      console.error('Error adding to next actions:', error);
      Alert.alert('Error', `Failed to add: ${error}`);
    }
  };

  const handleMarkComplete = async () => {
    if (!selectedStep) return;

    try {
      await database.write(async () => {
        await selectedStep.step.update(step => {
          step.isCompleted = !step.isCompleted;
        });
      });

      setContextMenuVisible(false);
      setSelectedStep(null);
    } catch (error) {
      console.error('Error marking complete:', error);
      Alert.alert('Error', `Failed to update: ${error}`);
    }
  };

  const handleAddToWaitingFor = () => {
    if (!selectedStep) return;
    setContextMenuVisible(false);
    Alert.prompt(
      'Waiting For',
      `Who are you waiting on for "${selectedStep.step.stepText}"?`,
      async (waitingFor: string) => {
        if (!waitingFor?.trim()) return;
        try {
          await database.write(async () => {
            const col = database.get<Item>('items');
            await col.create(item => {
              item.text = selectedStep.step.stepText;
              item.category = 'waiting';
              item.status = 'active';
              item.waitingFor = waitingFor.trim();
              item.hasCalendar = false;
            });
          });
          setSelectedStep(null);
        } catch (error) {
          console.error('Error adding to waiting for:', error);
          Alert.alert('Error', `Failed to add: ${error}`);
        }
      },
      'plain-text',
      '',
      'default',
    );
  };

  const handleStepAddToCalendar = async () => {
    if (!selectedStep) return;
    setContextMenuVisible(false);
    setSelectedStep(null);

    const eventId = await createCalendarEvent({
      title: selectedStep.step.stepText,
      notes: `Project step from: ${selectedStep.project.text}`,
    });
    if (eventId) {
      Alert.alert('Added to Calendar', `"${selectedStep.step.stepText}" has been added to your calendar.`);
    }
  };

  const handleCancelContextMenu = () => {
    setContextMenuVisible(false);
    setSelectedStep(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────

  const renderItem = ({item}: {item: ProjectWithSteps}) => {
    const isExpanded = expandedProjects.has(item.id);
    const hasSteps = item.fetchedSteps && item.fetchedSteps.length > 0;
    const isEditing = editingProject === item.id;

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

            {isExpanded && !isEditing && (
              <View style={styles.stepsContainer}>
                {item.fetchedSteps!.map((step, index) => (
                  <TouchableOpacity
                    key={step.id}
                    style={styles.stepItem}
                    onLongPress={() => handleLongPress(step, item)}
                    delayLongPress={500}>
                    <Text style={styles.stepNumber}>{index + 1}.</Text>
                    <Text
                      style={[
                        styles.stepText,
                        step.isCompleted && styles.stepTextCompleted,
                      ]}>
                      {step.stepText}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Edit Mode */}
            {isExpanded && isEditing && (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.editInput}
                  placeholder="Enter steps (one per line)"
                  placeholderTextColor="#999"
                  value={editPlanText}
                  onChangeText={setEditPlanText}
                  multiline
                  textAlignVertical="top"
                />
                <View style={styles.editButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancelEdit}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={() => handleSaveEdit(item)}>
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}

        {/* Action Buttons */}
        <View style={styles.cardActions}>
          {hasSteps && !isEditing && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleStartEdit(item)}>
              <Text style={styles.editButtonText}>✏️ Edit Plan</Text>
            </TouchableOpacity>
          )}
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
          Long-press a step to add to Next Actions or mark complete.
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
            extraData={items.map(i => i.fetchedSteps?.map(s => s.id).join(',') ?? '').join('|')}
          />
        )}
      </KeyboardAvoidingView>

      {/* Plan Dialog */}
      {showPlanDialog && (
        <View style={styles.dialogOverlay}>
          <TouchableOpacity
            style={styles.dialogBackdrop}
            activeOpacity={1}
            onPress={handleCancelDialog}
          />
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Add project plan</Text>
            <Text style={styles.dialogLabel}>Project: {inputText}</Text>
            <Text style={styles.dialogSubtitle}>
              Enter the steps (one per line):
            </Text>
            <TextInput
              style={styles.dialogInput}
              placeholder="1. Research options&#10;2. Get quotes&#10;3. Make decision"
              placeholderTextColor="#999"
              value={planText}
              onChangeText={setPlanText}
              multiline
              textAlignVertical="top"
              numberOfLines={6}
            />
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={styles.dialogButtonSecondary}
                onPress={handleCancelDialog}>
                <Text style={styles.dialogButtonSecondaryText}>Skip</Text>
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

      {/* Context Menu */}
      <Modal
        visible={contextMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelContextMenu}>
        <TouchableOpacity
          style={styles.contextMenuOverlay}
          activeOpacity={1}
          onPress={handleCancelContextMenu}>
          <View style={styles.contextMenu}>
            <Text style={styles.contextMenuTitle}>
              {selectedStep?.step.stepText}
            </Text>
            <View style={styles.contextMenuDivider} />
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={handleAddToNextActions}>
              <Text style={styles.contextMenuItemText}>
                ➜ Add to Next Actions
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={handleAddToWaitingFor}>
              <Text style={styles.contextMenuItemText}>
                ⏳ Add to Waiting For
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={handleStepAddToCalendar}>
              <Text style={styles.contextMenuItemText}>
                📅 Add to Calendar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={handleMarkComplete}>
              <Text style={styles.contextMenuItemText}>
                {selectedStep?.step.isCompleted ? '○ Mark Incomplete' : '✓ Mark Complete'}
              </Text>
            </TouchableOpacity>
            <View style={styles.contextMenuDivider} />
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={handleCancelContextMenu}>
              <Text style={[styles.contextMenuItemText, styles.contextMenuCancel]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  projectBadgeText: {
    fontSize: 11,
    color: '#1976d2',
    fontWeight: '500',
  },
  stepCountBadge: {
    backgroundColor: '#f3e5f5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e1bee7',
  },
  stepCountText: {
    fontSize: 11,
    color: '#7b1fa2',
    fontWeight: '500',
  },
  expandButton: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  expandButtonText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  stepsContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 8,
  },
  stepNumber: {
    width: 24,
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
  },
  stepTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  editContainer: {
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    color: '#000',
    minHeight: 120,
    marginBottom: 12,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#000',
    borderRadius: 6,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  editButtonText: {
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
    maxWidth: 300,
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
  contextMenuDivider: {
    height: 1,
    backgroundColor: '#e5e5e5',
  },
  contextMenuItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  contextMenuItemText: {
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
    fontWeight: '500',
  },
  contextMenuCancel: {
    color: '#999',
  },
});
