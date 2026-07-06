import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { logoutAction } from "@/lib/actions";
import { dbAll } from "@/lib/db";
import { getTheme } from "@/lib/theme";
import ThemeToggle from "@/components/theme-toggle";

type BlogListRow = {
  id: number;
  title: string;
  body: string;
  created_at: number;
  updated_at: number;
  author_email: string;
};

// Same subject list the dashboard shows in its pill nav. We link back to
// the dashboard with a sensible default (grade 1) — the dashboard itself
// respects the learner's last-picked grade otherwise.
const SUBJECT_TABS = [
  { id: "math", label: "Math" },
  { id: "language", label: "Language" },
  { id: "science", label: "Science" },
] as const;

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Rough plain-text preview: strip common markdown / latex markers and
// clip. Not perfect (won't render escaped chars, drops meaningful
// punctuation) but adequate for a snippet.
function snippet(body: string): string {
  const stripped = body.replace(/[#*_`$]/g, "").replace(/\s+/g, " ").trim();
  if (stripped.length <= 140) return stripped;
  return stripped.slice(0, 140).trimEnd() + "…";
}

export default async function BlogListPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const theme = await getTheme();
  const isAdmin = session.role === "admin";
  const initial = session.email.charAt(0).toUpperCase();

  const posts = await dbAll<BlogListRow>(
    "SELECT b.id, b.title, b.body, b.created_at, b.updated_at, u.email AS author_email FROM blogs b JOIN users u ON b.author_id = u.id WHERE b.published = TRUE ORDER BY b.updated_at DESC",
  );

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-20 border-b border-zinc-900 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-6 px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="inline-block h-6 w-6 rounded-md bg-cyan-400 shadow-[0_0_20px_-2px_rgba(34,211,238,0.7)]" />
            <span className="text-base font-semibold tracking-tight text-zinc-100">
              Scrolls
            </span>
          </Link>

          <nav className="hidden items-center gap-1 rounded-full bg-zinc-900 p-1 ring-1 ring-zinc-800 sm:flex">
            {SUBJECT_TABS.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard?subject=${s.id}&grade=1`}
                className="rounded-full px-4 py-1.5 text-sm font-medium text-zinc-500 transition hover:text-zinc-200"
              >
                {s.label}
              </Link>
            ))}
            <span
              className="rounded-full bg-zinc-800 px-4 py-1.5 text-sm font-medium text-zinc-100 shadow-inner"
              aria-current="page"
            >
              Blogs
            </span>
          </nav>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                href="/admin/blogs"
                className="hidden rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-cyan-400 sm:inline-block"
              >
                Manage blogs
              </Link>
            )}
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

        <nav className="border-t border-zinc-900 px-6 sm:hidden">
          <div className="mx-auto flex max-w-4xl gap-1 py-2">
            {SUBJECT_TABS.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard?subject=${s.id}&grade=1`}
                className="rounded-full px-3 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-900"
              >
                {s.label}
              </Link>
            ))}
            <span className="rounded-full bg-cyan-500 px-3 py-1 text-xs font-medium text-black">
              Blogs
            </span>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Blog
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              Notes from Scrolls
            </h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-400">
              Occasional writing about learning, the curriculum, and how the
              app is built.
            </p>
          </div>
        </div>

        <section className="mt-8">
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950 px-6 py-16 text-center">
              <h3 className="text-base font-semibold text-zinc-100">
                No posts yet.
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
                Check back soon — the first post is on its way.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {posts.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/blogs/${p.id}`}
                    className="group block rounded-2xl bg-zinc-950 p-6 ring-1 ring-zinc-800 transition hover:ring-cyan-400/50"
                  >
                    <p className="text-base font-semibold text-zinc-100 group-hover:text-cyan-200">
                      {p.title || "Untitled"}
                    </p>
                    {snippet(p.body) && (
                      <p className="mt-2 text-sm text-zinc-400">
                        {snippet(p.body)}
                      </p>
                    )}
                    <p className="mt-3 text-xs text-zinc-500">
                      {p.author_email} · {formatDate(p.updated_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
