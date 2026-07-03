"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Block,
  ImageBlock,
  InteractiveBlock,
  QuestionBlock,
  TextBlock,
  WritingBlock,
} from "@/lib/lesson-content";
import katex from "katex";
import { recordLessonCompletionAction } from "@/lib/actions";
import ScrollScriptRunner from "@/components/scrollscript-runner";
import { SceneRunner } from "@/components/scene-editor";
import { RichText } from "@/lib/rich-text";
import ThemeToggle from "@/components/theme-toggle";
import type { Theme } from "@/lib/theme";
import {
  gradeLongLabel,
  gradeParam,
  normalizeSubject,
  subjectPill,
} from "@/lib/curriculum";

type QuestionState = { selected: number | null; submitted: boolean };
type InteractiveState = { checked: boolean; correct: boolean };
type WritingState = { value: string; submitted: boolean; correct: boolean };

export default function LessonPlayer({
  lessonId,
  title,
  description,
  subject,
  grade,
  blocks,
  stage = "initial",
  mastery = 0,
  preview = false,
  theme,
}: {
  lessonId: number;
  title: string;
  description: string;
  subject: string;
  grade: number;
  blocks: Block[];
  stage?: "initial" | "day1" | "day3";
  mastery?: number;
  preview?: boolean;
  theme: Theme;
}) {
  const [index, setIndex] = useState(0);
  const [questionState, setQuestionState] = useState<
    Record<number, QuestionState>
  >({});
  const [interactiveState, setInteractiveState] = useState<
    Record<number, InteractiveState>
  >({});
  const [writingState, setWritingState] = useState<
    Record<number, WritingState>
  >({});

  const totalQuestions = useMemo(
    () =>
      blocks.filter(
        (b) =>
          b.type === "question" ||
          b.type === "writing" ||
          b.type === "interactive",
      ).length,
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
    for (const [k, v] of Object.entries(writingState)) {
      const i = Number(k);
      const b = blocks[i];
      if (b && b.type === "writing" && v.submitted && v.correct) n++;
    }
    return n;
  }, [questionState, interactiveState, writingState, blocks]);

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
    // Preview from the editor never records a completion — the author is
    // QA'ing the lesson, not learning it.
    if (preview) return;
    if (atEnd && total > 0 && !recordedRef.current) {
      recordedRef.current = true;
      recordLessonCompletionAction(lessonId, stage).catch(() => {});
    }
  }, [atEnd, total, lessonId, stage, preview]);

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
        <div className="h-1 w-full bg-zinc-900">
          <div
            className="h-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.7)] transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {preview && (
          <div className="border-t border-amber-500/30 bg-amber-500/10 px-6 py-1.5 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300">
            Preview mode · completion is not recorded
          </div>
        )}
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
            stage={stage}
            // After this stage records, mastery jumps to the *next*
            // threshold — show that as the new value so the user feels
            // the progression.
            masteryBefore={mastery}
            onRestart={() => {
              setIndex(0);
              setQuestionState({});
              setInteractiveState({});
              setWritingState({});
            }}
          />
        ) : (
          <BlockView
            block={blocks[index]}
            qs={questionState[index]}
            is={interactiveState[index]}
            ws={writingState[index]}
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
            onWritingChange={(value) =>
              setWritingState((s) => ({
                ...s,
                [index]: {
                  value,
                  submitted: false,
                  correct: s[index]?.correct ?? false,
                },
              }))
            }
            onWritingSubmit={(correct) =>
              setWritingState((s) => ({
                ...s,
                [index]: {
                  value: s[index]?.value ?? "",
                  submitted: true,
                  correct,
                },
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
  stage,
  masteryBefore,
  onRestart,
}: {
  title: string;
  correct: number;
  totalQuestions: number;
  backHref: string;
  stage: "initial" | "day1" | "day3";
  masteryBefore: number;
  onRestart: () => void;
}) {
  // After this stage was just recorded, mastery advances:
  //   initial → 33%, day1 → 66%, day3 → 100%.
  const masteryAfter =
    stage === "day3" ? 1 : stage === "day1" ? 0.66 : 0.33;
  const masteryAfterPct = Math.round(masteryAfter * 100);
  const masteryBeforePct = Math.round(masteryBefore * 100);
  const justMastered = stage === "day3";
  const headline =
    stage === "initial"
      ? "Lesson complete"
      : stage === "day1"
        ? "Day +1 review complete"
        : "Day +3 review complete";
  const nextHint =
    stage === "initial"
      ? "Come back in a day for the Day +1 review."
      : stage === "day1"
        ? "Two more days to lock it in with the Day +3 review."
        : "You mastered this skill.";

  return (
    <div className="rounded-2xl bg-zinc-950 p-10 text-center ring-1 ring-zinc-800">
      <div
        className={
          "mx-auto flex h-12 w-12 items-center justify-center rounded-full ring-1 " +
          (justMastered
            ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
            : "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30")
        }
      >
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
        {headline}
      </h2>
      <p className="mt-1 text-sm text-zinc-400">{title}</p>
      {totalQuestions > 0 && (
        <p className="mt-4 text-base text-zinc-200">
          <span className="text-2xl font-semibold text-zinc-50">{correct}</span>
          <span className="text-zinc-500"> / {totalQuestions} correct</span>
        </p>
      )}

      <div className="mt-6 inline-flex flex-col items-center gap-1">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Mastery
        </span>
        <span
          className={
            "text-3xl font-semibold " +
            (justMastered ? "text-emerald-300" : "text-zinc-100")
          }
        >
          {masteryBeforePct}% → {masteryAfterPct}%
        </span>
      </div>
      <p className="mx-auto mt-4 max-w-sm text-sm text-zinc-400">{nextHint}</p>

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
  ws,
  onAnswer,
  onSubmit,
  onInteractiveResult,
  onWritingChange,
  onWritingSubmit,
  onContinue,
  onPrev,
}: {
  block: Block;
  qs: QuestionState | undefined;
  is: InteractiveState | undefined;
  ws: WritingState | undefined;
  onAnswer: (i: number) => void;
  onSubmit: () => void;
  onInteractiveResult: (correct: boolean) => void;
  onWritingChange: (value: string) => void;
  onWritingSubmit: (correct: boolean) => void;
  onContinue: () => void;
  onPrev?: () => void;
}) {
  function checkWriting() {
    if (block.type !== "writing") return;
    const value = ws?.value ?? "";
    const correct = matchesAcceptedAnswer(value, block);
    onWritingSubmit(correct);
  }

  return (
    <div className="rounded-2xl bg-zinc-950 p-8 ring-1 ring-zinc-800">
      {block.type === "text" && <TextView block={block} />}
      {block.type === "image" && <ImageView block={block} />}
      {block.type === "question" && (
        <QuestionView block={block} qs={qs} onAnswer={onAnswer} />
      )}
      {block.type === "writing" && (
        <WritingView
          block={block}
          ws={ws}
          onChange={onWritingChange}
        />
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
        ) : block.type === "writing" ? (
          ws?.submitted ? (
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
              onClick={checkWriting}
              disabled={!ws?.value?.trim()}
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

function normalizeWritingAnswer(raw: string, caseSensitive: boolean): string {
  // Collapse internal whitespace so "2 x + 3" matches "2x+3" (LaTeX / math
  // expressions rarely care about spacing). Leading/trailing trimmed too.
  let s = raw.trim().replace(/\s+/g, "");
  if (!caseSensitive) s = s.toLowerCase();
  return s;
}

function matchesAcceptedAnswer(value: string, block: WritingBlock): boolean {
  // LaTeX answers are always case-sensitive because \sin and \Sin differ.
  const cs = !!block.caseSensitive || !!block.alwaysLatex;
  const norm = normalizeWritingAnswer(value, cs);
  if (!norm) return false;
  return block.acceptedAnswers.some(
    (a) => normalizeWritingAnswer(a, cs) === norm,
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

// Walks backward from `cursor` and returns the last "atom" — a balanced
// (..) group, a balanced {..} group (unwrapped), or a run of word
// characters. Used by `/` to wrap the prior value in a fraction.
function findLastAtom(
  source: string,
  cursor: number,
): { text: string; start: number } | null {
  if (cursor <= 0) return null;
  const ch = source[cursor - 1];
  if (ch === ")") {
    let depth = 0;
    for (let i = cursor - 1; i >= 0; i--) {
      if (source[i] === ")") depth++;
      else if (source[i] === "(") {
        depth--;
        if (depth === 0) return { text: source.slice(i, cursor), start: i };
      }
    }
    return null;
  }
  if (ch === "}") {
    let depth = 0;
    for (let i = cursor - 1; i >= 0; i--) {
      if (source[i] === "}") depth++;
      else if (source[i] === "{") {
        depth--;
        if (depth === 0) {
          // Unwrap: return only what's inside the braces.
          return { text: source.slice(i + 1, cursor - 1), start: i };
        }
      }
    }
    return null;
  }
  if (/[a-zA-Z0-9.]/.test(ch)) {
    let i = cursor - 1;
    while (i >= 0 && /[a-zA-Z0-9.]/.test(source[i])) i--;
    return { text: source.slice(i + 1, cursor), start: i + 1 };
  }
  return null;
}

function LatexInputArea({
  block,
  value,
  onChange,
  disabled,
  ringClass,
}: {
  block: WritingBlock;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  ringClass: string;
}) {
  // Source is the raw LaTeX the student is building. `cursor` is the index
  // into source where the next keystroke or button-press lands.
  const [source, setSource] = useState(value);
  const [cursor, setCursor] = useState(value.length);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value (parent restart, etc.) back into local state.
  useEffect(() => {
    setSource(value);
    setCursor(value.length);
  }, [value]);

  const apply = (nextSource: string, nextCursor: number) => {
    setSource(nextSource);
    setCursor(nextCursor);
    onChange(nextSource);
  };

  const insertText = (t: string) => {
    if (disabled) return;
    apply(source.slice(0, cursor) + t + source.slice(cursor), cursor + t.length);
  };

  // Button snippets can mark the cursor slot with an empty `{}`, `()`, or
  // `[]`. After insert, cursor goes BETWEEN the two characters of the slot.
  const insertSnippet = (snippet: string) => {
    if (disabled || !snippet) return;
    const slot = snippet.match(/\{\}|\(\)|\[\]/);
    const ns = source.slice(0, cursor) + snippet + source.slice(cursor);
    if (slot && slot.index !== undefined) {
      apply(ns, cursor + slot.index + 1);
    } else {
      apply(ns, cursor + snippet.length);
    }
  };

  const backspace = () => {
    if (disabled || cursor === 0) return;
    apply(source.slice(0, cursor - 1) + source.slice(cursor), cursor - 1);
  };

  // `/` wraps the last atom in `\frac{atom}{}` and parks the cursor inside
  // the empty denominator. If there's nothing to wrap, falls back to a
  // literal `/` so e.g. an existing fraction's display isn't blocked.
  const slash = () => {
    if (disabled) return;
    const atom = findLastAtom(source, cursor);
    if (atom === null) {
      insertText("/");
      return;
    }
    const before = source.slice(0, atom.start);
    const after = source.slice(cursor);
    const inserted = `\\frac{${atom.text}}{}`;
    apply(before + inserted + after, before.length + inserted.length - 1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === "Backspace") {
      e.preventDefault();
      backspace();
    } else if (e.key === "/") {
      e.preventDefault();
      slash();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setCursor((c) => Math.min(source.length, c + 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setCursor(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setCursor(source.length);
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      insertText(e.key);
    }
  };

  // Render the preview. Replace empty `{}` / `[]` with `{\square}` so empty
  // slots stay visible — KaTeX would otherwise collapse them to nothing,
  // which is disorienting after pressing `/` lands the cursor in an empty
  // denominator. Also render a small caret-equivalent at the cursor position
  // by splitting the source: prefix `\,|\,` suffix would break LaTeX
  // mid-expression though, so we don't try to draw an in-equation cursor —
  // arrow keys still work, just without a visual carat in the rendered math.
  const previewSource = useMemo(() => {
    const visibleSource = source
      .replace(/\{\}/g, "{\\square}")
      .replace(/\[\]/g, "[\\square]");
    return visibleSource || "\\,";
  }, [source]);

  const previewHtml = useMemo(() => {
    try {
      return katex.renderToString(previewSource, {
        throwOnError: false,
        displayMode: false,
        output: "html",
      });
    } catch {
      return "";
    }
  }, [previewSource]);

  const buttons = block.buttons ?? [];

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.focus()}
        className={
          "flex min-h-[5.5rem] cursor-text items-center justify-center rounded-xl bg-zinc-900/60 px-4 py-5 ring-1 transition " +
          ringClass
        }
      >
        <div
          className="text-2xl leading-tight text-zinc-100"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>
      {/* Hidden but real input: receives keyboard focus, captures keys via
          onKeyDown. Stays empty (we manage value ourselves) and is positioned
          off-screen so it doesn't take layout space. */}
      <input
        ref={inputRef}
        type="text"
        value=""
        readOnly
        autoFocus={!disabled}
        onKeyDown={onKeyDown}
        onChange={() => {}}
        aria-label="LaTeX answer input"
        className="sr-only"
        suppressHydrationWarning
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {buttons.map((b, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => {
              insertSnippet(b.latex);
              inputRef.current?.focus();
            }}
            className="rounded-md bg-zinc-800 px-2.5 py-1 text-sm font-medium text-zinc-100 ring-1 ring-zinc-700 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {b.label || "·"}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            slash();
            inputRef.current?.focus();
          }}
          title="Turn the last value into a fraction"
          className="rounded-md bg-zinc-800 px-2.5 py-1 text-sm font-medium text-zinc-100 ring-1 ring-zinc-700 hover:bg-zinc-700 disabled:opacity-50"
        >
          a⁄b
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            backspace();
            inputRef.current?.focus();
          }}
          title="Backspace"
          className="rounded-md bg-zinc-800 px-2.5 py-1 text-sm font-medium text-zinc-100 ring-1 ring-zinc-700 hover:bg-zinc-700 disabled:opacity-50"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}

function WritingView({
  block,
  ws,
  onChange,
}: {
  block: WritingBlock;
  ws: WritingState | undefined;
  onChange: (value: string) => void;
}) {
  const submitted = ws?.submitted ?? false;
  const correct = submitted && (ws?.correct ?? false);
  const value = ws?.value ?? "";
  const ringClass = submitted
    ? correct
      ? "ring-emerald-400"
      : "ring-rose-400"
    : "ring-zinc-800 focus-within:ring-2 focus-within:ring-cyan-400";

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
        Writing
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

      <div className="mt-6">
        {block.alwaysLatex ? (
          <LatexInputArea
            block={block}
            value={value}
            onChange={onChange}
            disabled={submitted}
            ringClass={ringClass}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={submitted}
            placeholder="Type your answer"
            autoComplete="off"
            suppressHydrationWarning
            className={
              "w-full rounded-xl bg-zinc-900 px-4 py-3 text-base text-zinc-100 ring-1 transition placeholder:text-zinc-600 focus:outline-none disabled:opacity-70 " +
              (submitted
                ? correct
                  ? "ring-emerald-400"
                  : "ring-rose-400"
                : "ring-zinc-800 focus:ring-2 focus:ring-cyan-400")
            }
          />
        )}
      </div>

      {submitted && (
        <div
          className={
            "mt-5 rounded-xl p-4 text-sm ring-1 " +
            (correct
              ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30"
              : "bg-rose-500/10 text-rose-200 ring-rose-500/30")
          }
        >
          <p className="font-semibold">{correct ? "Correct" : "Not quite"}</p>
          {!correct && (
            <p className="mt-1 text-zinc-300">
              Accepted answer:{" "}
              <span className="font-mono text-zinc-100">
                {block.acceptedAnswers[0] || "(unset)"}
              </span>
              {block.acceptedAnswers.length > 1 && (
                <span className="text-zinc-500">
                  {" "}
                  · {block.acceptedAnswers.length - 1} other accepted
                </span>
              )}
            </p>
          )}
          {block.explanation && (
            <p className="mt-1 text-zinc-300">
              <RichText source={block.explanation} />
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
