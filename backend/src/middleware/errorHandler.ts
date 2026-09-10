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