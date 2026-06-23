"use client";

import { useActionState, useState } from "react";
import { createLessonAction, type FormState } from "@/lib/actions";

const initial: FormState = {};

type CategoryOption = {
  id: number;
  subject: string;
  grade: number;
  name: string;
};

const fieldClass =
  "mt-1 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800 transition placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-400";

function gradeToString(g: number): string {
  return g === 0 ? "K" : String(g);
}

export default function NewLessonForm({
  categories,
  initialSubject = "math",
  initialGrade = 1,
}: {
  categories: CategoryOption[];
  initialSubject?: string;
  initialGrade?: number;
}) {
  const [state, formAction, pending] = useActionState(
    createLessonAction,
    initial,
  );
  const [subject, setSubject] = useState(initialSubject);
  const [grade, setGrade] = useState(gradeToString(initialGrade));
  const [categoryId, setCategoryId] = useState("");

  const filtered = categories.filter(
    (c) => c.subject === subject && c.grade === gradeToNumber(grade),
  );
  const validCategoryId = filtered.some((c) => String(c.id) === categoryId)
    ? categoryId
    : "";

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="subject"
            className="block text-sm font-medium text-zinc-300"
          >
            Subject
          </label>
          <select
            id="subject"
            name="subject"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setCategoryId("");
            }}
            suppressHydrationWarning
            className={fieldClass}
          >
            <option value="math">Math</option>
            <option value="language">Language</option>
            <option value="science">Science</option>
            <option value="calculus">Calculus</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="grade"
            className="block text-sm font-medium text-zinc-300"
          >
            Grade
          </label>
          <select
            id="grade"
            name="grade"
            value={grade}
            onChange={(e) => {
              setGrade(e.target.value);
              setCategoryId("");
            }}
            suppressHydrationWarning
            className={fieldClass}
          >
            <option value="K">Kindergarten</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
              <option key={g} value={String(g)}>
                Grade {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="category_id"
          className="block text-sm font-medium text-zinc-300"
        >
          Category
        </label>
        <select
          id="category_id"
          name="category_id"
          value={validCategoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          suppressHydrationWarning
          className={fieldClass}
        >
          <option value="">Uncategorized</option>
          {filtered.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
        {filtered.length === 0 && (
          <p className="mt-1.5 text-xs text-zinc-500">
            No categories yet for this subject + grade.{" "}
            <a
              href="/admin/categories"
              className="text-cyan-300 hover:text-cyan-200"
              target="_blank"
              rel="noreferrer"
            >
              Create one
            </a>
            .
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-zinc-300"
        >
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={200}
          placeholder="e.g. Add within 20"
          suppressHydrationWarning
          className={fieldClass}
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-zinc-300"
        >
          Short description
        </label>
        <input
          id="description"
          name="description"
          type="text"
          maxLength={300}
          placeholder="One line shown on the dashboard"
          suppressHydrationWarning
          className={fieldClass}
        />
      </div>

      {state.error && (
        <p className="text-sm text-rose-400" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        suppressHydrationWarning
        className="inline-flex items-center justify-center rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create & open editor"}
      </button>
    </form>
  );
}

function gradeToNumber(g: string): number {
  if (g.toUpperCase() === "K") return 0;
  const n = parseInt(g, 10);
  return Number.isInteger(n) ? n : 1;
}
