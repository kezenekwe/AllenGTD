import RNCalendarEvents from 'react-native-calendar-events';
import {Alert, Linking} from 'react-native';
import {getCalendarProvider} from './calendarPreference';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CreateEventOptions {
  title: string;
  notes?: string;
  startDate?: Date; // defaults to 1 hour from now
  endDate?: Date; // defaults to 2 hours from now
  location?: string;
  alarms?: number[]; // minutes before event (e.g., [15, 30])
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

// ─── Helper Functions ──────────────────────────────────────────────────────

function defaultTimes(options: CreateEventOptions): {start: Date; end: Date} {
  const now = new Date();
  return {
    start: options.startDate ?? new Date(now.getTime() + 60 * 60 * 1000),
    end: options.endDate ?? new Date(now.getTime() + 2 * 60 * 60 * 1000),
  };
}

function formatAlarms(minutesBefore: number[]): Array<{date: number}> {
  return minutesBefore.map(minutes => ({date: -minutes}));
}

// ─── Calendar Access ───────────────────────────────────────────────────────

/**
 * Request calendar permissions
 * @returns Permission status: 'authorized' | 'denied' | 'restricted'
 */
export async function requestCalendarPermissions(): Promise<string> {
  try {
    const status = await RNCalendarEvents.requestPermissions();
    console.log('📅 Calendar permission status:', status);
    return status;
  } catch (error) {
    console.error('Error requesting calendar permissions:', error);
    return 'denied';
  }
}

/**
 * Check if calendar permissions are granted
 */
export async function hasCalendarPermissions(): Promise<boolean> {
  try {
    const status = await RNCalendarEvents.checkPermissions();
    return status === 'authorized' || (status as string) === 'writeOnly';
  } catch (error) {
    return false;
  }
}

/**
 * Get all available calendars
 */
export async function getCalendars(): Promise<Calendar[]> {
  try {
    const hasPermission = await hasCalendarPermissions();
    if (!hasPermission) {
      console.log('⚠️ No calendar permission to get calendars');
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
    console.log('Error getting calendars:', error);
    return [];
  }
}

/**
 * Get the default/primary calendar
 * Falls back to first writable calendar if no primary exists
 */
export async function getDefaultCalendar(): Promise<Calendar | null> {
  try {
    const calendars = await getCalendars();

    if (calendars.length === 0) {
      console.log('⚠️ No calendars available');
      return null;
    }

    // 1. Try to find primary calendar
    const primary = calendars.find(cal => cal.isPrimary);
    if (primary) {
      console.log(`✓ Using primary calendar: ${primary.title}`);
      return primary;
    }

    // 2. Fall back to first writable calendar
    const writable = calendars.find(cal => cal.allowsModifications);
    if (writable) {
      console.log(`✓ Using first writable calendar: ${writable.title}`);
      return writable;
    }

    // 3. Fall back to first calendar
    console.log(`✓ Using first available calendar: ${calendars[0].title}`);
    return calendars[0];
  } catch (error) {
    console.log('Error getting default calendar:', error);
    return null;
  }
}

// ─── Apple Calendar (native) ───────────────────────────────────────────────

export async function createNativeCalendarEvent(
  options: CreateEventOptions,
): Promise<string | null> {
  try {
    const status = await RNCalendarEvents.requestPermissions();
    if (status !== 'authorized' && (status as string) !== 'writeOnly') {
      Alert.alert(
        'Calendar Access Required',
        'Please grant calendar access in Settings.',
      );
      return null;
    }

    const defaultCalendar = await getDefaultCalendar();
    if (!defaultCalendar) {
      Alert.alert('Error', 'No calendar available.');
      return null;
    }

    const {start, end} = defaultTimes(options);

    let eventId: string | undefined;
    try {
      eventId = await RNCalendarEvents.saveEvent(options.title, {
        calendarId: defaultCalendar.id,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        notes: options.notes,
        alarms: [{date: -30}],
      });
    } catch (saveError) {
      console.warn('saveEvent error:', saveError);
    }

    // Open Apple Calendar to today
    const todayTs = Math.floor(Date.now() / 1000);
    Linking.openURL(`calshow://${todayTs}`).catch(() => {});

    return eventId || 'created';
  } catch (error) {
    console.log('createNativeCalendarEvent error:', error);
    Alert.alert('Error', 'Failed to add to calendar.');
    return null;
  }
}

// ─── Google Calendar ───────────────────────────────────────────────────────

function toGCalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

async function createGoogleCalendarEvent(
  options: CreateEventOptions,
): Promise<null> {
  const {start, end} = defaultTimes(options);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: options.title,
    dates: `${toGCalDate(start)}/${toGCalDate(end)}`,
    ...(options.notes ? {details: options.notes} : {}),
    ...(options.location ? {location: options.location} : {}),
  });

  const url = `https://calendar.google.com/calendar/render?${params.toString()}`;
  try {
    await Linking.openURL(url);
    console.log('✓ Opened Google Calendar');
  } catch {
    Alert.alert('Error', 'Could not open Google Calendar.');
  }
  return null;
}

