import * as Sentry from "@sentry/nextjs";
import { auth } from "@/auth";

/**
 * Wrap a server action so unhandled errors are captured by Sentry with
 * user context. The action's own error handling (try/catch returning
 * { ok: false }) is unaffected — this only catches truly unexpected throws.
 *
 * Usage:
 *   export const myAction = withErrorReporting("myAction", async (input) => {
 *     // …action body…
 *   });
 */
export function withErrorReporting<TInput, TOutput>(
  actionName: string,
  fn: (input: TInput) => Promise<TOutput>,
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput) => {
    try {
      return await fn(input);
    } catch (error) {
      // Attach user context so the Sentry event is actionable.
      try {
        const session = await auth();
        if (session?.user) {
          Sentry.setUser({
            id: session.user.id,
            email: session.user.email ?? undefined,
          });
        }
      } catch {
        // Auth read failed — still report the original error.
      }

      Sentry.captureException(error, {
        tags: { action: actionName },
        extra: {
          inputKeys: input && typeof input === "object" ? Object.keys(input) : undefined,
        },
      });

      throw error;
    }
  };
}
