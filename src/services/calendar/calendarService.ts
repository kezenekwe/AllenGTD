import RNCalendarEvents from 'react-native-calendar-events';
import {Alert, Linking} from 'react-native';
import {getCalendarProvider} from './calendarPreference';

// ─── calendarService ───────────────────────────────────────────────────────
// Routes calendar event creation to the user's preferred app.

export interface CreateEventOptions {
  title: string;
  notes?: string;
  startDate?: Date;   // defaults to 1 hour from now
  endDate?: Date;     // defaults to 2 hours from now
}

function defaultTimes(options: CreateEventOptions): {start: Date; end: Date} {
  const now = new Date();
  return {
    start: options.startDate ?? new Date(now.getTime() + 60 * 60 * 1000),
    end: options.endDate ?? new Date(now.getTime() + 2 * 60 * 60 * 1000),
  };
}

// ─── Apple Calendar (native) ───────────────────────────────────────────────

export async function createNativeCalendarEvent(
  options: CreateEventOptions,
): Promise<string | null> {
  try {
    const status = await RNCalendarEvents.requestPermissions();
    if (status !== 'authorized') {
      Alert.alert(
        'Calendar Access Required',
        'Please grant calendar access in Settings to add events.',
      );
      return null;
    }

    const {start, end} = defaultTimes(options);
    const eventId = await RNCalendarEvents.saveEvent(options.title, {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      notes: options.notes,
      alarms: [{date: -30}],
    });

    return eventId ?? null;
  } catch (error) {
    console.error('Error creating native calendar event:', error);
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
  });

  const url = `https://calendar.google.com/calendar/render?${params.toString()}`;
  try {
    await Linking.openURL(url);
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
  const notes = options.notes ? `&notes=${encodeURIComponent(options.notes)}` : '';

  // Try Fantastical 3 first, fall back to Fantastical 2
  const url = `x-fantastical3://parse?sentence=${sentence}${notes}`;
  const fallbackUrl = `fantastical2://parse?sentence=${sentence}${notes}`;

  try {
    const canOpen = await Linking.canOpenURL(url);
    await Linking.openURL(canOpen ? url : fallbackUrl);
  } catch {
    Alert.alert(
      'Fantastical Not Found',
      'Please install Fantastical from the App Store.',
    );
  }
  return null;
}

// ─── Unified entry point ───────────────────────────────────────────────────

/**
 * Creates a calendar event using the user's preferred calendar app.
 * Returns a native event ID for Apple Calendar, or null for third-party apps
 * (which are opened via URL and cannot return an ID).
 */
export async function createCalendarEvent(
  options: CreateEventOptions,
): Promise<string | null> {
  const provider = await getCalendarProvider();
  switch (provider) {
    case 'google':
      return createGoogleCalendarEvent(options);
    case 'fantastical':
      return createFantasticalEvent(options);
    default:
      return createNativeCalendarEvent(options);
  }
}
