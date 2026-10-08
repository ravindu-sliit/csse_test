import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse, paginatedResponse } from '../utils/apiResponse';
import * as supplyService from '../services/supply.service';
import { AuthenticatedRequest } from '../types';

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
