// src/hooks/useBackgroundSync.ts
// React hook for background sync status

import { useState, useEffect } from 'react';
import {
  backgroundSyncService,
  SyncStatus,
} from '../services/backgroundSyncService';

// ─── Types ────────────────────────────────────────────────────────────────

interface SyncStatusInfo {
  status: SyncStatus;
  lastSyncTime: Date | null;
  lastSyncResult: {
    pushed: number;
    pulled: number;
    conflicts: number;
  } | null;
  error: string | null;
  syncCount: number;
}

interface UseBackgroundSyncReturn {
  status: SyncStatus;
  isSyncing: boolean;
  isSynced: boolean;
  isError: boolean;
  isOffline: boolean;
  lastSyncTime: Date | null;
  lastSyncResult: SyncStatusInfo['lastSyncResult'];
  error: string | null;
  syncCount: number;
  triggerSync: () => Promise<void>;
  pauseSync: () => void;
  resumeSync: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useBackgroundSync(): UseBackgroundSyncReturn {
  const [statusInfo, setStatusInfo] = useState<SyncStatusInfo>({
    status: 'idle',
    lastSyncTime: null,
    lastSyncResult: null,
    error: null,
    syncCount: 0,
  });

  useEffect(() => {
    // Initialize background sync
    backgroundSyncService.initialize();

    // Subscribe to status changes
    const listenerId = backgroundSyncService.addListener(newStatusInfo => {
      setStatusInfo(newStatusInfo);
    });

    // Cleanup
    return () => {
      backgroundSyncService.removeListener(listenerId);
    };
  }, []);

  const triggerSync = async () => {
    await backgroundSyncService.triggerSync();
  };

  const pauseSync = () => {
    backgroundSyncService.pause();
  };

  const resumeSync = () => {
    backgroundSyncService.resume();
  };

  return {
    status: statusInfo.status,
    isSyncing: statusInfo.status === 'syncing',
    isSynced: statusInfo.status === 'synced',
    isError: statusInfo.status === 'error',
    isOffline: statusInfo.status === 'offline',
    lastSyncTime: statusInfo.lastSyncTime,
    lastSyncResult: statusInfo.lastSyncResult,
    error: statusInfo.error,
    syncCount: statusInfo.syncCount,
    triggerSync,
    pauseSync,
    resumeSync,
  };
}
