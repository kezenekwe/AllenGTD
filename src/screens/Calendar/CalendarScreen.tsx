import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  Alert,
  Linking,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import {Calendar, DateData} from 'react-native-calendars';
import RNCalendarEvents, {CalendarEventReadable} from 'react-native-calendar-events';
import {itemRepository} from '@services/database/repositories/ItemRepository';
import Item from '@services/database/models/Item';
import {
  CalendarProvider,
  CALENDAR_PROVIDERS,
  getCalendarProvider,
  setCalendarProvider,
} from '@services/calendar/calendarPreference';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AgendaEntry {
  id: string;
  title: string;
  date: string;           // 'YYYY-MM-DD'
  timeRange?: string;     // e.g. '9:00 AM – 10:00 AM' or 'All day'
  location?: string;
  notes?: string;
  type: 'device' | 'gtd';
  startISO?: string;      // for native calendar deep-link
  nativeEventId?: string; // actual calendar event ID (for deletion)
  gtdItem?: Item;         // GTD item reference (for clearing calendar link)
  raw?: CalendarEventReadable;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});

const formatTimeRange = (start: string, end: string, allDay: boolean) => {
  if (allDay) return 'All day';
  return `${formatTime(start)} – ${formatTime(end)}`;
};

// ─── CalendarScreen ──────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState<string>(toYMD(new Date()));
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
  const [allEntries, setAllEntries] = useState<AgendaEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [activeProvider, setActiveProvider] = useState<CalendarProvider>('native');

  useEffect(() => {
    getCalendarProvider().then(setActiveProvider);
  }, []);

  // ─── Load Events ───────────────────────────────────────────────────────

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      // Request calendar permission
      const status = await RNCalendarEvents.requestPermissions();
      if (status !== 'authorized') {
        setPermissionDenied(true);
        setIsLoading(false);
        return;
      }

      // Fetch device calendar events for a 3-month window
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      const deviceEvents = await RNCalendarEvents.fetchAllEvents(
        start.toISOString(),
        end.toISOString(),
      );

      // Fetch GTD items with hasCalendar = true
      const gtdItems: Item[] = await itemRepository.fetchByCategory('nextActions');
      const waitingItems: Item[] = await itemRepository.fetchByCategory('waiting');
      const allGtdItems = [...gtdItems, ...waitingItems].filter(i => i.hasCalendar);

      // Build unified entries list
      const deviceEntries: AgendaEntry[] = deviceEvents.map(e => ({
        id: e.id,
        title: e.title,
        date: toYMD(new Date(e.startDate)),
        timeRange: formatTimeRange(e.startDate, e.endDate, e.allDay ?? false),
        location: e.location || undefined,
        notes: e.notes || undefined,
        type: 'device',
        startISO: e.startDate,
        nativeEventId: e.id,
        raw: e,
      }));

      // Build a lookup map so GTD items can inherit details from their native event
      const deviceEventMap = new Map(deviceEvents.map(e => [e.id, e]));

      const gtdEntries: AgendaEntry[] = allGtdItems.filter(item =>
        !item.calendarEventId || !deviceEventMap.has(item.calendarEventId),
      ).map(item => {
        const nativeEvent = item.calendarEventId
          ? deviceEventMap.get(item.calendarEventId)
          : undefined;

        return {
          id: item.id,
          title: item.text,
          date: nativeEvent ? toYMD(new Date(nativeEvent.startDate)) : toYMD(item.createdAt),
          timeRange: nativeEvent
            ? formatTimeRange(nativeEvent.startDate, nativeEvent.endDate, nativeEvent.allDay ?? false)
            : undefined,
          location: nativeEvent?.location || undefined,
          notes: nativeEvent?.notes || undefined,
          startISO: nativeEvent?.startDate,
          nativeEventId: item.calendarEventId ?? undefined,
          gtdItem: item,
          type: 'gtd',
          raw: nativeEvent,
        };
      });

      const combined = [...deviceEntries, ...gtdEntries].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.startISO ?? '').localeCompare(b.startISO ?? '');
      });

      setAllEntries(combined);

      // Build markedDates for the calendar dots
      const marks: Record<string, any> = {};
      for (const entry of combined) {
        if (!marks[entry.date]) {
          marks[entry.date] = {dots: []};
        }
        const dot = {
          key: entry.type + entry.id,
          color: entry.type === 'device' ? '#007AFF' : '#000',
        };
        marks[entry.date].dots.push(dot);
      }
      // Preserve selected day highlight
      marks[selectedDate] = {
        ...(marks[selectedDate] ?? {}),
        selected: true,
        selectedColor: '#000',
      };
      setMarkedDates(marks);
    } catch (err) {
      console.error('Error loading calendar events:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // ─── Remove from Calendar ─────────────────────────────────────────────

  const handleRemoveFromCalendar = (entry: AgendaEntry) => {
    if (!entry.nativeEventId) return;

    Alert.alert(
      'Remove from Calendar',
      `Remove "${entry.title}" from your calendar?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await RNCalendarEvents.removeEvent(entry.nativeEventId!);
              if (entry.type === 'gtd' && entry.gtdItem) {
                await itemRepository.clearCalendar(entry.gtdItem);
              }
              await loadEvents();
            } catch (err) {
              console.error('Error removing calendar event:', err);
              Alert.alert('Error', 'Could not remove the calendar event.');
            }
          },
        },
      ],
    );
  };

  // ─── Day Selection ─────────────────────────────────────────────────────

  const handleDayPress = (day: DateData) => {
    const date = day.dateString;
    setSelectedDate(date);
    setMarkedDates(prev => {
      const next: Record<string, any> = {};
      for (const [key, val] of Object.entries(prev)) {
        next[key] = {...val, selected: false};
      }
      next[date] = {...(next[date] ?? {}), selected: true, selectedColor: '#000'};
      return next;
    });
  };

  // ─── Calendar provider picker ─────────────────────────────────────────

  const handlePickProvider = () => {
    const options = CALENDAR_PROVIDERS.map(p => p.label);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Default Calendar App',
          message: 'New events will be added to this calendar',
          options: [...options, 'Cancel'],
          cancelButtonIndex: options.length,
          destructiveButtonIndex: undefined,
        },
        async buttonIndex => {
          if (buttonIndex < options.length) {
            const chosen = CALENDAR_PROVIDERS[buttonIndex].id;
            await setCalendarProvider(chosen);
            setActiveProvider(chosen);
          }
        },
      );
    } else {
      // Android fallback: Alert with buttons
      Alert.alert(
        'Default Calendar App',
        'New events will be added to this calendar',
        [
          ...CALENDAR_PROVIDERS.map(p => ({
            text: p.id === activeProvider ? `${p.label} ✓` : p.label,
            onPress: async () => {
              await setCalendarProvider(p.id);
              setActiveProvider(p.id);
            },
          })),
          {text: 'Cancel', style: 'cancel' as const},
        ],
      );
    }
  };

  // ─── Open native calendar at event's date/time ────────────────────────

  const openInNativeCalendar = (entry: AgendaEntry) => {
    if (!entry.startISO) return;
    // iOS calshow:// accepts a Unix timestamp (seconds) to jump to that moment
    const ts = Math.floor(new Date(entry.startISO).getTime() / 1000);
    Linking.openURL(`calshow://${ts}`).catch(() =>
      Alert.alert('Error', 'Could not open Calendar app'),
    );
  };

  // ─── Filtered entries for selected day ────────────────────────────────

  const dayEntries = allEntries.filter(e => e.date === selectedDate);

  // ─── Render ────────────────────────────────────────────────────────────

  if (permissionDenied) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>Calendar</Text>
            <TouchableOpacity
              style={styles.providerButton}
              onPress={handlePickProvider}>
              <Text style={styles.providerButtonText}>
                {CALENDAR_PROVIDERS.find(p => p.id === activeProvider)?.label ?? 'Calendar'}
              </Text>
              <Text style={styles.providerChevron}> ›</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionIcon}>📅</Text>
          <Text style={styles.permissionText}>
            Calendar access is required to show your events.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={loadEvents}>
            <Text style={styles.permissionButtonText}>Grant Access</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderEntry = ({item}: {item: AgendaEntry}) => {
    const isDevice = item.type === 'device';
    const isTappable = !!item.startISO; // both device events and GTD items linked to a native event
    const isRemovable = !!item.nativeEventId;
    return (
      <TouchableOpacity
        style={styles.entryCard}
        onPress={() => isTappable && openInNativeCalendar(item)}
        onLongPress={() => isRemovable && handleRemoveFromCalendar(item)}
        activeOpacity={isTappable || isRemovable ? 0.7 : 1}>
        <View style={[styles.entryDot, isDevice ? styles.deviceDot : styles.gtdDot]} />
        <View style={styles.entryContent}>
          {/* Title row */}
          <View style={styles.entryTitleRow}>
            <Text style={styles.entryTitle}>{item.title}</Text>
            <Text style={[styles.entryBadge, isDevice ? styles.deviceBadge : styles.gtdBadge]}>
              {isDevice ? 'Calendar' : 'GTD'}
            </Text>
          </View>

          {/* Time */}
          {item.timeRange && (
            <Text style={styles.entryDetail}>🕐 {item.timeRange}</Text>
          )}

          {/* Location */}
          {item.location ? (
            <Text style={styles.entryDetail} numberOfLines={1}>📍 {item.location}</Text>
          ) : null}

          {/* Notes / description */}
          {item.notes ? (
            <Text style={styles.entryNotes} numberOfLines={2}>{item.notes}</Text>
          ) : null}

          {/* Tap hint for any event linked to the native calendar */}
          {isTappable && (
            <Text style={styles.entryTapHint}>Tap to open in Calendar →</Text>
          )}
          {isRemovable && (
            <Text style={styles.entryRemoveHint}>Hold to remove from Calendar</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyDay}>
      <Text style={styles.emptyDayText}>No events</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Calendar</Text>
          <TouchableOpacity
            style={styles.providerButton}
            onPress={handlePickProvider}>
            <Text style={styles.providerButtonText}>
              {CALENDAR_PROVIDERS.find(p => p.id === activeProvider)?.label ?? 'Calendar'}
            </Text>
            <Text style={styles.providerChevron}> ›</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>Schedule & events</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} />
      ) : (
        <>
          {/* Calendar grid */}
          <Calendar
            current={selectedDate}
            onDayPress={handleDayPress}
            markingType="multi-dot"
            markedDates={markedDates}
            theme={{
              backgroundColor: '#fff',
              calendarBackground: '#fff',
              textSectionTitleColor: '#999',
              selectedDayBackgroundColor: '#000',
              selectedDayTextColor: '#fff',
              todayTextColor: '#000',
              todayBackgroundColor: '#f0f0f0',
              dayTextColor: '#000',
              textDisabledColor: '#ccc',
              dotColor: '#000',
              arrowColor: '#000',
              monthTextColor: '#000',
              textMonthFontWeight: '600',
              textDayFontSize: 14,
              textMonthFontSize: 16,
            }}
          />

          {/* Day agenda */}
          <View style={styles.agendaHeader}>
            <Text style={styles.agendaTitle}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString([], {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
            <TouchableOpacity onPress={loadEvents}>
              <Text style={styles.refreshText}>↻ Refresh</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={dayEntries}
            keyExtractor={e => e.id}
            renderItem={renderEntry}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={styles.agendaList}
          />
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
  providerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  providerButtonText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  providerChevron: {
    fontSize: 14,
    color: '#999',
  },
  loader: {
    marginTop: 40,
  },
  agendaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  agendaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  refreshText: {
    fontSize: 13,
    color: '#666',
  },
  agendaList: {
    padding: 12,
    gap: 8,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    gap: 10,
    marginBottom: 8,
  },
  entryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  deviceDot: {
    backgroundColor: '#007AFF',
  },
  gtdDot: {
    backgroundColor: '#000',
  },
  entryContent: {
    flex: 1,
    gap: 4,
  },
  entryTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  entryTitle: {
    flex: 1,
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
    lineHeight: 20,
  },
  entryDetail: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  entryNotes: {
    fontSize: 12,
    color: '#999',
    lineHeight: 17,
    fontStyle: 'italic',
  },
  entryTapHint: {
    fontSize: 11,
    color: '#007AFF',
    marginTop: 2,
  },
  entryRemoveHint: {
    fontSize: 11,
    color: '#999',
    marginTop: 1,
  },
  entryBadge: {
    fontSize: 10,
    fontWeight: '500',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deviceBadge: {
    backgroundColor: '#e3f0ff',
    color: '#007AFF',
  },
  gtdBadge: {
    backgroundColor: '#f0f0f0',
    color: '#666',
  },
  emptyDay: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyDayText: {
    fontSize: 13,
    color: '#ccc',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  permissionIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  permissionText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#000',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
