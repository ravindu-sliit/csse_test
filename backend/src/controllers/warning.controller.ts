import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse, paginatedResponse, errorResponse } from '../utils/apiResponse';
import * as warningService from '../services/warning.service';
import { AuthenticatedRequest } from '../types';

export const createWarning = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await warningService.createAndBroadcast(req.body, req.user!.id);
  return successResponse(res, {
    id: result.warning.id,
    warningCode: result.warning.warningCode,
    hazardType: result.warning.hazardType,
    severityLevel: result.warning.severityLevel,
    status: result.warning.status,
    issuedTime: result.warning.issuedTime,
    targetDistricts: result.warning.targetDistricts,
    estimatedReach: result.estimatedReach,
  }, 'Warning created and broadcast initiated', 201);
});

export const getWarnings = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, status, district, hazardType } = req.query;
  const result = await warningService.listWarnings({
    page: page ? parseInt(page as string) : 1,
    limit: limit ? parseInt(limit as string) : 20,
    status: status as string,
    district: district as string,
    hazardType: hazardType as string,
  });
  return paginatedResponse(res, result.warnings, result.meta);
});

export const getWarning = asyncHandler(async (req: Request, res: Response) => {
  const warning = await warningService.getWarningById(req.params.id);
  if (!warning) return errorResponse(res, 404, 'NOT_FOUND', 'Warning not found');
  return successResponse(res, warning);
});

export const getBroadcastStatus = asyncHandler(async (req: Request, res: Response) => {
  const status = await warningService.getBroadcastStatus(req.params.id);
  if (!status) return errorResponse(res, 404, 'NOT_FOUND', 'Warning not found');
  return successResponse(res, status);
});

export const cancelWarning = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const warning = await warningService.cancelWarning(req.params.id, req.body.reason);
  return successResponse(res, warning, 'Warning cancelled');
});

export const escalateWarning = asyncHandler(async (req: Request, res: Response) => {
  const warning = await warningService.escalateWarning(req.params.id, req.body.newSeverityLevel);
  return successResponse(res, warning, 'Warning escalated');
});

export const getDashboardSummary = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await warningService.getDashboardSummary();
  return successResponse(res, summary);
});
