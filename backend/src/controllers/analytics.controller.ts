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

export const getCompletedEvents = asyncHandler(async (_req: Request, res: Response) => {
  return successResponse(res, await exportService.getCompletedEvents());
});

export const previewAnalyticsReport = asyncHandler(async (req: Request, res: Response) => {
  return successResponse(res, await exportService.previewAnalyticsReport(req.body));
});

export const generateAnalyticsReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { format, ...filters } = req.body;
  if (format !== 'CSV' && format !== 'PDF') {
    return res.status(400).json({ success: false, error: { code: 'INVALID_FORMAT', message: 'Format must be CSV or PDF' } });
  }
  return successResponse(res, await exportService.generateAnalyticsReport(filters, format, req.user!.id), 'Report generated successfully', 201);
});

export const downloadAnalyticsReport = asyncHandler(async (req: Request, res: Response) => {
  const report = await exportService.getReportFile(req.params.id);
  const filePath = report.filePath;
  if (!filePath) return res.status(404).json({ success: false, error: { code: 'REPORT_NOT_FOUND', message: 'Report file not found' } });
  return res.download(filePath, `${report.reportTitle}.${report.exportFormat?.toLowerCase() || 'csv'}`);
});

export const deleteAnalyticsReport = asyncHandler(async (req: Request, res: Response) => {
  return successResponse(res, await exportService.deleteAnalyticsReport(req.params.id), 'Report deleted successfully');
});