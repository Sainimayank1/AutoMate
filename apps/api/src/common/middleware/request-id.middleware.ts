import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { REQUEST_ID_HEADER } from "../constants/http.constants";

/** Accept a caller's correlation id only if it is short and plain; otherwise mint one. */
const SAFE_REQUEST_ID = /^[\w-]{1,128}$/;

/**
 * Registered first (before body parsing) so every response, including body-parser errors,
 * carries the id. pino-http reuses `req.id`, so logs and responses always agree.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const id =
    typeof incoming === "string" && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
