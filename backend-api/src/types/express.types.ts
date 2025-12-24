import { Request } from 'express';
import { TokenPayload } from './auth.types';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}
