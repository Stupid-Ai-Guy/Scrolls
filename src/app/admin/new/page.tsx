import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { dbAll, type CategoryRow } from "@/lib/db";
import { normalizeSubject, parseGrade } from "@/lib/curriculum";
import NewLessonForm from "./new-lesson-form";

export default async function NewLessonPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; grade?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const initialSubject = normalizeSubject(params.subject);
  const initialGrade = parseGrade(params.grade);

  const categories = await dbAll<CategoryRow>(
    "SELECT id, subject, grade, name, position, created_at FROM categories ORDER BY subject, grade, position",
  );

  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-zinc-900 bg-black">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
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
            className="text-sm font-medium text-zinc-400 hover:text-zinc-100"
          >
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
          New lesson
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Start with the basics. You&apos;ll add questions, explanations, and
          diagrams on the next screen.
        </p>

        <div className="mt-8 rounded-2xl bg-zinc-950 p-7 ring-1 ring-zinc-800">
          <NewLessonForm
            initialSubject={initialSubject}
            initialGrade={initialGrade}
            categories={categories.map((c) => ({
              id: c.id,
              subject: c.subject,
              grade: c.grade,
              name: c.name,
            }))}
          />
        </div>
      </main>
    </div>
  );
}
