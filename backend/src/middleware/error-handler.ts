import { ApiErrorCode } from '../enums/api-error-code.enum.js';
import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  // A response that has already started cannot be replaced with a JSON error.
  if (res.headersSent) {
    next(error);
    return;
  }

  // Classify body-parser errors without exposing their messages or request bodies.
  const errorType = error instanceof Error && 'type' in error ? error.type : undefined;

  if (errorType === 'entity.parse.failed') {
    res.status(400).json({
      error: { code: ApiErrorCode.InvalidJson, message: 'Request body must contain valid JSON.' },
    });
    return;
  }

  if (errorType === 'entity.too.large') {
    res.status(413).json({
      error: {
        code: ApiErrorCode.PayloadTooLarge,
        message: 'Request body exceeds the 100kb limit.',
      },
    });
    return;
  }

  if (errorType === 'charset.unsupported' || errorType === 'encoding.unsupported') {
    res.status(415).json({
      error: {
        code: ApiErrorCode.UnsupportedMediaType,
        message: 'Request body encoding is not supported.',
      },
    });
    return;
  }

  // Prisma and driver error details can contain SQL parameters and connection data.
  console.error('Unhandled request error.');

  res.status(500).json({
    error: { code: ApiErrorCode.InternalServerError, message: 'An unexpected error occurred.' },
  });
};
