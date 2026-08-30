"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteLessonAction } from "@/lib/actions";

// Absolute-positioned edit + delete controls that overlay a skill tile.
// Placed on top of the tile's Link — buttons stopPropagation so they don't
// trigger the tile navigation. Only rendered when the viewer is an admin.
export default function TileAdminActions({ lessonId }: { lessonId: number }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function stop(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
  }

  function del(e: React.MouseEvent) {
    stop(e);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", String(lessonId));
      await deleteLessonAction(fd);
    });
  }

  return (
    <div
      onClick={stop}
      className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md bg-zinc-950/90 p-0.5 opacity-0 ring-1 ring-zinc-800 backdrop-blur transition group-hover:opacity-100 focus-within:opacity-100"
    >
      {confirming ? (
        <>
          <span className="px-2 text-[10px] font-medium text-rose-200">
            Delete?
          </span>
          <button
            type="button"
            onClick={del}
            disabled={pending}
            className="rounded bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-black hover:bg-rose-400 disabled:opacity-60"
          >
            {pending ? "…" : "Yes"}
          </button>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              setConfirming(false);
            }}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 hover:bg-zinc-900"
          >
            No
          </button>
        </>
      ) : (
        <>
          <Link
            href={`/admin/lessons/${lessonId}`}
            onClick={(e) => e.stopPropagation()}
            title="Edit lesson"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-900 hover:text-cyan-300"
          >
            <PencilIcon />
          </Link>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              setConfirming(true);
            }}
            title="Delete lesson"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-rose-500/10 hover:text-rose-300"
          >
            <TrashIcon />
          </button>
        </>
      )}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 2l3 3-8 8H3v-3z" />
      <path d="M9.5 3.5l3 3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 5h10" />
      <path d="M6 5V3.5A.5.5 0 0 1 6.5 3h3a.5.5 0 0 1 .5.5V5" />
      <path d="M4.5 5l.5 7.5A1 1 0 0 0 6 13.5h4a1 1 0 0 0 1-1L11.5 5" />
    </svg>
  );
}
