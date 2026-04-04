import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── CalendarProvider ──────────────────────────────────────────────────────

export type CalendarProvider = 'native' | 'google' | 'fantastical';

export interface CalendarProviderInfo {
  id: CalendarProvider;
  label: string;
  description: string;
}

export const CALENDAR_PROVIDERS: CalendarProviderInfo[] = [
  {
    id: 'native',
    label: 'Apple Calendar',
    description: 'Adds to your default iOS calendar account',
  },
  {
    id: 'google',
    label: 'Google Calendar',
    description: 'Opens Google Calendar in your browser',
  },
  {
    id: 'fantastical',
    label: 'Fantastical',
    description: 'Opens in Fantastical (must be installed)',
  },
];

// ─── Storage ───────────────────────────────────────────────────────────────

const KEY = '@allen_calendar_provider';

export async function getCalendarProvider(): Promise<CalendarProvider> {
  try {
    const value = await AsyncStorage.getItem(KEY);
    return (value as CalendarProvider) ?? 'native';
  } catch {
    return 'native';
  }
}

export async function setCalendarProvider(
  provider: CalendarProvider,
): Promise<void> {
  await AsyncStorage.setItem(KEY, provider);
}
