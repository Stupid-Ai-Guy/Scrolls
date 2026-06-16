"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCategoryAction, type FormState } from "@/lib/actions";

const initial: FormState = {};

export default function AddCategoryForm({
  subject,
  grade,
}: {
  subject: string;
  grade: number;
}) {
  const [state, formAction, pending] = useActionState(
    createCategoryAction,
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start"
    >
      <input type="hidden" name="subject" value={subject} />
      <input type="hidden" name="grade" value={String(grade)} />
      <div className="flex-1">
        <input
          name="name"
          placeholder="e.g. Counting and number patterns"
          maxLength={120}
          required
          suppressHydrationWarning
          className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        />
        {state.error && (
          <p className="mt-1.5 text-xs text-rose-400" role="alert">
            {state.error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        suppressHydrationWarning
        className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add category"}
      </button>
    </form>
  );
}
