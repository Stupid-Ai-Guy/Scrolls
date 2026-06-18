import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { logoutAction } from "@/lib/actions";
import { dbAll, type CategoryRow, type LessonRow } from "@/lib/db";
import {
  gradeLongLabel,
  gradeParam,
  parseGrade,
  type SubjectId,
} from "@/lib/curriculum";

type LessonCard = Pick<
  LessonRow,
  "id" | "title" | "description" | "category_id"
>;

const SUBJECTS: ReadonlyArray<{
  id: SubjectId;
  label: string;
  tagline: string;
  glow: string;
  pill: string;
  accentText: string;
  accentBorder: string;
}> = [
  {
    id: "math",
    label: "Math",
    tagline: "Build real intuition for numbers, shapes, and patterns.",
    glow: "from-emerald-500/10",
    pill: "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30",
    accentText: "text-emerald-300",
    accentBorder: "border-emerald-400",
  },
  {
    id: "language",
    label: "Language",
    tagline: "Read closely, write clearly, and grow your vocabulary.",
    glow: "from-rose-500/10",
    pill: "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/30",
    accentText: "text-rose-300",
    accentBorder: "border-rose-400",
  },
  {
    id: "science",
    label: "Science",
    tagline: "Investigate how the world works through experiments and ideas.",
    glow: "from-sky-500/10",
    pill: "bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/30",
    accentText: "text-sky-300",
    accentBorder: "border-sky-400",
  },
];

