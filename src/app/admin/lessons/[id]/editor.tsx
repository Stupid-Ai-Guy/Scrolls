"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveLessonAction, type FormState } from "@/lib/actions";
import {
  emptyBlock,
  type Block,
  type BlockType,
  type ImageBlock,
  type InteractiveBlock,
  type QuestionBlock,
  type TextBlock,
} from "@/lib/lesson-content";
import { SAMPLE_SCROLLSCRIPT } from "@/lib/scrollscript";
import ScrollScriptRunner from "@/components/scrollscript-runner";
import ScrollScriptEditor from "@/components/scrollscript-editor";

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
  categories,
}: {
  lessonId: number;
  initialTitle: string;
  initialDescription: string;
  initialSubject: SubjectId;
  initialGrade: number;
  initialCategoryId: number | null;
  initialBlocks: Block[];
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
            code: SAMPLE_SCROLLSCRIPT,
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

  const serializedContent = JSON.stringify({
    blocks: blocks.map(stripKey),
  });

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
              href={`/lessons/${lessonId}`}
              target="_blank"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
            >
              Preview
            </Link>
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
                {[1, 2, 3, 4, 5, 6, 7, 8].map((g) => (
                  <option key={g} value={String(g)}>
                    Grade {g}
                  </option>
                ))}
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
              <AddBlockBar onAdd={addBlock} className="mt-5" />
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
                  />
                </li>
              ))}
            </ul>
          )}

          {blocks.length > 0 && (
            <div className="mt-6">
              <AddBlockBar onAdd={addBlock} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function AddBlockBar({
  onAdd,
  className = "",
}: {
  onAdd: (type: BlockType) => void;
  className?: string;
}) {
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
    </div>
  );
}

function TypeBadge({ type }: { type: BlockType }) {
  const styles: Record<BlockType, string> = {
    text: "bg-zinc-800 text-zinc-300",
    image: "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30",
    question: "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30",
    interactive: "bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/30",
  };
  const labels: Record<BlockType, string> = {
    text: "Explanation",
    image: "Diagram",
    question: "Question",
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
}: {
  block: EditorBlock;
  index: number;
  total: number;
  onUpdate: (patch: Partial<Block>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="rounded-2xl bg-zinc-950 p-5 ring-1 ring-zinc-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TypeBadge type={block.type} />
          <span className="text-xs text-zinc-500">Block {index + 1}</span>
        </div>
        <div className="flex items-center gap-0.5">
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

function InteractiveEditor({
  block,
  onUpdate,
}: {
  block: InteractiveBlock;
  onUpdate: (patch: Partial<InteractiveBlock>) => void;
}) {
  const [showHelp, setShowHelp] = useState(false);

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
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            ScrollScript code
          </p>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
          >
            {showHelp ? "Hide syntax" : "Show syntax"}
          </button>
        </div>
        {showHelp && <SyntaxHelp />}
        <div className="mt-2">
          <ScrollScriptEditor
            value={block.code}
            onChange={(v) => onUpdate({ code: v })}
            minRows={12}
            label="interactive.script"
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Live preview
        </p>
        <div className="rounded-xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
          <ScrollScriptRunner code={block.code} />
        </div>
      </div>
    </div>
  );
}

function SyntaxHelp() {
  return (
    <div className="rounded-lg bg-cyan-500/10 p-4 text-xs text-zinc-200 ring-1 ring-cyan-500/30">
      <p className="font-semibold">
        ScrollScript — one statement per line. Comments start with{" "}
        <code>#</code>.
      </p>
      <p className="mt-1 text-zinc-400">
        Shapes use named properties:{" "}
        <code>cords(x, y)</code>, <code>dims(...)</code>,{" "}
        <code>color(name)</code>, <code>label(&quot;text&quot;)</code>,{" "}
        <code>type(static|button)</code>, <code>id(&quot;...&quot;)</code>,{" "}
        <code>value(&quot;text&quot;)</code>. Lines use{" "}
        <code>from(x, y) to(x, y)</code>.
      </p>
      <ul className="mt-2 space-y-1 font-mono">
        <li>
          <code>view xmin xmax ymin ymax</code>
        </li>
        <li>
          <code>slider NAME min max default &quot;label&quot;</code>
        </li>
        <li>
          <code>NAME = EXPRESSION</code> — just assign, no <code>let</code>
        </li>
        <li>
          <code>point cords(x, y) [color(c)] [label(&quot;L&quot;)]</code>
        </li>
        <li>
          <code>line from(x, y) to(x, y) [color(c)]</code>
        </li>
        <li>
          <code>circle cords(cx, cy) dims(r) [color(c)] [label(&quot;L&quot;)]</code>
        </li>
        <li>
          <code>rect cords(cx, cy) dims(w, h) [color(c)] [label(&quot;L&quot;)]</code>
        </li>
        <li>
          <code>
            rect cords(cx, cy) dims(w, h) type(button) id(&quot;x&quot;)
            label(&quot;Click me&quot;)
          </code>{" "}
          — clickable, sets <code>clicked</code>
        </li>
        <li>
          <code>text cords(x, y) value(&quot;text&quot;) [color(c)]</code>
        </li>
        <li>
          <code>if cond ... elif cond ... else ... end</code> — blocks
        </li>
        <li>
          <code>check EXPRESSION</code> — e.g.{" "}
          <code>check clicked == &quot;yes&quot;</code>
        </li>
        <li>
          <code>hint &quot;text shown when wrong&quot;</code>
        </li>
      </ul>
      <p className="mt-3 font-semibold text-cyan-300">Math</p>
      <p className="mt-1 text-zinc-400">
        Operators <code>+ - * / ^</code>. Comparisons{" "}
        <code>{"< > <= >= == !="}</code>. Logic <code>and or not</code>.
        Constants <code>pi e</code>. Functions{" "}
        <code>sin cos tan sqrt abs min max floor ceil round</code>. Wrap
        computed coords in parens, e.g.{" "}
        <code>point (x + 1) (y * 2)</code>.
      </p>
      <p className="mt-3 font-semibold text-cyan-300">Colors</p>
      <p className="mt-1 text-zinc-400">
        <code>slate emerald rose sky amber red blue green indigo violet gray</code>
      </p>
    </div>
  );
}
