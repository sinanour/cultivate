import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/errors.types';
import { Prisma } from '@prisma/client';
import { ErrorCode, HttpStatus } from '../utils/constants';

export interface ErrorResponse {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

export class ErrorHandlerMiddleware {
  /**
   * Global error handler middleware
   * Catches all errors and formats consistent error responses
   */
  static handle() {
    return (err: Error, _req: Request, res: Response, _next: NextFunction) => {
      // Log error with stack trace
      console.error('Error occurred:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });

      // Handle custom AppError instances
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({
          code: err.code,
          message: err.message,
          details: err.details,
        });
      }

      // Handle Prisma errors
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        return ErrorHandlerMiddleware.handlePrismaError(err, res);
      }

      if (err instanceof Prisma.PrismaClientValidationError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Invalid data provided',
          details: {},
        });
      }

      // Handle generic errors
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
        details: {},
      });
    };
  }

  /**
   * Handle Prisma-specific errors
   */
  private static handlePrismaError(
    err: Prisma.PrismaClientKnownRequestError,
    res: Response
  ): Response {
    switch (err.code) {
      case 'P2002': // Unique constraint violation
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: ErrorCode.DUPLICATE_NAME,
          message: 'A record with this value already exists',
          details: {
            target: err.meta?.target,
          },
        });

      case 'P2003': // Foreign key constraint violation
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: ErrorCode.INVALID_REFERENCE,
          message: 'Referenced record does not exist',
          details: {
            field: err.meta?.field_name,
          },
        });

      case 'P2025': // Record not found
        return res.status(HttpStatus.NOT_FOUND).json({
          code: ErrorCode.NOT_FOUND,
          message: 'Record not found',
          details: {},
        });

      default:
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          code: ErrorCode.INTERNAL_ERROR,
          message: 'A database error occurred',
          details: {
            code: err.code,
          },
        });
    }
  }

  /**
   * 404 Not Found handler for undefined routes
   */
  static notFound() {
    return (_req: Request, res: Response) => {
      res.status(HttpStatus.NOT_FOUND).json({
        code: ErrorCode.NOT_FOUND,
        message: 'Route not found',
        details: {},
      });
    };
  }
}
