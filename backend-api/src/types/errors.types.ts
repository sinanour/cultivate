export class AppError extends Error {
    constructor(
        public code: string,
        public message: string,
        public statusCode: number,
        public details: Record<string, unknown> = {}
    ) {
        super(message);
        this.name = 'AppError';
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details: Record<string, unknown> = {}) {
        super('VALIDATION_ERROR', message, 400, details);
        this.name = 'ValidationError';
    }
}

export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication failed', details: Record<string, unknown> = {}) {
        super('UNAUTHORIZED', message, 401, details);
        this.name = 'AuthenticationError';
    }
}

export class AuthorizationError extends AppError {
    constructor(message: string = 'Insufficient permissions', details: Record<string, unknown> = {}) {
        super('FORBIDDEN', message, 403, details);
        this.name = 'AuthorizationError';
    }
}

export class NotFoundError extends AppError {
    constructor(message: string, details: Record<string, unknown> = {}) {
        super('NOT_FOUND', message, 404, details);
        this.name = 'NotFoundError';
    }
}

export class ConflictError extends AppError {
    constructor(message: string, details: Record<string, unknown> = {}) {
        super('CONFLICT', message, 409, details);
        this.name = 'ConflictError';
    }
}

export class InternalError extends AppError {
    constructor(message: string = 'Internal server error', details: Record<string, unknown> = {}) {
        super('INTERNAL_ERROR', message, 500, details);
        this.name = 'InternalError';
    }
}
