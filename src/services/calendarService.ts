// src/services/calendarService.ts
// Calendar service with permission handling and event management

import RNCalendarEvents from 'react-native-calendar-events';
import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Constants ────────────────────────────────────────────────────────────

const CALENDAR_PERMISSION_KEY = 'calendarPermissionStatus';

// ─── Types ────────────────────────────────────────────────────────────────

export type CalendarPermissionStatus = 
  | 'authorized' 
  | 'denied' 
  | 'restricted' 
  | 'undetermined';

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  location?: string;
  notes?: string;
  alarms?: CalendarAlarm[];
  calendar?: string;
}

export interface CalendarAlarm {
  date?: number; // Date timestamp
  structuredLocation?: {
    title: string;
    proximity?: 'enter' | 'leave';
    radius?: number;
    coords?: {
      latitude: number;
      longitude: number;
    };
  };
}

export interface Calendar {
  id: string;
  title: string;
  type: string;
  source: string;
  isPrimary: boolean;
  allowsModifications: boolean;
  color: string;
}

// ─── Calendar Service ─────────────────────────────────────────────────────

class CalendarService {
  private permissionStatus: CalendarPermissionStatus = 'undetermined';

  /**
   * Initialize calendar service
   */
  async initialize(): Promise<void> {
    console.log('📅 Initializing calendar service...');

    // Load previous permission status
    const savedStatus = await AsyncStorage.getItem(CALENDAR_PERMISSION_KEY);
    if (savedStatus) {
      this.permissionStatus = savedStatus as CalendarPermissionStatus;
    }

    console.log('✓ Calendar service initialized');
    console.log(`  Permission status: ${this.permissionStatus}`);
  }

  /**
   * Check current calendar permission status
   */
  async checkPermission(): Promise<CalendarPermissionStatus> {
    try {
      const status = await RNCalendarEvents.checkPermissions();
      
      this.permissionStatus = status as CalendarPermissionStatus;
      await AsyncStorage.setItem(CALENDAR_PERMISSION_KEY, status);

      console.log('📅 Calendar permission status:', status);

      return status as CalendarPermissionStatus;
    } catch (error) {
      console.error('Failed to check calendar permissions:', error);
      return 'denied';
    }
  }

  /**
   * Request calendar permissions
   */
  async requestPermission(): Promise<CalendarPermissionStatus> {
    try {
      console.log('📅 Requesting calendar permissions...');

      const status = await RNCalendarEvents.requestPermissions();

      this.permissionStatus = status as CalendarPermissionStatus;
      await AsyncStorage.setItem(CALENDAR_PERMISSION_KEY, status);

      console.log('📅 Calendar permission result:', status);

      if (status === 'authorized') {
        console.log('✅ Calendar access granted');
      } else if (status === 'denied') {
        console.log('❌ Calendar access denied');
      } else if (status === 'restricted') {
        console.log('⚠️ Calendar access restricted');
      }

      return status as CalendarPermissionStatus;
    } catch (error) {
      console.error('Failed to request calendar permissions:', error);
      return 'denied';
    }
  }

  /**
   * Ensure calendar permissions are granted
   */
  async ensurePermission(): Promise<boolean> {
    const currentStatus = await this.checkPermission();

    if (currentStatus === 'authorized') {
      return true;
    }

    if (currentStatus === 'denied') {
      // Permission was denied, prompt user to go to settings
      this.showPermissionDeniedAlert();
      return false;
    }

    if (currentStatus === 'undetermined') {
      // Permission not yet requested, ask now
      const newStatus = await this.requestPermission();
      return newStatus === 'authorized';
    }

    return false;
  }

