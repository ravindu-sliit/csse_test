import { Request, Response } from 'express';
import path from 'path';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse, paginatedResponse, errorResponse } from '../utils/apiResponse';
import * as reportService from '../services/report.service';
import { AuthenticatedRequest } from '../types';
import { getUploadUrl } from '../config/upload';

export const submitReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const report = await reportService.submitReport(req.body, req.user!.id);
  return successResponse(res, report, 'Report submitted successfully', 201);
});

export const uploadPhotos = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return errorResponse(res, 400, 'NO_FILES', 'No files uploaded');
  }
  const photoUrls = files.map(f => getUploadUrl(f.filename));
  return successResponse(res, { photoUrls });
});

export const getReports = asyncHandler(async (req: Request, res: Response) => {
  const { status, district, hazardType, page, limit } = req.query;
  const result = await reportService.listReports({
    status: status as string,
    district: district as string,
    hazardType: hazardType as string,
    page: page ? parseInt(page as string) : 1,
    limit: limit ? parseInt(limit as string) : 20,
  });
  return paginatedResponse(res, result.reports, result.meta);
});

export const getReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const report = await reportService.getReportById(req.params.id);
  if (!report) return errorResponse(res, 404, 'NOT_FOUND', 'Report not found');
  // Auto-mark under review when officer opens it
  if (req.user?.role !== 'CITIZEN') await reportService.markUnderReview(report.id);
  return successResponse(res, report);
});

export const getMyReports = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const reports = await reportService.getMyReports(req.user!.id);
  return successResponse(res, reports);
});

export const verifyReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const report = await reportService.verifyReport(req.params.id, req.body, req.user!.id);
  return successResponse(res, report, 'Report verified');
});

export const rejectReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const report = await reportService.rejectReport(req.params.id, req.body.rejectionReason, req.user!.id);
  return successResponse(res, report, 'Report rejected');
});