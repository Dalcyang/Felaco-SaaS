import { Request, Response, NextFunction } from 'express';
import { logger } from '../common/logger';
import { ValidationError } from 'class-validator';
import { HttpError } from 'routing-controllers';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public errors?: any[],
    public stack: string = ''
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errors = errors || [];
    
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(404, message);
  }
}

export class ValidationErrorResponse extends ApiError {
  constructor(errors: ValidationError[]) {
    const formattedErrors = errors.map(error => ({
      property: error.property,
      constraints: error.constraints,
      value: error.value,
    }));
    
    super(400, 'Validation failed', formattedErrors);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super(401, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden') {
    super(403, message);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string = 'Resource already exists') {
    super(409, message);
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = 'Too many requests, please try again later') {
    super(429, message);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error
  logger.error('Error occurred:', {
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      body: req.body,
      ip: req.ip,
      user: (req as any).user || 'anonymous'
    }
  });

  // Handle specific error types
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }

  // Handle class-validator validation errors
  if (Array.isArray(err) && err[0] instanceof ValidationError) {
    const apiError = new ValidationErrorResponse(err);
    return res.status(apiError.statusCode).json({
      success: false,
      message: apiError.message,
      errors: apiError.errors,
      ...(process.env.NODE_ENV === 'development' && { stack: err })
    });
  }

  // Handle routing-controllers errors
  if (err instanceof HttpError) {
    return res.status(err.httpCode).json({
      success: false,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }

  // Handle database errors
  if (err.name === 'QueryFailedError') {
    // Handle specific database errors
    const dbErr = err as any;
    
    // Handle duplicate key errors
    if (dbErr.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Resource already exists',
        ...(process.env.NODE_ENV === 'development' && { error: dbErr.detail })
      });
    }
    
    // Handle foreign key constraint errors
    if (dbErr.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Referenced resource not found',
        ...(process.env.NODE_ENV === 'development' && { error: dbErr.detail })
      });
    }
  }

  // Default error response
  const statusCode = 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message || 'Something went wrong';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { 
      error: err.message,
      stack: err.stack
    })
  });
};

// Wrapper for async/await error handling
export const asyncHandler = (fn: Function) => 
  (req: Request, res: Response, next: NextFunction) => 
    Promise.resolve(fn(req, res, next)).catch(next);

export {
  ApiError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  ValidationErrorResponse as ValidationError
};
