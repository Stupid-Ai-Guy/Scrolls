"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { createLessonAction, type FormState } from "@/lib/actions";

const initial: FormState = {};

const DRAFT_KEY = "scrolls-new-lesson-draft";

type SubjectId = "math" | "language" | "science";

type CategoryOption = {
  id: number;
  subject: string;
  grade: number;
  name: string;
};

type Draft = {
  title: string;
  description: string;
  grade: string; // "" | "0".."13"
  subject: SubjectId | "";
  categoryId: string; // "" for uncategorized
};

const EMPTY_DRAFT: Draft = {
  title: "",
  description: "",
  grade: "",
  subject: "",
  categoryId: "",
};

const GRADE_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "Kindergarten" },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: `Grade ${i + 1}`,
  })),
  { value: "13", label: "Calculus" },
];

const SUBJECT_OPTIONS: { value: SubjectId; label: string }[] = [
  { value: "math", label: "Math" },
  { value: "language", label: "Language" },
  { value: "science", label: "Science" },
];

const chipBase =
  "relative inline-flex items-center gap-1.5 rounded-full bg-zinc-900 py-1.5 pl-3 pr-2.5 text-xs font-semibold ring-1 ring-zinc-800 transition focus-within:ring-2 focus-within:ring-cyan-400";

