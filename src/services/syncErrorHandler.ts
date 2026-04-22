// src/services/syncErrorHandler.ts
// Sync error handling with exponential backoff and retry logic

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Constants ────────────────────────────────────────────────────────────

const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 60000; // 60 seconds
const RETRY_QUEUE_KEY = 'syncRetryQueue';

// ─── Types ────────────────────────────────────────────────────────────────

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SyncError {
  id: string;
  timestamp: Date;
  operation: 'push' | 'pull' | 'full_sync';
  error: Error;
  httpStatus?: number;
  severity: ErrorSeverity;
  retryCount: number;
  nextRetryAt: Date | null;
  itemId?: string;
  resolved: boolean;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

interface UserFriendlyError {
  title: string;
  message: string;
  action?: string;
  severity: ErrorSeverity;
}

// ─── Sync Error Handler ───────────────────────────────────────────────────

class SyncErrorHandler {
  private errors: SyncError[] = [];
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private retryConfig: RetryConfig = {
    maxAttempts: MAX_RETRY_ATTEMPTS,
    initialDelay: INITIAL_RETRY_DELAY,
    maxDelay: MAX_RETRY_DELAY,
    backoffMultiplier: 2,
  };

  /**
   * Initialize error handler
   */
  async initialize(): Promise<void> {
    // Load previous errors
    await this.loadErrors();
    
    // Schedule retries for pending errors
    this.scheduleRetries();
    
    console.log('✓ Sync error handler initialized');
  }

  /**
   * Handle sync error
   */
  async handleError(
    operation: 'push' | 'pull' | 'full_sync',
    error: Error | any,
    itemId?: string
  ): Promise<SyncError> {
    console.error(`❌ Sync error (${operation}):`, error);

    // Extract HTTP status if available
    const httpStatus = error?.response?.status || error?.status;

    // Determine severity
    const severity = this.determineSeverity(error, httpStatus);

    // Create error record
    const syncError: SyncError = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      operation,
      error: error instanceof Error ? error : new Error(String(error)),
      httpStatus,
      severity,
      retryCount: 0,
      nextRetryAt: null,
      itemId,
      resolved: false,
    };

    // Add to error list
    this.errors.push(syncError);

    // Save to storage
    await this.saveErrors();

    // Schedule retry if appropriate
    if (this.shouldRetry(syncError)) {
      await this.scheduleRetry(syncError);
    }

    return syncError;
  }

  /**
   * Determine error severity
   */
  private determineSeverity(
    error: any,
    httpStatus?: number
  ): ErrorSeverity {
    // Critical: Authentication or authorization errors
    if (httpStatus === 401 || httpStatus === 403) {
      return 'critical';
    }

    // High: Server errors that might persist
    if (httpStatus && httpStatus >= 500) {
      return 'high';
    }

    // Medium: Client errors
    if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
      return 'medium';
    }

    // Low: Network errors (likely temporary)
    if (
      error.message?.includes('Network') ||
      error.message?.includes('timeout') ||
      error.code === 'ECONNABORTED'
    ) {
      return 'low';
    }

    // Default: Medium
    return 'medium';
  }

  /**
   * Check if error should be retried
   */
  private shouldRetry(error: SyncError): boolean {
    // Don't retry critical errors (auth issues)
    if (error.severity === 'critical') {
      return false;
    }

    // Don't retry client errors (400-499) except 429 (rate limit)
    if (
      error.httpStatus &&
      error.httpStatus >= 400 &&
      error.httpStatus < 500 &&
      error.httpStatus !== 429
    ) {
      return false;
    }

    // Don't retry if max attempts reached
    if (error.retryCount >= this.retryConfig.maxAttempts) {
      return false;
    }

    return true;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const delay = Math.min(
      this.retryConfig.initialDelay *
        Math.pow(this.retryConfig.backoffMultiplier, retryCount),
      this.retryConfig.maxDelay
    );

    // Add jitter (±25%)
    const jitter = delay * 0.25;
    const randomJitter = Math.random() * jitter * 2 - jitter;

    return Math.floor(delay + randomJitter);
  }

  /**
   * Schedule retry for an error
   */
  async scheduleRetry(error: SyncError): Promise<void> {
    const delay = this.calculateRetryDelay(error.retryCount);
    const nextRetryAt = new Date(Date.now() + delay);

    error.nextRetryAt = nextRetryAt;

    console.log(
      `⏱️ Scheduling retry for ${error.id} in ${Math.floor(delay / 1000)}s ` +
      `(attempt ${error.retryCount + 1}/${this.retryConfig.maxAttempts})`
    );

    // Clear existing timeout if any
    const existingTimeout = this.retryTimeouts.get(error.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule new timeout
    const timeout = setTimeout(async () => {
      await this.retryError(error);
    }, delay);

    this.retryTimeouts.set(error.id, timeout);

    await this.saveErrors();
  }

  /**
   * Retry a failed sync
   */
  private async retryError(error: SyncError): Promise<void> {
    console.log(`🔄 Retrying sync (${error.operation}) - Attempt ${error.retryCount + 1}`);

    error.retryCount++;
    error.nextRetryAt = null;

    // Remove timeout
    this.retryTimeouts.delete(error.id);

    try {
      // Import here to avoid circular dependency
      const { syncService } = await import('./syncService');

      // Retry the operation
      await syncService.sync();

      // Mark as resolved
      error.resolved = true;
      
      console.log(`✅ Retry successful for ${error.id}`);

      await this.saveErrors();
    } catch (retryError) {
      console.error(`❌ Retry failed for ${error.id}:`, retryError);

      // Schedule another retry if appropriate
      if (this.shouldRetry(error)) {
        await this.scheduleRetry(error);
      } else {
        console.log(`⛔ Max retries reached for ${error.id}`);
        await this.saveErrors();
      }
    }
  }

  /**
   * Schedule retries for all pending errors
   */
  private scheduleRetries(): void {
    const pendingErrors = this.errors.filter(
      error => !error.resolved && this.shouldRetry(error)
    );

    pendingErrors.forEach(error => {
      this.scheduleRetry(error);
    });

    if (pendingErrors.length > 0) {
      console.log(`📋 Scheduled ${pendingErrors.length} pending retries`);
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyError(error: SyncError): UserFriendlyError {
    const httpStatus = error.httpStatus;

    // Authentication errors
    if (httpStatus === 401) {
      return {
        title: 'Session Expired',
        message: 'Please log in again to continue syncing.',
        action: 'Log In',
        severity: 'critical',
      };
    }

    // Authorization errors
    if (httpStatus === 403) {
      return {
        title: 'Access Denied',
        message: 'You don\'t have permission to sync this data.',
        severity: 'critical',
      };
    }

    // Rate limiting
    if (httpStatus === 429) {
      return {
        title: 'Too Many Requests',
        message: 'Sync is temporarily paused. Will retry automatically.',
        severity: 'medium',
      };
    }

    // Server errors
    if (httpStatus && httpStatus >= 500) {
      return {
        title: 'Server Error',
        message: 'The server is having issues. Your changes are saved locally and will sync automatically when the server recovers.',
        action: 'Retry Now',
        severity: 'high',
      };
    }

    // Client errors
    if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
      return {
        title: 'Sync Failed',
        message: 'Unable to sync some changes. Please try again.',
        action: 'Retry Now',
        severity: 'medium',
      };
    }

    // Network errors
    if (
      error.error.message?.includes('Network') ||
      error.error.message?.includes('timeout')
    ) {
      return {
        title: 'Connection Issue',
        message: 'Unable to reach the server. Will retry automatically when connection improves.',
        severity: 'low',
      };
    }

    // Unknown errors
    return {
      title: 'Sync Error',
      message: 'Something went wrong. Your changes are saved locally and will sync automatically.',
      action: 'Retry Now',
      severity: 'medium',
    };
  }

  /**
   * Get all errors
   */
  getErrors(): SyncError[] {
    return this.errors;
  }

  /**
   * Get unresolved errors
   */
  getUnresolvedErrors(): SyncError[] {
    return this.errors.filter(error => !error.resolved);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity): SyncError[] {
    return this.errors.filter(error => error.severity === severity);
  }

  /**
   * Clear resolved errors
   */
  async clearResolvedErrors(): Promise<void> {
    this.errors = this.errors.filter(error => !error.resolved);
    await this.saveErrors();
  }

  /**
   * Clear all errors
   */
  async clearAllErrors(): Promise<void> {
    // Clear all retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();

    // Clear errors
    this.errors = [];
    await this.saveErrors();
  }

  /**
   * Manually retry an error
   */
  async manualRetry(errorId: string): Promise<void> {
    const error = this.errors.find(e => e.id === errorId);
    
    if (!error) {
      throw new Error(`Error ${errorId} not found`);
    }

    await this.retryError(error);
  }

  /**
   * Save errors to storage
   */
  private async saveErrors(): Promise<void> {
    try {
      const data = JSON.stringify(
        this.errors.map(error => ({
          ...error,
          timestamp: error.timestamp.toISOString(),
          nextRetryAt: error.nextRetryAt?.toISOString() || null,
          error: {
            message: error.error.message,
            stack: error.error.stack,
          },
        }))
      );

      await AsyncStorage.setItem(RETRY_QUEUE_KEY, data);
    } catch (error) {
      console.error('Failed to save errors:', error);
    }
  }

  /**
   * Load errors from storage
   */
  private async loadErrors(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(RETRY_QUEUE_KEY);
      
      if (!data) return;

      const parsed = JSON.parse(data);
      
      this.errors = parsed.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp),
        nextRetryAt: item.nextRetryAt ? new Date(item.nextRetryAt) : null,
        error: new Error(item.error.message),
      }));

      console.log(`📂 Loaded ${this.errors.length} error(s) from storage`);
    } catch (error) {
      console.error('Failed to load errors:', error);
    }
  }

  /**
   * Get retry statistics
   */
  getStats(): {
    total: number;
    resolved: number;
    pending: number;
    critical: number;
    highSeverity: number;
    retrying: number;
  } {
    const total = this.errors.length;
    const resolved = this.errors.filter(e => e.resolved).length;
    const pending = total - resolved;
    const critical = this.errors.filter(e => e.severity === 'critical' && !e.resolved).length;
    const highSeverity = this.errors.filter(e => e.severity === 'high' && !e.resolved).length;
    const retrying = this.retryTimeouts.size;

    return {
      total,
      resolved,
      pending,
      critical,
      highSeverity,
      retrying,
    };
  }
}

// Export singleton instance
export const syncErrorHandler = new SyncErrorHandler();
