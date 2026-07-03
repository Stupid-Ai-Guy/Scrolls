import Link from "next/link";
import {
  gradeLongLabel,
  gradeParam,
  normalizeSubject,
  subjectPill,
} from "@/lib/curriculum";
import ThemeToggle from "@/components/theme-toggle";
import type { Theme } from "@/lib/theme";

export default function ReviewLocked({
  lessonId,
  title,
  subject,
  grade,
  completedStage,
  mastery,
  reviewDueAt,
  theme,
}: {
  lessonId: number;
  title: string;
  subject: string;
  grade: number;
  completedStage: "initial" | "day1" | "day3";
  mastery: number;
  reviewDueAt: number | null;
  theme: Theme;
}) {
  const backHref = `/dashboard?subject=${normalizeSubject(subject)}&grade=${gradeParam(grade)}`;
  const isMastered = completedStage === "day3";
  const masteryPct = Math.round(mastery * 100);

  const nextLabel =
    completedStage === "initial"
      ? "Day +1 review"
      : completedStage === "day1"
        ? "Day +3 review"
        : null;

  const dueDate =
    reviewDueAt !== null
      ? new Date(reviewDueAt).toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        })
      : null;

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-20 border-b border-zinc-900 bg-black/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-3">
          <Link href={backHref} className="flex items-center gap-2">
            <span className="inline-block h-6 w-6 rounded-md bg-cyan-400 shadow-[0_0_20px_-2px_rgba(34,211,238,0.7)]" />
            <span className="text-base font-semibold tracking-tight text-zinc-100">
              Scrolls
            </span>
          </Link>
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-sm font-medium text-zinc-300">
              {title}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle theme={theme} />
            <Link
              href={backHref}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            >
              Close
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8 flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${subjectPill(subject)}`}
          >
            {subject}
          </span>
          <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-medium text-zinc-400 ring-1 ring-zinc-800">
            {gradeLongLabel(grade)}
          </span>
        </div>

        <div className="rounded-2xl bg-zinc-950 p-10 text-center ring-1 ring-zinc-800">
          <div
            className={
              "mx-auto flex h-12 w-12 items-center justify-center rounded-full ring-1 " +
              (isMastered
                ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                : "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30")
            }
          >
            {isMastered ? (
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" d="M12 7v5l3 2" />
              </svg>
            )}
          </div>

          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-100">
            {isMastered ? "Skill mastered" : "Come back soon"}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">{title}</p>

          <div className="mt-6 inline-flex flex-col items-center gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Mastery
            </span>
            <span
              className={
                "text-3xl font-semibold " +
                (isMastered ? "text-emerald-300" : "text-zinc-100")
              }
            >
              {masteryPct}%
            </span>
          </div>

          {!isMastered && nextLabel && dueDate && (
            <p className="mx-auto mt-6 max-w-sm text-sm text-zinc-300">
              Your <span className="font-semibold">{nextLabel}</span> unlocks
              on <span className="font-semibold">{dueDate}</span>. Spacing the
              review gives this material time to stick.
            </p>
          )}
          {isMastered && (
            <p className="mx-auto mt-6 max-w-sm text-sm text-zinc-300">
              You finished every review for this lesson. You can revisit it
              any time, but mastery is locked in.
            </p>
          )}

          <div className="mt-8 flex items-center justify-center gap-2">
            <Link
              href={backHref}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400"
            >
              Back to dashboard
            </Link>
            <Link
              href={`/lessons/${lessonId}/preview`}
              className="hidden rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-zinc-800 hover:bg-zinc-800"
            >
              Review notes
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
