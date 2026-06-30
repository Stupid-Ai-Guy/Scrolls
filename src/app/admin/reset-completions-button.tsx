"use client";

import { useState, useTransition } from "react";
import { clearAllCompletionsAction } from "@/lib/actions";

export default function ResetCompletionsButton() {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function reset() {
    startTransition(async () => {
      await clearAllCompletionsAction();
      setConfirming(false);
      setDone(true);
      // Auto-clear the success label after a moment so the button goes back
      // to its idle state without forcing a manual refresh.
      setTimeout(() => setDone(false), 2500);
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 px-2 py-1.5 text-xs font-medium text-rose-200 ring-1 ring-rose-500/30">
        <span className="px-1">Wipe all completions?</span>
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="rounded-md bg-rose-500 px-2.5 py-1 text-xs font-semibold text-black transition hover:bg-rose-400 disabled:opacity-60"
        >
          {pending ? "Wiping…" : "Yes, wipe"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-md px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-rose-500/10 hover:text-rose-300"
      title="Delete every row from lesson_completions — affects all users"
    >
      {done ? "Wiped" : "Reset completions"}
    </button>
  );
}
