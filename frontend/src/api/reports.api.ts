import { apiClient } from './client';
import type { HazardReport } from '@/types';

export async function submitReportApi(dto: {
  hazardType: string;
  description: string;
  photoUrls: string[];
  gpsLatitude: number;
  gpsLongitude: number;
  district: string;
  locationLabel?: string;
}) {
  const res = await apiClient.post<{ success: boolean; data: HazardReport }>('/reports', dto);
  return res.data.data;
}

export async function uploadPhotosApi(files: File[]): Promise<string[]> {
  const formData = new FormData();
  files.forEach(f => formData.append('photos', f));
  const res = await apiClient.post<{ success: boolean; data: { photoUrls: string[] } }>('/reports/upload-photos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data.photoUrls;
}

export async function fetchReports(params?: { status?: string; district?: string; hazardType?: string; page?: number }) {
  const res = await apiClient.get<{ success: boolean; data: HazardReport[]; meta: { total: number; page: number; limit: number; totalPages: number } }>('/reports', { params });
  return res.data;
}

export async function fetchReport(id: string) {
  const res = await apiClient.get<{ success: boolean; data: HazardReport }>(`/reports/${id}`);
  return res.data.data;
}

export async function fetchMyReports() {
  const res = await apiClient.get<{ success: boolean; data: HazardReport[] }>('/reports/my-reports');
  return res.data.data;
}

export async function verifyReportApi(id: string, dto: { severityEstimate?: string; officerNotes?: string }) {
  const res = await apiClient.patch<{ success: boolean; data: HazardReport }>(`/reports/${id}/verify`, dto);
  return res.data.data;
}

export async function rejectReportApi(id: string, rejectionReason?: string) {
  const res = await apiClient.patch<{ success: boolean; data: HazardReport }>(`/reports/${id}/reject`, { rejectionReason });
  return res.data.data;
}