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
      error: { code: 'INVALID_JSON', message: 'Request body must contain valid JSON.' },
    });
    return;
  }

  if (errorType === 'entity.too.large') {
    res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds the 100kb limit.' },
    });
    return;
  }

  if (errorType === 'charset.unsupported' || errorType === 'encoding.unsupported') {
    res.status(415).json({
      error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Request body encoding is not supported.' },
    });
    return;
  }

  console.error('Unhandled request error:', error instanceof Error ? error.stack : 'Unknown error');

  res.status(500).json({
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
  });
};
