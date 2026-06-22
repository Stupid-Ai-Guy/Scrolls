import "server-only";
import { neon } from "@neondatabase/serverless";

type QueryRow = Record<string, unknown>;
type Args = unknown[];
type NeonClient = {
  query: (text: string, params?: Args) => Promise<QueryRow[]>;
};

declare global {
  // eslint-disable-next-line no-var
  var __eduSql: NeonClient | undefined;
  // eslint-disable-next-line no-var
  var __eduDbInit: Promise<void> | undefined;
}

function makeSql(): NeonClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it via Vercel Storage → Postgres (or set it in .env.local for local dev).",
    );
  }
  // The function itself is also a tagged-template; we only use the .query() method.
  return neon(url) as unknown as NeonClient;
}

// Lazy: only construct the client when the first query actually runs.
// This lets `next build` succeed without DATABASE_URL set.
function sql(text: string, args: Args = []): Promise<QueryRow[]> {
  if (!globalThis.__eduSql) {
    globalThis.__eduSql = makeSql();
  }
  return globalThis.__eduSql.query(text, args);
}

async function ensureColumn(
  table: string,
  column: string,
  definition: string,
) {
  const rows = await sql(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2",
    [table, column],
  );
  if (rows.length === 0) {
    await sql(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function _init(): Promise<void> {
  await sql(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      tier          TEXT NOT NULL DEFAULT 'basic',
      role          TEXT NOT NULL DEFAULT 'user',
      created_at    BIGINT NOT NULL
    )
  `);
  await sql(`
    CREATE TABLE IF NOT EXISTS lessons (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      content     TEXT NOT NULL DEFAULT '',
      grade       INTEGER NOT NULL DEFAULT 1,
      subject     TEXT NOT NULL DEFAULT 'math',
      created_by  INTEGER NOT NULL,
      created_at  BIGINT NOT NULL
    )
  `);
  await sql(`
    CREATE TABLE IF NOT EXISTS categories (
      id          SERIAL PRIMARY KEY,
      subject     TEXT NOT NULL,
      grade       INTEGER NOT NULL,
      name        TEXT NOT NULL,
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  BIGINT NOT NULL
    )
  `);
  await sql(`
    CREATE TABLE IF NOT EXISTS lesson_completions (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER NOT NULL,
      lesson_id    INTEGER NOT NULL,
      completed_at BIGINT NOT NULL
    )
  `);
  await sql(
    "CREATE INDEX IF NOT EXISTS lesson_completions_user_idx ON lesson_completions (user_id, completed_at DESC)",
  );
  await ensureColumn("users", "role", "TEXT NOT NULL DEFAULT 'user'");
  await ensureColumn("lessons", "category_id", "INTEGER");
}

function init(): Promise<void> {
  if (!globalThis.__eduDbInit) {
    globalThis.__eduDbInit = _init();
  }
  return globalThis.__eduDbInit;
}

function normalizeRow(row: QueryRow): QueryRow {
  const out: QueryRow = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "string" && /^\d+$/.test(v)) {
      const n = Number(v);
      out[k] = Number.isSafeInteger(n) ? n : v;
    } else if (typeof v === "bigint") {
      out[k] = Number(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function dbGet<T>(
  sqlText: string,
  args: Args = [],
): Promise<T | undefined> {
  await init();
  const rows = await sql(sqlText, args);
  if (rows.length === 0) return undefined;
  return normalizeRow(rows[0]) as T;
}

export async function dbAll<T>(
  sqlText: string,
  args: Args = [],
): Promise<T[]> {
  await init();
  const rows = await sql(sqlText, args);
  return rows.map(normalizeRow) as T[];
}

export async function dbExec(
  sqlText: string,
  args: Args = [],
): Promise<void> {
  await init();
  await sql(sqlText, args);
}

export type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  tier: "basic" | "pro" | "premium";
  role: "user" | "admin";
  created_at: number;
};

export type LessonRow = {
  id: number;
  title: string;
  description: string;
  content: string;
  grade: number;
  subject: string;
  created_by: number;
  created_at: number;
  category_id: number | null;
};

export type CategoryRow = {
  id: number;
  subject: string;
  grade: number;
  name: string;
  position: number;
  created_at: number;
};
