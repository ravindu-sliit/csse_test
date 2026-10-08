import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse, paginatedResponse, errorResponse } from '../utils/apiResponse';
import * as shelterService from '../services/shelter.service';
import { AuthenticatedRequest } from '../types';

export const createShelter = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const shelter = await shelterService.createShelter(req.body, req.user!.id);
  return successResponse(res, shelter, 'Shelter registered', 201);
});

export const getShelters = asyncHandler(async (req: Request, res: Response) => {
  const { district, status, page, limit } = req.query;
  const result = await shelterService.listShelters({ district: district as string, status: status as string, page: page ? parseInt(page as string) : 1, limit: limit ? parseInt(limit as string) : 50 });
  return paginatedResponse(res, result.shelters, result.meta);
});

export const getShelter = asyncHandler(async (req: Request, res: Response) => {
  const shelter = await shelterService.getShelterById(req.params.id);
  if (!shelter) return errorResponse(res, 404, 'NOT_FOUND', 'Shelter not found');
  return successResponse(res, shelter);
});

export const updateOccupancy = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const [shelter] = await shelterService.updateOccupancy(req.params.id, req.body.newOccupancy, req.user!.id) as [{ id: string; currentOccupancy: number; status: string }, unknown];
  return successResponse(res, shelter, 'Occupancy updated');
});

export const deleteShelter = asyncHandler(async (req: Request, res: Response) => {
  await shelterService.deleteShelter(req.params.id);
  return successResponse(res, { id: req.params.id }, 'Shelter deleted');
});

export const getSheltersSummary = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await shelterService.getSheltersSummary();
  return successResponse(res, summary);
});

export const geocodeShelter = asyncHandler(async (req: Request, res: Response) => {
  const result = await shelterService.geocodeShelterAddress(req.body.address, req.body.district);
  return successResponse(res, result);
});
