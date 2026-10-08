import { apiClient } from './client';
import type { Shelter, RescueTeam, ReliefSupply, SupplyDispatch } from '@/types';

export async function fetchShelters(params?: { district?: string; status?: string }) {
  const res = await apiClient.get<{ success: boolean; data: Shelter[]; meta: { total: number; page: number; limit: number; totalPages: number } }>('/shelters', { params });
  return res.data;
}

export async function fetchSheltersSummary() {
  const res = await apiClient.get<{ success: boolean; data: { totalCapacity: number; totalOccupancy: number; availableSpots: number; shelterCount: number } }>('/shelters/summary');
  return res.data.data;
}

export async function createShelterApi(dto: { name: string; address: string; district: string; capacity: number; contactNumber?: string; amenities: string[]; latitude?: number; longitude?: number }) {
  const res = await apiClient.post<{ success: boolean; data: Shelter }>('/shelters', dto);
  return res.data.data;
}

export async function updateOccupancyApi(id: string, newOccupancy: number) {
  const res = await apiClient.patch<{ success: boolean; data: Shelter }>(`/shelters/${id}/occupancy`, { newOccupancy });
  return res.data.data;
}

export async function fetchRescueTeams(params?: { district?: string; status?: string }) {
  const res = await apiClient.get<{ success: boolean; data: RescueTeam[] }>('/rescue-teams', { params });
  return res.data.data;
}

export async function dispatchTeamApi(dto: { teamId: string; targetDistrict: string; missionDetails?: string; criticality: string; gearChecklist: string[] }) {
  const res = await apiClient.post<{ success: boolean; data: { id: string } }>('/dispatches', dto);
  return res.data.data;
}

export async function fetchSupplies(params?: { category?: string }) {
  const res = await apiClient.get<{ success: boolean; data: ReliefSupply[] }>('/supplies', { params });
  return res.data.data;
}

export async function fetchSupplyDispatches(params?: { transitStatus?: string }) {
  const res = await apiClient.get<{ success: boolean; data: SupplyDispatch[]; meta: { total: number; page: number; limit: number; totalPages: number } }>('/supply-dispatches', { params });
  return res.data;
}

export async function createSupplyDispatchApi(dto: { supplyId: string; shelterId?: string; destinationLabel: string; quantity: number; unit: string }) {
  const res = await apiClient.post<{ success: boolean; data: SupplyDispatch }>('/supply-dispatches', dto);
  return res.data.data;
}

export async function updateSupplyTransitApi(id: string, transitStatus: string) {
  const res = await apiClient.patch<{ success: boolean; data: SupplyDispatch }>(`/supply-dispatches/${id}/status`, { transitStatus });
  return res.data.data;
}

export async function fetchCoordinationSummary(district?: string) {
  const res = await apiClient.get<{ success: boolean; data: { teamsDeployed: number; teamsTotal: number; activeShelters: number; supplyHubsActive: number } }>('/coordination-summary', { params: { district } });
  return res.data.data;
}