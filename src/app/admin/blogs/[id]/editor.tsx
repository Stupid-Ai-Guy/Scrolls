"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { saveBlogAction, type FormState } from "@/lib/actions";
import { renderBlogMarkdown } from "@/lib/blog-content";
import ThemeToggle from "@/components/theme-toggle";
import type { Theme } from "@/lib/theme";

const fieldClass =
  "w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800 transition placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-400";

const initial: FormState = {};

// Mirror the reader page's prose styling so the preview matches what a
// signed-in reader will see. Kept in sync with src/app/blogs/[id]/page.tsx.
const PROSE_CLASSES =
  "text-zinc-200 leading-relaxed " +
  "[&_h1]:mt-8 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-zinc-50 " +
  "[&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-zinc-50 " +
  "[&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-zinc-100 " +
  "[&_p]:mt-4 [&_p]:leading-relaxed " +
  "[&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 " +
  "[&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6 " +
  "[&_li]:mt-1 " +
  "[&_a]:text-cyan-300 [&_a]:underline hover:[&_a]:text-cyan-200 " +
  "[&_code]:bg-zinc-900 [&_code]:px-1 [&_code]:rounded [&_code]:text-[0.9em] " +
  "[&_pre]:bg-zinc-950 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:ring-1 [&_pre]:ring-zinc-800 [&_pre]:mt-4 [&_pre]:overflow-x-auto " +
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-cyan-500/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:mt-4 [&_blockquote]:text-zinc-300 " +
  "[&_strong]:font-semibold [&_strong]:text-zinc-100 " +
  "[&_em]:italic " +
  "[&_hr]:my-8 [&_hr]:border-zinc-800";

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

  // Rendering markdown+katex on every keystroke would be wasteful; memo on
  // the raw source so we only re-render when the body actually changes.
  const bodyHtml = useMemo(() => renderBlogMarkdown(body), [body]);

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
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={24}
                placeholder={"Write in Markdown.\n\n## A section\n\n- bullet\n- **bold**\n\nInline math: $E = mc^2$"}
                spellCheck={false}
                suppressHydrationWarning
                className={`mt-1 ${fieldClass} font-mono text-[13px] leading-relaxed`}
              />
            </div>
          </section>

          {/* ---------- Preview pane ---------- */}
          <section className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-lg bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400 ring-1 ring-zinc-800">
              Markdown supported: <code>**bold**</code>, <code>## Heading</code>
              , <code>- list</code>, <code>`code`</code>, <code>&gt; quote</code>
              . Math: <code>$…$</code> inline, <code>$$…$$</code> display.
            </div>
            <div className="mt-3 rounded-2xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Preview
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
                {title || "Untitled"}
              </h1>
              <article
                className={"mt-4 " + PROSE_CLASSES}
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
