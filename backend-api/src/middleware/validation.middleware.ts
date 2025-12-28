import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ErrorCode, HttpStatus } from '../utils/constants';

export class ValidationMiddleware {
  /**
   * Middleware to validate request body against a Zod schema
   */
  static validateBody(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        schema.parse(req.body);
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(HttpStatus.BAD_REQUEST).json({
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid request data',
            details: error.errors.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          });
        }
        next(error);
      }
    };
  }

  /**
   * Middleware to validate query parameters against a Zod schema
   */
  static validateQuery(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        schema.parse(req.query);
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(HttpStatus.BAD_REQUEST).json({
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid query parameters',
            details: error.errors.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          });
        }
        next(error);
      }
    };
  }

  /**
   * Middleware to validate path parameters against a Zod schema
   */
  static validateParams(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        schema.parse(req.params);
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(HttpStatus.BAD_REQUEST).json({
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid path parameters',
            details: error.errors.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          });
        }
        next(error);
      }
    };
  }
}
