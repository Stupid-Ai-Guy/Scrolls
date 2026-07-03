"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { dbExec, dbGet, type UserRow } from "./db";
import { createSession, destroySession, getSession } from "./session";

export type Theme = "light" | "dark";
const THEME_COOKIE = "scrolls-theme";

// Called from the ThemeToggle client component. Writes the preference to a
// long-lived cookie so the root layout can server-render the right class
// on <html> — no first-paint flash when switching pages or reloading.
export async function setThemeAction(theme: Theme): Promise<void> {
  if (theme !== "light" && theme !== "dark") return;
  const jar = await cookies();
  jar.set(THEME_COOKIE, theme, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export type FormState = { error?: string; ok?: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MASTER_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

const ALLOWED_SUBJECTS = ["math", "language", "science"] as const;
type Subject = (typeof ALLOWED_SUBJECTS)[number];

const MAX_GRADE = 13; // 13 = Calculus

function normalizeSubject(raw: string): Subject {
  return (ALLOWED_SUBJECTS as readonly string[]).includes(raw)
    ? (raw as Subject)
    : "math";
}

function normalizeGrade(raw: string): number {
  const upper = raw.toUpperCase();
  if (upper === "K") return 0;
  if (upper === "CALC" || upper === "CALCULUS") return 13;
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n >= 0 && n <= MAX_GRADE ? n : 1;
}

async function normalizeCategoryId(
  raw: string,
  subject: Subject,
  grade: number,
): Promise<number | null> {
  if (!raw) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  const cat = await dbGet<{ subject: string; grade: number }>(
    "SELECT subject, grade FROM categories WHERE id = $1",
    [id],
  );
  if (!cat) return null;
  if (cat.subject !== subject || cat.grade !== grade) return null;
  return id;
}

async function admitAsAdmin(email: string): Promise<never> {
  const existing = await dbGet<{ id: number; role: string }>(
    "SELECT id, role FROM users WHERE email = $1",
    [email],
  );

  let userId: number;
  if (existing) {
    userId = existing.id;
    if (existing.role !== "admin") {
      await dbExec("UPDATE users SET role = 'admin' WHERE id = $1", [userId]);
    }
  } else {
    const placeholder = await bcrypt.hash(
      crypto.randomUUID() + Date.now(),
      10,
    );
    const inserted = await dbGet<{ id: number }>(
      "INSERT INTO users (email, password_hash, tier, role, created_at) VALUES ($1, $2, 'basic', 'admin', $3) RETURNING id",
      [email, placeholder, Date.now()],
    );
    userId = inserted!.id;
  }

  await createSession({ userId, email, role: "admin" });
  redirect("/admin");
}

export async function signupAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email." };
  if (!password) return { error: "Password is required." };

  if (MASTER_PASSWORD && password === MASTER_PASSWORD) {
    await admitAsAdmin(email);
  }

  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords do not match." };

  const existing = await dbGet<{ id: number }>(
    "SELECT id FROM users WHERE email = $1",
    [email],
  );
  if (existing) return { error: "An account with that email already exists." };

  const hash = await bcrypt.hash(password, 10);
  const inserted = await dbGet<{ id: number }>(
    "INSERT INTO users (email, password_hash, tier, role, created_at) VALUES ($1, $2, 'basic', 'user', $3) RETURNING id",
    [email, hash, Date.now()],
  );

  await createSession({
    userId: inserted!.id,
    email,
    role: "user",
  });
  redirect("/dashboard");
}

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email." };
  if (!password) return { error: "Password is required." };

  if (MASTER_PASSWORD && password === MASTER_PASSWORD) {
    await admitAsAdmin(email);
  }

  const user = await dbGet<UserRow>(
    "SELECT id, email, password_hash, tier, role, created_at FROM users WHERE email = $1",
    [email],
  );

  if (!user) return { error: "Invalid email or password." };
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return { error: "Invalid email or password." };

  await createSession({
    userId: user.id,
    email: user.email,
    role: user.role === "admin" ? "admin" : "user",
  });
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

// Admin-only debug action: drops every row from lesson_completions, for
// every user. Intended for clearing out test data while iterating on the
// spaced-repetition flow. The caller is expected to confirm in the UI
// before invoking — there's no soft-delete or undo.
export async function clearAllCompletionsAction(): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "admin") return;
  await dbExec("DELETE FROM lesson_completions", []);
}

export async function recordLessonCompletionAction(
  lessonId: number,
  stage: "initial" | "day1" | "day3" = "initial",
): Promise<void> {
  const session = await getSession();
  if (!session) return;
  if (!Number.isInteger(lessonId) || lessonId <= 0) return;
  if (stage !== "initial" && stage !== "day1" && stage !== "day3") return;
  const lesson = await dbGet<{ id: number }>(
    "SELECT id FROM lessons WHERE id = $1",
    [lessonId],
  );
  if (!lesson) return;
  await dbExec(
    "INSERT INTO lesson_completions (user_id, lesson_id, stage, completed_at) VALUES ($1, $2, $3, $4)",
    [session.userId, lessonId, stage, Date.now()],
  );
}

