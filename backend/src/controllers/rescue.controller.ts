import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/apiResponse';
import * as rescueService from '../services/rescue.service';
import { AuthenticatedRequest } from '../types';

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
