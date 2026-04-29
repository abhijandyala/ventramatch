import { z } from "zod";

const serverEnvSchema = z.object({
  /** PostgreSQL connection string (Railway, local Docker, etc.). Omitted for `next build` without a DB. */
  DATABASE_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

let cachedServerEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      "Invalid server environment. Missing or malformed: " +
        parsed.error.issues.map((i) => i.path.join(".")).join(", "),
    );
  }
  cachedServerEnv = parsed.data;
  return parsed.data;
}

export function getClientEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  if (!parsed.success) {
    throw new Error(
      "Invalid client environment. Missing or malformed: " +
        parsed.error.issues.map((i) => i.path.join(".")).join(", "),
    );
  }
  return parsed.data;
}
