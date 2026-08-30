"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { clearAllCompletionsAction } from "@/lib/actions";

// Small popover surfacing admin-only tools that used to live on the
// /admin studio page: Categories, Blogs, Terminal, and Reset completions.
// Only rendered for admins.
export default function AdminMenu() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [wiped, setWiped] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirming(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function reset() {
    startTransition(async () => {
      await clearAllCompletionsAction();
      setConfirming(false);
      setWiped(true);
      setTimeout(() => setWiped(false), 2500);
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Admin menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={
          "inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 " +
          (open ? "bg-zinc-900 text-zinc-100" : "")
        }
      >
        <svg
          viewBox="0 0 16 16"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="8" cy="4" r="1.2" />
          <circle cx="8" cy="8" r="1.2" />
          <circle cx="8" cy="12" r="1.2" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl bg-zinc-950 shadow-2xl ring-1 ring-zinc-800"
        >
          <div className="px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Studio
            </p>
          </div>
          <MenuLink href="/admin/categories" label="Categories" icon={<FolderIcon />} />
          <MenuLink href="/admin/blogs" label="Blogs" icon={<QuillIcon />} />
          <MenuLink href="/admin/terminal" label="Terminal" icon={<TerminalIcon />} />
          <div className="my-1 h-px bg-zinc-900" />
          {confirming ? (
            <div className="px-3 py-3 text-xs">
              <p className="text-rose-200">Wipe all completions?</p>
              <p className="mt-0.5 text-[10px] text-zinc-500">
                Deletes every row from lesson_completions — affects all users.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
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
                  className="rounded-md px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => setConfirming(true)}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:bg-rose-500/10 hover:text-rose-300"
            >
              <TrashIcon />
              {wiped ? "Completions wiped" : "Reset completions"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
    >
      {icon}
      {label}
    </Link>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 2h4.5A1.5 1.5 0 0 1 14 6.5v5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5z" />
    </svg>
  );
}

function QuillIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 13l2-2L12 4l1 1-7 7-2 2z" />
      <path d="M3 13h3" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M4.5 6L7 8l-2.5 2" />
      <path d="M8 10h3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 5h10" />
      <path d="M6 5V3.5A.5.5 0 0 1 6.5 3h3a.5.5 0 0 1 .5.5V5" />
      <path d="M4.5 5l.5 7.5A1 1 0 0 0 6 13.5h4a1 1 0 0 0 1-1L11.5 5" />
    </svg>
  );
}
