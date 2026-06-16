import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Terminal from "./terminal";

export default async function TerminalPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-10 border-b border-zinc-900 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="inline-block h-6 w-6 rounded-md bg-cyan-400 shadow-[0_0_20px_-2px_rgba(34,211,238,0.7)]" />
            <span className="text-base font-semibold tracking-tight text-zinc-100">
              Scrolls
            </span>
            <span className="ml-2 rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-300 ring-1 ring-cyan-500/30">
              Terminal
            </span>
          </Link>
          <Link
            href="/admin"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          >
            ← Studio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
            Terminal
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Experiment with ScrollScript outside of any lesson. Edit code, watch
            it render live, and evaluate expressions against the current scene.
          </p>
        </div>
        <Terminal />
      </main>
    </div>
  );
}
