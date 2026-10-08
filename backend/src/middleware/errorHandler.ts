/**
 * @file errorHandler.ts
 * @description Global error handling middleware for consistent API error responses.
 *
 * @solid
 * - SRP: This middleware ONLY formats and sends error responses.
 *        Error throwing is done in services/controllers.
 * - LSP: Handles all error types (known errors, Prisma errors, unknown errors)
 *        and transforms them into consistent { success: false, error: {...} } format.
 * - OCP: New error types can be handled by adding cases without modifying existing logic.
 */
import { Request, Response, NextFunction } from 'express';

interface ServiceError {
  code: string;
  message: string;
  status: number;
}

function isServiceError(err: unknown): err is ServiceError {
  return typeof err === 'object' && err !== null && 'code' in err && 'status' in err;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  if (isServiceError(err)) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message },
  });
}