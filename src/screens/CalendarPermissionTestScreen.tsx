// src/screens/CalendarPermissionTestScreen.tsx
// Test screen for calendar permissions and basic operations

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useCalendarPermission } from '../hooks/useCalendarPermission';
import { calendarService, Calendar } from '../services/calendarService';

export default function CalendarPermissionTestScreen() {
  const {
    status,
    isAuthorized,
    isLoading,
    requestPermission,
    checkPermission,
    canRequest,
    needsSettings,
    message,
  } = useCalendarPermission();

  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);

  /**
   * Load calendars when authorized
   */
  useEffect(() => {
    if (isAuthorized) {
      loadCalendars();
    }
  }, [isAuthorized]);

  /**
   * Load available calendars
   */
  const loadCalendars = async () => {
    setLoadingCalendars(true);

    try {
      const cals = await calendarService.getCalendars();
      setCalendars(cals);
    } catch (error) {
      console.error('Failed to load calendars:', error);
    } finally {
      setLoadingCalendars(false);
    }
  };

  /**
   * Request calendar permission
   */
  const handleRequestPermission = async () => {
    const result = await requestPermission();

    if (result === 'authorized') {
      Alert.alert('Success', 'Calendar access granted!');
    } else if (result === 'denied') {
      Alert.alert(
        'Permission Denied',
        'Calendar access was denied. You can enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    } else if (result === 'restricted') {
      Alert.alert(
        'Restricted',
        'Calendar access is restricted by system settings.'
      );
    }
  };

  /**
   * Create test event
   */
  const handleCreateTestEvent = async () => {
    if (!isAuthorized) {
      Alert.alert('Permission Required', 'Please grant calendar access first.');
      return;
    }

    try {
      const now = new Date();
      const startDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration

      const eventId = await calendarService.createEvent(
        'Test Event from Allen GTD',
        startDate,
        endDate,
        {
          location: 'Test Location',
          notes: 'This is a test event created by Allen GTD app',
          alarms: [{ date: -15 }], // 15 minutes before
        }
      );

      if (eventId) {
        Alert.alert(
          'Success',
          `Test event created!\n\nEvent ID: ${eventId}\n\nCheck your calendar app.`
        );
      } else {
        Alert.alert('Failed', 'Could not create event');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create test event');
      console.error(error);
    }
  };

  /**
   * Get status color
   */
  const getStatusColor = (): string => {
    switch (status) {
      case 'authorized':
        return '#4CAF50';
      case 'denied':
        return '#f44336';
      case 'restricted':
        return '#FF9800';
      default:
        return '#757575';
    }
  };

  /**
   * Get status icon
   */
  const getStatusIcon = (): string => {
    switch (status) {
      case 'authorized':
        return '✅';
      case 'denied':
        return '❌';
      case 'restricted':
        return '⚠️';
      default:
        return '❓';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Calendar Permission Test</Text>

      {/* Permission Status */}
      <View
        style={[
          styles.statusCard,
          { borderLeftColor: getStatusColor() },
        ]}
      >
        <View style={styles.statusHeader}>
          <Text style={styles.statusIcon}>{getStatusIcon()}</Text>
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>Permission Status</Text>
            <Text style={styles.statusText}>{status.toUpperCase()}</Text>
            <Text style={styles.statusMessage}>{message}</Text>
          </View>
        </View>

        {isLoading && (
          <ActivityIndicator size="small" color={getStatusColor()} />
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructionsCard}>
        <Text style={styles.instructionsTitle}>📱 How to Test:</Text>
        <Text style={styles.instructionsText}>
          1. Tap "Request Calendar Permission"
        </Text>
        <Text style={styles.instructionsText}>
          2. See system permission dialog
        </Text>
        <Text style={styles.instructionsText}>
          3. Grant permission (tap "Allow" or "OK")
        </Text>
        <Text style={styles.instructionsText}>
          4. See status change to "AUTHORIZED"
        </Text>
        <Text style={styles.instructionsText}>
          5. Create test event to verify
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {canRequest && (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleRequestPermission}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              📅 Request Calendar Permission
            </Text>
          </TouchableOpacity>
        )}

        {needsSettings && (
          <TouchableOpacity
            style={[styles.button, styles.warningButton]}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.buttonText}>⚙️ Open Settings</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.infoButton]}
          onPress={checkPermission}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>🔄 Check Permission</Text>
        </TouchableOpacity>

        {isAuthorized && (
          <>
            <TouchableOpacity
              style={[styles.button, styles.successButton]}
              onPress={loadCalendars}
              disabled={loadingCalendars}
            >
              <Text style={styles.buttonText}>
                {loadingCalendars ? '⏳ Loading...' : '📋 Load Calendars'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.createButton]}
              onPress={handleCreateTestEvent}
            >
              <Text style={styles.buttonText}>
                ➕ Create Test Event
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Calendars List */}
      {isAuthorized && calendars.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Available Calendars ({calendars.length})
          </Text>

          {calendars.map(calendar => (
            <View key={calendar.id} style={styles.calendarCard}>
              <View
                style={[
                  styles.calendarColor,
                  { backgroundColor: calendar.color || '#999' },
                ]}
              />
              <View style={styles.calendarInfo}>
                <Text style={styles.calendarTitle}>
                  {calendar.title}
                  {calendar.isPrimary && (
                    <Text style={styles.primaryBadge}> (Primary)</Text>
                  )}
                </Text>
                <Text style={styles.calendarMeta}>Type: {calendar.type}</Text>
                <Text style={styles.calendarMeta}>Source: {calendar.source}</Text>
                <Text style={styles.calendarMeta}>
                  Editable: {calendar.allowsModifications ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Permission States Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>ℹ️ Permission States:</Text>
        <Text style={styles.infoText}>
          <Text style={styles.infoLabel}>Authorized:</Text> Full calendar access
        </Text>
        <Text style={styles.infoText}>
          <Text style={styles.infoLabel}>Denied:</Text> User denied permission
        </Text>
        <Text style={styles.infoText}>
          <Text style={styles.infoLabel}>Restricted:</Text> System restriction
        </Text>
        <Text style={styles.infoText}>
          <Text style={styles.infoLabel}>Undetermined:</Text> Not yet requested
        </Text>
      </View>

      {/* Platform Info */}
      <View style={styles.platformCard}>
        <Text style={styles.platformTitle}>📱 Platform Notes:</Text>
        <Text style={styles.platformText}>
          <Text style={styles.platformLabel}>iOS:</Text> Shows system dialog
          with "Allow" / "Don't Allow"
        </Text>
        <Text style={styles.platformText}>
          <Text style={styles.platformLabel}>Android:</Text> Shows permission
          dialog with "Allow" / "Deny"
        </Text>
        <Text style={styles.platformText}>
          <Text style={styles.platformLabel}>Settings:</Text> If denied, must
          enable in device Settings
        </Text>
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
  statusCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statusMessage: {
    fontSize: 14,
    color: '#666',
  },
  instructionsCard: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1976D2',
  },
  instructionsText: {
    fontSize: 14,
    color: '#1565C0',
    marginBottom: 4,
  },
  actions: {
    marginBottom: 16,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#2196F3',
  },
  warningButton: {
    backgroundColor: '#FF9800',
  },
  infoButton: {
    backgroundColor: '#00BCD4',
  },
  successButton: {
    backgroundColor: '#4CAF50',
  },
  createButton: {
    backgroundColor: '#9C27B0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
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
  calendarCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarColor: {
    width: 8,
    height: '100%',
    borderRadius: 4,
    marginRight: 12,
  },
  calendarInfo: {
    flex: 1,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  primaryBadge: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  calendarMeta: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  infoCard: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#2E7D32',
  },
  infoText: {
    fontSize: 14,
    color: '#388E3C',
    marginBottom: 4,
  },
  infoLabel: {
    fontWeight: '600',
  },
  platformCard: {
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  platformTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#E65100',
  },
  platformText: {
    fontSize: 14,
    color: '#EF6C00',
    marginBottom: 4,
  },
  platformLabel: {
    fontWeight: '600',
  },
});
