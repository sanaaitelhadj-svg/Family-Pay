import { Request, Response, NextFunction } from 'express';
import { FamilyPayError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof FamilyPayError) {
    res.status(err.statusCode).json({ error: err.code, message: err.message });
    return;
  }

  logger.error('Unhandled error', { err: err.message, stack: err.stack, name: err.name });
  // En dev/staging on expose le détail pour faciliter le debug
  const detail = process.env.NODE_ENV !== 'production' ? err.message : 'An unexpected error occurred.';
  res.status(500).json({ error: 'INTERNAL_ERROR', message: detail, _debug: err.message });
}
