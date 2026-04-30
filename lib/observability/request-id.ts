import { cache } from "react";
import { randomUUID } from "node:crypto";

/**
 * Per-request ID. Uses React's `cache()` so the same request always
 * returns the same ID, even across multiple server components / server
 * actions within a single RSC render. No AsyncLocalStorage needed.
 *
 * Thread this into log() calls as a field: log.info("op", { requestId: getRequestId() })
 * so log aggregation can correlate all events from a single page render.
 */
export const getRequestId = cache((): string => randomUUID());