const GRADE_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0, label: "K" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
  { value: 6, label: "6" },
  { value: 7, label: "7" },
  { value: 8, label: "8" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; grade?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const subject =
    SUBJECTS.find((s) => s.id === params.subject) ?? SUBJECTS[0];
  const grade = parseGrade(params.grade);

  const lessons = await dbAll<LessonCard>(
    "SELECT id, title, description, category_id FROM lessons WHERE grade = $1 AND subject = $2 ORDER BY created_at ASC",
    [grade, subject.id],
  );

  const categoryRows = await dbAll<CategoryRow>(
    "SELECT id, subject, grade, name, position, created_at FROM categories WHERE subject = $1 AND grade = $2 ORDER BY position ASC",
    [subject.id, grade],
  );

  const groups = groupLessonsByCategory(lessons, categoryRows);
  const isAdmin = session.role === "admin";
  const initial = session.email.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-20 border-b border-zinc-900 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="inline-block h-6 w-6 rounded-md bg-cyan-400 shadow-[0_0_20px_-2px_rgba(34,211,238,0.7)]" />
            <span className="text-base font-semibold tracking-tight text-zinc-100">
              Scrolls
            </span>
          </Link>

          <nav className="hidden items-center gap-1 rounded-full bg-zinc-900 p-1 ring-1 ring-zinc-800 sm:flex">
            {SUBJECTS.map((s) => {
              const active = s.id === subject.id;
              return (
                <Link
                  key={s.id}
                  href={`/dashboard?subject=${s.id}&grade=${gradeParam(grade)}`}
                  className={
                    "rounded-full px-4 py-1.5 text-sm font-medium transition " +
                    (active
                      ? "bg-zinc-800 text-zinc-100 shadow-inner"
                      : "text-zinc-500 hover:text-zinc-200")
                  }
                  aria-current={active ? "page" : undefined}
                >
                  {s.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                href="/admin"
                className="hidden rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-cyan-400 sm:inline-block"
              >
                Manage lessons
              </Link>
            )}
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-800"
                suppressHydrationWarning
              >
                Sign out
              </button>
            </form>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-zinc-200 ring-1 ring-zinc-800"
              title={session.email}
            >
              {initial}
            </div>
          </div>
        </div>

        <nav className="border-t border-zinc-900 px-6 sm:hidden">
          <div className="mx-auto flex max-w-6xl gap-1 py-2">
            {SUBJECTS.map((s) => {
              const active = s.id === subject.id;
              return (
                <Link
                  key={s.id}
                  href={`/dashboard?subject=${s.id}&grade=${gradeParam(grade)}`}
                  className={
                    "rounded-full px-3 py-1 text-xs font-medium " +
                    (active
                      ? "bg-cyan-500 text-black"
                      : "text-zinc-500 hover:bg-zinc-900")
                  }
                >
                  {s.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <section className="relative overflow-hidden border-b border-zinc-900">
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 -z-0 bg-gradient-to-b ${subject.glow} via-transparent to-black`}
        />
        <div className="relative mx-auto max-w-6xl px-6 pt-12 pb-10">
          <p
            className={`text-xs font-semibold uppercase tracking-[0.2em] ${subject.accentText}`}
          >
            {subject.label}
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
            {gradeLongLabel(grade)}
          </h1>
          <p className="mt-3 max-w-xl text-base text-zinc-400">
            {subject.tagline}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-1.5">
            {GRADE_OPTIONS.map((g) => {
              const active = g.value === grade;
              return (
                <Link
                  key={g.value}
                  href={`/dashboard?subject=${subject.id}&grade=${gradeParam(g.value)}`}
                  className={
                    "min-w-10 rounded-lg px-3 py-1.5 text-center text-sm font-medium transition " +
                    (active
                      ? "bg-cyan-500 text-black"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100")
                  }
                  aria-current={active ? "page" : undefined}
                >
                  {g.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Skills
              </h2>
              <p className="text-xs text-zinc-500">
                {lessons.length === 0
                  ? "0 skills"
                  : `${lessons.length} skill${lessons.length === 1 ? "" : "s"}`}
              </p>
            </div>

            {lessons.length === 0 ? (
              <EmptyState
                isAdmin={isAdmin}
                subjectLabel={subject.label}
                gradeLabel={gradeLongLabel(grade)}
              />
            ) : (
              <CategorySections groups={groups} pillClass={subject.pill} />
            )}
          </section>

          <aside className="space-y-3">
            <SidebarCard
              title="Daily streak"
              value="0"
              hint="Practice any skill to start your streak."
            />
            <SidebarCard
              title="Skills mastered"
              value="0"
              hint="Mastery unlocks the next topic."
            />
            <div className="rounded-2xl bg-gradient-to-br from-cyan-500/10 via-zinc-950 to-zinc-950 p-5 ring-1 ring-cyan-500/20">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Try Pro
              </p>
              <p className="mt-2 text-sm text-zinc-300">
                Add an AI tutor that adapts to your level, pace, and gaps.
              </p>
              <Link
                href="/#pricing"
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 hover:text-cyan-200"
              >
                See plans
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function EmptyState({
  isAdmin,
  subjectLabel,
  gradeLabel,
}: {
  isAdmin: boolean;
  subjectLabel: string;
  gradeLabel: string;
}) {
  return (
    <div className="mt-5 rounded-2xl bg-zinc-950 p-12 text-center ring-1 ring-zinc-800">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-zinc-500 ring-1 ring-zinc-800">
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      </div>
      <h3 className="mt-4 text-base font-semibold text-zinc-100">
        No {subjectLabel.toLowerCase()} skills for {gradeLabel} yet
      </h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-zinc-500">
        This curriculum will populate as soon as lessons are added.
      </p>
      {isAdmin && (
        <Link
          href="/admin"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400"
        >
          Add a lesson
        </Link>
      )}
    </div>
  );
}

type LessonGroup = {
  categoryId: number | null;
  letter: string;
  name: string;
  lessons: LessonCard[];
};

function groupLessonsByCategory(
  lessons: LessonCard[],
  categories: CategoryRow[],
): LessonGroup[] {
  const byId = new Map<number | null, LessonCard[]>();
  for (const l of lessons) {
    const key = l.category_id ?? null;
    if (!byId.has(key)) byId.set(key, []);
    byId.get(key)!.push(l);
  }

  const groups: LessonGroup[] = [];
  categories.forEach((c, i) => {
    const ls = byId.get(c.id);
    if (!ls || ls.length === 0) return;
    groups.push({
      categoryId: c.id,
      letter: String.fromCharCode(65 + (i % 26)),
      name: c.name,
      lessons: ls,
    });
  });
  const uncategorized = byId.get(null);
  if (uncategorized && uncategorized.length > 0) {
    groups.push({
      categoryId: null,
      letter: "·",
      name: "Other",
      lessons: uncategorized,
    });
  }
  return groups;
}

function CategorySections({
  groups,
  pillClass,
}: {
  groups: LessonGroup[];
  pillClass: string;
}) {
  if (groups.length === 0) return null;
  return (
    <div className="mt-5 space-y-8">
      {groups.map((group) => (
        <section key={group.categoryId ?? "uncat"}>
          <div className="mb-3 flex items-baseline gap-3">
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-cyan-500/10 px-2 text-xs font-bold text-cyan-300 ring-1 ring-cyan-500/30">
              {group.letter}
            </span>
            <h3 className="text-base font-semibold tracking-tight text-zinc-100">
              {group.name}
            </h3>
            <span className="text-xs text-zinc-500">
              {group.lessons.length} skill
              {group.lessons.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="space-y-2">
            {group.lessons.map((l, i) => (
              <li key={l.id}>
                <Link
                  href={`/lessons/${l.id}`}
                  className="group flex items-center gap-4 rounded-xl bg-zinc-950 px-5 py-4 ring-1 ring-zinc-800 transition hover:bg-zinc-900 hover:ring-cyan-400/60"
                >
                  <span
                    className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-bold ${pillClass}`}
                  >
                    {group.letter}.{i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {l.title}
                    </p>
                    {l.description && (
                      <p className="truncate text-xs text-zinc-500">
                        {l.description}
                      </p>
                    )}
                  </div>
                  <svg
                    className="h-4 w-4 text-zinc-700 transition group-hover:text-cyan-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SidebarCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl bg-zinc-950 p-5 ring-1 ring-zinc-800">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
        {title}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}
