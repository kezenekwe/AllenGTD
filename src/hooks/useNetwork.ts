// src/hooks/useNetwork.ts
// React hook for network status monitoring

import { useState, useEffect } from 'react';
import { networkService } from '../services/networkService';

// ─── Types ────────────────────────────────────────────────────────────────

interface NetworkStatus {
  isConnected: boolean;
  type: string | null;
  isInternetReachable: boolean | null;
  details: any;
}

interface UseNetworkReturn {
  isOnline: boolean;
  isOffline: boolean;
  connectionType: string | null;
  isInternetReachable: boolean | null;
  status: NetworkStatus | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useNetwork(): UseNetworkReturn {
  const [status, setStatus] = useState<NetworkStatus | null>(null);

  useEffect(() => {
    // Initialize network service
    networkService.initialize();

    // Subscribe to network changes
    const listenerId = networkService.addListener(newStatus => {
      setStatus(newStatus);
    });

    // Get initial status
    networkService.getStatus().then(setStatus);

    // Cleanup
    return () => {
      networkService.removeListener(listenerId);
    };
  }, []);

  return {
    isOnline: status?.isConnected ?? false,
    isOffline: !(status?.isConnected ?? false),
    connectionType: status?.type ?? null,
    isInternetReachable: status?.isInternetReachable ?? null,
    status,
  };
}
