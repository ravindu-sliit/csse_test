/**
 * @file client.ts
 * @description Axios HTTP client configuration with interceptors for auth and error handling.
 *
 * @solid
 * - SRP: This module ONLY configures the HTTP client. Individual API calls are in separate files.
 * - OCP: New interceptors (logging, retry) can be added without modifying existing ones.
 * - DIP: All API modules depend on this abstraction, not raw axios. Allows swapping HTTP library.
 */

import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor for 401 handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      try {
        // Dynamic import to avoid circular dependency
        const { useAuthStore } = await import('@/stores/authStore');
        const newToken = await useAuthStore.getState().refreshAccessToken();
        if (newToken) {
          error.config.headers['Authorization'] = `Bearer ${newToken}`;
          return apiClient(error.config);
        }
      } catch {
        // refresh failed, let error propagate
      }
    }
    return Promise.reject(error);
  }
);