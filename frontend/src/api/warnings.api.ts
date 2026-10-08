import { apiClient } from './client';
import type { Warning } from '@/types';

interface CreateWarningDto {
  hazardType: string;
  severityLevel: string;
  targetDistricts: string[];
  targetRiverBasin?: string;
  message: string;
  broadcastChannels: string[];
  expiryTime?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  sourceReportId?: string;
}

export async function createWarning(dto: CreateWarningDto) {
  const res = await apiClient.post<{ success: boolean; data: Warning & { estimatedReach: number } }>('/warnings', dto);
  return res.data.data;
}

export async function fetchWarnings(params?: { status?: string; district?: string; hazardType?: string; page?: number }) {
  const res = await apiClient.get<{ success: boolean; data: Warning[]; meta: { total: number; page: number; limit: number; totalPages: number } }>('/warnings', { params });
  return res.data;
}

export async function fetchWarning(id: string) {
  const res = await apiClient.get<{ success: boolean; data: Warning }>(`/warnings/${id}`);
  return res.data.data;
}

export async function fetchBroadcastStatus(id: string) {
  const res = await apiClient.get<{ success: boolean; data: unknown }>(`/warnings/${id}/broadcast-status`);
  return res.data.data;
}

export async function cancelWarning(id: string, reason?: string) {
  const res = await apiClient.patch<{ success: boolean; data: Warning }>(`/warnings/${id}/cancel`, { reason });
  return res.data.data;
}

export async function fetchDashboardSummary() {
  const res = await apiClient.get<{ success: boolean; data: { activeWarnings: number; pendingReports: number; openShelters: number; deployedTeams: number } }>('/warnings/dashboard-summary');
  return res.data.data;
}