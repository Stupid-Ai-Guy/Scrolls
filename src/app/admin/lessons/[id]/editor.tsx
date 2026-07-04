"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { saveLessonAction, type FormState } from "@/lib/actions";
import {
  emptyBlock,
  type Block,
  type BlockType,
  type ImageBlock,
  type InteractiveBlock,
  type QuestionBlock,
  type RepetitionSets,
  type ReviewBlock,
  type TextBlock,
  type WritingBlock,
} from "@/lib/lesson-content";
import {
  DEFAULT_SCENE,
  SceneEditor as VisualSceneEditor,
  SceneRunner,
} from "@/components/scene-editor";
import type { Scene } from "@/lib/lesson-content";
import ThemeToggle from "@/components/theme-toggle";
import type { Theme } from "@/lib/theme";

type SubjectId = "math" | "language" | "science";
type EditorBlock = Block & { _key: string };

const fieldClass =
  "w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800 transition placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-400";

const initial: FormState = {};

function withKey(b: Block): EditorBlock {
  return { ...b, _key: crypto.randomUUID() } as EditorBlock;
}

function stripKey(b: EditorBlock): Block {
  const { _key, ...rest } = b;
  return rest as Block;
}

type CategoryOption = {
  id: number;
  subject: string;
  grade: number;
  name: string;
};

