"use client";

import { useEffect, useState } from "react";
import AddLessonModal from "./add-lesson-modal";

type CategoryOption = {
  id: number;
  subject: string;
  grade: number;
  name: string;
};

// Renders the header pill and owns the modal open state. Also wires the
// global `N` shortcut (skipped when the user is typing in a field).
export default function AddLessonButton({
  categories,
  variant = "pill",
}: {
  categories: CategoryOption[];
  variant?: "pill" | "hero";
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el?.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {variant === "hero" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400"
        >
          <PlusIcon />
          Add a lesson
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Add lesson (N)"
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-cyan-400"
        >
          <PlusIcon />
          <span className="hidden sm:inline">Add lesson</span>
        </button>
      )}
      <AddLessonModal
        open={open}
        onClose={() => setOpen(false)}
        categories={categories}
      />
    </>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="8" y1="3" x2="8" y2="13" />
      <line x1="3" y1="8" x2="13" y2="8" />
    </svg>
  );
}
