"use client";

import { useEffect, useId, useRef } from "react";
import AddLessonModal from "./add-lesson-modal";

type CategoryOption = {
  id: number;
  subject: string;
  grade: number;
  name: string;
};

// Renders the trigger pill AND the popover. Uses `popovertarget` on the
// button so the browser handles show/hide/toggle entirely — no React
// state to sync, no race conditions between click events and hidePopover.
// The N global hotkey still needs JS since it's a keyboard shortcut, not
// a click on a trigger.
export default function AddLessonButton({
  categories,
  variant = "pill",
}: {
  categories: CategoryOption[];
  variant?: "pill" | "hero";
}) {
  const popoverId = useId();
  const popoverRef = useRef<HTMLDivElement>(null);

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
      try {
        popoverRef.current?.togglePopover();
      } catch {
        /* older browsers or popover not attached yet */
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {variant === "hero" ? (
        <button
          type="button"
          popoverTarget={popoverId}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400"
        >
          <PlusIcon />
          Add a lesson
        </button>
      ) : (
        <button
          type="button"
          popoverTarget={popoverId}
          title="Add lesson (N)"
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-cyan-400"
        >
          <PlusIcon />
          <span className="hidden sm:inline">Add lesson</span>
        </button>
      )}
      <AddLessonModal
        ref={popoverRef}
        id={popoverId}
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