export default function LessonEditor({
  lessonId,
  initialTitle,
  initialDescription,
  initialSubject,
  initialGrade,
  initialCategoryId,
  initialBlocks,
  initialRepetitionSets,
  theme,
  categories,
}: {
  lessonId: number;
  initialTitle: string;
  initialDescription: string;
  initialSubject: SubjectId;
  initialGrade: number;
  initialCategoryId: number | null;
  initialBlocks: Block[];
  initialRepetitionSets: RepetitionSets;
  theme: Theme;
  categories: CategoryOption[];
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [subject, setSubject] = useState<SubjectId>(initialSubject);
  const [grade, setGrade] = useState<number>(initialGrade);
  const [categoryId, setCategoryId] = useState<number | null>(
    initialCategoryId,
  );
  const [blocks, setBlocks] = useState<EditorBlock[]>(
    initialBlocks.map(withKey),
  );
  const [repetitionSets, setRepetitionSets] = useState<RepetitionSets>(
    initialRepetitionSets,
  );
  const [repetitionOpen, setRepetitionOpen] = useState(false);

  const repetitionCount =
    repetitionSets.day1.length + repetitionSets.day3.length;

  // Cross-editor block clipboard, persisted in localStorage so copy in one
  // lesson → paste in another (or after a page reload) both work.
  const [clipboard, setClipboardState] = useState<Block | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("scrolls-block-clipboard");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Block;
      // Trust the shape lightly: only accept known block types.
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof (parsed as Block).type === "string"
      ) {
        setClipboardState(parsed);
      }
    } catch {
      /* ignore corrupt clipboard */
    }
  }, []);
  function setClipboard(next: Block | null) {
    setClipboardState(next);
    try {
      if (next === null) localStorage.removeItem("scrolls-block-clipboard");
      else localStorage.setItem("scrolls-block-clipboard", JSON.stringify(next));
    } catch {
      /* storage full / disabled — clipboard remains in-memory this session */
    }
  }

  const availableCategories = categories.filter(
    (c) => c.subject === subject && c.grade === grade,
  );
  const validCategoryId = availableCategories.some((c) => c.id === categoryId)
    ? categoryId
    : null;

  function changeSubject(next: SubjectId) {
    setSubject(next);
    setCategoryId((cur) =>
      categories.some(
        (c) => c.id === cur && c.subject === next && c.grade === grade,
      )
        ? cur
        : null,
    );
  }

  function changeGrade(next: number) {
    setGrade(next);
    setCategoryId((cur) =>
      categories.some(
        (c) => c.id === cur && c.subject === subject && c.grade === next,
      )
        ? cur
        : null,
    );
  }

  const [state, formAction, pending] = useActionState(
    saveLessonAction,
    initial,
  );

  const questionCount = blocks.filter((b) => b.type === "question").length;
  const textCount = blocks.filter((b) => b.type === "text").length;
  const imageCount = blocks.filter((b) => b.type === "image").length;
  const interactiveCount = blocks.filter((b) => b.type === "interactive").length;

  function addBlock(type: BlockType) {
    const newBlock =
      type === "interactive"
        ? ({
            type: "interactive",
            prompt: "",
            code: "",
            scene: DEFAULT_SCENE,
          } as Block)
        : emptyBlock(type);
    setBlocks((bs) => [...bs, withKey(newBlock)]);
  }

  function updateBlock(index: number, patch: Partial<Block>) {
    setBlocks((bs) =>
      bs.map((b, i) => (i === index ? ({ ...b, ...patch } as EditorBlock) : b)),
    );
  }

  function removeBlock(index: number) {
    setBlocks((bs) => bs.filter((_, i) => i !== index));
  }

  function moveBlock(index: number, dir: -1 | 1) {
    setBlocks((bs) => {
      const j = index + dir;
      if (j < 0 || j >= bs.length) return bs;
      const next = bs.slice();
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  function copyBlock(index: number) {
    const b = blocks[index];
    if (!b) return;
    // Store without the editor-only _key so the paste path can mint a fresh
    // one instead of re-using the source's key.
    setClipboard(stripKey(b));
  }

  function pasteBlock() {
    if (!clipboard) return;
    setBlocks((bs) => [...bs, withKey(clipboard)]);
  }

  // Toggle a question block ↔ writing block, preserving the fields that
  // both types share (prompt, explanation, imageUrl). Type-specific fields
  // are dropped on the way out and freshly initialized on the way in.
  function toggleWriting(index: number) {
    setBlocks((bs) =>
      bs.map((b, i) => {
        if (i !== index) return b;
        if (b.type === "question") {
          return withKey({
            type: "writing",
            prompt: b.prompt,
            acceptedAnswers: [""],
            explanation: b.explanation,
            imageUrl: b.imageUrl,
          });
        }
        if (b.type === "writing") {
          return withKey({
            type: "question",
            prompt: b.prompt,
            options: ["", ""],
            correctIndex: 0,
            explanation: b.explanation,
            imageUrl: b.imageUrl,
          });
        }
        return b;
      }),
    );
  }

  const hasRepetition =
    repetitionSets.day1.length > 0 || repetitionSets.day3.length > 0;
  const serializedContent = JSON.stringify(
    hasRepetition
      ? { blocks: blocks.map(stripKey), repetitionSets }
      : { blocks: blocks.map(stripKey) },
  );

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-20 border-b border-zinc-900 bg-black/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            >
              ← Studio
            </Link>
            <span className="hidden text-sm text-zinc-700 sm:inline">/</span>
            <p className="hidden truncate text-sm font-medium text-zinc-300 sm:block">
              {title || "Untitled lesson"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {state.ok && !pending && (
              <span className="text-xs font-medium text-emerald-400">
                Saved
              </span>
            )}
            <Link
              href="/admin/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-sm font-semibold text-cyan-300 ring-1 ring-cyan-500/40 transition hover:bg-cyan-500/25 hover:text-cyan-200 hover:ring-cyan-400/60"
            >
              <svg
                viewBox="0 0 16 16"
                className="h-4 w-4"
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
            <button
              type="button"
              onClick={() => setRepetitionOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
              title="Edit spaced-repetition question sets"
            >
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
              Repetition Set
              {repetitionCount > 0 && (
                <span className="ml-1 rounded-full bg-cyan-500/15 px-1.5 text-[10px] font-semibold text-cyan-300 ring-1 ring-cyan-500/30">
                  {repetitionCount}
                </span>
              )}
            </button>
            <Link
              href={`/lessons/${lessonId}?preview=1`}
              target="_blank"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
              title="Preview as the author — completion isn't recorded and reviews aren't gated"
            >
              Preview
            </Link>
            <ThemeToggle theme={theme} />
            <form action={formAction}>
              <input type="hidden" name="id" value={lessonId} />
              <input type="hidden" name="title" value={title} />
              <input type="hidden" name="description" value={description} />
              <input type="hidden" name="subject" value={subject} />
              <input type="hidden" name="grade" value={String(grade)} />
              <input
                type="hidden"
                name="category_id"
                value={validCategoryId === null ? "" : String(validCategoryId)}
              />
              <input type="hidden" name="content" value={serializedContent} />
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-cyan-500 px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {state.error && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-rose-500/10 px-4 py-2 text-sm text-rose-300 ring-1 ring-rose-500/30"
          >
            {state.error}
          </p>
        )}

        <section className="rounded-2xl bg-zinc-950 p-7 ring-1 ring-zinc-800">
          <h2 className="text-base font-semibold text-zinc-100">
            Lesson details
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-300">
                Subject
              </label>
              <select
                value={subject}
                onChange={(e) => changeSubject(e.target.value as SubjectId)}
                suppressHydrationWarning
                className={`mt-1 ${fieldClass}`}
              >
                <option value="math">Math</option>
                <option value="language">Language</option>
                <option value="science">Science</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300">
                Grade
              </label>
              <select
                value={String(grade)}
                onChange={(e) => changeGrade(parseInt(e.target.value, 10))}
                suppressHydrationWarning
                className={`mt-1 ${fieldClass}`}
              >
                <option value="0">Kindergarten</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                  <option key={g} value={String(g)}>
                    Grade {g}
                  </option>
                ))}
                {subject === "math" && (
                  <option value="13">Calculus</option>
                )}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-300">
              Category
            </label>
            <select
              value={validCategoryId === null ? "" : String(validCategoryId)}
              onChange={(e) =>
                setCategoryId(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              suppressHydrationWarning
              className={`mt-1 ${fieldClass}`}
            >
              <option value="">Uncategorized</option>
              {availableCategories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
            {availableCategories.length === 0 && (
              <p className="mt-1.5 text-xs text-zinc-500">
                No categories yet for this subject + grade.{" "}
                <a
                  href="/admin/categories"
                  className="text-cyan-300 hover:text-cyan-200"
                  target="_blank"
                  rel="noreferrer"
                >
                  Create one
                </a>
                .
              </p>
            )}
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-300">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              suppressHydrationWarning
              className={`mt-1 ${fieldClass}`}
            />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-300">
              Short description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              suppressHydrationWarning
              className={`mt-1 ${fieldClass}`}
            />
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-zinc-100">Lesson</h2>
            <p className="text-xs text-zinc-500">
              {questionCount}q · {interactiveCount} interactive · {textCount}{" "}
              explanation · {imageCount} diagram
            </p>
          </div>

          {blocks.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950 px-6 py-12 text-center">
              <p className="text-sm font-semibold text-zinc-100">
                Start building this lesson
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
                Add explanation pages, diagrams, multiple-choice questions, and
                ScrollScript-coded interactives in any order.
              </p>
              <AddBlockBar
                onAdd={addBlock}
                onPaste={clipboard ? pasteBlock : undefined}
                clipboardType={clipboard?.type}
                className="mt-5"
              />
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {blocks.map((b, i) => (
                <li key={b._key}>
                  <BlockCard
                    block={b}
                    index={i}
                    total={blocks.length}
                    onUpdate={(patch) => updateBlock(i, patch)}
                    onRemove={() => removeBlock(i)}
                    onMove={(d) => moveBlock(i, d)}
                    onCopy={() => copyBlock(i)}
                    onToggleWriting={
                      b.type === "question" || b.type === "writing"
                        ? () => toggleWriting(i)
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          )}

          {blocks.length > 0 && (
            <div className="mt-6">
              <AddBlockBar
                onAdd={addBlock}
                onPaste={clipboard ? pasteBlock : undefined}
                clipboardType={clipboard?.type}
              />
            </div>
          )}
        </section>
      </main>

      {repetitionOpen && (
        <RepetitionSetModal
          sets={repetitionSets}
          onChange={setRepetitionSets}
          onClose={() => setRepetitionOpen(false)}
          clipboard={clipboard}
          onCopyToClipboard={(b) => setClipboard(b)}
        />
      )}
    </div>
  );
}

function RepetitionSetModal({
  sets,
  onChange,
  onClose,
  clipboard,
  onCopyToClipboard,
}: {
  sets: RepetitionSets;
  onChange: (next: RepetitionSets) => void;
  onClose: () => void;
  clipboard: Block | null;
  onCopyToClipboard: (b: Block) => void;
}) {
  const [activeTab, setActiveTab] = useState<"day1" | "day3">("day1");
  const list = sets[activeTab];
  // Review sets only accept question / writing blocks; paste only if the
  // shared clipboard has one of those.
  const pasteable: ReviewBlock | null =
    clipboard &&
    (clipboard.type === "question" || clipboard.type === "writing")
      ? (clipboard as ReviewBlock)
      : null;

  function addReview(kind: "question" | "writing") {
    const fresh: ReviewBlock =
      kind === "writing"
        ? { type: "writing", prompt: "", acceptedAnswers: [""] }
        : { type: "question", prompt: "", options: ["", ""], correctIndex: 0 };
    onChange({ ...sets, [activeTab]: [...list, fresh] });
  }

  function pasteReview() {
    if (!pasteable) return;
    // Deep-clone the clipboard entry so subsequent edits don't mutate the
    // stored value in-place (localStorage keeps a JSON copy, but the
    // in-memory clipboard is the same object reference otherwise).
    const clone = JSON.parse(JSON.stringify(pasteable)) as ReviewBlock;
    onChange({ ...sets, [activeTab]: [...list, clone] });
  }

  function updateReview(i: number, patch: Partial<ReviewBlock>) {
    const next = list.map((q, j) =>
      j === i ? ({ ...q, ...patch } as ReviewBlock) : q,
    );
    onChange({ ...sets, [activeTab]: next });
  }

  function copyReview(i: number) {
    const item = list[i];
    if (!item) return;
    onCopyToClipboard(item as Block);
  }

  function removeReview(i: number) {
    const next = list.filter((_, j) => j !== i);
    onChange({ ...sets, [activeTab]: next });
  }

  function moveReview(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = list.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...sets, [activeTab]: next });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-2xl bg-zinc-950 ring-1 ring-zinc-800"
      >
        <div className="flex items-start justify-between border-b border-zinc-900 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              Spaced repetition
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Day +1 unlocks the day after first completion. Day +3 unlocks
              two days after that. Mastery only hits 100% once both sets are
              done.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
          >
            <svg
              viewBox="0 0 16 16"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-1 border-b border-zinc-900 px-6 pt-3">
          {(["day1", "day3"] as const).map((tab) => {
            const count = sets[tab].length;
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={
                  "rounded-t-md px-3 py-2 text-sm font-medium transition " +
                  (active
                    ? "bg-zinc-900 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300")
                }
              >
                {tab === "day1" ? "Day +1" : "Day +3"}
                {count > 0 && (
                  <span
                    className={
                      "ml-2 rounded-full px-1.5 text-[10px] font-semibold ring-1 " +
                      (active
                        ? "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30"
                        : "bg-zinc-800 text-zinc-400 ring-zinc-700")
                    }
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="px-6 py-5">
          {list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-zinc-200">
                No questions yet for {activeTab === "day1" ? "Day +1" : "Day +3"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Add multiple-choice or free-response questions students will
                see on this review.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => addReview("question")}
                  className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/40 transition hover:bg-emerald-500/25"
                >
                  + Question
                </button>
                <button
                  type="button"
                  onClick={() => addReview("writing")}
                  className="rounded-lg bg-violet-500/15 px-3 py-1.5 text-sm font-semibold text-violet-300 ring-1 ring-violet-500/40 transition hover:bg-violet-500/25"
                >
                  + Writing
                </button>
                {pasteable && (
                  <button
                    type="button"
                    onClick={pasteReview}
                    className="rounded-lg bg-cyan-500/10 px-3 py-1.5 text-sm font-semibold text-cyan-300 ring-1 ring-cyan-500/40 transition hover:bg-cyan-500/20"
                  >
                    + Paste ({pasteable.type})
                  </button>
                )}
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {list.map((q, i) => (
                <li
                  key={i}
                  className="rounded-xl bg-zinc-900/60 p-4 ring-1 ring-zinc-800"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TypeBadge type={q.type} />
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {i + 1}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <ReviewCopyButton onCopy={() => copyReview(i)} />
                      <IconBtn
                        label="Move up"
                        onClick={() => moveReview(i, -1)}
                        disabled={i === 0}
                      >
                        ↑
                      </IconBtn>
                      <IconBtn
                        label="Move down"
                        onClick={() => moveReview(i, 1)}
                        disabled={i === list.length - 1}
                      >
                        ↓
                      </IconBtn>
                      <IconBtn
                        label="Remove"
                        onClick={() => removeReview(i)}
                        danger
                      >
                        ✕
                      </IconBtn>
                    </div>
                  </div>
                  {q.type === "question" ? (
                    <QuestionEditor
                      block={q}
                      onUpdate={(patch) => updateReview(i, patch)}
                    />
                  ) : (
                    <WritingEditor
                      block={q}
                      onUpdate={(patch) => updateReview(i, patch)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}

          {list.length > 0 && (
            <div
              className={
                "mt-4 grid gap-2 " +
                (pasteable ? "grid-cols-3" : "grid-cols-2")
              }
            >
              <button
                type="button"
                onClick={() => addReview("question")}
                className="rounded-lg border border-dashed border-zinc-800 px-4 py-3 text-sm font-medium text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
              >
                + Question
              </button>
              <button
                type="button"
                onClick={() => addReview("writing")}
                className="rounded-lg border border-dashed border-zinc-800 px-4 py-3 text-sm font-medium text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
              >
                + Writing
              </button>
              {pasteable && (
                <button
                  type="button"
                  onClick={pasteReview}
                  className="rounded-lg border border-dashed border-cyan-500/40 px-4 py-3 text-sm font-medium text-cyan-300 transition hover:border-cyan-400/60 hover:bg-cyan-500/5"
                >
                  + Paste ({pasteable.type})
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-900 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-cyan-500 px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-cyan-400"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewCopyButton({ onCopy }: { onCopy: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        onCopy();
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      title="Copy to clipboard — paste in another set or in the main lesson"
      aria-label="Copy"
      className={
        "flex h-8 w-8 items-center justify-center rounded-md text-base transition " +
        (copied
          ? "bg-emerald-500/15 text-emerald-300"
          : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200")
      }
    >
      {copied ? (
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8.5l3 3 7-7" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="3" width="8" height="10" rx="1.2" />
          <path d="M6 3v-.5A.5.5 0 0 1 6.5 2h3a.5.5 0 0 1 .5.5V3" />
        </svg>
      )}
    </button>
  );
}

function AddBlockBar({
  onAdd,
  onPaste,
  clipboardType,
  className = "",
}: {
  onAdd: (type: BlockType) => void;
  onPaste?: () => void;
  clipboardType?: BlockType;
  className?: string;
}) {
  const pasteLabels: Record<BlockType, string> = {
    text: "explanation",
    image: "diagram",
    question: "question",
    writing: "writing",
    interactive: "interactive",
  };
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-2 ${className}`}
    >
      <button
        type="button"
        onClick={() => onAdd("text")}
        className="rounded-lg bg-zinc-950 px-3.5 py-2 text-sm font-medium text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-900"
      >
        + Explanation
      </button>
      <button
        type="button"
        onClick={() => onAdd("image")}
        className="rounded-lg bg-zinc-950 px-3.5 py-2 text-sm font-medium text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-900"
      >
        + Diagram
      </button>
      <button
        type="button"
        onClick={() => onAdd("question")}
        className="rounded-lg bg-zinc-950 px-3.5 py-2 text-sm font-medium text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-900"
      >
        + Question
      </button>
      <button
        type="button"
        onClick={() => onAdd("interactive")}
        className="rounded-lg bg-cyan-500 px-3.5 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
      >
        + Interactive
      </button>
      {onPaste && clipboardType && (
        <button
          type="button"
          onClick={onPaste}
          title={`Paste the ${pasteLabels[clipboardType]} block from the clipboard`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-cyan-300 ring-1 ring-cyan-500/40 transition hover:bg-cyan-500/10"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="3" width="8" height="10" rx="1.2" />
            <path d="M6 3v-.5A.5.5 0 0 1 6.5 2h3a.5.5 0 0 1 .5.5V3" />
          </svg>
          + Paste ({pasteLabels[clipboardType]})
        </button>
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: BlockType }) {
  const styles: Record<BlockType, string> = {
    text: "bg-zinc-800 text-zinc-300",
    image: "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30",
    question: "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30",
    writing: "bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/30",
    interactive: "bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/30",
  };
  const labels: Record<BlockType, string> = {
    text: "Explanation",
    image: "Diagram",
    question: "Question",
    writing: "Writing",
    interactive: "Interactive",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[type]}`}
    >
      {labels[type]}
    </span>
  );
}

function BlockCard({
  block,
  index,
  total,
  onUpdate,
  onRemove,
  onMove,
  onCopy,
  onToggleWriting,
}: {
  block: EditorBlock;
  index: number;
  total: number;
  onUpdate: (patch: Partial<Block>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onCopy: () => void;
  onToggleWriting?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const isWriting = block.type === "writing";

  return (
    <div className="rounded-2xl bg-zinc-950 p-5 ring-1 ring-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <TypeBadge type={block.type} />
          <span className="text-xs text-zinc-500">Block {index + 1}</span>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            title="Copy block — paste it here or in another lesson"
            className={
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition " +
              (copied
                ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100")
            }
          >
            <svg
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="4" y="3" width="8" height="10" rx="1.2" />
              <path d="M6 3v-.5A.5.5 0 0 1 6.5 2h3a.5.5 0 0 1 .5.5V3" />
            </svg>
            {copied ? "Copied" : "Copy"}
          </button>
          <div className="flex items-center gap-1">
            {onToggleWriting && (
              <button
                type="button"
                onClick={onToggleWriting}
                title={
                  isWriting
                    ? "Turn back into a multiple-choice question"
                    : "Turn this into a free-response writing question"
                }
                className={
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition " +
                  (isWriting
                    ? "bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30 hover:bg-violet-500/25"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100")
                }
                aria-pressed={isWriting}
              >
                <span
                  className={
                    "inline-block h-2 w-2 rounded-full " +
                    (isWriting ? "bg-violet-300" : "bg-zinc-600")
                  }
                />
                Writing question
              </button>
            )}
            <IconBtn
              label="Move up"
              disabled={index === 0}
              onClick={() => onMove(-1)}
            >
              ↑
            </IconBtn>
            <IconBtn
              label="Move down"
              disabled={index === total - 1}
              onClick={() => onMove(1)}
            >
              ↓
            </IconBtn>
            <IconBtn label="Delete" danger onClick={onRemove}>
              ×
            </IconBtn>
          </div>
        </div>
      </div>

      <div className="mt-4">
        {block.type === "text" && (
          <TextEditor block={block} onUpdate={onUpdate} />
        )}
        {block.type === "image" && (
          <ImageEditor block={block} onUpdate={onUpdate} />
        )}
        {block.type === "question" && (
          <QuestionEditor block={block} onUpdate={onUpdate} />
        )}
        {block.type === "writing" && (
          <WritingEditor block={block} onUpdate={onUpdate} />
        )}
        {block.type === "interactive" && (
          <InteractiveEditor block={block} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  disabled = false,
  danger = false,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={
        "flex h-8 w-8 items-center justify-center rounded-md text-base transition disabled:cursor-not-allowed disabled:opacity-30 " +
        (danger
          ? "text-rose-400 hover:bg-rose-500/10"
          : "text-zinc-500 hover:bg-zinc-800")
      }
    >
      {children}
    </button>
  );
}

function TextEditor({
  block,
  onUpdate,
}: {
  block: TextBlock;
  onUpdate: (patch: Partial<TextBlock>) => void;
}) {
  return (
    <div className="space-y-3">
      <input
        value={block.title ?? ""}
        onChange={(e) => onUpdate({ title: e.target.value })}
        placeholder="Optional heading"
        suppressHydrationWarning
        className={fieldClass}
      />
      <textarea
        value={block.body}
        onChange={(e) => onUpdate({ body: e.target.value })}
        rows={5}
        placeholder="Explain the concept. Line breaks are preserved."
        suppressHydrationWarning
        className={fieldClass}
      />
    </div>
  );
}

function ImageEditor({
  block,
  onUpdate,
}: {
  block: ImageBlock;
  onUpdate: (patch: Partial<ImageBlock>) => void;
}) {
  return (
    <div className="space-y-3">
      <input
        value={block.url}
        onChange={(e) => onUpdate({ url: e.target.value })}
        placeholder="Image URL (https://…)"
        suppressHydrationWarning
        className={fieldClass}
      />
      <input
        value={block.caption ?? ""}
        onChange={(e) => onUpdate({ caption: e.target.value })}
        placeholder="Optional caption"
        suppressHydrationWarning
        className={fieldClass}
      />
      {block.url && (
        <div className="overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.url}
            alt={block.caption ?? ""}
            className="block max-h-72 w-full object-contain"
          />
        </div>
      )}
    </div>
  );
}

function QuestionEditor({
  block,
  onUpdate,
}: {
  block: QuestionBlock;
  onUpdate: (patch: Partial<QuestionBlock>) => void;
}) {
  function updateOption(i: number, value: string) {
    const next = block.options.slice();
    next[i] = value;
    onUpdate({ options: next });
  }
  function addOption() {
    if (block.options.length >= 6) return;
    onUpdate({ options: [...block.options, ""] });
  }
  function removeOption(i: number) {
    if (block.options.length <= 2) return;
    const next = block.options.filter((_, j) => j !== i);
    const correct =
      block.correctIndex === i
        ? 0
        : block.correctIndex > i
          ? block.correctIndex - 1
          : block.correctIndex;
    onUpdate({ options: next, correctIndex: correct });
  }

  return (
    <div className="space-y-3">
      <textarea
        value={block.prompt}
        onChange={(e) => onUpdate({ prompt: e.target.value })}
        rows={2}
        placeholder="Ask a question, e.g. What is 2 + 3?"
        suppressHydrationWarning
        className={fieldClass}
      />
      <p className="-mt-2 text-[11px] text-zinc-500">
        Math: wrap LaTeX in <code className="text-zinc-300">$…$</code> for
        inline (e.g. <code className="text-zinc-300">$\sin(x)$</code>) or{" "}
        <code className="text-zinc-300">$$…$$</code> for display. Works in
        the prompt, options, and explanation.
      </p>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Diagram (optional)
        </p>
        <input
          value={block.imageUrl ?? ""}
          onChange={(e) => onUpdate({ imageUrl: e.target.value })}
          placeholder="Image URL — shown above the question"
          suppressHydrationWarning
          className={fieldClass}
        />
        {block.imageUrl && (
          <div className="mt-2 overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={block.imageUrl}
              alt=""
              className="block max-h-56 w-full object-contain"
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Answer options
        </p>
        {block.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <label
              className={
                "flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-xs font-semibold ring-1 transition " +
                (block.correctIndex === i
                  ? "bg-emerald-500 text-black ring-emerald-500"
                  : "bg-zinc-900 text-zinc-500 ring-zinc-800 hover:bg-zinc-800")
              }
            >
              <input
                type="radio"
                checked={block.correctIndex === i}
                onChange={() => onUpdate({ correctIndex: i })}
                className="sr-only"
              />
              {String.fromCharCode(65 + i)}
            </label>
            <input
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              suppressHydrationWarning
              className={fieldClass}
            />
            <button
              type="button"
              onClick={() => removeOption(i)}
              disabled={block.options.length <= 2}
              aria-label="Remove option"
              className="flex h-9 w-9 items-center justify-center rounded-md text-base text-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addOption}
          disabled={block.options.length >= 6}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 ring-1 ring-zinc-800 hover:bg-zinc-900 disabled:opacity-40"
        >
          + Add option
        </button>
        <p className="text-xs text-zinc-500">
          Tap a letter to mark the correct answer.
        </p>
      </div>
      <textarea
        value={block.explanation ?? ""}
        onChange={(e) => onUpdate({ explanation: e.target.value })}
        rows={2}
        placeholder="Optional explanation shown after the learner answers"
        suppressHydrationWarning
        className={fieldClass}
      />
    </div>
  );
}

function WritingEditor({
  block,
  onUpdate,
}: {
  block: WritingBlock;
  onUpdate: (patch: Partial<WritingBlock>) => void;
}) {
  function updateAnswer(i: number, value: string) {
    const next = block.acceptedAnswers.slice();
    next[i] = value;
    onUpdate({ acceptedAnswers: next });
  }
  function addAnswer() {
    onUpdate({ acceptedAnswers: [...block.acceptedAnswers, ""] });
  }
  function removeAnswer(i: number) {
    if (block.acceptedAnswers.length <= 1) return;
    onUpdate({
      acceptedAnswers: block.acceptedAnswers.filter((_, j) => j !== i),
    });
  }

  return (
    <div className="space-y-3">
      <textarea
        value={block.prompt}
        onChange={(e) => onUpdate({ prompt: e.target.value })}
        rows={2}
        placeholder="Ask the student to write the answer, e.g. Solve for x: 2x + 3 = 7"
        suppressHydrationWarning
        className={fieldClass}
      />
      <p className="-mt-2 text-[11px] text-zinc-500">
        Math: wrap LaTeX in <code className="text-zinc-300">$…$</code> for
        inline (e.g. <code className="text-zinc-300">$\sin(x)$</code>) or{" "}
        <code className="text-zinc-300">$$…$$</code> for display. Works in
        the prompt and explanation.
      </p>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Diagram (optional)
        </p>
        <input
          value={block.imageUrl ?? ""}
          onChange={(e) => onUpdate({ imageUrl: e.target.value })}
          placeholder="Image URL — shown above the question"
          suppressHydrationWarning
          className={fieldClass}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Accepted answers
        </p>
        <p className="mb-2 text-[11px] text-zinc-500">
          Add every variant you want to mark correct. If <em>Always LaTeX</em>{" "}
          is on, write each answer as a LaTeX expression (e.g.{" "}
          <code className="text-zinc-300">\frac{"{"}1{"}{"}2{"}"}</code>).
        </p>
        <ul className="space-y-2">
          {block.acceptedAnswers.map((ans, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                value={ans}
                onChange={(e) => updateAnswer(i, e.target.value)}
                placeholder={i === 0 ? "Primary answer" : "Alternative answer"}
                spellCheck={false}
                suppressHydrationWarning
                className={`${fieldClass} font-mono`}
              />
              <IconBtn
                label="Remove"
                onClick={() => removeAnswer(i)}
                disabled={block.acceptedAnswers.length <= 1}
                danger
              >
                ×
              </IconBtn>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={addAnswer}
          className="mt-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-800"
        >
          + Add alternative
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={!!block.alwaysLatex}
            onChange={(e) => onUpdate({ alwaysLatex: e.target.checked })}
            className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-cyan-500 focus:ring-cyan-400"
          />
          <span>
            <span className="font-medium">Always LaTeX</span>
            <span className="ml-1 text-zinc-500">
              — student sees only a rendered preview and builds their answer
              with buttons + keys
            </span>
          </span>
        </label>
        <label
          className={
            "inline-flex items-center gap-2 text-xs " +
            (block.alwaysLatex ? "text-zinc-500" : "text-zinc-300")
          }
        >
          <input
            type="checkbox"
            checked={!!block.caseSensitive || !!block.alwaysLatex}
            onChange={(e) => onUpdate({ caseSensitive: e.target.checked })}
            disabled={!!block.alwaysLatex}
            className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-cyan-500 focus:ring-cyan-400 disabled:opacity-60"
          />
          <span>
            <span className="font-medium">Case-sensitive</span>
            <span className="ml-1 text-zinc-500">
              {block.alwaysLatex
                ? "— forced on for LaTeX answers (\\sin ≠ \\Sin)"
                : "— off by default; helpful for prose answers"}
            </span>
          </span>
        </label>
      </div>

      {block.alwaysLatex && (
        <WritingButtonsEditor
          buttons={block.buttons ?? []}
          onChange={(buttons) => onUpdate({ buttons })}
        />
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Explanation (shown after answering)
        </p>
        <textarea
          value={block.explanation ?? ""}
          onChange={(e) => onUpdate({ explanation: e.target.value })}
          rows={2}
          placeholder="Optional — explain the reasoning"
          suppressHydrationWarning
          className={fieldClass}
        />
      </div>
    </div>
  );
}

function WritingButtonsEditor({
  buttons,
  onChange,
}: {
  buttons: { label: string; latex: string }[];
  onChange: (next: { label: string; latex: string }[]) => void;
}) {
  function updateRow(i: number, patch: Partial<{ label: string; latex: string }>) {
    onChange(buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }
  function addRow() {
    onChange([...buttons, { label: "", latex: "" }]);
  }
  function removeRow(i: number) {
    onChange(buttons.filter((_, j) => j !== i));
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        Quick-insert buttons
      </p>
      <p className="mt-1 text-[11px] text-zinc-500">
        Each button drops a LaTeX snippet into the student&apos;s answer at
        the cursor. Put empty <code className="text-zinc-300">{`{}`}</code>,{" "}
        <code className="text-zinc-300">()</code>, or{" "}
        <code className="text-zinc-300">[]</code> in the snippet to mark where
        the cursor should land — e.g.{" "}
        <code className="text-zinc-300">\sin()</code> drops the cursor inside
        the parens. The student can also press <kbd>/</kbd> to turn the last
        value into a fraction.
      </p>
      {buttons.length === 0 ? (
        <p className="mt-3 text-xs italic text-zinc-600">
          No buttons yet. Add one to give students a quick way to type
          functions, Greek letters, or any LaTeX snippet.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {buttons.map((b, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                value={b.label}
                onChange={(e) => updateRow(i, { label: e.target.value })}
                placeholder="Label (sine)"
                suppressHydrationWarning
                className={`${fieldClass} max-w-[10rem]`}
              />
              <input
                value={b.latex}
                onChange={(e) => updateRow(i, { latex: e.target.value })}
                placeholder="LaTeX (\\sin())"
                spellCheck={false}
                suppressHydrationWarning
                className={`${fieldClass} font-mono`}
              />
              <IconBtn
                label="Remove"
                onClick={() => removeRow(i)}
                danger
              >
                ×
              </IconBtn>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={addRow}
        className="mt-3 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-800"
      >
        + Add button
      </button>
    </div>
  );
}

function InteractiveEditor({
  block,
  onUpdate,
}: {
  block: InteractiveBlock;
  onUpdate: (patch: Partial<InteractiveBlock>) => void;
}) {
  const scene: Scene = block.scene ?? DEFAULT_SCENE;

  return (
    <div className="space-y-4">
      <textarea
        value={block.prompt ?? ""}
        onChange={(e) => onUpdate({ prompt: e.target.value })}
        rows={2}
        placeholder="Prompt shown to the learner above the interactive"
        suppressHydrationWarning
        className={fieldClass}
      />

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Diagram (optional)
        </p>
        <input
          value={block.imageUrl ?? ""}
          onChange={(e) => onUpdate({ imageUrl: e.target.value })}
          placeholder="Image URL — shown above the interactive scene"
          suppressHydrationWarning
          className={fieldClass}
        />
        {block.imageUrl && (
          <div className="mt-2 overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={block.imageUrl}
              alt=""
              className="block max-h-56 w-full object-contain"
            />
          </div>
        )}
      </div>

      <VisualSceneEditor
        scene={scene}
        onChange={(next) => onUpdate({ scene: next })}
      />

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Live preview
        </p>
        <div className="rounded-xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
          <SceneRunner scene={scene} />
        </div>
      </div>
    </div>
  );
}

