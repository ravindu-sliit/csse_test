/**
 * @file authorizeRoles.ts
 * @description Role-based authorization middleware for restricting endpoint access.
 *
 * @solid
 * - SRP: This middleware ONLY checks if user has required role.
 *        Authentication is handled by authenticateToken.ts.
 * - OCP: New roles can be added to UserRole enum without modifying this middleware.
 *        Just pass the new role to authorizeRoles(...) in routes.
 * - LSP: Returns consistent 403 error format for all unauthorized access attempts.
 */
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { errorResponse } from '../utils/apiResponse';

export function authorizeRoles(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return errorResponse(res, 401, 'TOKEN_MISSING', 'Not authenticated');
    if (!roles.includes(req.user.role)) {
      return errorResponse(res, 403, 'FORBIDDEN', `Role '${req.user.role}' is not authorized for this action`);
    }
    next();
  };
}