  /**
   * Show alert when permission is denied
   */
  private showPermissionDeniedAlert(): void {
    Alert.alert(
      'Calendar Access Required',
      'Calendar access has been denied. Please enable it in Settings to create calendar events.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Open Settings',
          onPress: () => {
            Linking.openSettings();
          },
        },
      ]
    );
  }

  /**
   * Get current permission status
   */
  getPermissionStatus(): CalendarPermissionStatus {
    return this.permissionStatus;
  }

  /**
   * Check if permission is granted
   */
  isAuthorized(): boolean {
    return this.permissionStatus === 'authorized';
  }

  /**
   * Get all available calendars
   */
  async getCalendars(): Promise<Calendar[]> {
    try {
      const hasPermission = await this.ensurePermission();
      if (!hasPermission) {
        console.log('⚠️ No calendar permission');
        return [];
      }

      const calendars = await RNCalendarEvents.findCalendars();

      console.log(`📅 Found ${calendars.length} calendar(s)`);

      return calendars.map(cal => ({
        id: cal.id,
        title: cal.title,
        type: cal.type,
        source: cal.source,
        isPrimary: cal.isPrimary || false,
        allowsModifications: cal.allowsModifications,
        color: cal.color,
      }));
    } catch (error) {
      console.error('Failed to get calendars:', error);
      return [];
    }
  }

  /**
   * Get primary calendar
   */
  async getPrimaryCalendar(): Promise<Calendar | null> {
    const calendars = await this.getCalendars();

    // Find primary calendar
    const primary = calendars.find(cal => cal.isPrimary);
    if (primary) return primary;

    // Fallback to first writable calendar
    const writable = calendars.find(cal => cal.allowsModifications);
    if (writable) return writable;

    // Fallback to first calendar
    return calendars.length > 0 ? calendars[0] : null;
  }

  /**
   * Create calendar event
   */
  async createEvent(
    title: string,
    startDate: Date,
    endDate: Date,
    options?: {
      location?: string;
      notes?: string;
      alarms?: CalendarAlarm[];
      calendarId?: string;
    }
  ): Promise<string | null> {
    try {
      const hasPermission = await this.ensurePermission();
      if (!hasPermission) {
        console.log('⚠️ Cannot create event: No permission');
        return null;
      }

      // Get calendar ID (use provided or primary)
      let calendarId = options?.calendarId;
      if (!calendarId) {
        const primaryCalendar = await this.getPrimaryCalendar();
        if (!primaryCalendar) {
          console.error('No calendar available');
          return null;
        }
        calendarId = primaryCalendar.id;
      }

      // Create event
      const eventId = await RNCalendarEvents.saveEvent(title, {
        calendarId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        location: options?.location,
        notes: options?.notes,
        alarms: options?.alarms,
      });

      console.log(`✅ Created calendar event: ${eventId}`);
      console.log(`   Title: ${title}`);
      console.log(`   Start: ${startDate.toLocaleString()}`);
      console.log(`   End: ${endDate.toLocaleString()}`);

      return eventId;
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      return null;
    }
  }

  /**
   * Update calendar event
   */
  async updateEvent(
    eventId: string,
    title: string,
    startDate: Date,
    endDate: Date,
    options?: {
      location?: string;
      notes?: string;
      alarms?: CalendarAlarm[];
    }
  ): Promise<boolean> {
    try {
      const hasPermission = await this.ensurePermission();
      if (!hasPermission) {
        console.log('⚠️ Cannot update event: No permission');
        return false;
      }

      await RNCalendarEvents.saveEvent(title, {
        id: eventId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        location: options?.location,
        notes: options?.notes,
        alarms: options?.alarms,
      });

      console.log(`✅ Updated calendar event: ${eventId}`);

      return true;
    } catch (error) {
      console.error('Failed to update calendar event:', error);
      return false;
    }
  }

  /**
   * Delete calendar event
   */
  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      const hasPermission = await this.ensurePermission();
      if (!hasPermission) {
        console.log('⚠️ Cannot delete event: No permission');
        return false;
      }

      await RNCalendarEvents.removeEvent(eventId);

      console.log(`✅ Deleted calendar event: ${eventId}`);

      return true;
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
      return false;
    }
  }

  /**
   * Find events in date range
   */
  async findEvents(
    startDate: Date,
    endDate: Date,
    calendarIds?: string[]
  ): Promise<CalendarEvent[]> {
    try {
      const hasPermission = await this.ensurePermission();
      if (!hasPermission) {
        console.log('⚠️ Cannot find events: No permission');
        return [];
      }

      const events = await RNCalendarEvents.fetchAllEvents(
        startDate.toISOString(),
        endDate.toISOString(),
        calendarIds
      );

      console.log(`📅 Found ${events.length} event(s)`);

      return events.map(event => ({
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location,
        notes: event.notes,
        alarms: event.alarms,
        calendar: event.calendar,
      }));
    } catch (error) {
      console.error('Failed to find events:', error);
      return [];
    }
  }

  /**
   * Find event by ID
   */
  async findEventById(eventId: string): Promise<CalendarEvent | null> {
    try {
      const hasPermission = await this.ensurePermission();
      if (!hasPermission) {
        return null;
      }

      const event = await RNCalendarEvents.findEventById(eventId);

      if (!event) return null;

      return {
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location,
        notes: event.notes,
        alarms: event.alarms,
        calendar: event.calendar,
      };
    } catch (error) {
      console.error('Failed to find event:', error);
      return null;
    }
  }

  /**
   * Get permission info for display
   */
  getPermissionInfo(): {
    status: CalendarPermissionStatus;
    canRequest: boolean;
    needsSettings: boolean;
    message: string;
  } {
    const status = this.permissionStatus;

    if (status === 'authorized') {
      return {
        status,
        canRequest: false,
        needsSettings: false,
        message: 'Calendar access granted',
      };
    }

    if (status === 'denied') {
      return {
        status,
        canRequest: false,
        needsSettings: true,
        message: 'Calendar access denied. Please enable in Settings.',
      };
    }

    if (status === 'restricted') {
      return {
        status,
        canRequest: false,
        needsSettings: true,
        message: 'Calendar access restricted by system settings.',
      };
    }

    // undetermined
    return {
      status,
      canRequest: true,
      needsSettings: false,
      message: 'Calendar access not yet requested.',
    };
  }
}

// Export singleton instance
export const calendarService = new CalendarService();