export async function createLessonAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return { error: "Not authorized." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const subject = normalizeSubject(String(formData.get("subject") ?? "math"));
  const grade = normalizeGrade(String(formData.get("grade") ?? "1"));
  const categoryId = await normalizeCategoryId(
    String(formData.get("category_id") ?? ""),
    subject,
    grade,
  );

  if (!title) return { error: "Title is required." };
  if (title.length > 200) return { error: "Title is too long." };

  const emptyContent = JSON.stringify({ blocks: [] });
  let inserted: { id: number } | undefined;
  try {
    inserted = await dbGet<{ id: number }>(
      "INSERT INTO lessons (title, description, content, grade, subject, category_id, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
      [
        title,
        description,
        emptyContent,
        grade,
        subject,
        categoryId,
        session.userId,
        Date.now(),
      ],
    );
  } catch (e) {
    return {
      error: `Couldn't save lesson: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (!inserted) return { error: "Couldn't save lesson (no row returned)." };

  revalidatePath("/admin");
  revalidatePath("/admin/new");
  revalidatePath("/dashboard");
  redirect(`/admin/lessons/${inserted.id}`);
}

export async function saveLessonAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return { error: "Not authorized." };

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "Invalid lesson." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const subject = normalizeSubject(String(formData.get("subject") ?? "math"));
  const grade = normalizeGrade(String(formData.get("grade") ?? "1"));
  const categoryId = await normalizeCategoryId(
    String(formData.get("category_id") ?? ""),
    subject,
    grade,
  );
  const contentRaw = String(formData.get("content") ?? "");

  if (!title) return { error: "Title is required." };
  if (title.length > 200) return { error: "Title is too long." };

  let content: string;
  try {
    const parsed: unknown = JSON.parse(contentRaw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as { blocks?: unknown }).blocks)
    ) {
      return { error: "Invalid lesson content." };
    }
    content = JSON.stringify({
      blocks: (parsed as { blocks: unknown[] }).blocks,
    });
  } catch {
    return { error: "Invalid lesson content." };
  }

  try {
    await dbExec(
      "UPDATE lessons SET title = $1, description = $2, subject = $3, grade = $4, category_id = $5, content = $6 WHERE id = $7",
      [title, description, subject, grade, categoryId, content, id],
    );
  } catch (e) {
    return {
      error: `Couldn't save lesson: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/lessons/${id}`);
  revalidatePath("/dashboard");
  revalidatePath(`/lessons/${id}`);
  return { ok: true };
}

export async function deleteLessonAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "admin") return;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  await dbExec("DELETE FROM lessons WHERE id = $1", [id]);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

// ---------------- Categories ----------------

export async function createCategoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return { error: "Not authorized." };

  const subject = normalizeSubject(String(formData.get("subject") ?? "math"));
  const grade = normalizeGrade(String(formData.get("grade") ?? "1"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };
  if (name.length > 120) return { error: "Name is too long." };

  const maxRow = await dbGet<{ p: number | null }>(
    "SELECT MAX(position) as p FROM categories WHERE subject = $1 AND grade = $2",
    [subject, grade],
  );
  const position = (maxRow?.p ?? -1) + 1;

  await dbExec(
    "INSERT INTO categories (subject, grade, name, position, created_at) VALUES ($1, $2, $3, $4, $5)",
    [subject, grade, name, position, Date.now()],
  );

  revalidatePath("/admin/categories");
  revalidatePath("/admin");
  revalidatePath("/admin/new");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "admin") return;
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!Number.isInteger(id) || id <= 0 || !name) return;
  await dbExec("UPDATE categories SET name = $1 WHERE id = $2", [name, id]);
  revalidatePath("/admin/categories");
  revalidatePath("/admin");
  revalidatePath("/admin/new");
  revalidatePath("/dashboard");
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "admin") return;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  await dbExec("UPDATE lessons SET category_id = NULL WHERE category_id = $1", [
    id,
  ]);
  await dbExec("DELETE FROM categories WHERE id = $1", [id]);
  revalidatePath("/admin/categories");
  revalidatePath("/admin");
  revalidatePath("/admin/new");
  revalidatePath("/dashboard");
}

export async function moveCategoryAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "admin") return;
  const id = Number(formData.get("id"));
  const dir = Number(formData.get("dir"));
  if (!Number.isInteger(id) || id <= 0) return;
  if (dir !== -1 && dir !== 1) return;

  const cat = await dbGet<{
    id: number;
    subject: string;
    grade: number;
    position: number;
  }>("SELECT id, subject, grade, position FROM categories WHERE id = $1", [
    id,
  ]);
  if (!cat) return;

  const neighbor = await dbGet<{ id: number; position: number }>(
    dir === -1
      ? "SELECT id, position FROM categories WHERE subject = $1 AND grade = $2 AND position < $3 ORDER BY position DESC LIMIT 1"
      : "SELECT id, position FROM categories WHERE subject = $1 AND grade = $2 AND position > $3 ORDER BY position ASC LIMIT 1",
    [cat.subject, cat.grade, cat.position],
  );
  if (!neighbor) return;

  await dbExec("UPDATE categories SET position = $1 WHERE id = $2", [
    neighbor.position,
    cat.id,
  ]);
  await dbExec("UPDATE categories SET position = $1 WHERE id = $2", [
    cat.position,
    neighbor.id,
  ]);

  revalidatePath("/admin/categories");
  revalidatePath("/dashboard");
}
