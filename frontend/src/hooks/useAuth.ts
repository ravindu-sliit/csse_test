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