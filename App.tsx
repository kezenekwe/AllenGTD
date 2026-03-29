import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {DatabaseProvider} from '@nozbe/watermelondb/DatabaseProvider';
import {database} from '@services/database/index';
import TabNavigator from '@navigation/TabNavigator';

// ─── App ───────────────────────────────────────────────────────────────────
// Root component. DatabaseProvider makes the WatermelonDB instance available
// to every component via context — no prop drilling needed.

export default function App() {
  return (
    <DatabaseProvider database={database}>
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>
    </DatabaseProvider>
  );
}
