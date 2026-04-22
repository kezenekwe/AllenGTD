// src/hooks/useCalendarPermission.ts
// React hook for calendar permissions

import { useState, useEffect } from 'react';
import { calendarService, CalendarPermissionStatus } from '../services/calendarService';

// ─── Types ────────────────────────────────────────────────────────────────

interface UseCalendarPermissionReturn {
  status: CalendarPermissionStatus;
  isAuthorized: boolean;
  isLoading: boolean;
  requestPermission: () => Promise<CalendarPermissionStatus>;
  checkPermission: () => Promise<CalendarPermissionStatus>;
  canRequest: boolean;
  needsSettings: boolean;
  message: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useCalendarPermission(): UseCalendarPermissionReturn {
  const [status, setStatus] = useState<CalendarPermissionStatus>('undetermined');
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Check permission on mount
   */
  useEffect(() => {
    checkPermission();
  }, []);

  /**
   * Check current permission status
   */
  const checkPermission = async (): Promise<CalendarPermissionStatus> => {
    setIsLoading(true);
    
    try {
      const newStatus = await calendarService.checkPermission();
      setStatus(newStatus);
      return newStatus;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Request calendar permission
   */
  const requestPermission = async (): Promise<CalendarPermissionStatus> => {
    setIsLoading(true);

    try {
      const newStatus = await calendarService.requestPermission();
      setStatus(newStatus);
      return newStatus;
    } finally {
      setIsLoading(false);
    }
  };

  const permissionInfo = calendarService.getPermissionInfo();

  return {
    status,
    isAuthorized: status === 'authorized',
    isLoading,
    requestPermission,
    checkPermission,
    canRequest: permissionInfo.canRequest,
    needsSettings: permissionInfo.needsSettings,
    message: permissionInfo.message,
  };
}
