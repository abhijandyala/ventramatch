/**
 * Run a single SQL file against DATABASE_URL (postgres-js).
 * Usage: DATABASE_URL=... node scripts/apply-migration.mjs db/migrations/0002_auth_schema.sql
 * On Railway, use the service shell or a public/proxy DB URL (not *.railway.internal from your laptop).
 */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-migration.mjs <path-to.sql>");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const path = resolve(cwd(), file);
const sql = readFileSync(path, "utf8");
const db = postgres(url, { max: 1, connect_timeout: 20 });

try {
  await db.unsafe(sql);
  console.log("OK:", file);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await db.end();
}
