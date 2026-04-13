import React, {useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {DatabaseProvider} from '@nozbe/watermelondb/DatabaseProvider';
import {database} from '@services/database/index';
import TabNavigator from '@navigation/TabNavigator';
import {networkService} from './src/services/networkService';
import NetworkStatusBanner from './src/components/NetworkStatusBanner';

// ─── App ───────────────────────────────────────────────────────────────────
// Root component. DatabaseProvider makes the WatermelonDB instance available
// to every component via context — no prop drilling needed.

export default function App() {
  useEffect(() => {
    networkService.initialize();

    return () => {
      networkService.cleanup();
    };
  }, []);

  return (
    <DatabaseProvider database={database}>
      <>
        <NetworkStatusBanner />
        <NavigationContainer>
          <TabNavigator />
        </NavigationContainer>
      </>
    </DatabaseProvider>
  );
}
