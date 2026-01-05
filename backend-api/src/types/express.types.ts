import { Request } from 'express';
import { TokenPayload } from './auth.types';

export interface AuthorizationInfo {
  hasGeographicRestrictions: boolean;
  authorizedAreaIds: string[];
  readOnlyAreaIds: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
  authorizationInfo?: AuthorizationInfo;
}
