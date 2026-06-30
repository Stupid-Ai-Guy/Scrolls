// Spaced-repetition scheduling and mastery math.
//
// A lesson can have up to three completion stages:
//   - 'initial'  : finished the lesson for the first time.
//   - 'day1'     : finished the Day +1 review set (>= 1 day after 'initial').
//   - 'day3'     : finished the Day +3 review set (>= 2 days after 'day1').
//
// Mastery progresses 0 → 33% → 66% → 100% as those stages complete. A
// learner can never hit 100% in one sitting — the schedule is enforced by
// `availableStage` below using UTC day buckets (same convention as the
// existing streak code).

export type Stage = "initial" | "day1" | "day3";

export type CompletionRow = {
  lesson_id: number;
  stage: Stage | string;
  completed_at: number;
};

export type LessonProgress = {
  // Latest stage the learner has completed for this lesson, or null if
  // they haven't finished it yet.
  completedStage: Stage | null;
  // Earliest stage they're allowed to attempt right now ("initial" if
  // they haven't started; "day1" / "day3" once enough time has passed;
  // null if everything is done OR they're waiting for a review window).
  availableStage: Stage | null;
  // Mastery, 0..1 — 0 / 0.33 / 0.66 / 1.0.
  mastery: number;
  // When the next review unlocks (ms epoch), or null if there is no
  // pending review (either nothing started, or all stages done).
  reviewDueAt: number | null;
  // True when reviewDueAt <= now — i.e. a Day +1 or Day +3 review is
  // available right now.
  reviewDueNow: boolean;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Number of full UTC days between two timestamps. `from` is normalized to
// the start of its day, `to` is taken as-is, so "completed yesterday" → 1
// from any time today.
function daysSince(from: number, to: number): number {
  return Math.floor((to - startOfUtcDay(from)) / ONE_DAY_MS);
}

function masteryForStage(stage: Stage | null): number {
  if (stage === "day3") return 1;
  if (stage === "day1") return 0.66;
  if (stage === "initial") return 0.33;
  return 0;
}

// Latest stage completed for one lesson, given the user's full completion
// history filtered to that lesson. Picks the highest-rank stage.
function latestStage(rows: CompletionRow[]): {
  stage: Stage | null;
  completedAt: number | null;
} {
  let best: Stage | null = null;
  let bestAt: number | null = null;
  const rank: Record<Stage, number> = { initial: 0, day1: 1, day3: 2 };
  for (const r of rows) {
    const s = r.stage as Stage;
    if (s !== "initial" && s !== "day1" && s !== "day3") continue;
    if (best === null || rank[s] > rank[best]) {
      best = s;
      bestAt = r.completed_at;
    } else if (s === best && bestAt !== null && r.completed_at > bestAt) {
      bestAt = r.completed_at;
    }
  }
  return { stage: best, completedAt: bestAt };
}

export type LessonRepetitionInfo = {
  hasDay1: boolean;
  hasDay3: boolean;
};

// Decides what review (if any) the learner can attempt next, given which
// review sets the lesson actually has authored. A lesson with no day1
// questions can never transition past 'initial'; same for day3.
export function computeLessonProgress(
  rows: CompletionRow[],
  info: LessonRepetitionInfo,
  now: number = Date.now(),
): LessonProgress {
  const { stage, completedAt } = latestStage(rows);
  const mastery = masteryForStage(stage);

  if (stage === null) {
    // Haven't started — initial set is always available.
    return {
      completedStage: null,
      availableStage: "initial",
      mastery,
      reviewDueAt: null,
      reviewDueNow: false,
    };
  }

  if (stage === "initial" && info.hasDay1) {
    const due = startOfUtcDay(completedAt!) + ONE_DAY_MS;
    const ready = daysSince(completedAt!, now) >= 1;
    return {
      completedStage: stage,
      availableStage: ready ? "day1" : null,
      mastery,
      reviewDueAt: due,
      reviewDueNow: ready,
    };
  }

  if (stage === "day1" && info.hasDay3) {
    const due = startOfUtcDay(completedAt!) + 2 * ONE_DAY_MS;
    const ready = daysSince(completedAt!, now) >= 2;
    return {
      completedStage: stage,
      availableStage: ready ? "day3" : null,
      mastery,
      reviewDueAt: due,
      reviewDueNow: ready,
    };
  }

  // Either fully mastered (day3) or the lesson has no further sets — nothing
  // more to schedule. Mastery is capped at whatever the last completed
  // stage is worth.
  return {
    completedStage: stage,
    availableStage: null,
    mastery,
    reviewDueAt: null,
    reviewDueNow: false,
  };
}

// Convenience: bucket every completion row by lesson_id, then compute
// progress per lesson. Returned map only includes lessons the learner
// has actually engaged with OR lessons supplied in `lessonInfo`. Callers
// usually pass a Map keyed by every lesson in scope.
export function computeAllProgress(
  rows: CompletionRow[],
  lessonInfo: Map<number, LessonRepetitionInfo>,
  now: number = Date.now(),
): Map<number, LessonProgress> {
  const byLesson = new Map<number, CompletionRow[]>();
  for (const r of rows) {
    if (!byLesson.has(r.lesson_id)) byLesson.set(r.lesson_id, []);
    byLesson.get(r.lesson_id)!.push(r);
  }
  const out = new Map<number, LessonProgress>();
  for (const [lessonId, info] of lessonInfo) {
    const lessonRows = byLesson.get(lessonId) ?? [];
    out.set(lessonId, computeLessonProgress(lessonRows, info, now));
  }
  // Also fold in lessons that have completions but no info passed
  // explicitly (shouldn't really happen, but keeps the helper total).
  for (const [lessonId, lessonRows] of byLesson) {
    if (!out.has(lessonId)) {
      out.set(
        lessonId,
        computeLessonProgress(
          lessonRows,
          { hasDay1: false, hasDay3: false },
          now,
        ),
      );
    }
  }
  return out;
}
