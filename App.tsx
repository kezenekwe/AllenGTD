import React, {useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {DatabaseProvider} from '@nozbe/watermelondb/DatabaseProvider';
import {database} from '@services/database/index';
import TabNavigator from '@navigation/TabNavigator';
import {networkService} from './src/services/networkService';
import {backgroundSyncService} from './src/services/backgroundSyncService';
import {syncErrorHandler} from './src/services/syncErrorHandler';
import NetworkStatusBanner from './src/components/NetworkStatusBanner';

import SyncErrorAlert from './src/components/SyncErrorAlert';

// ─── App ───────────────────────────────────────────────────────────────────
// Root component. DatabaseProvider makes the WatermelonDB instance available
// to every component via context — no prop drilling needed.

export default function App() {
  useEffect(() => {
    networkService.initialize();
    syncErrorHandler.initialize();
    backgroundSyncService.initialize();

    return () => {
      networkService.cleanup();
      backgroundSyncService.cleanup();
    };
  }, []);

  return (
    <DatabaseProvider database={database}>
      <>
        <NetworkStatusBanner />
        <SyncErrorAlert />
        <NavigationContainer>
          <TabNavigator />
        </NavigationContainer>

      </>
    </DatabaseProvider>
  );
}
