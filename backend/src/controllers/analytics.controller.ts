import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse, paginatedResponse } from '../utils/apiResponse';
import * as analyticsService from '../services/analytics.service';
import * as exportService from '../services/export.service';
import { AuthenticatedRequest } from '../types';

export const getOverview = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getOverviewData(req.query.period as string);
  return successResponse(res, data);
});

export const getShelterAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getShelterAnalytics(req.query.period as string);
  return successResponse(res, data);
});

export const getResourceAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getResourceAnalytics(req.query.period as string);
  return successResponse(res, data);
});

export const getAlertTimeline = asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getAlertTimeline(req.query.period as string);
  return successResponse(res, data);
});

export const generateReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const report = await exportService.generateReport(req.body, req.user!.id);
  return successResponse(res, report, 'Report generated successfully', 201);
});

export const getReportHistory = asyncHandler(async (req: Request, res: Response) => {
  const result = await exportService.listReports({ page: req.query.page ? parseInt(req.query.page as string) : 1 });
  return paginatedResponse(res, result.reports, result.meta);
});