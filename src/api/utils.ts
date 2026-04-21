import { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function parseWithSchema<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
  errorMessage: string
): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, errorMessage, result.error.flatten());
  }

  return result.data;
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}
