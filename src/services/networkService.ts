// src/services/networkService.ts
// Network detection service with auto-sync on connection

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { syncService } from './syncService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Constants ────────────────────────────────────────────────────────────

const LAST_ONLINE_KEY = 'lastOnlineTime';
const OFFLINE_DURATION_KEY = 'offlineDuration';

// ─── Types ────────────────────────────────────────────────────────────────

interface NetworkStatus {
  isConnected: boolean;
  type: string | null;
  isInternetReachable: boolean | null;
  details: any;
}

interface NetworkListener {
  id: string;
  callback: (status: NetworkStatus) => void;
}

// ─── Network Service ──────────────────────────────────────────────────────

class NetworkService {
  private listeners: NetworkListener[] = [];
  private currentStatus: NetworkStatus | null = null;
  private unsubscribe: (() => void) | null = null;
  private wasOffline = false;
  private offlineSince: Date | null = null;

  /**
   * Initialize network monitoring
   */
  async initialize(): Promise<void> {
    console.log('🌐 Initializing network service...');

    // Get initial state
    const state = await NetInfo.fetch();
    this.updateStatus(state);

    // Subscribe to network changes
    this.unsubscribe = NetInfo.addEventListener(state => {
      this.handleNetworkChange(state);
    });

    console.log('✓ Network service initialized');
  }

  /**
   * Cleanup network monitoring
   */
  cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.listeners = [];
    console.log('Network service cleaned up');
  }

  /**
   * Handle network state changes
   */
  private async handleNetworkChange(state: NetInfoState): Promise<void> {
    const wasConnected = this.currentStatus?.isConnected ?? false;
    const isConnected = state.isConnected ?? false;

    console.log(
      `📡 Network changed: ${wasConnected ? 'Online' : 'Offline'} → ${isConnected ? 'Online' : 'Offline'}`
    );

    // Update status
    this.updateStatus(state);

    // Detect offline → online transition
    if (!wasConnected && isConnected) {
      await this.handleOnlineTransition();
    }

    // Detect online → offline transition
    if (wasConnected && !isConnected) {
      this.handleOfflineTransition();
    }

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Handle transition from offline to online
   */
  private async handleOnlineTransition(): Promise<void> {
    console.log('✅ Device came online!');

    // Calculate offline duration
    if (this.offlineSince) {
      const offlineDuration = Date.now() - this.offlineSince.getTime();
      const minutes = Math.floor(offlineDuration / 1000 / 60);
      
      console.log(`📊 Was offline for ${minutes} minute(s)`);
      
      await AsyncStorage.setItem(
        OFFLINE_DURATION_KEY,
        offlineDuration.toString()
      );
    }

    // Save online time
    await AsyncStorage.setItem(LAST_ONLINE_KEY, new Date().toISOString());

    // Reset offline tracking
    this.wasOffline = false;
    this.offlineSince = null;

    // Auto-sync when coming online
    console.log('🔄 Triggering auto-sync...');
    
    try {
      const result = await syncService.sync();
      
      console.log(
        `✓ Auto-sync complete: Pushed ${result.pushed}, Pulled ${result.pulled}`
      );
      
      if (result.conflicts.length > 0) {
        console.log(`⚠️ Resolved ${result.conflicts.length} conflict(s)`);
      }
    } catch (error) {
      console.error('Auto-sync failed:', error);
    }
  }

  /**
   * Handle transition from online to offline
   */
  private handleOfflineTransition(): void {
    console.log('⚠️ Device went offline');
    
    this.wasOffline = true;
    this.offlineSince = new Date();
    
    console.log('💾 Offline mode: Changes will be saved locally');
  }

  /**
   * Update current network status
   */
  private updateStatus(state: NetInfoState): void {
    this.currentStatus = {
      isConnected: state.isConnected ?? false,
      type: state.type,
      isInternetReachable: state.isInternetReachable,
      details: state.details,
    };
  }

  /**
   * Get current network status
   */
  async getStatus(): Promise<NetworkStatus> {
    if (!this.currentStatus) {
      const state = await NetInfo.fetch();
      this.updateStatus(state);
    }
    
    return this.currentStatus!;
  }

  /**
   * Check if device is online
   */
  async isOnline(): Promise<boolean> {
    const status = await this.getStatus();
    return status.isConnected && (status.isInternetReachable ?? true);
  }

  /**
   * Check if device is offline
   */
  async isOffline(): Promise<boolean> {
    return !(await this.isOnline());
  }

  /**
   * Get offline duration (if currently offline)
   */
  getOfflineDuration(): number | null {
    if (!this.offlineSince) return null;
    return Date.now() - this.offlineSince.getTime();
  }

  /**
   * Get last online time
   */
  async getLastOnlineTime(): Promise<Date | null> {
    const timestamp = await AsyncStorage.getItem(LAST_ONLINE_KEY);
    return timestamp ? new Date(timestamp) : null;
  }

  /**
   * Add network status listener
   */
  addListener(callback: (status: NetworkStatus) => void): string {
    const id = `listener_${Date.now()}_${Math.random()}`;
    
    this.listeners.push({ id, callback });
    
    // Immediately call with current status
    if (this.currentStatus) {
      callback(this.currentStatus);
    }
    
    return id;
  }

  /**
   * Remove network status listener
   */
  removeListener(id: string): void {
    this.listeners = this.listeners.filter(listener => listener.id !== id);
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(): void {
    if (!this.currentStatus) return;
    
    this.listeners.forEach(listener => {
      try {
        listener.callback(this.currentStatus!);
      } catch (error) {
        console.error('Error in network listener:', error);
      }
    });
  }

  /**
   * Force sync check (for testing)
   */
  async forceSyncCheck(): Promise<void> {
    const isOnline = await this.isOnline();
    
    if (isOnline) {
      console.log('🔄 Force sync check: Device is online, syncing...');
      await syncService.sync();
    } else {
      console.log('⚠️ Force sync check: Device is offline, skipping');
    }
  }

  /**
   * Get network statistics
   */
  async getStats(): Promise<{
    isOnline: boolean;
    connectionType: string | null;
    offlineDuration: number | null;
    lastOnlineTime: Date | null;
  }> {
    const status = await this.getStatus();
    const lastOnlineTime = await this.getLastOnlineTime();
    
    return {
      isOnline: status.isConnected,
      connectionType: status.type,
      offlineDuration: this.getOfflineDuration(),
      lastOnlineTime,
    };
  }
}

// Export singleton instance
export const networkService = new NetworkService();
