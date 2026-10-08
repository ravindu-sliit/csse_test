import { z } from 'zod';

export const createShelterSchema = z.object({
  name: z.string().min(3),
  address: z.string().min(5),
  district: z.string().min(1),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  capacity: z.number().int().positive(),
  contactNumber: z.string().optional(),
  amenities: z.array(z.string()).default([]),
});

export const updateOccupancySchema = z.object({
  newOccupancy: z.number().int().min(0),
});

export const updateShelterStatusSchema = z.object({
  status: z.enum(['OPEN', 'FULL', 'CLOSED']),
});

export const dispatchTeamSchema = z.object({
  teamId: z.string().min(1),
  targetDistrict: z.string().min(1),
  missionDetails: z.string().optional(),
  criticality: z.enum(['HIGH', 'MEDIUM', 'ROUTINE']).default('ROUTINE'),
  gearChecklist: z.array(z.string()).default([]),
});

export const createSupplySchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  location: z.string().min(1),
  organizationId: z.string().optional(),
});

export const createSupplyDispatchSchema = z.object({
  supplyId: z.string().min(1),
  shelterId: z.string().optional(),
  destinationLabel: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
});

export const updateTransitStatusSchema = z.object({
  transitStatus: z.enum(['PREPARING', 'IN_TRANSIT', 'DELIVERED']),
});

export const geocodeShelterSchema = z.object({
  address: z.string().min(5).max(300),
  district: z.string().min(1).max(100),
});
