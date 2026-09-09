import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    district?: string | null;
  };
}

export type UserRole = 'CITIZEN' | 'DMC_OFFICER' | 'DMC_DUTY_OFFICER' | 'DISTRICT_OFFICER' | 'RESCUE_TEAM';