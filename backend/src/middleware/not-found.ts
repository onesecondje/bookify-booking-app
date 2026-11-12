import { ApiErrorCode } from '../enums/api-error-code.enum.js';
import type { RequestHandler } from 'express';

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: ApiErrorCode.NotFound,
      message: 'Route not found.',
    },
  });
};
