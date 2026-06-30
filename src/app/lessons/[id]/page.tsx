import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { dbAll, dbGet, type LessonRow } from "@/lib/db";
import { parseLessonContent, type Block } from "@/lib/lesson-content";
import {
  computeLessonProgress,
  type CompletionRow,
} from "@/lib/spaced-repetition";
import LessonPlayer from "./player";
import ReviewLocked from "./review-locked";

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const lessonId = Number(id);
  if (!Number.isInteger(lessonId) || lessonId <= 0) notFound();

  // Preview mode: lesson author opens the lesson from the editor with
  // ?preview=1. Only honored for admins so a learner can't bypass the
  // spaced-repetition gate by editing the URL. In preview, no completion
  // is recorded and the original blocks always play (no review override,
  // no locked-review panel).
  const sp = await searchParams;
  const preview = sp.preview === "1" && session.role === "admin";

  const lesson = await dbGet<LessonRow>(
    "SELECT id, title, description, content, grade, subject, created_by, created_at FROM lessons WHERE id = $1",
    [lessonId],
  );

  if (!lesson) notFound();

  const { blocks, repetitionSets } = parseLessonContent(lesson.content);
  const day1 = repetitionSets?.day1 ?? [];
  const day3 = repetitionSets?.day3 ?? [];

  const completionRows = await dbAll<CompletionRow>(
    "SELECT lesson_id, stage, completed_at FROM lesson_completions WHERE user_id = $1 AND lesson_id = $2",
    [session.userId, lessonId],
  );

  const progress = computeLessonProgress(completionRows, {
    hasDay1: day1.length > 0,
    hasDay3: day3.length > 0,
  });

  // Pick which set of blocks to play, based on stage availability.
  //   - never started: play the original lesson, stage='initial'
  //   - day1 unlocked: play the day1 questions, stage='day1'
  //   - day3 unlocked: play the day3 questions, stage='day3'
  //   - waiting: render a "come back soon" panel
  //   - fully mastered: render a "mastered" panel
  // Preview mode short-circuits everything to the original blocks and a
  // disabled completion recorder.
  let playableBlocks: Block[] = blocks;
  let stage: "initial" | "day1" | "day3" = "initial";
  if (!preview) {
    if (progress.availableStage === "day1") {
      playableBlocks = day1;
      stage = "day1";
    } else if (progress.availableStage === "day3") {
      playableBlocks = day3;
      stage = "day3";
    }

    if (
      progress.availableStage === null &&
      (progress.completedStage === "initial" ||
        progress.completedStage === "day1")
    ) {
      // Review is on a delay — show the locked panel instead of the player.
      return (
        <ReviewLocked
          lessonId={lesson.id}
          title={lesson.title}
          subject={lesson.subject}
          grade={lesson.grade}
          completedStage={progress.completedStage}
          mastery={progress.mastery}
          reviewDueAt={progress.reviewDueAt ?? 0}
        />
      );
    }

    if (
      progress.availableStage === null &&
      progress.completedStage === "day3"
    ) {
      return (
        <ReviewLocked
          lessonId={lesson.id}
          title={lesson.title}
          subject={lesson.subject}
          grade={lesson.grade}
          completedStage="day3"
          mastery={1}
          reviewDueAt={null}
        />
      );
    }
  }

  return (
    <LessonPlayer
      lessonId={lesson.id}
      title={lesson.title}
      description={lesson.description}
      subject={lesson.subject}
      grade={lesson.grade}
      blocks={playableBlocks}
      stage={stage}
      mastery={progress.mastery}
      preview={preview}
    />
  );
}
