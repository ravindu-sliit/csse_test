import { z } from 'zod';

export const submitReportSchema = z.object({
  hazardType: z.enum(['FLOOD', 'LANDSLIDE', 'CYCLONE', 'TSUNAMI', 'DROUGHT', 'LIGHTNING', 'FALLEN_TREE', 'ROAD_BLOCK']),
  description: z.string().min(10, 'Description too short').max(2000),
  photoUrls: z.array(z.string()).max(3).default([]),
  gpsLatitude: z.number().min(-90).max(90),
  gpsLongitude: z.number().min(-180).max(180),
  district: z.string().min(1, 'District is required'),
  locationLabel: z.string().optional(),
});

export const verifyReportSchema = z.object({
  severityEstimate: z.enum(['WATCH', 'ADVISORY', 'WARNING', 'EMERGENCY']).optional(),
  officerNotes: z.string().optional(),
  estimatedHouseholds: z.number().int().positive().optional(),
});

export const rejectReportSchema = z.object({
  rejectionReason: z.string().optional(),
});

export type SubmitReportDto = z.infer<typeof submitReportSchema>;
export type VerifyReportDto = z.infer<typeof verifyReportSchema>;