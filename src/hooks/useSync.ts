// src/hooks/useSync.ts
// React hook for sync operations

import { useState, useEffect, useCallback } from 'react';
import { syncService } from '../services/syncService';
import { AppState, AppStateStatus } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────

interface UseSyncReturn {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncStatus: {
    totalItems: number;
    syncedItems: number;
    unsyncedItems: number;
    pendingDeletes: number;
  } | null;
  sync: () => Promise<void>;
  error: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useSync(autoSyncInterval?: number): UseSyncReturn {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<UseSyncReturn['syncStatus']>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Perform sync
   */
  const sync = useCallback(async () => {
    if (isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    setIsSyncing(true);
    setError(null);

    try {
      const result = await syncService.sync();

      if (result.errors.length > 0) {
        setError(result.errors[0]);
        console.error('Sync errors:', result.errors);
      } else {
        setLastSyncTime(new Date());
        console.log('Sync successful:', result);
      }

      // Update sync status
      const status = await syncService.getSyncStatus();
      setSyncStatus(status);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown sync error';
      setError(errorMessage);
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  /**
   * Auto-sync on interval
   */
  useEffect(() => {
    if (!autoSyncInterval) return;

    const intervalId = setInterval(() => {
      sync();
    }, autoSyncInterval);

    return () => clearInterval(intervalId);
  }, [autoSyncInterval, sync]);

  /**
   * Sync on app foreground
   */
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('App foregrounded, syncing...');
        sync();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [sync]);

  /**
   * Initial sync on mount
   */
  useEffect(() => {
    sync();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isSyncing,
    lastSyncTime,
    syncStatus,
    sync,
    error,
  };
}
