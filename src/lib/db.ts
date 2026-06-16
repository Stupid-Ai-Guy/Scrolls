import "server-only";
import { createClient, type Client, type InValue } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";

declare global {
  // eslint-disable-next-line no-var
  var __eduDb: Client | undefined;
  // eslint-disable-next-line no-var
  var __eduDbInit: Promise<void> | undefined;
}

function makeClient(): Client {
  const tursoUrl = process.env.TURSO_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  if (tursoUrl) {
    return createClient({
      url: tursoUrl,
      ...(tursoToken ? { authToken: tursoToken } : {}),
    });
  }
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  return createClient({
    url: `file:${path.join(dataDir, "app.sqlite")}`,
  });
}

export const db: Client = globalThis.__eduDb ?? makeClient();
if (!globalThis.__eduDb) globalThis.__eduDb = db;

async function ensureColumn(
  table: string,
  column: string,
  definition: string,
) {
  const result = await db.execute(`PRAGMA table_info(${table})`);
  const has = result.rows.some(
    (r) => (r as unknown as { name: string }).name === column,
  );
  if (!has) {
    await db.execute(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`,
    );
  }
}

async function _init(): Promise<void> {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      tier          TEXT NOT NULL DEFAULT 'basic',
      role          TEXT NOT NULL DEFAULT 'user',
      created_at    INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lessons (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      content     TEXT NOT NULL DEFAULT '',
      grade       INTEGER NOT NULL DEFAULT 1,
      subject     TEXT NOT NULL DEFAULT 'math',
      created_by  INTEGER NOT NULL,
      created_at  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      subject     TEXT NOT NULL,
      grade       INTEGER NOT NULL,
      name        TEXT NOT NULL,
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL
    );
  `);
  await ensureColumn("users", "role", "TEXT NOT NULL DEFAULT 'user'");
  await ensureColumn("lessons", "category_id", "INTEGER");
}

function init(): Promise<void> {
  if (!globalThis.__eduDbInit) {
    globalThis.__eduDbInit = _init();
  }
  return globalThis.__eduDbInit;
}

type Args = InValue[];

function num(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  return Number(v);
}

export async function dbGet<T>(
  sql: string,
  args: Args = [],
): Promise<T | undefined> {
  await init();
  const result = await db.execute({ sql, args });
  return result.rows[0] as T | undefined;
}

export async function dbAll<T>(sql: string, args: Args = []): Promise<T[]> {
  await init();
  const result = await db.execute({ sql, args });
  return result.rows as unknown as T[];
}

export async function dbRun(
  sql: string,
  args: Args = [],
): Promise<{ lastInsertRowid: number; rowsAffected: number }> {
  await init();
  const result = await db.execute({ sql, args });
  return {
    lastInsertRowid:
      result.lastInsertRowid !== undefined ? num(result.lastInsertRowid) : 0,
    rowsAffected: result.rowsAffected,
  };
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
