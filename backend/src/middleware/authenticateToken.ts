/**
 * @file authenticateToken.ts
 * @description JWT authentication middleware for protecting API routes.
 *
 * @solid
 * - SRP: This middleware ONLY verifies JWT tokens and attaches user to request.
 *        Authorization (role checking) is handled by authorizeRoles.ts.
 * - OCP: Token verification strategy can be extended (e.g., refresh token rotation)
 *        without modifying the core verification logic.
 * - DIP: Uses jwt.verify abstraction, not direct crypto operations.
 */
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '../types';
import { errorResponse } from '../utils/apiResponse';

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) return errorResponse(res, 401, 'TOKEN_MISSING', 'Access token required');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthenticatedRequest['user'];
    req.user = decoded;
    next();
  } catch (err: unknown) {
    const isExpired = err instanceof Error && err.name === 'TokenExpiredError';
    return errorResponse(res, 401, isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID', 'Invalid or expired token');
  }
}