import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse, errorResponse } from '../utils/apiResponse';
import * as authService from '../services/auth.service';
import { AuthenticatedRequest } from '../types';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  return successResponse(res, result, 'Account created successfully', 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  return successResponse(res, result, 'Login successful');
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const result = await authService.refresh(refreshToken);
  return successResponse(res, result);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) await authService.logout(refreshToken);
  return successResponse(res, null, 'Logged out successfully');
});

export const getMe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = await authService.getMe(req.user!.id);
  if (!user) return errorResponse(res, 404, 'NOT_FOUND', 'User not found');
  return successResponse(res, user);
});