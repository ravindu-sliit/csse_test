/**
 * @file useAuth.ts
 * @description Custom hook providing authentication state and actions to components.
 *
 * @solid
 * - SRP: This hook ONLY exposes auth state and actions. No UI rendering.
 * - DIP: Components depend on this hook interface, not directly on authStore.
 *        Allows changing state management library without updating components.
 */

import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types';

export function useAuth() {
  const { user, accessToken, isLoading, login, logout } = useAuthStore();
  const isAuthenticated = !!user && !!accessToken;

  function hasRole(...roles: UserRole[]): boolean {
    if (!user) return false;
    return roles.includes(user.role);
  }

  function isOfficer(): boolean {
    return hasRole('DMC_OFFICER', 'DMC_DUTY_OFFICER', 'DISTRICT_OFFICER', 'RESCUE_TEAM');
  }

  function isCitizen(): boolean {
    return hasRole('CITIZEN');
  }

  return { user, isLoading, isAuthenticated, login, logout, hasRole, isOfficer, isCitizen };
}