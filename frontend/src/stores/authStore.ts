/**
 * @file authStore.ts
 * @description Zustand store for authentication state management.
 *
 * @solid
 * - SRP: This store ONLY manages auth state (user, tokens, login/logout actions).
 *        API calls are in auth.api.ts, UI is in components.
 * - OCP: New auth methods can be added (setUser, updateProfile) without modifying existing actions.
 * - DIP: Components use useAuth() hook abstraction, not direct store access.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/api/client';
import { loginApi, logoutApi, refreshTokenApi } from '@/api/auth.api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,

      setAuth: (user, accessToken, refreshToken) => {
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        set({ user, accessToken, refreshToken });
      },

      clearAuth: () => {
        delete apiClient.defaults.headers.common['Authorization'];
        set({ user: null, accessToken: null, refreshToken: null });
      },

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const data = await loginApi(email, password);
          get().setAuth(data.user, data.accessToken, data.refreshToken);
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        const rt = get().refreshToken;
        get().clearAuth();
        if (rt) await logoutApi(rt).catch(() => {});
      },

      refreshAccessToken: async () => {
        const rt = get().refreshToken;
        if (!rt) return null;
        try {
          const { accessToken } = await refreshTokenApi(rt);
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          set({ accessToken });
          return accessToken;
        } catch {
          get().clearAuth();
          return null;
        }
      },
    }),
    {
      name: 'dmc-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);