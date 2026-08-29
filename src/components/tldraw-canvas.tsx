"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef } from "react";
import type { Editor, TLEditorSnapshot, TLStoreSnapshot } from "tldraw";
import "tldraw/tldraw.css";

// tldraw touches window/document at import time, so pull it in client-only.
const Tldraw = dynamic(
  () => import("tldraw").then((m) => ({ default: m.Tldraw })),
  { ssr: false, loading: () => <CanvasSkeleton /> },
);

// Snapshot is stored as opaque JSON in the block. Callers pass it around as
// `unknown` (see lib/lesson-content.ts) so they don't have to depend on
// tldraw types; we cast at the tldraw boundary below.
type TldrawSnapshotInternal = TLEditorSnapshot | TLStoreSnapshot;

function CanvasSkeleton() {
  return (
    <div className="flex h-[420px] items-center justify-center rounded-xl bg-zinc-900 text-xs text-zinc-500 ring-1 ring-zinc-800">
      Loading canvas…
    </div>
  );
}

export function TldrawAuthor({
  snapshot,
  onChange,
}: {
  snapshot?: unknown;
  onChange: (next: unknown) => void;
}) {
  // Debounce store-change → onChange so every stroke doesn't spam React.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMount = useCallback(
    (editor: Editor) => {
      const emit = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          onChange(editor.getSnapshot());
        }, 250);
      };
      const unlisten = editor.store.listen(emit, {
        source: "user",
        scope: "document",
      });
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        unlisten();
      };
    },
    [onChange],
  );

  return (
    <div className="h-[480px] overflow-hidden rounded-xl ring-1 ring-zinc-800">
      <Tldraw
        snapshot={snapshot as TldrawSnapshotInternal | undefined}
        onMount={handleMount}
      />
    </div>
  );
}

export function TldrawReader({ snapshot }: { snapshot?: unknown }) {
  const handleMount = useCallback((editor: Editor) => {
    editor.updateInstanceState({ isReadonly: true });
    editor.zoomToFit({ animation: { duration: 0 } });
  }, []);

  return (
    <div className="h-[420px] overflow-hidden rounded-xl ring-1 ring-zinc-800">
      <Tldraw
        snapshot={snapshot as TldrawSnapshotInternal | undefined}
        onMount={handleMount}
      />
    </div>
  );
}
