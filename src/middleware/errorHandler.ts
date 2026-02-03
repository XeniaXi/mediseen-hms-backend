import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

interface ErrorResponse {
  error: string;
  message?: string;
  details?: unknown;
  stack?: string;
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', err);

  const isDevelopment = process.env.NODE_ENV === 'development';

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const response: ErrorResponse = {
      error: 'Database error',
      message: err.message,
    };

    // Unique constraint violation
    if (err.code === 'P2002') {
      res.status(409).json({
        error: 'Duplicate entry',
        message: `A record with this ${(err.meta?.target as string[])?.join(', ')} already exists`,
      });
      return;
    }

    // Record not found
    if (err.code === 'P2025') {
      res.status(404).json({
        error: 'Record not found',
        message: err.message,
      });
      return;
    }

    res.status(400).json(response);
    return;
  }

  // Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      error: 'Validation error',
      message: 'Invalid data provided',
      details: isDevelopment ? err.message : undefined,
    });
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: 'Invalid token',
      message: err.message,
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      error: 'Token expired',
      message: 'Please login again',
    });
    return;
  }

  // Default error response
  const response: ErrorResponse = {
    error: 'Internal server error',
    message: isDevelopment ? err.message : 'Something went wrong',
  };

  if (isDevelopment) {
    response.stack = err.stack;
  }

  res.status(500).json(response);
};
