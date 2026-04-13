// src/services/apiClient.ts
// Axios client for API requests with authentication

import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Configuration ────────────────────────────────────────────────────────

const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api' // Development
  : 'https://your-production-api.com/api'; // Production

// ─── Create Axios Instance ────────────────────────────────────────────────

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request Interceptor (Add Auth Token) ────────────────────────────────

apiClient.interceptors.request.use(
  async config => {
    // Get auth token from storage
    const token = await AsyncStorage.getItem('authToken');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// ─── Response Interceptor (Handle Errors) ─────────────────────────────────

apiClient.interceptors.response.use(
  response => {
    return response;
  },
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      await AsyncStorage.removeItem('authToken');
      // You could dispatch a Redux action or use navigation here
      console.log('Unauthorized - token cleared');
    }

    return Promise.reject(error);
  }
);

// ─── Helper Functions ─────────────────────────────────────────────────────

/**
 * Save auth token
 */
export async function saveAuthToken(token: string): Promise<void> {
  await AsyncStorage.setItem('authToken', token);
}

/**
 * Get auth token
 */
export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem('authToken');
}

/**
 * Clear auth token (logout)
 */
export async function clearAuthToken(): Promise<void> {
  await AsyncStorage.removeItem('authToken');
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getAuthToken();
  return !!token;
}
