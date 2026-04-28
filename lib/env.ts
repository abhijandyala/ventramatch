import { z } from "zod";

// Server-only env. Read by route handlers, server actions, and proxy/edge code.
// Add new vars here AND to .env.example so they get documented in one place.
const serverEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),

  // Database (Railway Postgres). Optional during early scaffolding so the app
  // still builds before the DB layer is wired in.
  DATABASE_URL: z.string().min(1).optional(),

  // Auth secret. Required once the auth layer lands; optional today.
  AUTH_SECRET: z.string().min(1).optional(),

  // AWS S3 — optional until uploads land.
  AWS_REGION: z.string().min(1).optional(),
  AWS_S3_BUCKET: z.string().min(1).optional(),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),

  // Email (Resend) — optional until email sending lands.
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
});

const clientEnvSchema = serverEnvSchema.pick({
  NEXT_PUBLIC_SITE_URL: true,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

let cachedServerEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      "Invalid server environment. Missing or malformed: " +
        parsed.error.issues.map((i) => i.path.join(".")).join(", "),
    );
  }
  cachedServerEnv = parsed.data;
  return cachedServerEnv;
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
