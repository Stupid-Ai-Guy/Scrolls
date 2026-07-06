import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { logoutAction } from "@/lib/actions";
import { dbGet } from "@/lib/db";
import { renderBlogMarkdown } from "@/lib/blog-content";
import { getTheme } from "@/lib/theme";
import ThemeToggle from "@/components/theme-toggle";

type BlogDetail = {
  id: number;
  title: string;
  body: string;
  updated_at: number;
  author_email: string;
};

// Tailwind class fragment that gives the rendered article a readable
// "prose" look without pulling in the typography plugin. The child
// selectors target the elements marked outputs.
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

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const theme = await getTheme();
  const initial = session.email.charAt(0).toUpperCase();

  const { id } = await params;
  const blogId = Number(id);
  if (!Number.isInteger(blogId) || blogId <= 0) notFound();

  const post = await dbGet<BlogDetail>(
    "SELECT b.id, b.title, b.body, b.updated_at, u.email AS author_email FROM blogs b JOIN users u ON b.author_id = u.id WHERE b.id = $1 AND b.published = TRUE",
    [blogId],
  );

  if (!post) notFound();

  const html = renderBlogMarkdown(post.body);

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-20 border-b border-zinc-900 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <Link href="/blogs" className="flex items-center gap-2">
              <span className="inline-block h-6 w-6 rounded-md bg-cyan-400 shadow-[0_0_20px_-2px_rgba(34,211,238,0.7)]" />
              <span className="text-base font-semibold tracking-tight text-zinc-100">
                Scrolls
              </span>
            </Link>
            <span className="hidden text-sm text-zinc-700 sm:inline">/</span>
            <Link
              href="/blogs"
              className="hidden rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 sm:inline-block"
            >
              ← All posts
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} />
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-800"
                suppressHydrationWarning
              >
                Sign out
              </button>
            </form>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-zinc-200 ring-1 ring-zinc-800"
              title={session.email}
            >
              {initial}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/blogs"
          className="mb-8 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 hover:text-cyan-300 sm:hidden"
        >
          ← All posts
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          {post.title || "Untitled"}
        </h1>
        <p className="mt-3 text-sm text-zinc-500">
          {post.author_email} · {formatDate(post.updated_at)}
        </p>
        <article
          className={"mt-8 " + PROSE_CLASSES}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </main>
    </div>
  );
}
