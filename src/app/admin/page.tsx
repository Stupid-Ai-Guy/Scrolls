import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { deleteLessonAction, logoutAction } from "@/lib/actions";
import { dbAll, type LessonRow } from "@/lib/db";
import { countBlocks, parseLessonContent } from "@/lib/lesson-content";
import { gradeShortLabel, subjectPill } from "@/lib/curriculum";

export default async function StudioPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const lessons = await dbAll<LessonRow>(
    "SELECT id, title, description, content, grade, subject, category_id, created_by, created_at FROM lessons ORDER BY created_at DESC",
  );

  const summaries = lessons.map((l) => {
    const counts = countBlocks(parseLessonContent(l.content));
    return { lesson: l, counts };
  });

  const totals = summaries.reduce(
    (acc, { counts }) => {
      acc.lessons += 1;
      acc.questions += counts.question;
      acc.blocks += counts.total;
      return acc;
    },
    { lessons: 0, questions: 0, blocks: 0 },
  );

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-10 border-b border-zinc-900 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="inline-block h-6 w-6 rounded-md bg-cyan-400 shadow-[0_0_20px_-2px_rgba(34,211,238,0.7)]" />
            <span className="text-base font-semibold tracking-tight text-zinc-100">
              Scrolls
            </span>
            <span className="ml-2 rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-300 ring-1 ring-cyan-500/30">
              Studio
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/categories"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
            >
              Categories
            </Link>
            <Link
              href="/admin/terminal"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
            >
              Terminal
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
            >
              Learner view
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-800"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
              {session.email}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-50">
              Your lessons
            </h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-400">
              Author skills with explanation pages, diagrams, and interactive
              questions. Saved lessons appear instantly for every learner.
            </p>
          </div>
          <Link
            href="/admin/new"
            className="rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-400 hover:shadow-[0_0_30px_-6px_rgba(34,211,238,0.7)]"
          >
            New lesson
          </Link>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <StatCard label="Lessons" value={totals.lessons} />
          <StatCard label="Questions" value={totals.questions} />
          <StatCard label="Total blocks" value={totals.blocks} />
        </div>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            All lessons
          </h2>

          {summaries.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950 px-6 py-16 text-center">
              <h3 className="text-base font-semibold text-zinc-100">
                No lessons yet
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
                Create your first lesson and start adding questions and
                explanations.
              </p>
              <Link
                href="/admin/new"
                className="mt-5 inline-flex items-center justify-center rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
              >
                Create your first lesson
              </Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {summaries.map(({ lesson: l, counts }) => (
                <li
                  key={l.id}
                  className="group flex items-start justify-between gap-4 rounded-xl bg-zinc-950 p-5 ring-1 ring-zinc-800 transition hover:ring-cyan-400/40"
                >
                  <Link
                    href={`/admin/lessons/${l.id}`}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-zinc-100 hover:text-cyan-300">
                        {l.title || "Untitled lesson"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${subjectPill(l.subject)}`}
                      >
                        {l.subject}
                      </span>
                      <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-zinc-300 ring-1 ring-zinc-800">
                        {gradeShortLabel(l.grade)}
                      </span>
                    </div>
                    {l.description && (
                      <p className="mt-1 text-sm text-zinc-400">
                        {l.description}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-zinc-500">
                      {counts.question} question
                      {counts.question === 1 ? "" : "s"} · {counts.interactive}{" "}
                      interactive · {counts.text} explanation
                      {counts.text === 1 ? "" : "s"} · {counts.image} diagram
                      {counts.image === 1 ? "" : "s"}
                    </p>
                  </Link>
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/lessons/${l.id}`}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                    >
                      Preview
                    </Link>
                    <Link
                      href={`/admin/lessons/${l.id}`}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-cyan-300 hover:bg-zinc-900"
                    >
                      Edit
                    </Link>
                    <form action={deleteLessonAction}>
                      <input type="hidden" name="id" value={l.id} />
                      <button
                        type="submit"
                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-400 opacity-0 transition hover:bg-rose-500/10 group-hover:opacity-100"
                      >
                        Delete
                      </button>
                    </form>
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-zinc-950 p-5 ring-1 ring-zinc-800">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">
        {value}
      </p>
    </div>
  );
}
