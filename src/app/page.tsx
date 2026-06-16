import Link from "next/link";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();
  const signedIn = !!session;

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-20 border-b border-zinc-900 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-block h-6 w-6 rounded-md bg-cyan-400 shadow-[0_0_20px_-2px_rgba(34,211,238,0.7)]" />
            <span className="text-base font-semibold tracking-tight text-zinc-100">
              Scrolls
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <a
              href="#pricing"
              className="hidden rounded-lg px-3 py-1.5 text-zinc-400 hover:text-zinc-100 sm:inline"
            >
              Pricing
            </a>
            {signedIn ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400"
              >
                Open dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-1.5 font-medium text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-black transition hover:bg-cyan-400"
                >
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="relative mx-auto max-w-5xl px-6 pt-24 pb-24 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.18),_transparent_70%)]"
        />
        <p className="mb-5 inline-block rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-300 ring-1 ring-cyan-500/30">
          Math · Language · Science
        </p>
        <h1 className="mx-auto max-w-3xl text-5xl font-semibold tracking-tight text-zinc-50 sm:text-6xl">
          Learn by doing.
          <br />
          <span className="text-zinc-500">Not by reading.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-400">
          Interactive, visual lessons paired with a clear mastery-based path.
          Build real understanding at a pace that fits you.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {signedIn ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-cyan-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 hover:shadow-[0_0_40px_-8px_rgba(34,211,238,0.7)]"
            >
              Continue learning
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="rounded-lg bg-cyan-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 hover:shadow-[0_0_40px_-8px_rgba(34,211,238,0.7)]"
              >
                Create your account
              </Link>
              <Link
                href="/login"
                className="rounded-lg px-6 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="border-y border-zinc-900 bg-zinc-950">
        <div className="mx-auto grid max-w-6xl gap-px overflow-hidden bg-zinc-900 sm:grid-cols-3">
          {[
            {
              title: "Visual first",
              body: "Manipulate diagrams and watch concepts click. Every lesson is built around an interactive idea, not a wall of text.",
            },
            {
              title: "Guided discovery",
              body: "Small steps lead you to the insight yourself. You earn understanding instead of memorizing rules.",
            },
            {
              title: "Mastery-based path",
              body: "A clear skill tree shows what's next. Move on when a topic is truly solid — not before.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-zinc-950 p-8">
              <h3 className="text-base font-semibold text-zinc-100">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-100">
            Simple pricing
          </h2>
          <p className="mt-3 text-zinc-400">
            Start free. Add an AI tutor when you want one.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          <PricingCard
            name="Basic"
            price="Free"
            tagline="Full access to the standard curriculum."
            features={[
              "Every standard lesson",
              "Full skill-tree progression",
              "Mastery tracking",
            ]}
            cta={signedIn ? "Open dashboard" : "Get started"}
            href={signedIn ? "/dashboard" : "/signup"}
          />
          <PricingCard
            featured
            name="Pro"
            price="$9"
            priceSuffix="/mo"
            tagline="Add an AI tutor that adapts to you."
            features={[
              "Everything in Basic",
              "Personalized AI-generated lessons",
              "Conversational tutor (chat mode)",
              "Standard AI usage",
            ]}
            cta={signedIn ? "Upgrade to Pro" : "Start Pro"}
            href={signedIn ? "/dashboard" : "/signup"}
          />
          <PricingCard
            name="Premium"
            price="$19"
            priceSuffix="/mo"
            tagline="For heavy use of personalized AI."
            features={[
              "Everything in Pro",
              "Significantly more AI credits",
              "Priority response speed",
            ]}
            cta={signedIn ? "Upgrade to Premium" : "Start Premium"}
            href={signedIn ? "/dashboard" : "/signup"}
          />
        </div>
      </section>

      <footer className="border-t border-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-8 text-sm text-zinc-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Scrolls</p>
          <div className="flex items-center gap-4">
            <a href="#pricing" className="hover:text-zinc-200">
              Pricing
            </a>
            <Link href="/login" className="hover:text-zinc-200">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PricingCard({
  name,
  price,
  priceSuffix,
  tagline,
  features,
  cta,
  href,
  featured = false,
}: {
  name: string;
  price: string;
  priceSuffix?: string;
  tagline: string;
  features: string[];
  cta: string;
  href: string;
  featured?: boolean;
}) {
  return (
    <div
      className={
        "relative rounded-2xl bg-zinc-950 p-7 " +
        (featured
          ? "ring-2 ring-cyan-400 shadow-[0_0_60px_-20px_rgba(34,211,238,0.55)]"
          : "ring-1 ring-zinc-800")
      }
    >
      {featured && (
        <span className="absolute -top-3 left-7 rounded-full bg-cyan-500 px-2.5 py-0.5 text-xs font-semibold text-black">
          Most popular
        </span>
      )}
      <h3 className="text-lg font-semibold tracking-tight text-zinc-100">
        {name}
      </h3>
      <p className="mt-1 text-sm text-zinc-400">{tagline}</p>
      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight text-zinc-50">
          {price}
        </span>
        {priceSuffix && (
          <span className="text-sm text-zinc-500">{priceSuffix}</span>
        )}
      </div>
      <ul className="mt-6 space-y-2.5 text-sm text-zinc-300">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
                clipRule="evenodd"
              />
            </svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={
          "mt-7 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition " +
          (featured
            ? "bg-cyan-500 text-black hover:bg-cyan-400"
            : "bg-zinc-900 text-zinc-100 ring-1 ring-zinc-700 hover:bg-zinc-800")
        }
      >
        {cta}
      </Link>
    </div>
  );
}
