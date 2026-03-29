import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Text} from 'react-native';

// Screens (each is a placeholder — we fill them in Tasks 1.4+)
import InboxScreen from '@screens/Inbox/InboxScreen';
import NextActionsScreen from '@screens/NextActions/NextActionsScreen';
import ProjectsScreen from '@screens/Projects/ProjectsScreen';
import WaitingScreen from '@screens/Waiting/WaitingForScreen';
import SomedayScreen from '@screens/Someday/SomedayScreen';
import ReferenceScreen from '@screens/Reference/ReferenceScreen';

// ─── Tab Param List ────────────────────────────────────────────────────────

export type TabParamList = {
  Inbox: undefined;
  NextActions: undefined;
  Projects: undefined;
  Waiting: undefined;
  Someday: undefined;
  Reference: undefined;
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
};

const tabLabel: Record<keyof TabParamList, string> = {
  Inbox: 'Inbox',
  NextActions: 'Next',
  Projects: 'Projects',
  Waiting: 'Waiting',
  Someday: 'Someday',
  Reference: 'Reference',
};

// ─── Navigator ────────────────────────────────────────────────────────────

export default function TabNavigator() {
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
    </Tab.Navigator>
  );
}
