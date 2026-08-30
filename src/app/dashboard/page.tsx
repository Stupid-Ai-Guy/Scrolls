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
import { parseLessonContent } from "@/lib/lesson-content";
import {
  computeAllProgress,
  type CompletionRow,
  type LessonProgress,
  type LessonRepetitionInfo,
} from "@/lib/spaced-repetition";
import { getTheme } from "@/lib/theme";
import ThemeToggle from "@/components/theme-toggle";
import CountUp from "@/components/count-up";

type LessonCard = Pick<
  LessonRow,
  "id" | "title" | "description" | "category_id"
> & { content: string };

const SUBJECTS: ReadonlyArray<{
  id: SubjectId;
  label: string;
  tagline: string;
  accentText: string;
  pill: string;
  ring: string;
  glow: string;
}> = [
  {
    id: "math",
    label: "Math",
    tagline: "Build real intuition for numbers, shapes, and patterns.",
    accentText: "text-emerald-300",
    pill: "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30",
    ring: "ring-emerald-500/25",
    glow: "from-emerald-500/15",
  },
  {
    id: "language",
    label: "Language",
    tagline: "Read closely, write clearly, and grow your vocabulary.",
    accentText: "text-rose-300",
    pill: "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/30",
    ring: "ring-rose-500/25",
    glow: "from-rose-500/15",
  },
  {
    id: "science",
    label: "Science",
    tagline: "Investigate how the world works through experiments and ideas.",
    accentText: "text-sky-300",
    pill: "bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/30",
    ring: "ring-sky-500/25",
    glow: "from-sky-500/15",
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
  { value: 9, label: "9" },
  { value: 10, label: "10" },
  { value: 11, label: "11" },
  { value: 12, label: "12" },
  // Calculus is a math-only "extra" level. Filtered out for other subjects
  // in the render below.
  { value: 13, label: "Calc" },
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
    "SELECT id, title, description, category_id, content FROM lessons WHERE grade = $1 AND subject = $2 ORDER BY created_at ASC",
    [grade, subject.id],
  );

  const categoryRows = await dbAll<CategoryRow>(
    "SELECT id, subject, grade, name, position, created_at FROM categories WHERE subject = $1 AND grade = $2 ORDER BY position ASC",
    [subject.id, grade],
  );

  const completionRows = await dbAll<CompletionRow>(
    "SELECT lesson_id, stage, completed_at FROM lesson_completions WHERE user_id = $1 ORDER BY completed_at DESC",
    [session.userId],
  );

  const lessonInfo = new Map<number, LessonRepetitionInfo>();
  for (const l of lessons) {
    const parsed = parseLessonContent(l.content);
    lessonInfo.set(l.id, {
      hasDay1: (parsed.repetitionSets?.day1.length ?? 0) > 0,
      hasDay3: (parsed.repetitionSets?.day3.length ?? 0) > 0,
    });
  }
  const progressByLesson = computeAllProgress(completionRows, lessonInfo);

  let masteredCount = 0;
  let reviewsDueNow = 0;
  for (const p of progressByLesson.values()) {
    if (p.mastery >= 1) masteredCount++;
    if (p.reviewDueNow) reviewsDueNow++;
  }
  const streakCount = computeStreak(completionRows.map((r) => r.completed_at));

  // Reviews across every subject/grade so the pill count matches
  // wherever the learner is browsing.
  const allLessonRows = await dbAll<{ id: number; content: string }>(
    "SELECT id, content FROM lessons",
  );
  const allLessonInfo = new Map<number, LessonRepetitionInfo>();
  for (const l of allLessonRows) {
    const parsed = parseLessonContent(l.content);
    allLessonInfo.set(l.id, {
      hasDay1: (parsed.repetitionSets?.day1.length ?? 0) > 0,
      hasDay3: (parsed.repetitionSets?.day3.length ?? 0) > 0,
    });
  }
  const allProgress = computeAllProgress(completionRows, allLessonInfo);
  let totalReviewsDue = 0;
  for (const p of allProgress.values()) if (p.reviewDueNow) totalReviewsDue++;

  const groups = groupLessonsByCategory(lessons, categoryRows);
  const isAdmin = session.role === "admin";
  const initial = session.email.charAt(0).toUpperCase();
  const theme = await getTheme();
  const resume = pickResume(lessons, progressByLesson);

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
            <Link
              href="/blogs"
              className="rounded-full px-4 py-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-200"
            >
              Blogs
            </Link>
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
            <ThemeToggle theme={theme} />
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
            <Link
              href="/blogs"
              className="rounded-full px-3 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-900"
            >
              Blogs
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {resume && (
          <ResumeHero
            lesson={resume.lesson}
            state={resume.state}
            subject={subject}
            grade={grade}
          />
        )}

        <StatsRow
          streak={streakCount}
          mastered={masteredCount}
          reviews={totalReviewsDue}
          reviewsInView={reviewsDueNow}
        />

        <section className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p
                className={`text-xs font-semibold uppercase tracking-[0.2em] ${subject.accentText}`}
              >
                {subject.label}
              </p>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
                {gradeLongLabel(grade)}
              </h1>
            </div>
            {isAdmin && lessons.length > 0 && (
              <Link
                href={`/admin/new?subject=${subject.id}&grade=${gradeParam(grade)}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-300 ring-1 ring-cyan-500/40 transition hover:bg-cyan-500/25 hover:text-cyan-200 hover:ring-cyan-400/60"
              >
                <svg
                  viewBox="0 0 16 16"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <line x1="8" y1="3" x2="8" y2="13" />
                  <line x1="3" y1="8" x2="13" y2="8" />
                </svg>
                New lesson
              </Link>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-1.5">
            {GRADE_OPTIONS.filter(
              (g) => g.value !== 13 || subject.id === "math",
            ).map((g) => {
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

          <p className="mt-4 max-w-xl text-sm text-zinc-500">
            {subject.tagline}
          </p>
        </section>

        <section className="mt-8">
          {lessons.length === 0 ? (
            <EmptyState
              isAdmin={isAdmin}
              subjectLabel={subject.label}
              gradeLabel={gradeLongLabel(grade)}
            />
          ) : (
            <CategoryGrid
              groups={groups}
              pillClass={subject.pill}
              progressByLesson={progressByLesson}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function pickResume(
  lessons: LessonCard[],
  progressByLesson: Map<number, LessonProgress>,
): { lesson: LessonCard; state: "review" | "continue" | "start" } | null {
  if (lessons.length === 0) return null;

  // Review-due wins — that's the strongest "do this now" signal.
  const reviewDue = lessons.find(
    (l) => progressByLesson.get(l.id)?.reviewDueNow,
  );
  if (reviewDue) return { lesson: reviewDue, state: "review" };

  // Otherwise, the first lesson not yet mastered — natural next step.
  const inProgress = lessons.find(
    (l) => (progressByLesson.get(l.id)?.mastery ?? 0) < 1,
  );
  if (inProgress) {
    const hasAny = progressByLesson.get(inProgress.id)?.mastery ?? 0;
    return {
      lesson: inProgress,
      state: hasAny > 0 ? "continue" : "start",
    };
  }

  // Everything mastered — surface the first lesson so there's still a
  // hero to click (a redo).
  return { lesson: lessons[0], state: "continue" };
}

function ResumeHero({
  lesson,
  state,
  subject,
  grade,
}: {
  lesson: LessonCard;
  state: "review" | "continue" | "start";
  subject: (typeof SUBJECTS)[number];
  grade: number;
}) {
  const label =
    state === "review"
      ? "Review ready"
      : state === "continue"
        ? "Continue where you left off"
        : "Start here";
  const cta = state === "review" ? "Start review" : "Open lesson";
  const isReview = state === "review";

  return (
    <section
      className={
        "relative overflow-hidden rounded-3xl bg-zinc-950 p-8 ring-1 sm:p-10 " +
        (isReview ? "ring-cyan-500/40" : `ring-1 ${subject.ring}`)
      }
    >
      <div
        aria-hidden
        className={
          "pointer-events-none absolute inset-0 -z-0 bg-gradient-to-br to-transparent " +
          (isReview ? "from-cyan-500/15" : subject.glow)
        }
      />
      <div className="relative">
        <p
          className={
            "text-xs font-semibold uppercase tracking-[0.2em] " +
            (isReview ? "text-cyan-300" : subject.accentText)
          }
        >
          {label}
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          {lesson.title}
        </h2>
        {lesson.description && (
          <p className="mt-2 max-w-2xl text-base text-zinc-400">
            {lesson.description}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link
            href={`/lessons/${lesson.id}`}
            className={
              "group inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition " +
              (isReview
                ? "bg-cyan-500 text-black hover:bg-cyan-400"
                : "bg-zinc-100 text-black hover:bg-white")
            }
          >
            {cta}
            <svg
              viewBox="0 0 16 16"
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 8h10" />
              <path d="M9 4l4 4-4 4" />
            </svg>
          </Link>
          <p className="text-xs text-zinc-500">
            {subject.label} · {gradeLongLabel(grade)}
          </p>
        </div>
      </div>
    </section>
  );
}

function StatsRow({
  streak,
  mastered,
  reviews,
  reviewsInView,
}: {
  streak: number;
  mastered: number;
  reviews: number;
  reviewsInView: number;
}) {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      <StatCard
        label="Day streak"
        value={streak}
        icon={<FlameIcon />}
        accent="amber"
        hint={
          streak === 0
            ? "Finish a lesson to start"
            : streak === 1
              ? "One day in — keep it up"
              : `${streak} days in a row`
        }
      />
      <StatCard
        label="Skills mastered"
        value={mastered}
        icon={<CheckIcon />}
        accent="emerald"
        hint={
          mastered === 0
            ? "Complete a lesson and its reviews"
            : "Mastery unlocks the next topic"
        }
      />
      <StatCard
        label="Reviews due"
        value={reviews}
        icon={<RepeatIcon />}
        accent={reviews > 0 ? "cyan" : "muted"}
        hint={
          reviews === 0
            ? "You're all caught up"
            : reviewsInView > 0 && reviewsInView !== reviews
              ? `${reviewsInView} in this view · ${reviews} total`
              : "Open a lesson with a review badge"
        }
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
  accent: "amber" | "emerald" | "cyan" | "muted";
}) {
  const tone: Record<
    "amber" | "emerald" | "cyan" | "muted",
    { bg: string; text: string; ring: string; value: string }
  > = {
    amber: {
      bg: "bg-amber-500/10",
      text: "text-amber-300",
      ring: "ring-amber-500/30",
      value: "text-amber-100",
    },
    emerald: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-300",
      ring: "ring-emerald-500/30",
      value: "text-emerald-100",
    },
    cyan: {
      bg: "bg-cyan-500/10",
      text: "text-cyan-300",
      ring: "ring-cyan-500/30",
      value: "text-cyan-100",
    },
    muted: {
      bg: "bg-zinc-900",
      text: "text-zinc-500",
      ring: "ring-zinc-800",
      value: "text-zinc-100",
    },
  };
  const t = tone[accent];

  return (
    <div className="rounded-2xl bg-zinc-950 p-5 ring-1 ring-zinc-800">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {label}
        </p>
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${t.bg} ${t.text} ring-1 ${t.ring}`}
        >
          {icon}
        </span>
      </div>
      <p
        className={`mt-3 text-4xl font-semibold tracking-tight tabular-nums ${t.value}`}
      >
        <CountUp value={value} />
      </p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
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
    <div className="rounded-3xl bg-zinc-950 p-12 text-center ring-1 ring-zinc-800">
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

function CategoryGrid({
  groups,
  pillClass,
  progressByLesson,
}: {
  groups: LessonGroup[];
  pillClass: string;
  progressByLesson: Map<number, LessonProgress>;
}) {
  if (groups.length === 0) return null;
  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <section key={group.categoryId ?? "uncat"}>
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-cyan-500/10 px-2 text-sm font-bold text-cyan-300 ring-1 ring-cyan-500/30">
              {group.letter}
            </span>
            <h3 className="text-lg font-semibold tracking-tight text-zinc-100">
              {group.name}
            </h3>
            <span className="text-xs text-zinc-500">
              {group.lessons.length} skill
              {group.lessons.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.lessons.map((l, i) => (
              <li key={l.id}>
                <SkillTile
                  lesson={l}
                  index={i}
                  letter={group.letter}
                  pillClass={pillClass}
                  progress={progressByLesson.get(l.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SkillTile({
  lesson,
  index,
  letter,
  pillClass,
  progress,
}: {
  lesson: LessonCard;
  index: number;
  letter: string;
  pillClass: string;
  progress: LessonProgress | undefined;
}) {
  const masteryPct = progress ? Math.round(progress.mastery * 100) : 0;
  const reviewDue = progress?.reviewDueNow ?? false;
  const mastered = (progress?.mastery ?? 0) >= 1;

  return (
    <Link
      href={`/lessons/${lesson.id}`}
      className={
        "group relative flex h-full flex-col gap-3 rounded-2xl p-5 ring-1 transition " +
        (reviewDue
          ? "bg-cyan-500/5 ring-cyan-500/40 hover:-translate-y-0.5 hover:bg-cyan-500/10 hover:ring-cyan-400/70"
          : "bg-zinc-950 ring-zinc-800 hover:-translate-y-0.5 hover:bg-zinc-900 hover:ring-cyan-400/60")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-bold ${pillClass}`}
        >
          {letter}.{index + 1}
        </span>
        <ProgressRing pct={masteryPct} mastered={mastered} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-100">{lesson.title}</p>
        {lesson.description && (
          <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
            {lesson.description}
          </p>
        )}
      </div>
      {reviewDue && (
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300 ring-1 ring-cyan-500/40">
          <svg
            viewBox="0 0 16 16"
            className="h-2.5 w-2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 5a5 5 0 0 1 9-3l1 1" />
            <path d="M13 2v3h-3" />
            <path d="M13 11a5 5 0 0 1-9 3l-1-1" />
            <path d="M3 14v-3h3" />
          </svg>
          Review ready
        </span>
      )}
    </Link>
  );
}

function ProgressRing({
  pct,
  mastered,
  size = 40,
}: {
  pct: number;
  mastered: boolean;
  size?: number;
}) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const offset = C - (Math.max(0, Math.min(100, pct)) / 100) * C;
  const strokeClass = mastered
    ? "stroke-emerald-400"
    : pct > 0
      ? "stroke-cyan-400"
      : "stroke-zinc-700";

  if (mastered) {
    return (
      <span
        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40"
        title="Mastered"
      >
        <svg
          viewBox="0 0 16 16"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8.5l3.5 3.5L13 5" />
        </svg>
      </span>
    );
  }

  return (
    <span
      className="relative inline-flex items-center justify-center"
      title={pct > 0 ? `Mastery ${pct}%` : "Not started"}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          className="stroke-zinc-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          className={strokeClass}
        />
      </svg>
      {pct > 0 && (
        <span className="absolute text-[10px] font-semibold tabular-nums text-zinc-400">
          {pct}
        </span>
      )}
    </span>
  );
}

function FlameIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 1.5S5.5 4 5.5 6.5c0 .8.3 1.4.8 1.9C5.5 8 4 9 4 11a4 4 0 0 0 8 0c0-2-1.2-3-1.7-4 .3-.3.5-.7.5-1.2C10.8 4 8 1.5 8 1.5z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 5a5 5 0 0 1 9-3l1 1" />
      <path d="M13 2v3h-3" />
      <path d="M13 11a5 5 0 0 1-9 3l-1-1" />
      <path d="M3 14v-3h3" />
    </svg>
  );
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  // UTC bucket — keeps the streak deterministic on the server.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeStreak(completedAts: number[]): number {
  if (completedAts.length === 0) return 0;
  const days = new Set<string>();
  for (const ts of completedAts) days.add(dayKey(ts));

  const now = Date.now();
  const today = dayKey(now);
  const ONE_DAY = 24 * 60 * 60 * 1000;
  let cursor = days.has(today) ? now : now - ONE_DAY;
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor -= ONE_DAY;
  }
  return streak;
}
