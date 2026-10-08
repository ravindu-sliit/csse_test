/**
 * @file validateRequest.ts
 * @description Request body validation middleware using Zod schemas.
 *
 * @solid
 * - SRP: This middleware ONLY validates request body against a schema.
 *        Business logic validation is in services.
 * - OCP: Any Zod schema can be passed without modifying the middleware.
 * - LSP: Returns consistent 400 error format for all validation failures.
 * - DIP: Depends on ZodSchema interface, not specific schema implementations.
 */
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