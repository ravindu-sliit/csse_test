import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse, paginatedResponse, errorResponse } from '../utils/apiResponse';
import * as shelterService from '../services/shelter.service';
import * as rescueService from '../services/rescue.service';
import * as supplyService from '../services/supply.service';
import { AuthenticatedRequest } from '../types';

// SHELTER
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

export const getSheltersSummary = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await shelterService.getSheltersSummary();
  return successResponse(res, summary);
});

// RESCUE TEAMS
export const getTeams = asyncHandler(async (req: Request, res: Response) => {
  const teams = await rescueService.listTeams({ district: req.query.district as string, status: req.query.status as string });
  return successResponse(res, teams);
});

export const dispatchTeam = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const dispatch = await rescueService.dispatchTeam(req.body, req.user!.id);
  return successResponse(res, dispatch, 'Team dispatched', 201);
});

export const updateDispatch = asyncHandler(async (req: Request, res: Response) => {
  const result = await rescueService.updateDispatchStatus(req.params.id, req.body.status);
  return successResponse(res, result, 'Status updated');
});

export const getCoordinationSummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await rescueService.getCoordinationSummary(req.query.district as string);
  return successResponse(res, summary);
});

// SUPPLY
export const getSupplies = asyncHandler(async (req: Request, res: Response) => {
  const supplies = await supplyService.listSupplies({ category: req.query.category as string, status: req.query.status as string });
  return successResponse(res, supplies);
});

export const createSupply = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const supply = await supplyService.createSupply(req.body, req.user!.id);
  return successResponse(res, supply, 'Supply registered', 201);
});

export const getSupplyDispatches = asyncHandler(async (req: Request, res: Response) => {
  const result = await supplyService.listSupplyDispatches({ shelterId: req.query.shelterId as string, transitStatus: req.query.transitStatus as string });
  return paginatedResponse(res, result.dispatches, result.meta);
});

export const createSupplyDispatch = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const dispatch = await supplyService.createDispatch(req.body, req.user!.id);
  return successResponse(res, dispatch, 'Supply dispatch created', 201);
});

export const updateSupplyTransit = asyncHandler(async (req: Request, res: Response) => {
  const dispatch = await supplyService.updateTransitStatus(req.params.id, req.body.transitStatus);
  return successResponse(res, dispatch, 'Transit status updated');
});

export const geocodeShelter = asyncHandler(async (req: Request, res: Response) => {
  const result = await shelterService.geocodeShelterAddress(req.body.address, req.body.district);
  return successResponse(res, result);
});
