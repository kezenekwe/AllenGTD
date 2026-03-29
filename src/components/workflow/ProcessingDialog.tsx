import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  WORKFLOW_STEPS,
  WorkflowStateMachine,
  WorkflowStepConfig,
} from './workflowStateMachine';
import {WorkflowStep} from '@types/index';
import Item from '@services/database/models/Item';

// ─── Props ─────────────────────────────────────────────────────────────────

interface ProcessingDialogProps {
  visible: boolean;
  item: Item | null;
  onClose: () => void;
  onComplete: (
    action: string,
    payload?: {
      nextAction?: string;
      waitingFor?: string;
      projectPlan?: string;
      hasCalendar?: boolean;
    },
  ) => void;
}

// ─── ProcessingDialog ──────────────────────────────────────────────────────

export default function ProcessingDialog({
  visible,
  item,
  onClose,
  onComplete,
}: ProcessingDialogProps) {
  const [stateMachine] = useState(() => new WorkflowStateMachine());
  const [currentConfig, setCurrentConfig] = useState<WorkflowStepConfig>(
    stateMachine.getCurrentStep(),
  );
  const [inputValue, setInputValue] = useState('');

  // Reset when dialog opens with new item
  useEffect(() => {
    if (visible && item) {
      stateMachine.reset();
      setCurrentConfig(stateMachine.getCurrentStep());
      setInputValue('');
    }
  }, [visible, item, stateMachine]);

  // ─── Navigation ────────────────────────────────────────────────────────

  const goToStep = (step: WorkflowStep) => {
    stateMachine.goToStep(step);
    setCurrentConfig(stateMachine.getCurrentStep());
    setInputValue(''); // Clear input when changing steps
  };

  const handleBack = () => {
    const didGoBack = stateMachine.goBack();
    if (didGoBack) {
      setCurrentConfig(stateMachine.getCurrentStep());
      setInputValue('');
    }
  };

  const handleExit = () => {
    stateMachine.reset();
    setInputValue('');
    onClose();
  };

  // ─── Button Actions ────────────────────────────────────────────────────

  const handleButtonPress = (buttonIndex: number) => {
    const button = currentConfig.buttons[buttonIndex];

    // If button has input requirements, validate
    if (currentConfig.inputType && !inputValue.trim()) {
      // Could show error here — for now, just return
      return;
    }

    // Handle immediate actions (reference, someday, trash, complete)
    if (button.action) {
      handleAction(button.action);
      return;
    }

    // Handle step navigation
    if (button.nextStep) {
      goToStep(button.nextStep);
      return;
    }

    // Handle actions that need input (create-project, next-action, delegate)
    handleInputAction(buttonIndex);
  };

  const handleAction = (action: string) => {
    switch (action) {
      case 'reference':
        onComplete('moveToCategory', {category: 'reference'} as any);
        break;
      case 'someday':
        onComplete('moveToCategory', {category: 'someday'} as any);
        break;
      case 'trash':
        onComplete('delete');
        break;
      case 'complete':
        onComplete('complete');
        break;
    }
    handleExit();
  };

  const handleInputAction = (buttonIndex: number) => {
    const step = currentConfig.step;
    const value = inputValue.trim();

    if (!value) return;

    switch (step) {
      case 'create-project':
        // Parse steps (split by newline)
        const steps = value.split('\n').filter(s => s.trim());
        onComplete('moveToCategory', {
          category: 'projects',
          projectPlan: value,
          steps,
        } as any);
        break;

      case 'next-action':
        // Check if calendar button was pressed (index 1)
        const hasCalendar = buttonIndex === 1;
        onComplete('moveToCategory', {
          category: 'nextActions',
          nextAction: value,
          hasCalendar,
        } as any);
        break;

      case 'delegate':
        onComplete('moveToCategory', {
          category: 'waiting',
          waitingFor: value,
        } as any);
        break;
    }

    handleExit();
  };

  // ─── Render ────────────────────────────────────────────────────────────

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleExit}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleExit}
        />

        <View style={styles.dialog}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled">
            {/* Item being processed */}
            <View style={styles.itemPreview}>
              <Text style={styles.itemPreviewLabel}>Processing:</Text>
              <Text style={styles.itemPreviewText}>{item.text}</Text>
            </View>

            {/* Question */}
            <Text style={styles.title}>{currentConfig.title}</Text>
            <Text style={styles.question}>{currentConfig.question}</Text>

            {/* Input field (if needed) */}
            {currentConfig.inputType && (
              <View style={styles.inputContainer}>
                {currentConfig.inputType === 'textarea' ? (
                  <TextInput
                    style={[styles.input, styles.textarea]}
                    placeholder={currentConfig.inputPlaceholder}
                    placeholderTextColor="#999"
                    value={inputValue}
                    onChangeText={setInputValue}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                  />
                ) : (
                  <TextInput
                    style={styles.input}
                    placeholder={currentConfig.inputPlaceholder}
                    placeholderTextColor="#999"
                    value={inputValue}
                    onChangeText={setInputValue}
                    autoFocus
                  />
                )}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.buttons}>
              {currentConfig.buttons.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.button}
                  onPress={() => handleButtonPress(index)}>
                  <Text style={styles.buttonText}>
                    {button.emoji && `${button.emoji} `}
                    {button.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Navigation Buttons */}
            {(currentConfig.showBack || currentConfig.showExit) && (
              <View style={styles.navButtons}>
                {currentConfig.showBack && (
                  <TouchableOpacity
                    style={styles.navButton}
                    onPress={handleBack}>
                    <Text style={styles.navButtonText}>← Back</Text>
                  </TouchableOpacity>
                )}
                {currentConfig.showExit && (
                  <TouchableOpacity
                    style={styles.navButton}
                    onPress={handleExit}>
                    <Text style={styles.navButtonText}>Exit</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  dialog: {
    width: '90%',
    maxWidth: 440,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  scrollContent: {
    padding: 24,
  },
  itemPreview: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 6,
    marginBottom: 20,
  },
  itemPreviewLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
    fontWeight: '500',
  },
  itemPreviewText: {
    fontSize: 13,
    color: '#000',
    lineHeight: 18,
  },
  title: {
    fontSize: 20,
    fontStyle: 'italic',
    fontWeight: '400',
    color: '#000',
    marginBottom: 12,
  },
  question: {
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#fff',
  },
  textarea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  buttons: {
    gap: 10,
  },
  button: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 14,
  },
  buttonText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '400',
  },
  navButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  navButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 6,
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
});
