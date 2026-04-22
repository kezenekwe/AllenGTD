// src/screens/CalendarServiceTestScreen.tsx
// Test screen for CalendarService - Task 5.2

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import CalendarService, {
  addToCalendar,
  getDefaultCalendar,
  Calendar,
} from '../services/calendar/CalendarService';

export default function CalendarServiceTestScreen() {
  const [title, setTitle] = useState('Test Event from Allen GTD');
  const [notes, setNotes] = useState('This is a test event created using the addToCalendar method');
  const [defaultCalendar, setDefaultCalendar] = useState<Calendar | null>(null);
  const [lastEventId, setLastEventId] = useState<string | null>(null);

  /**
   * Load default calendar on mount
   */
  useEffect(() => {
    loadDefaultCalendar();
  }, []);

  /**
   * Load default calendar
   */
  const loadDefaultCalendar = async () => {
    const calendar = await getDefaultCalendar();
    setDefaultCalendar(calendar);

    if (calendar) {
      console.log('Default calendar loaded:', calendar.title);
    }
  };

  /**
   * Test addToCalendar method (simple version)
   */
  const handleAddToCalendar = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an event title');
      return;
    }

    try {
      // Use default time (1 hour from now)
      const eventId = await addToCalendar(title, notes);

      setLastEventId(eventId ?? 'created');
      Alert.alert('Success!', 'Event added to your calendar.\n\nOpen the Calendar app to verify.', [{text: 'OK'}]);
      console.log('✅ Event created with ID:', eventId);
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  /**
   * Test addToCalendar with specific date
   */
  const handleAddToCalendarWithDate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an event title');
      return;
    }

    try {
      // Tomorrow at 2 PM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0);

      const eventId = await addToCalendar(title, notes, tomorrow);

      setLastEventId(eventId ?? 'created');
      Alert.alert('Success!', 'Event added to your calendar for tomorrow at 2 PM.', [{text: 'OK'}]);
      console.log('✅ Event created for tomorrow:', eventId);
    } catch (error) {
      console.error('Error creating event with date:', error);
    }
  };

  /**
   * Test createEvent method (advanced version)
   */
  const handleCreateEventAdvanced = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an event title');
      return;
    }

    try {
      // Create event with full options
      const startDate = new Date();
      startDate.setHours(startDate.getHours() + 2); // 2 hours from now

      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1); // 1 hour duration

      const eventId = await CalendarService.createEvent({
        title,
        notes,
        startDate,
        endDate,
        location: 'Conference Room A',
        alarms: [15, 30], // 15 and 30 minutes before
      });

      setLastEventId(eventId ?? 'created');
      Alert.alert('Success!', 'Advanced event added to your calendar.\n\nIncludes location and 2 alarms.', [{text: 'OK'}]);
    } catch (error) {
      console.error('Error creating advanced event:', error);
    }
  };

  /**
   * Request permissions manually
   */
  const handleRequestPermissions = async () => {
    const status = await CalendarService.requestPermissions();

    if (status === 'authorized') {
      Alert.alert('Success', 'Calendar access granted!');
      loadDefaultCalendar();
    } else if (status === 'denied') {
      Alert.alert(
        'Permission Denied',
        'Please enable calendar access in Settings',
      );
    } else {
      Alert.alert('Restricted', 'Calendar access is restricted');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Calendar Service Test</Text>
      <Text style={styles.subtitle}>Task 5.2</Text>

      {/* Default Calendar Info */}
      {defaultCalendar && (
        <View style={styles.calendarCard}>
          <Text style={styles.calendarTitle}>Default Calendar</Text>
          <View style={styles.calendarRow}>
            <View
              style={[
                styles.calendarColor,
                {backgroundColor: defaultCalendar.color || '#999'},
              ]}
            />
            <View style={styles.calendarInfo}>
              <Text style={styles.calendarName}>{defaultCalendar.title}</Text>
              <Text style={styles.calendarMeta}>
                Type: {defaultCalendar.type}
              </Text>
              <Text style={styles.calendarMeta}>
                Source: {defaultCalendar.source}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Instructions */}
      <View style={styles.instructionsCard}>
        <Text style={styles.instructionsTitle}>📅 How to Test:</Text>
        <Text style={styles.instructionsText}>
          1. Enter an event title and notes below
        </Text>
        <Text style={styles.instructionsText}>
          2. Tap one of the "Add to Calendar" buttons
        </Text>
        <Text style={styles.instructionsText}>
          3. Event will be created in your default calendar
        </Text>
        <Text style={styles.instructionsText}>
          4. Open iOS Calendar app to verify
        </Text>
        <Text style={styles.instructionsText}>
          5. Event should appear with title, notes, and alarm
        </Text>
      </View>

      {/* Input Fields */}
      <View style={styles.inputSection}>
        <Text style={styles.label}>Event Title:</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Enter event title"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Notes:</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Enter event notes"
          placeholderTextColor="#999"
          multiline
          numberOfLines={4}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleAddToCalendar}>
          <Text style={styles.buttonText}>
            📅 Add to Calendar{'\n'}(1 hour from now)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.successButton]}
          onPress={handleAddToCalendarWithDate}>
          <Text style={styles.buttonText}>
            📅 Add to Calendar{'\n'}(Tomorrow at 2 PM)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.advancedButton]}
          onPress={handleCreateEventAdvanced}>
          <Text style={styles.buttonText}>
            ⚙️ Create Advanced Event{'\n'}(with location & 2 alarms)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.permissionButton]}
          onPress={handleRequestPermissions}>
          <Text style={styles.buttonText}>🔒 Request Permissions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.refreshButton]}
          onPress={loadDefaultCalendar}>
          <Text style={styles.buttonText}>🔄 Reload Default Calendar</Text>
        </TouchableOpacity>
      </View>

      {/* Last Event ID */}
      {lastEventId && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>✅ Last Created Event</Text>
          <Text style={styles.resultId}>Event ID: {lastEventId}</Text>
          <Text style={styles.resultHint}>
            Open {Platform.OS === 'ios' ? 'iOS' : 'Android'} Calendar app to
            view
          </Text>
        </View>
      )}

      {/* API Reference */}
      <View style={styles.apiCard}>
        <Text style={styles.apiTitle}>📖 API Methods:</Text>
        <Text style={styles.apiMethod}>
          addToCalendar(title, notes?, date?)
        </Text>
        <Text style={styles.apiDescription}>
          Simple method for quick event creation
        </Text>

        <Text style={styles.apiMethod}>getDefaultCalendar()</Text>
        <Text style={styles.apiDescription}>
          Gets user's primary/default calendar
        </Text>

        <Text style={styles.apiMethod}>CalendarService.createEvent()</Text>
        <Text style={styles.apiDescription}>
          Advanced event creation with full options
        </Text>
      </View>

      {/* Expected Console Output */}
      <View style={styles.consoleCard}>
        <Text style={styles.consoleTitle}>📝 Expected Console Output:</Text>
        <Text style={styles.consoleText}>
          📅 Calendar permission status: authorized
        </Text>
        <Text style={styles.consoleText}>📅 Found 3 calendar(s)</Text>
        <Text style={styles.consoleText}>
          ✓ Using primary calendar: Calendar
        </Text>
        <Text style={styles.consoleText}>
          ✅ Created calendar event: event-id-123
        </Text>
        <Text style={styles.consoleText}>
          {'   '}Title: Test Event from Allen GTD
        </Text>
        <Text style={styles.consoleText}>
          {'   '}Calendar: Calendar
        </Text>
        <Text style={styles.consoleText}>
          {'   '}Start: 1/20/2025, 10:00:00 AM
        </Text>
      </View>

      <View style={{height: 32}} />
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
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  calendarCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarColor: {
    width: 8,
    height: 40,
    borderRadius: 4,
    marginRight: 12,
  },
  calendarInfo: {
    flex: 1,
  },
  calendarName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  calendarMeta: {
    fontSize: 12,
    color: '#999',
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
  inputSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
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
  successButton: {
    backgroundColor: '#4CAF50',
  },
  advancedButton: {
    backgroundColor: '#9C27B0',
  },
  permissionButton: {
    backgroundColor: '#FF9800',
  },
  refreshButton: {
    backgroundColor: '#00BCD4',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  resultCard: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 8,
  },
  resultId: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#388E3C',
    marginBottom: 4,
  },
  resultHint: {
    fontSize: 12,
    color: '#66BB6A',
  },
  apiCard: {
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  apiTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 12,
  },
  apiMethod: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '600',
    color: '#EF6C00',
    marginTop: 8,
  },
  apiDescription: {
    fontSize: 13,
    color: '#F57C00',
    marginBottom: 4,
    marginLeft: 8,
  },
  consoleCard: {
    backgroundColor: '#263238',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  consoleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 8,
  },
  consoleText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#B0BEC5',
    marginBottom: 2,
  },
});
