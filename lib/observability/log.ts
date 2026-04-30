/**
 * Structured JSON-line logger. Replaces raw console.log in hot paths
 * so Railway logs become queryable (JSON lines → search by userId,
 * requestId, op, level).
 *
 * Usage:
 *   import { log } from "@/lib/observability/log";
 *   log.info("feed:investor", { userId, returned: items.length });
 *   log.warn("deck:upload", "file too large", { bytes: 30_000_000 });
 *   log.error("intro:send", error);
 *
 * All output goes to stdout via console.log — Railway captures it
 * natively. No external logging service needed for v1.
 */

type Level = "info" | "warn" | "error";

function emit(
  level: Level,
  op: string,
  msgOrFields?: string | Record<string, unknown>,
  fields?: Record<string, unknown>,
) {
  const entry: Record<string, unknown> = {
    level,
    ts: new Date().toISOString(),
    op,
  };

  if (typeof msgOrFields === "string") {
    entry.msg = msgOrFields;
    if (fields) Object.assign(entry, fields);
  } else if (msgOrFields) {
    Object.assign(entry, msgOrFields);
  }

  // JSON.stringify is fast enough for our volume. If we ever need
  // streaming perf, swap to pino.
  const line = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    default:
      console.log(line);
  }
}

export const log = {
  info: (op: string, msgOrFields?: string | Record<string, unknown>, fields?: Record<string, unknown>) =>
    emit("info", op, msgOrFields, fields),
  warn: (op: string, msgOrFields?: string | Record<string, unknown>, fields?: Record<string, unknown>) =>
    emit("warn", op, msgOrFields, fields),
  error: (op: string, msgOrErr?: string | Error | Record<string, unknown>, fields?: Record<string, unknown>) => {
    if (msgOrErr instanceof Error) {
      emit("error", op, {
        msg: msgOrErr.message,
        stack: msgOrErr.stack?.split("\n").slice(0, 5).join("\n"),
        ...fields,
      });
    } else {
      emit("error", op, msgOrErr, fields);
    }
  },
};
