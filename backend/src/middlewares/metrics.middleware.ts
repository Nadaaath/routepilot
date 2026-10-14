import { NextFunction, Request, Response } from "express";
import {
  httpRequestDurationSeconds,
  httpRequestsTotal,
} from "../lib/metrics";

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (
  req.path === "/metrics" ||
  req.path === "/health" ||
  req.path === "/ready"
) {
  return next();
}

  const endTimer = httpRequestDurationSeconds.startTimer();

  res.on("finish", () => {
    const route =
      req.route?.path
        ? `${req.baseUrl}${req.route.path}`
        : "unmatched";

    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);
    endTimer(labels);
  });

  next();
}