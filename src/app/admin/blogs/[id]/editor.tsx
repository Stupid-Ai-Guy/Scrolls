"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { saveBlogAction, type FormState } from "@/lib/actions";
import { BLOG_PROSE_CLASSES, renderBlogBody } from "@/lib/blog-content";
import ThemeToggle from "@/components/theme-toggle";
import RichTextEditor from "@/components/rich-text-editor";
import type { Theme } from "@/lib/theme";

const fieldClass =
  "w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800 transition placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-400";

const initial: FormState = {};

export default function BlogEditor({
  blogId,
  initialTitle,
  initialBody,
  initialPublished,
  theme,
}: {
  blogId: number;
  initialTitle: string;
  initialBody: string;
  initialPublished: boolean;
  theme: Theme;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [published, setPublished] = useState(initialPublished);

  const [state, formAction, pending] = useActionState(saveBlogAction, initial);

  // The WYSIWYG editor already shows formatting inline — the preview pane
  // exists specifically to render KaTeX math (which $…$ doesn't do inside
  // the editor). Memoize so we only re-render when the body changes.
  const bodyHtml = useMemo(() => renderBlogBody(body), [body]);

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-20 border-b border-zinc-900 bg-black/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/blogs"
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            >
              ← Studio
            </Link>
            <span className="hidden text-sm text-zinc-700 sm:inline">/</span>
            <p className="hidden truncate text-sm font-medium text-zinc-300 sm:block">
              {title || "Untitled"}
            </p>
            {!published && (
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-400 ring-1 ring-zinc-700">
                Draft
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {state.ok && !pending && (
              <span className="text-xs font-medium text-emerald-400">
                Saved
              </span>
            )}
            {published && (
              <Link
                href={`/blogs/${blogId}`}
                target="_blank"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
                title="Open the published post in a new tab"
              >
                Preview
              </Link>
            )}
            <ThemeToggle theme={theme} />
            <form action={formAction}>
              <input type="hidden" name="id" value={blogId} />
              <input type="hidden" name="title" value={title} />
              <input type="hidden" name="body" value={body} />
              <input
                type="hidden"
                name="published"
                value={published ? "on" : ""}
              />
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

      <main className="mx-auto max-w-7xl px-6 py-8">
        {state.error && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-rose-500/10 px-4 py-2 text-sm text-rose-300 ring-1 ring-rose-500/30"
          >
            {state.error}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ---------- Editor pane ---------- */}
          <section className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300">
                Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="A catchy headline"
                suppressHydrationWarning
                className={`mt-1 ${fieldClass}`}
              />
            </div>

            <label className="inline-flex items-center gap-2 rounded-lg bg-zinc-950 px-3 py-2 ring-1 ring-zinc-800">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-cyan-500 focus:ring-cyan-400"
              />
              <span className="text-sm text-zinc-200">
                <span className="font-medium">Published</span>
                <span className="ml-2 text-xs text-zinc-500">
                  Drafts are hidden from readers.
                </span>
              </span>
            </label>

            <div>
              <label className="block text-sm font-medium text-zinc-300">
                Body
              </label>
              <div className="mt-1">
                <RichTextEditor value={body} onChange={setBody} />
              </div>
            </div>
          </section>

          {/* ---------- Preview pane ---------- */}
          <section className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-lg bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400 ring-1 ring-zinc-800">
              Use the toolbar for formatting. Math: <code>$…$</code> inline,{" "}
              <code>$$…$$</code> display — rendered here on save-preview.
            </div>
            <div className="mt-3 rounded-2xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Preview
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
                {title || "Untitled"}
              </h1>
              <article
                className={"mt-4 " + BLOG_PROSE_CLASSES}
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
              {!body && (
                <p className="mt-4 text-sm italic text-zinc-600">
                  Start typing on the left to see a live preview.
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
