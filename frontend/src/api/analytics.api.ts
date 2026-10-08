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
  const res = await apiClient.get<{ success: boolean; data: { id: string; reportTitle: string; exportFormat: string; generatedAt: string; fileUrl: string; district: string; hazard?: AnalyticsReportEvent }[] }>('/analytics/reports');
  return res.data.data;
}

export interface AnalyticsReportFilters {
  eventId: string;
  districts: string[];
  startDate: string;
  endDate: string;
  categories: string[];
}

export interface AnalyticsReportEvent {
  id: string;
  description: string;
  type: string;
  startTime: string;
  endTime: string;
}

export async function fetchCompletedReportEvents() {
  const res = await apiClient.get<{ success: boolean; data: AnalyticsReportEvent[] }>('/analytics/reports/events');
  return res.data.data;
}

export async function previewAnalyticsReport(filters: AnalyticsReportFilters) {
  const res = await apiClient.post<{ success: boolean; data: any }>('/analytics/reports/preview', filters);
  return res.data.data;
}

export async function generateAnalyticsReport(filters: AnalyticsReportFilters, format: 'CSV' | 'PDF') {
  const res = await apiClient.post<{ success: boolean; data: { reportId: string; fileUrl: string } }>('/analytics/reports/generate', { ...filters, format });
  return res.data.data;
}

export async function downloadAnalyticsReport(id: string) {
  const res = await apiClient.get(`/analytics/reports/${id}/download`, { responseType: 'blob' });
  return URL.createObjectURL(res.data);
}

export async function deleteAnalyticsReport(id: string) {
  await apiClient.delete(`/analytics/reports/${id}`);
}