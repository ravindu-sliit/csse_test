import { apiClient } from './client';

export async function fetchAnalyticsOverview(period: string = '30d') {
  const res = await apiClient.get<{ success: boolean; data: unknown }>('/analytics/overview', { params: { period } });
  return res.data.data;
}

export async function fetchShelterAnalytics(period: string = '30d') {
  const res = await apiClient.get<{ success: boolean; data: unknown }>('/analytics/shelters', { params: { period } });
  return res.data.data;
}

export async function fetchResourceAnalytics(period: string = '30d') {
  const res = await apiClient.get<{ success: boolean; data: unknown }>('/analytics/resources', { params: { period } });
  return res.data.data;
}

export async function fetchAlertTimeline(period: string = '7d') {
  const res = await apiClient.get<{ success: boolean; data: unknown[] }>('/analytics/alert-timeline', { params: { period } });
  return res.data.data;
}

export async function generateReportApi(dto: { templateId: string; title: string; districts: string[]; format: string }) {
  const res = await apiClient.post<{ success: boolean; data: { id: string; fileUrl: string; reportTitle: string; generatedAt: string } }>('/analytics/generate', dto);
  return res.data.data;
}

export async function fetchReportHistory() {
  const res = await apiClient.get<{ success: boolean; data: { id: string; reportTitle: string; exportFormat: string; generatedAt: string; fileUrl: string }[] }>('/analytics/history');
  return res.data.data;
}