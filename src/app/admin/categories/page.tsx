import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { dbAll, type CategoryRow } from "@/lib/db";
import {
  deleteCategoryAction,
  moveCategoryAction,
  updateCategoryAction,
} from "@/lib/actions";
import {
  GRADES,
  SUBJECT_IDS,
  SUBJECT_LABEL,
  gradeLongLabel,
  gradeParam,
  normalizeSubject,
  parseGrade,
} from "@/lib/curriculum";
import AddCategoryForm from "./add-category-form";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; grade?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const subjectId = normalizeSubject(params.subject);
  const subjectLabel = SUBJECT_LABEL[subjectId];
  const grade = parseGrade(params.grade);

  const categories = await dbAll<CategoryRow>(
    "SELECT id, subject, grade, name, position, created_at FROM categories WHERE subject = $1 AND grade = $2 ORDER BY position ASC",
    [subjectId, grade],
  );

  const countsRaw = await dbAll<{ category_id: number | null; c: number }>(
    "SELECT category_id, COUNT(*)::int as c FROM lessons WHERE subject = $1 AND grade = $2 GROUP BY category_id",
    [subjectId, grade],
  );
  const counts = new Map<number, number>();
  let uncategorized = 0;
  for (const r of countsRaw) {
    if (r.category_id === null) uncategorized = r.c;
    else counts.set(r.category_id, r.c);
  }

  const uncategorizedSentence =
    uncategorized > 0
      ? `${uncategorized} lesson${uncategorized === 1 ? "" : "s"} uncategorized`
      : "All lessons categorized";

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-10 border-b border-zinc-900 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="inline-block h-6 w-6 rounded-md bg-cyan-400 shadow-[0_0_20px_-2px_rgba(34,211,238,0.7)]" />
            <span className="text-base font-semibold tracking-tight text-zinc-100">
              Scrolls
            </span>
            <span className="ml-2 rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-300 ring-1 ring-cyan-500/30">
              Studio
            </span>
          </Link>
          <Link
            href="/admin"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          >
            ← Studio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            {subjectLabel} · {gradeLongLabel(grade)}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-50">
            Categories
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">
            Group skills into named categories. Each subject + grade has its
            own set, and the order here is the order learners see on the
            dashboard.
          </p>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Subject
            </p>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-zinc-900 p-1 ring-1 ring-zinc-800">
              {SUBJECT_IDS.map((id) => {
                const active = id === subjectId;
                return (
                  <Link
                    key={id}
                    href={`/admin/categories?subject=${id}&grade=${gradeParam(grade)}`}
                    className={
                      "rounded-full px-3 py-1 text-xs font-semibold transition " +
                      (active
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-200")
                    }
                  >
                    {SUBJECT_LABEL[id]}
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Grade
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {GRADES.map((g) => {
                const active = g === grade;
                return (
                  <Link
                    key={g}
                    href={`/admin/categories?subject=${subjectId}&grade=${gradeParam(g)}`}
                    className={
                      "min-w-9 rounded-md px-2.5 py-1 text-center text-xs font-medium transition " +
                      (active
                        ? "bg-cyan-500 text-black"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100")
                    }
                  >
                    {g === 0 ? "K" : g}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Add a category
          </h2>
          <AddCategoryForm subject={subjectId} grade={grade} />
        </section>

        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              All categories
            </h2>
            <p className="text-xs text-zinc-500">{uncategorizedSentence}</p>
          </div>

          {categories.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950 px-6 py-12 text-center">
              <p className="text-sm font-semibold text-zinc-100">
                No categories yet for {subjectLabel} · {gradeLongLabel(grade)}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
                Add your first one above. Skills you create can then be filed
                into it.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {categories.map((cat, i) => (
                <li
                  key={cat.id}
                  className="rounded-xl bg-zinc-950 px-4 py-3 ring-1 ring-zinc-800"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-cyan-500/10 px-2 text-xs font-bold text-cyan-300 ring-1 ring-cyan-500/30">
                      {String.fromCharCode(65 + (i % 26))}
                    </span>

                    <form
                      action={updateCategoryAction}
                      className="flex flex-1 items-center gap-2"
                    >
                      <input type="hidden" name="id" value={cat.id} />
                      <input
                        name="name"
                        defaultValue={cat.name}
                        maxLength={120}
                        suppressHydrationWarning
                        className="min-w-0 flex-1 rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 ring-1 ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      />
                      <button
                        type="submit"
                        className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 ring-1 ring-zinc-800 hover:bg-zinc-800"
                      >
                        Save
                      </button>
                    </form>

                    <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-zinc-400 ring-1 ring-zinc-800">
                      {counts.get(cat.id) ?? 0} skill
                      {(counts.get(cat.id) ?? 0) === 1 ? "" : "s"}
                    </span>

                    <div className="flex items-center gap-0.5">
                      <form action={moveCategoryAction}>
                        <input type="hidden" name="id" value={cat.id} />
                        <input type="hidden" name="dir" value="-1" />
                        <button
                          type="submit"
                          disabled={i === 0}
                          aria-label="Move up"
                          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          ↑
                        </button>
                      </form>
                      <form action={moveCategoryAction}>
                        <input type="hidden" name="id" value={cat.id} />
                        <input type="hidden" name="dir" value="1" />
                        <button
                          type="submit"
                          disabled={i === categories.length - 1}
                          aria-label="Move down"
                          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </form>
                      <form action={deleteCategoryAction}>
                        <input type="hidden" name="id" value={cat.id} />
                        <button
                          type="submit"
                          aria-label="Delete"
                          className="flex h-8 w-8 items-center justify-center rounded-md text-rose-400 hover:bg-rose-500/10"
                        >
                          ×
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

