// src/services/backgroundSyncService.enhanced.ts
// Enhanced background sync service with error handling

import { AppState, AppStateStatus } from 'react-native';
import { syncService } from './syncService';
import { networkService } from './networkService';
import { syncErrorHandler } from './syncErrorHandler';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Constants ────────────────────────────────────────────────────────────

const SYNC_INTERVAL_MS = 30 * 1000; // 30 seconds
const LAST_SYNC_KEY = 'lastBackgroundSync';
const SYNC_COUNT_KEY = 'backgroundSyncCount';

// ─── Types ────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

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
  errorCount: number;
  pendingRetries: number;
}

interface SyncListener {
  id: string;
  callback: (statusInfo: SyncStatusInfo) => void;
}

// ─── Enhanced Background Sync Service ─────────────────────────────────────

class EnhancedBackgroundSyncService {
  private intervalId: NodeJS.Timeout | null = null;
  private appStateSubscription: any = null;
  private currentStatus: SyncStatus = 'idle';
  private lastSyncTime: Date | null = null;
  private lastSyncResult: any = null;
  private error: string | null = null;
  private syncCount = 0;
  private listeners: SyncListener[] = [];
  private isInitialized = false;

  /**
   * Initialize background sync with error handling
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ Background sync already initialized');
      return;
    }

    console.log('🔄 Initializing background sync with error handling...');

    // Initialize error handler
    await syncErrorHandler.initialize();

    // Load previous sync data
    await this.loadSyncData();

    // Set up periodic sync
    this.startPeriodicSync();

    // Set up app state listener
    this.setupAppStateListener();

    this.isInitialized = true;

    console.log('✓ Background sync initialized with error handling');
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    console.log('🛑 Cleaning up background sync...');

    this.stopPeriodicSync();

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.isInitialized = false;

    console.log('✓ Background sync cleaned up');
  }

  /**
   * Load sync data
   */
  private async loadSyncData(): Promise<void> {
    try {
      const lastSyncStr = await AsyncStorage.getItem(LAST_SYNC_KEY);
      if (lastSyncStr) {
        this.lastSyncTime = new Date(lastSyncStr);
      }

      const syncCountStr = await AsyncStorage.getItem(SYNC_COUNT_KEY);
      if (syncCountStr) {
        this.syncCount = parseInt(syncCountStr, 10);
      }
    } catch (error) {
      console.error('Failed to load sync data:', error);
    }
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    if (this.intervalId) return;

    console.log(`🔁 Starting periodic sync (every ${SYNC_INTERVAL_MS / 1000}s)`);

    // Initial sync
    this.performBackgroundSync('periodic_initial');

    // Set up interval
    this.intervalId = setInterval(() => {
      this.performBackgroundSync('periodic_interval');
    }, SYNC_INTERVAL_MS);
  }

  /**
   * Stop periodic sync
   */
  private stopPeriodicSync(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Periodic sync stopped');
    }
  }

  /**
   * Set up app state listener
   */
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          console.log('✅ App foregrounded - triggering sync');
          this.performBackgroundSync('app_foreground');

          if (!this.intervalId) {
            this.startPeriodicSync();
          }
        }
      }
    );
  }

  /**
   * Perform background sync with error handling
   */
  private async performBackgroundSync(trigger: string): Promise<void> {
    // Skip if already syncing
    if (this.currentStatus === 'syncing') {
      console.log('⏭️ Sync already in progress, skipping');
      return;
    }

    // Check if online
    const isOnline = await networkService.isOnline();
    if (!isOnline) {
      console.log('⚠️ Device offline, skipping background sync');
      this.updateStatus('offline', null);
      return;
    }

    console.log(`🔄 Background sync triggered by: ${trigger}`);

    // Update status to syncing
    this.updateStatus('syncing', null);

    try {
      // Perform sync
      const result = await syncService.sync();

      // Update sync data
      this.lastSyncTime = new Date();
      this.lastSyncResult = {
        pushed: result.pushed,
        pulled: result.pulled,
        conflicts: result.conflicts.length,
      };
      this.syncCount++;
      this.error = null;

      // Save to storage
      await AsyncStorage.setItem(LAST_SYNC_KEY, this.lastSyncTime.toISOString());
      await AsyncStorage.setItem(SYNC_COUNT_KEY, this.syncCount.toString());

      // Update status to synced
      this.updateStatus('synced', null);

      console.log(
        `✓ Background sync complete: ` +
        `Pushed ${result.pushed}, Pulled ${result.pulled}, ` +
        `Conflicts ${result.conflicts.length}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error('❌ Background sync failed:', errorMessage);

      // Handle error with retry logic
      await syncErrorHandler.handleError('full_sync', error);

      // Update status
      this.error = errorMessage;
      this.updateStatus('error', errorMessage);
    }
  }

  /**
   * Update status and notify listeners
   */
  private updateStatus(status: SyncStatus, error: string | null): void {
    this.currentStatus = status;
    this.error = error;
    this.notifyListeners();
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const statusInfo = this.getStatusInfo();

    this.listeners.forEach(listener => {
      try {
        listener.callback(statusInfo);
      } catch (error) {
        console.error('Error in sync status listener:', error);
      }
    });
  }

  /**
   * Get current status info
   */
  getStatusInfo(): SyncStatusInfo {
    const errorStats = syncErrorHandler.getStats();

    return {
      status: this.currentStatus,
      lastSyncTime: this.lastSyncTime,
      lastSyncResult: this.lastSyncResult,
      error: this.error,
      syncCount: this.syncCount,
      errorCount: errorStats.pending,
      pendingRetries: errorStats.retrying,
    };
  }

  /**
   * Get current status
   */
  getStatus(): SyncStatus {
    return this.currentStatus;
  }

  /**
   * Add status listener
   */
  addListener(callback: (statusInfo: SyncStatusInfo) => void): string {
    const id = `listener_${Date.now()}_${Math.random()}`;
    this.listeners.push({ id, callback });
    callback(this.getStatusInfo());
    return id;
  }

  /**
   * Remove status listener
   */
  removeListener(id: string): void {
    this.listeners = this.listeners.filter(listener => listener.id !== id);
  }

  /**
   * Manually trigger sync
   */
  async triggerSync(): Promise<void> {
    console.log('🔄 Manual sync triggered');
    await this.performBackgroundSync('manual_trigger');
  }

  /**
   * Pause periodic sync
   */
  pause(): void {
    console.log('⏸️ Pausing periodic sync');
    this.stopPeriodicSync();
  }

  /**
   * Resume periodic sync
   */
  resume(): void {
    console.log('▶️ Resuming periodic sync');
    this.startPeriodicSync();
  }

  /**
   * Check if sync is active
   */
  isActive(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Get time until next sync
   */
  getTimeUntilNextSync(): number | null {
    if (!this.lastSyncTime || !this.intervalId) return null;

    const timeSinceLastSync = Date.now() - this.lastSyncTime.getTime();
    const timeUntilNext = SYNC_INTERVAL_MS - timeSinceLastSync;

    return timeUntilNext > 0 ? timeUntilNext : 0;
  }

  /**
   * Reset sync count
   */
  async resetSyncCount(): Promise<void> {
    this.syncCount = 0;
    await AsyncStorage.setItem(SYNC_COUNT_KEY, '0');
    this.notifyListeners();
  }
}

// Export singleton instance
export const backgroundSyncService = new EnhancedBackgroundSyncService();
