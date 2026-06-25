"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Block,
  ImageBlock,
  InteractiveBlock,
  QuestionBlock,
  TextBlock,
} from "@/lib/lesson-content";
import { recordLessonCompletionAction } from "@/lib/actions";
import ScrollScriptRunner from "@/components/scrollscript-runner";
import { SceneRunner } from "@/components/scene-editor";
import { RichText } from "@/lib/rich-text";
import {
  gradeLongLabel,
  gradeParam,
  normalizeSubject,
  subjectPill,
} from "@/lib/curriculum";

type QuestionState = { selected: number | null; submitted: boolean };
type InteractiveState = { checked: boolean; correct: boolean };

export default function LessonPlayer({
  lessonId,
  title,
  description,
  subject,
  grade,
  blocks,
}: {
  lessonId: number;
  title: string;
  description: string;
  subject: string;
  grade: number;
  blocks: Block[];
}) {
  const [index, setIndex] = useState(0);
  const [questionState, setQuestionState] = useState<
    Record<number, QuestionState>
  >({});
  const [interactiveState, setInteractiveState] = useState<
    Record<number, InteractiveState>
  >({});

  const totalQuestions = useMemo(
    () =>
      blocks.filter((b) => b.type === "question" || b.type === "interactive")
        .length,
    [blocks],
  );
  const correctSoFar = useMemo(() => {
    let n = 0;
    for (const [k, v] of Object.entries(questionState)) {
      const i = Number(k);
      const b = blocks[i];
      if (
        b &&
        b.type === "question" &&
        v.submitted &&
        v.selected === b.correctIndex
      )
        n++;
    }
    for (const [k, v] of Object.entries(interactiveState)) {
      const i = Number(k);
      const b = blocks[i];
      if (b && b.type === "interactive" && v.checked && v.correct) n++;
    }
    return n;
  }, [questionState, interactiveState, blocks]);

  const backHref = `/dashboard?subject=${normalizeSubject(subject)}&grade=${gradeParam(grade)}`;
  const total = blocks.length;
  const atEnd = index >= total;
  const progressPct =
    total === 0 ? 100 : Math.round((Math.min(index, total) / total) * 100);

  // Record a completion the first time the learner reaches the end of a
  // non-empty lesson. Stays gated for the lifetime of this player instance
  // so "Try again" → "complete" doesn't double-log.
  const recordedRef = useRef(false);
  useEffect(() => {
    if (atEnd && total > 0 && !recordedRef.current) {
      recordedRef.current = true;
      recordLessonCompletionAction(lessonId).catch(() => {});
    }
  }, [atEnd, total, lessonId]);

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
          <Link
            href={backHref}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          >
            Close
          </Link>
        </div>
        <div className="h-1 w-full bg-zinc-900">
          <div
            className="h-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.7)] transition-all"
            style={{ width: `${progressPct}%` }}
          />
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
          {total > 0 && !atEnd && (
            <span className="ml-auto text-xs text-zinc-500">
              {index + 1} of {total}
            </span>
          )}
        </div>

        {total === 0 ? (
          <EmptyLesson
            title={title}
            description={description}
            backHref={backHref}
          />
        ) : atEnd ? (
          <CompletionCard
            title={title}
            correct={correctSoFar}
            totalQuestions={totalQuestions}
            backHref={backHref}
            onRestart={() => {
              setIndex(0);
              setQuestionState({});
              setInteractiveState({});
            }}
          />
        ) : (
          <BlockView
            block={blocks[index]}
            qs={questionState[index]}
            is={interactiveState[index]}
            onAnswer={(selected) =>
              setQuestionState((s) => ({
                ...s,
                [index]: { selected, submitted: false },
              }))
            }
            onSubmit={() =>
              setQuestionState((s) => ({
                ...s,
                [index]: {
                  selected: s[index]?.selected ?? null,
                  submitted: true,
                },
              }))
            }
            onInteractiveResult={(correct) =>
              setInteractiveState((s) => ({
                ...s,
                [index]: { checked: true, correct },
              }))
            }
            onContinue={() => setIndex((i) => i + 1)}
            onPrev={index > 0 ? () => setIndex((i) => i - 1) : undefined}
          />
        )}
      </main>
    </div>
  );
}

