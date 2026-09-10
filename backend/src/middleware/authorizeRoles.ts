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