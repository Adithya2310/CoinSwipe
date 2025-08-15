/**
 * Error Handling Middleware for CoinSwipe Server
 * 
 * Provides centralized error handling for all Express routes
 * with proper logging and user-friendly error responses.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Custom Error Class with Status Code
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Main Error Handling Middleware
 * 
 * Catches all errors in Express routes and provides
 * consistent error responses to clients.
 * 
 * @param error - Error object
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Default error values
  let statusCode = 500;
  let message = 'Internal Server Error';
  let isOperational = false;

  // Check if it's our custom AppError
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    isOperational = error.isOperational;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (error.message) {
    message = error.message;
  }

  // Log error details
  const errorInfo = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    statusCode,
    message,
    isOperational
  };

  if (statusCode >= 500) {
    logger.error('❌ Server Error:', errorInfo, error.stack);
  } else {
    logger.warn('⚠️  Client Error:', errorInfo);
  }

  // Prepare error response
  const errorResponse: any = {
    error: true,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
    errorResponse.details = {
      name: error.name,
      isOperational,
      method: req.method,
      headers: req.headers
    };
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
}

/**
 * Async Error Handler Wrapper
 * 
 * Wraps async route handlers to catch errors and pass
 * them to the error handling middleware.
 * 
 * @param fn - Async function to wrap
 * @returns Wrapped function that catches errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found Handler
 * 
 * Handles requests to non-existent endpoints
 * 
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
}
