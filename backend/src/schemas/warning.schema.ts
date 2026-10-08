import { z } from 'zod';

export const createWarningSchema = z.object({
  hazardType: z.enum(['FLOOD', 'LANDSLIDE', 'CYCLONE', 'TSUNAMI', 'DROUGHT', 'LIGHTNING', 'FALLEN_TREE', 'ROAD_BLOCK']),
  severityLevel: z.enum(['WATCH', 'ADVISORY', 'WARNING', 'EMERGENCY']),
  targetDistricts: z.array(z.string()).min(1, 'At least one district required'),
  targetRiverBasin: z.string().optional(),
  message: z.string().min(10, 'Message too short').max(300, 'Max 300 characters'),
  broadcastChannels: z.array(z.enum(['SMS_BLAST', 'PUSH_NOTIFICATION', 'TV_RADIO', 'COASTAL_SIREN'])).min(1),
  hazardId: z.string().optional(),
  expiryTime: z.string().datetime().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  locationLabel: z.string().optional(),
  sourceReportId: z.string().optional(),
});

export const cancelWarningSchema = z.object({
  reason: z.string().optional(),
});

export const escalateWarningSchema = z.object({
  newSeverityLevel: z.enum(['WATCH', 'ADVISORY', 'WARNING', 'EMERGENCY']),
  reason: z.string().optional(),
});

export type CreateWarningDto = z.infer<typeof createWarningSchema>;