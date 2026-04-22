import React, {useCallback} from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Text, Linking, View, Alert, ActionSheetIOS, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {setCalendarProvider} from '@services/calendar/calendarPreference';

import InboxScreen from '@screens/Inbox/InboxScreen';
import NextActionsScreen from '@screens/NextActions/NextActionsScreen';
import ProjectsScreen from '@screens/Projects/ProjectsScreen';
import WaitingScreen from '@screens/Waiting/WaitingForScreen';
import SomedayScreen from '@screens/Someday/SomedayScreen';
import ReferenceScreen from '@screens/Reference/ReferenceScreen';
import CalendarServiceTestScreen from '@screens/CalendarServiceTestScreen';

// CalendarScreen is never rendered — the tab opens the user's calendar app directly
const CalendarPlaceholder = () => <View />;

// ─── Calendar app preference ───────────────────────────────────────────────

type CalendarApp = 'apple' | 'google';

const PREF_KEY = '@allen_calendar_app';

const CALENDAR_APPS: {id: CalendarApp; label: string; url: string}[] = [
  {id: 'apple', label: 'Apple Calendar', url: 'calshow://'},
  {id: 'google', label: 'Google Calendar', url: 'https://calendar.google.com/calendar/r'},
];

async function getCalendarApp(): Promise<CalendarApp | null> {
  try {
    return (await AsyncStorage.getItem(PREF_KEY)) as CalendarApp | null;
  } catch {
    return null;
  }
}

async function saveCalendarApp(app: CalendarApp): Promise<void> {
  await AsyncStorage.setItem(PREF_KEY, app);
  // Keep createCalendarEvent provider in sync
  await setCalendarProvider(app === 'apple' ? 'native' : 'google');
}

function openCalendarApp(app: CalendarApp) {
  const entry = CALENDAR_APPS.find(a => a.id === app)!;
  Linking.openURL(entry.url).catch(() =>
    Alert.alert('Error', `Could not open ${entry.label}.`),
  );
}

function showAppPicker(onPick: (app: CalendarApp) => void) {
  const labels = CALENDAR_APPS.map(a => a.label);
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {title: 'Which calendar app do you use?', options: [...labels, 'Cancel'], cancelButtonIndex: labels.length},
      index => {
        if (index < labels.length) {
          onPick(CALENDAR_APPS[index].id);
        }
      },
    );
  } else {
    Alert.alert(
      'Which calendar app do you use?',
      undefined,
      [
        ...CALENDAR_APPS.map(a => ({text: a.label, onPress: () => onPick(a.id)})),
        {text: 'Cancel', style: 'cancel' as const},
      ],
    );
  }
}

// ─── Tab Param List ────────────────────────────────────────────────────────

export type TabParamList = {
  Inbox: undefined;
  NextActions: undefined;
  Projects: undefined;
  Waiting: undefined;
  Someday: undefined;
  Reference: undefined;
  CalendarServiceTest: undefined;
  Calendar: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

// ─── Helpers ───────────────────────────────────────────────────────────────

const tabIcon: Record<keyof TabParamList, string> = {
  Inbox: '📥',
  NextActions: '⚡',
  Projects: '📋',
  Waiting: '⏳',
  Someday: '💭',
  Reference: '📚',
  CalendarServiceTest: '🧪',
  Calendar: '📅',
};

const tabLabel: Record<keyof TabParamList, string> = {
  Inbox: 'Inbox',
  NextActions: 'Next',
  Projects: 'Projects',
  Waiting: 'Waiting',
  Someday: 'Someday',
  Reference: 'Reference',
  CalendarServiceTest: 'Cal Test',
  Calendar: 'Calendar',
};

// ─── Navigator ────────────────────────────────────────────────────────────

export default function TabNavigator() {
  const handleCalendarPress = useCallback(async () => {
    const saved = await getCalendarApp();
    if (saved) {
      openCalendarApp(saved);
    } else {
      showAppPicker(chosen => {
        saveCalendarApp(chosen);
        openCalendarApp(chosen);
      });
    }
  }, []);

  const handleCalendarLongPress = useCallback(() => {
    showAppPicker(chosen => {
      saveCalendarApp(chosen);
      openCalendarApp(chosen);
    });
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarIcon: () => (
          <Text style={{fontSize: 20}}>
            {tabIcon[route.name as keyof TabParamList]}
          </Text>
        ),
        tabBarLabel: tabLabel[route.name as keyof TabParamList],
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#999999',
        tabBarStyle: {
          borderTopColor: '#e5e5e5',
          backgroundColor: '#ffffff',
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
      })}>
      <Tab.Screen name="Inbox" component={InboxScreen} />
      <Tab.Screen name="NextActions" component={NextActionsScreen} />
      <Tab.Screen name="Projects" component={ProjectsScreen} />
      <Tab.Screen name="Waiting" component={WaitingScreen} />
      <Tab.Screen name="Someday" component={SomedayScreen} />
      <Tab.Screen name="Reference" component={ReferenceScreen} />
      <Tab.Screen name="CalendarServiceTest" component={CalendarServiceTestScreen} />
      <Tab.Screen
        name="Calendar"
        component={CalendarPlaceholder}
        listeners={{
          tabPress: e => {
            e.preventDefault();
            handleCalendarPress();
          },
          tabLongPress: () => handleCalendarLongPress(),
        }}
      />
    </Tab.Navigator>
  );
}
