# Scrolls

Brilliant-style interactive learning, with an IXL-style curriculum tree. Built with Next.js 15, Tailwind v4, and a small custom DSL ("ScrollScript") for authoring interactive lessons.

## Local development

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`. The database is a local SQLite file at `data/app.sqlite` (created on first boot).

To become an admin in the local app, sign in or sign up with the master password `ImAnAdmin?!1` (any email).

## Tech stack

- **Next.js 15 (App Router)** with React 19 server components and server actions
- **Tailwind CSS v4** (dark theme, Inter font)
- **LibSQL / Turso** for the database — same SQLite-compatible client locally and in production
- **jose** + signed httpOnly cookies for sessions
- **bcryptjs** for password hashing
- A small DSL parser/runner for interactive blocks (see `src/lib/scrollscript.ts`)

## Deploying to Vercel + Turso

The app stores everything in a SQLite-compatible database. In production, set the database to Turso (hosted LibSQL).

### 1. Create the Turso database

1. Install the Turso CLI: <https://docs.turso.tech/cli>.
2. Sign up and create a database:
   ```bash
   turso auth signup
   turso db create scrolls
   turso db show scrolls --url
   turso db tokens create scrolls
   ```
3. Save the URL (looks like `libsql://scrolls-yourname.turso.io`) and the auth token.

### 2. Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo at <https://vercel.com/new>.
3. Add these environment variables in the Vercel project settings:

   | Name | Value |
   |---|---|
   | `TURSO_URL` | the `libsql://…` URL from step 1 |
   | `TURSO_AUTH_TOKEN` | the token from step 1 |
   | `SESSION_SECRET` | a long random string (≥ 32 chars) |

4. Click Deploy.

The schema migrates itself on first boot — no manual setup needed.

## Project structure

```
src/
├─ app/                   Next.js routes
│  ├─ (marketing)         /, login, signup
│  ├─ dashboard/          learner dashboard (subjects × grades)
│  ├─ lessons/[id]/       learner lesson player
│  └─ admin/              studio (lessons, categories, terminal)
├─ components/            client-side components
│  ├─ scrollscript-editor.tsx     syntax-highlighted code editor
│  └─ scrollscript-runner.tsx     SVG runner with sliders/buttons/check
└─ lib/
   ├─ db.ts               LibSQL client + async query helpers
   ├─ actions.ts          all server actions
   ├─ session.ts          JWT cookie session
   ├─ curriculum.ts       subject + grade helpers
   ├─ lesson-content.ts   block-level lesson schema
   └─ scrollscript.ts     ScrollScript DSL (parser + evaluator)
```

## ScrollScript at a glance

```
view -8 8 -8 8
slider angle 0 360 200 "Angle (degrees)"

rad = angle * pi / 180
x = cos(rad) * 5
y = sin(rad) * 5

circle cords(0, 0) dims(5) color(slate)
line from(0, 0) to(x, y) color(emerald)
point cords(x, y) color(emerald) label("P")

if angle < 90
  text cords(0, -7) value("Acute") color(sky)
elif angle == 90
  text cords(0, -7) value("Right angle!") color(emerald)
else
  text cords(0, -7) value("Obtuse") color(rose)
end

check x > 0 and y > 0
hint "Try the first quadrant."
```

Open `/admin/terminal` (as admin) for the full reference and live preview.
