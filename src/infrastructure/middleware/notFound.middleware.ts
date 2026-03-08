import { type RequestHandler } from 'express';

import { NotFoundError } from '@/infrastructure/errors/app-error';

export const notFoundMiddleware: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError());
};
