import { apiClient } from './client';
import type { User } from '@/types';

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export async function loginApi(email: string, password: string): Promise<AuthResponse> {
  const res = await apiClient.post<{ success: boolean; data: AuthResponse }>('/auth/login', { email, password });
  return res.data.data;
}

export async function registerApi(data: {
  name: string;
  email: string;
  password: string;
  phoneNumber?: string;
  role?: string;
  district?: string;
  nic?: string;
}): Promise<AuthResponse> {
  const res = await apiClient.post<{ success: boolean; data: AuthResponse }>('/auth/register', data);
  return res.data.data;
}

export async function refreshTokenApi(refreshToken: string): Promise<{ accessToken: string }> {
  const res = await apiClient.post<{ success: boolean; data: { accessToken: string } }>('/auth/refresh', { refreshToken });
  return res.data.data;
}

export async function logoutApi(refreshToken: string): Promise<void> {
  await apiClient.post('/auth/logout', { refreshToken });
}

export async function getMeApi(): Promise<User> {
  const res = await apiClient.get<{ success: boolean; data: User }>('/auth/me');
  return res.data.data;
}