// ─── Fantastical ───────────────────────────────────────────────────────────

async function createFantasticalEvent(
  options: CreateEventOptions,
): Promise<null> {
  const {start} = defaultTimes(options);

  // Fantastical parses natural language — pass title + ISO start time
  const sentence = encodeURIComponent(
    `${options.title} at ${start.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`,
  );
  const notes = options.notes
    ? `&notes=${encodeURIComponent(options.notes)}`
    : '';

  // Try Fantastical 3 first, fall back to Fantastical 2
  const url = `x-fantastical3://parse?sentence=${sentence}${notes}`;
  const fallbackUrl = `fantastical2://parse?sentence=${sentence}${notes}`;

  try {
    const canOpen = await Linking.canOpenURL(url);
    await Linking.openURL(canOpen ? url : fallbackUrl);
    console.log('✓ Opened Fantastical');
  } catch {
    Alert.alert(
      'Fantastical Not Found',
      'Please install Fantastical from the App Store.',
    );
  }
  return null;
}

// ─── Unified Entry Points ──────────────────────────────────────────────────

/**
 * Creates a calendar event using the user's preferred calendar app.
 * Returns a native event ID for Apple Calendar, or null for third-party apps
 * (which are opened via URL and cannot return an ID).
 */
export async function createCalendarEvent(
  options: CreateEventOptions,
): Promise<string | null> {
  const provider = await getCalendarProvider();
  console.log('📅 createCalendarEvent: provider =', provider);
  switch (provider) {
    case 'google':
      console.log('📅 Using Google Calendar path (returns null)');
      return createGoogleCalendarEvent(options);
    case 'fantastical':
      console.log('📅 Using Fantastical path (returns null)');
      return createFantasticalEvent(options);
    default:
      console.log('📅 Using native calendar path');
      return createNativeCalendarEvent(options);
  }
}

/**
 * Simple method to add an event to the calendar
 * @param title Event title
 * @param notes Event notes/description
 * @param date Event start date (defaults to 1 hour from now)
 * @returns Event ID if created successfully, null otherwise
 *
 * @example
 * const eventId = await addToCalendar(
 *   'Team Meeting',
 *   'Discuss project updates',
 *   new Date('2025-01-20T10:00:00')
 * );
 */
export async function addToCalendar(
  title: string,
  notes?: string,
  date?: Date,
): Promise<string | null> {
  const startDate = date ?? new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration

  return createCalendarEvent({
    title,
    notes,
    startDate,
    endDate,
    alarms: [15], // 15 minutes before
  });
}

// ─── Export Default Service ────────────────────────────────────────────────

export const CalendarService = {
  // Permission methods
  requestPermissions: requestCalendarPermissions,
  hasPermissions: hasCalendarPermissions,

  // Calendar methods
  getCalendars,
  getDefaultCalendar,

  // Event creation methods
  createEvent: createCalendarEvent,
  addToCalendar,

  // Provider-specific methods
  createNativeEvent: createNativeCalendarEvent,
  createGoogleEvent: createGoogleCalendarEvent,
  createFantasticalEvent,
};

export default CalendarService;
