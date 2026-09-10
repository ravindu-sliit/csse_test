import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { errorResponse } from '../utils/apiResponse';

export function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstError = result.error.errors[0];
      return errorResponse(
        res, 400, 'VALIDATION_ERROR',
        firstError.message,
        firstError.path.join('.')
      );
    }
    req.body = result.data;
    next();
  };
}