function EmptyLesson({
  title,
  description,
  backHref,
}: {
  title: string;
  description: string;
  backHref: string;
}) {
  return (
    <div className="rounded-2xl bg-zinc-950 p-10 text-center ring-1 ring-zinc-800">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
        {title}
      </h1>
      {description && (
        <p className="mt-2 text-sm text-zinc-400">{description}</p>
      )}
      <p className="mt-6 text-sm italic text-zinc-500">This lesson is empty.</p>
      <Link
        href={backHref}
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
      >
        Back to dashboard
      </Link>
    </div>
  );
}

function CompletionCard({
  title,
  correct,
  totalQuestions,
  backHref,
  onRestart,
}: {
  title: string;
  correct: number;
  totalQuestions: number;
  backHref: string;
  onRestart: () => void;
}) {
  return (
    <div className="rounded-2xl bg-zinc-950 p-10 text-center ring-1 ring-zinc-800">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/30">
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
      </div>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-100">
        Lesson complete
      </h2>
      <p className="mt-1 text-sm text-zinc-400">{title}</p>
      {totalQuestions > 0 && (
        <p className="mt-4 text-base text-zinc-200">
          <span className="text-2xl font-semibold text-zinc-50">{correct}</span>
          <span className="text-zinc-500"> / {totalQuestions} correct</span>
        </p>
      )}
      <div className="mt-6 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-zinc-800 hover:bg-zinc-800"
        >
          Try again
        </button>
        <Link
          href={backHref}
          className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function BlockView({
  block,
  qs,
  is,
  onAnswer,
  onSubmit,
  onInteractiveResult,
  onContinue,
  onPrev,
}: {
  block: Block;
  qs: QuestionState | undefined;
  is: InteractiveState | undefined;
  onAnswer: (i: number) => void;
  onSubmit: () => void;
  onInteractiveResult: (correct: boolean) => void;
  onContinue: () => void;
  onPrev?: () => void;
}) {
  return (
    <div className="rounded-2xl bg-zinc-950 p-8 ring-1 ring-zinc-800">
      {block.type === "text" && <TextView block={block} />}
      {block.type === "image" && <ImageView block={block} />}
      {block.type === "question" && (
        <QuestionView block={block} qs={qs} onAnswer={onAnswer} />
      )}
      {block.type === "interactive" && (
        <InteractiveView block={block} onResult={onInteractiveResult} />
      )}

      <div className="mt-8 flex items-center justify-between">
        {onPrev ? (
          <button
            type="button"
            onClick={onPrev}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          >
            ← Previous
          </button>
        ) : (
          <span />
        )}

        {block.type === "question" ? (
          qs?.submitted ? (
            <button
              type="button"
              onClick={onContinue}
              className="rounded-lg bg-cyan-500 px-5 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={qs?.selected == null}
              className="rounded-lg bg-cyan-500 px-5 py-2 text-sm font-semibold text-black hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Check answer
            </button>
          )
        ) : block.type === "interactive" ? (
          <button
            type="button"
            onClick={onContinue}
            className="rounded-lg bg-cyan-500 px-5 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
          >
            {is?.checked && is.correct ? "Continue" : "Skip"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onContinue}
            className="rounded-lg bg-cyan-500 px-5 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

function TextView({ block }: { block: TextBlock }) {
  return (
    <div>
      {block.title && (
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">
          {block.title}
        </h2>
      )}
      <div className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-zinc-300">
        {block.body || (
          <span className="italic text-zinc-500">No content yet.</span>
        )}
      </div>
    </div>
  );
}

function ImageView({ block }: { block: ImageBlock }) {
  return (
    <figure>
      {block.url ? (
        <div className="overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.url}
            alt={block.caption ?? ""}
            className="mx-auto block max-h-[28rem] w-full object-contain"
          />
        </div>
      ) : (
        <div className="rounded-xl bg-zinc-900 px-6 py-16 text-center text-sm italic text-zinc-500 ring-1 ring-zinc-800">
          No image set for this diagram.
        </div>
      )}
      {block.caption && (
        <figcaption className="mt-3 text-center text-sm text-zinc-500">
          {block.caption}
        </figcaption>
      )}
    </figure>
  );
}

function QuestionView({
  block,
  qs,
  onAnswer,
}: {
  block: QuestionBlock;
  qs: QuestionState | undefined;
  onAnswer: (i: number) => void;
}) {
  const submitted = qs?.submitted ?? false;
  const selected = qs?.selected ?? null;
  const isCorrect = submitted && selected === block.correctIndex;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
        Question
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-100">
        {block.prompt ? (
          <RichText source={block.prompt} />
        ) : (
          "Untitled question"
        )}
      </h2>

      {block.imageUrl && (
        <div className="mt-5 overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.imageUrl}
            alt=""
            className="mx-auto block max-h-[20rem] w-full object-contain"
          />
        </div>
      )}

      <div className="mt-6 space-y-2">
        {block.options.map((opt, i) => {
          const isSelected = selected === i;
          const isAnswer = i === block.correctIndex;
          let className =
            "flex w-full cursor-pointer items-center gap-3 rounded-xl bg-zinc-900 p-4 text-left text-sm ring-1 transition";
          if (submitted) {
            if (isAnswer) className += " ring-emerald-400 bg-emerald-500/10";
            else if (isSelected) className += " ring-rose-400 bg-rose-500/10";
            else className += " ring-zinc-800";
          } else {
            className += isSelected
              ? " ring-cyan-400 ring-2"
              : " ring-zinc-800 hover:ring-zinc-700";
          }
          return (
            <button
              key={i}
              type="button"
              disabled={submitted}
              onClick={() => !submitted && onAnswer(i)}
              className={className}
            >
              <span
                className={
                  "flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold " +
                  (submitted && isAnswer
                    ? "bg-emerald-500 text-black"
                    : submitted && isSelected
                      ? "bg-rose-500 text-black"
                      : isSelected
                        ? "bg-cyan-500 text-black"
                        : "bg-zinc-800 text-zinc-300")
                }
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-zinc-100">
                {opt ? <RichText source={opt} /> : "(empty)"}
              </span>
            </button>
          );
        })}
      </div>

      {submitted && (
        <div
          className={
            "mt-5 rounded-xl p-4 text-sm ring-1 " +
            (isCorrect
              ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30"
              : "bg-rose-500/10 text-rose-200 ring-rose-500/30")
          }
        >
          <p className="font-semibold">
            {isCorrect ? "Correct" : "Not quite"}
          </p>
          {block.explanation && (
            <p className="mt-1 text-zinc-300">
              <RichText source={block.explanation} />
            </p>
          )}
          {!isCorrect && !block.explanation && (
            <p className="mt-1 text-zinc-300">
              The correct answer is{" "}
              {String.fromCharCode(65 + block.correctIndex)}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function InteractiveView({
  block,
  onResult,
}: {
  block: InteractiveBlock;
  onResult: (correct: boolean) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
        Interactive
      </p>
      {block.prompt && (
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-100">
          <RichText source={block.prompt} />
        </h2>
      )}
      {block.imageUrl && (
        <div className="mt-5 overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.imageUrl}
            alt=""
            className="mx-auto block max-h-[20rem] w-full object-contain"
          />
        </div>
      )}
      <div className="mt-6">
        {block.scene ? (
          <SceneRunner scene={block.scene} onCheckResult={onResult} />
        ) : (
          <ScrollScriptRunner code={block.code} onCheckResult={onResult} />
        )}
      </div>
    </div>
  );
}
