"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type FormState } from "@/lib/actions";

const initial: FormState = {};

const fieldClass =
  "mt-1.5 w-full rounded-lg bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 ring-1 ring-zinc-800 transition placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-400";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signupAction, initial);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.15),_transparent_70%)]"
      />
      <div className="mx-auto max-w-sm">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2 text-zinc-300"
        >
          <span className="inline-block h-7 w-7 rounded-lg bg-cyan-400 shadow-[0_0_24px_-2px_rgba(34,211,238,0.7)]" />
          <span className="text-lg font-semibold tracking-tight text-zinc-100">
            Scrolls
          </span>
        </Link>

        <div className="rounded-2xl bg-zinc-950 p-7 ring-1 ring-zinc-800">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Free to start. No credit card.
          </p>

          <form action={formAction} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-300"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                suppressHydrationWarning
                className={fieldClass}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-300"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                suppressHydrationWarning
                className={fieldClass}
              />
              <p className="mt-1.5 text-xs text-zinc-500">
                At least 8 characters.
              </p>
            </div>

            <div>
              <label
                htmlFor="confirm"
                className="block text-sm font-medium text-zinc-300"
              >
                Confirm password
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                suppressHydrationWarning
                className={fieldClass}
              />
            </div>

            {state.error && (
              <p className="text-sm text-rose-400" role="alert">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              suppressHydrationWarning
              className="w-full rounded-lg bg-cyan-500 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-60"
            >
              {pending ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-cyan-400 hover:text-cyan-300"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
