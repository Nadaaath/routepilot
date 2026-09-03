import type { NextFunction, Request, Response } from "express";

export type BodyValidator = (body: unknown) => string[];

export function validateBody(validator: BodyValidator) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors = validator(req.body);

    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }

    next();
  };
}
