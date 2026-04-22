// src/components/SyncErrorAlert.tsx
// Alert component for displaying sync errors with retry options

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { syncErrorHandler, SyncError } from '../services/syncErrorHandler';

export default function SyncErrorAlert() {
  const [errors, setErrors] = useState<SyncError[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  /**
   * Load errors
   */
  const loadErrors = () => {
    const unresolvedErrors = syncErrorHandler.getUnresolvedErrors();
    setErrors(unresolvedErrors);

    // Show modal if there are critical errors
    const hasCriticalErrors = unresolvedErrors.some(
      e => e.severity === 'critical'
    );
    if (hasCriticalErrors && !showModal) {
      setShowModal(true);
    }
  };

  useEffect(() => {
    loadErrors();

    // Refresh errors every 5 seconds
    const interval = setInterval(loadErrors, 5000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Retry an error
   */
  const handleRetry = async (error: SyncError) => {
    setRetrying(error.id);

    try {
      await syncErrorHandler.manualRetry(error.id);
      loadErrors();
    } catch (err) {
      console.error('Manual retry failed:', err);
    } finally {
      setRetrying(null);
    }
  };

  /**
   * Clear resolved errors
   */
  const handleClearResolved = async () => {
    await syncErrorHandler.clearResolvedErrors();
    loadErrors();
  };

  /**
   * Get most severe error to display as banner
   */
  const getMostSevereError = (): SyncError | null => {
    if (errors.length === 0) return null;

    // Priority: critical > high > medium > low
    const critical = errors.find(e => e.severity === 'critical');
    if (critical) return critical;

    const high = errors.find(e => e.severity === 'high');
    if (high) return high;

    const medium = errors.find(e => e.severity === 'medium');
    if (medium) return medium;

    return errors[0];
  };

  /**
   * Get error color
   */
  const getErrorColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return '#d32f2f';
      case 'high':
        return '#f44336';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#FFC107';
      default:
        return '#757575';
    }
  };

  const mostSevereError = getMostSevereError();

  if (!mostSevereError) {
    return null;
  }

  const userFriendlyError = syncErrorHandler.getUserFriendlyError(
    mostSevereError
  );

  return (
    <>
      {/* Error Banner */}
      <TouchableOpacity
        style={[
          styles.banner,
          { backgroundColor: getErrorColor(mostSevereError.severity) },
        ]}
        onPress={() => setShowModal(true)}
      >
        <Text style={styles.bannerIcon}>⚠️</Text>
        <View style={styles.bannerContent}>
          <Text style={styles.bannerTitle}>{userFriendlyError.title}</Text>
          <Text style={styles.bannerMessage} numberOfLines={1}>
            {userFriendlyError.message}
          </Text>
        </View>
        <Text style={styles.bannerAction}>Details →</Text>
      </TouchableOpacity>

      {/* Error Details Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sync Issues</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.errorList}>
              {errors.map(error => {
                const friendlyError = syncErrorHandler.getUserFriendlyError(error);
                const isRetrying = retrying === error.id;

                return (
                  <View
                    key={error.id}
                    style={[
                      styles.errorCard,
                      { borderLeftColor: getErrorColor(error.severity) },
                    ]}
                  >
                    <View style={styles.errorHeader}>
                      <Text style={styles.errorTitle}>
                        {friendlyError.title}
                      </Text>
                      <View
                        style={[
                          styles.severityBadge,
                          { backgroundColor: getErrorColor(error.severity) },
                        ]}
                      >
                        <Text style={styles.severityText}>
                          {error.severity.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.errorMessage}>
                      {friendlyError.message}
                    </Text>

                    <View style={styles.errorMeta}>
                      <Text style={styles.metaText}>
                        {error.timestamp.toLocaleString()}
                      </Text>
                      {error.retryCount > 0 && (
                        <Text style={styles.metaText}>
                          Retries: {error.retryCount}
                        </Text>
                      )}
                      {error.nextRetryAt && (
                        <Text style={styles.metaText}>
                          Next retry: {error.nextRetryAt.toLocaleTimeString()}
                        </Text>
                      )}
                    </View>

                    {friendlyError.action && (
                      <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => handleRetry(error)}
                        disabled={isRetrying}
                      >
                        {isRetrying ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.retryButtonText}>
                            {friendlyError.action}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearResolved}
              >
                <Text style={styles.clearButtonText}>Clear Resolved</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.doneButton}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingTop: 44,
  },
  bannerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  bannerMessage: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
  },
  bannerAction: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    fontSize: 24,
    color: '#999',
  },
  errorList: {
    padding: 16,
  },
  errorCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  severityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  errorMeta: {
    marginBottom: 12,
  },
  metaText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  clearButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  doneButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
