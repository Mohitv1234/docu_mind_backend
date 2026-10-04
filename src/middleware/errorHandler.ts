import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);
  const status = typeof error?.statusCode === 'number' ? error.statusCode : 500;
  res.status(status).json({ success: false, message: status === 500 ? 'Internal server error' : error.message });
};
