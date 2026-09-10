import { Response } from 'express';

export function successResponse(res: Response, data: unknown, message?: string, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data, message });
}

export function paginatedResponse(
  res: Response,
  data: unknown[],
  meta: { total: number; page: number; limit: number; totalPages: number }
) {
  return res.status(200).json({ success: true, data, meta });
}

export function errorResponse(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  field?: string
) {
  return res.status(statusCode).json({ success: false, error: { code, message, field } });
}