export default function AddLessonModal({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryOption[];
}) {
  const headingId = useId();
  const titleId = useId();
  const descId = useId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [state, formAction, pending] = useActionState(
    createLessonAction,
    initial,
  );
  const titleRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Load / persist the draft in localStorage so a mis-close doesn't nuke
  // an in-progress lesson.
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Draft>;
        setDraft({ ...EMPTY_DRAFT, ...parsed });
      }
    } catch {
      /* ignore */
    }
    // Give the browser a tick to render before focusing so the transform
    // animation doesn't fight with the focus scroll.
    const t = setTimeout(() => titleRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    try {
      if (isEmptyDraft(draft)) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft, open]);

  const requestClose = useCallback(() => {
    if (!isEmptyDraft(draft)) {
      const ok = window.confirm(
        "Discard this draft? The title, description, and taxonomy will be cleared.",
      );
      if (!ok) return;
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      setDraft(EMPTY_DRAFT);
    }
    onClose();
  }, [draft, onClose]);

  // Esc closes; Cmd/Ctrl+Enter submits from anywhere in the modal.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  // When Grade is Calculus, force Subject to math.
  useEffect(() => {
    if (draft.grade === "13" && draft.subject && draft.subject !== "math") {
      setDraft((d) => ({ ...d, subject: "math", categoryId: "" }));
    }
  }, [draft.grade, draft.subject]);

  if (!open || !mounted) return null;

  const gradeNum = draft.grade === "" ? null : Number(draft.grade);
  const subjectOptions =
    draft.grade === "13"
      ? SUBJECT_OPTIONS.filter((s) => s.value === "math")
      : SUBJECT_OPTIONS;

  const filteredCategories =
    draft.subject && gradeNum !== null
      ? categories.filter(
          (c) => c.subject === draft.subject && c.grade === gradeNum,
        )
      : [];

  const canPickSubject = draft.grade !== "";
  const canPickCategory = draft.grade !== "" && draft.subject !== "";
  const canSubmit =
    draft.title.trim().length > 0 && draft.grade !== "" && draft.subject !== "";

  return createPortal(
    <>
      <div
        onClick={requestClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(e) => e.stopPropagation()}
        className="fixed bottom-2 right-6 z-50 flex max-h-[26rem] w-[min(28rem,calc(100vw-3rem))] flex-col overflow-y-auto rounded-2xl bg-zinc-950 ring-1 ring-zinc-800 shadow-2xl"
      >
        <form
          ref={formRef}
          action={formAction}
          className="flex flex-col gap-3.5 p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <p id={headingId} className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              New lesson
            </p>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
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

          <div>
            <label htmlFor={titleId} className="sr-only">
              Title
            </label>
            <input
              ref={titleRef}
              id={titleId}
              name="title"
              type="text"
              required
              maxLength={200}
              placeholder="Lesson title"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              autoComplete="off"
              suppressHydrationWarning
              className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-lg font-medium text-zinc-50 placeholder:text-zinc-600 ring-1 ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          <div>
            <label htmlFor={descId} className="sr-only">
              Description
            </label>
            <input
              id={descId}
              name="description"
              type="text"
              maxLength={300}
              placeholder="Short description — shown under the tile on the dashboard"
              value={draft.description}
              onChange={(e) =>
                setDraft((d) => ({ ...d, description: e.target.value }))
              }
              autoComplete="off"
              suppressHydrationWarning
              className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 ring-1 ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-900 pt-4">
            <ChipSelect
              name="grade"
              label="Grade"
              value={draft.grade}
              onChange={(v) =>
                setDraft((d) => ({ ...d, grade: v, categoryId: "" }))
              }
              options={GRADE_OPTIONS}
              placeholder="Pick grade"
              required
            />
            <ChipSelect
              name="subject"
              label="Subject"
              value={draft.subject}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  subject: v as SubjectId | "",
                  categoryId: "",
                }))
              }
              options={subjectOptions}
              placeholder="Pick subject"
              disabled={!canPickSubject}
              disabledHint="Pick a grade first"
              required
            />
            <ChipSelect
              name="category_id"
              label="Category"
              value={draft.categoryId}
              onChange={(v) => setDraft((d) => ({ ...d, categoryId: v }))}
              options={[
                { value: "", label: "Uncategorized" },
                ...filteredCategories.map((c) => ({
                  value: String(c.id),
                  label: c.name,
                })),
              ]}
              placeholder="Uncategorized"
              disabled={!canPickCategory}
              disabledHint="Pick a subject first"
            />
            {canPickCategory && filteredCategories.length === 0 && (
              <a
                href="/admin/categories"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
              >
                + Add category
              </a>
            )}
          </div>

          {state.error && (
            <p role="alert" className="text-sm text-rose-400">
              {state.error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-zinc-900 pt-4">
            <p className="text-[11px] text-zinc-600">
              <kbd className="rounded bg-zinc-900 px-1 py-0.5 font-sans text-zinc-400 ring-1 ring-zinc-800">
                Esc
              </kbd>{" "}
              to cancel
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={requestClose}
                disabled={pending}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit || pending}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "Creating…" : "Create lesson"}
                <span
                  aria-hidden
                  className="hidden rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-sans font-medium text-black/70 sm:inline"
                >
                  ⌘↵
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </>,
    document.body,
  );
}

function ChipSelect({
  name,
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  disabledHint,
  required = false,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
  disabledHint?: string;
  required?: boolean;
}) {
  const selectedLabel =
    options.find((o) => o.value === value)?.label ?? null;
  const displayText = disabled
    ? disabledHint ?? placeholder
    : selectedLabel ?? placeholder;

  return (
    <label
      className={
        chipBase +
        (disabled
          ? " cursor-not-allowed opacity-40"
          : " cursor-pointer hover:ring-zinc-700")
      }
      title={disabled && disabledHint ? disabledHint : label}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span
        className={selectedLabel ? "text-zinc-100" : "text-zinc-500"}
      >
        {displayText}
      </span>
      <svg
        viewBox="0 0 16 16"
        className="h-3 w-3 text-zinc-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 6l4 4 4-4" />
      </svg>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        suppressHydrationWarning
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-not-allowed"
        aria-label={label}
      >
        {!value && (
          <option value="" disabled={required}>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function isEmptyDraft(d: Draft): boolean {
  return (
    !d.title.trim() &&
    !d.description.trim() &&
    !d.grade &&
    !d.subject &&
    !d.categoryId
  );
}
