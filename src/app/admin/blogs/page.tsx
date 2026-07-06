import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  createBlogAction,
  deleteBlogAction,
  logoutAction,
} from "@/lib/actions";
import { dbAll } from "@/lib/db";
import { getTheme } from "@/lib/theme";
import ThemeToggle from "@/components/theme-toggle";
import ResetCompletionsButton from "../reset-completions-button";
import DeleteBlogButton from "./delete-blog-button";

type BlogSummary = {
  id: number;
  title: string;
  body: string;
  published: boolean;
  updated_at: number;
  author_email: string;
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function snippet(body: string): string {
  const stripped = body.replace(/[#*_`$]/g, "").replace(/\s+/g, " ").trim();
  if (stripped.length <= 140) return stripped;
  return stripped.slice(0, 140).trimEnd() + "…";
}

export default async function AdminBlogsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");
  const theme = await getTheme();

  const posts = await dbAll<BlogSummary>(
    "SELECT b.id, b.title, b.body, b.published, b.updated_at, u.email AS author_email FROM blogs b JOIN users u ON b.author_id = u.id ORDER BY b.updated_at DESC",
  );

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-10 border-b border-zinc-900 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="inline-block h-6 w-6 rounded-md bg-cyan-400 shadow-[0_0_20px_-2px_rgba(34,211,238,0.7)]" />
            <span className="text-base font-semibold tracking-tight text-zinc-100">
              Scrolls
            </span>
            <span className="ml-2 rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-300 ring-1 ring-cyan-500/30">
              Studio
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/categories"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
            >
              Categories
            </Link>
            <Link
              href="/admin/blogs"
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-100 ring-1 ring-zinc-800"
              aria-current="page"
            >
              Blogs
            </Link>
            <Link
              href="/admin/terminal"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
            >
              Terminal
            </Link>
            <ResetCompletionsButton />
            <ThemeToggle theme={theme} />
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
            >
              Learner view
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-800"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
              {session.email}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-50">
              Blog posts
            </h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-400">
              Draft essays, notes, and announcements. Publish to make them
              visible to signed-in readers.
            </p>
          </div>
          <form action={createBlogAction}>
            <button
              type="submit"
              className="rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-400 hover:shadow-[0_0_30px_-6px_rgba(34,211,238,0.7)]"
            >
              New blog
            </button>
          </form>
        </div>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            All posts
          </h2>

          {posts.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950 px-6 py-16 text-center">
              <h3 className="text-base font-semibold text-zinc-100">
                No posts yet
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
                Start a draft — you can leave it unpublished until it&apos;s
                ready.
              </p>
              <form action={createBlogAction}>
                <button
                  type="submit"
                  className="mt-5 inline-flex items-center justify-center rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
                >
                  Create your first post
                </button>
              </form>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {posts.map((p) => (
                <li
                  key={p.id}
                  className="group flex items-start justify-between gap-4 rounded-xl bg-zinc-950 p-5 ring-1 ring-zinc-800 transition hover:ring-cyan-400/40"
                >
                  <Link
                    href={`/admin/blogs/${p.id}`}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-zinc-100 hover:text-cyan-300">
                        {p.title || "Untitled"}
                      </span>
                      {p.published ? (
                        <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-300 ring-1 ring-cyan-500/30">
                          Published
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-400 ring-1 ring-zinc-700">
                          Draft
                        </span>
                      )}
                    </div>
                    {snippet(p.body) && (
                      <p className="mt-1 text-sm text-zinc-400 line-clamp-2">
                        {snippet(p.body)}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-zinc-500">
                      {p.author_email} · updated {formatDate(p.updated_at)}
                    </p>
                  </Link>
                  <div className="flex items-center gap-1">
                    {p.published && (
                      <Link
                        href={`/blogs/${p.id}`}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                      >
                        View
                      </Link>
                    )}
                    <Link
                      href={`/admin/blogs/${p.id}`}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-cyan-300 hover:bg-zinc-900"
                    >
                      Edit
                    </Link>
                    <form action={deleteBlogAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <DeleteBlogButton title={p.title || "Untitled"} />
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
