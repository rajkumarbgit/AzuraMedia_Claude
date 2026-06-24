# AzuraMedia — Job & Production Workflow Platform

Full-stack Next.js 14 app (App Router + API routes as backend) with PostgreSQL via Prisma and NextAuth-based authentication. Covers job intake with client budgets and mandates, a PM approval workflow with versioned timeline history, a CEO dashboard, a shift-based production/capacity scheduler, an admin panel (users/clients/designations/page permissions), per-role dashboards, and dark/light theme.

## Tech stack
- Next.js 14 (TypeScript, App Router)
- Prisma ORM + PostgreSQL (built/tested for Supabase)
- NextAuth.js (Credentials provider, JWT sessions, bcrypt password hashing)
- Tailwind CSS, next-themes (dark/light), Recharts

## 1. Local setup

```bash
npm install
cp .env.example .env   # fill in the values below
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`.

### Environment variables (`.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Pooled connection string (Supabase: port 6543, `?pgbouncer=true`) |
| `DIRECT_URL` | Direct connection string (Supabase: port 5432) — used for migrations |
| `NEXTAUTH_SECRET` | Random secret. Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | App URL, e.g. `http://localhost:3000` or your production domain |

### Seed login credentials

After `npm run seed`, all users share the password `Password123!`:

| Email | Role |
|---|---|
| ceo@azuramedia.com | CEO |
| admin@azuramedia.com | ADMIN |
| pm@azuramedia.com | PROJECT_MANAGER |
| lead1@azuramedia.com | PRODUCTION_LEAD |
| ops1@azuramedia.com / ops2@azuramedia.com / ops3@azuramedia.com | OPS (APAC/EMEA/AMER shifts) |

**Change these passwords (or delete/replace the seed users) before any real deployment.**

## 2. Deploying to Vercel + Supabase

1. **Supabase**: create a project → Settings → Database → copy the *Connection pooling* string into `DATABASE_URL` and the *direct* connection string into `DIRECT_URL`.
2. **Vercel**: import this repo → set the four env vars above as Project Environment Variables (Production + Preview) → set `NEXTAUTH_URL` to your Vercel domain.
3. Deploy. Vercel's build environment has unrestricted internet access, so `prisma generate` (run automatically via the `build` script, `prisma generate && next build`) will download its query engine binaries from `binaries.prisma.sh` without issue.
4. Run the migration once against the production database (from your machine, with `.env` pointed at the production `DATABASE_URL`/`DIRECT_URL`):
   ```bash
   npx prisma migrate deploy
   npm run seed   # optional — seeds demo users/clients/jobs; skip or adapt for real data
   ```
5. Log in with one of the seed accounts (or your own data) and confirm role-based redirects work, then change/remove demo passwords.

## 3. How the workflow maps to your requirements

- **Job intake** (`/jobs`, `/jobs/new`): job no., client, multi-currency budget, production spend %, PM comment. Gated to PM/CEO/ADMIN via page permissions.
- **Mandate change & approval**: production roles request extra/reduced mandates from a job's detail page; PM/CEO/ADMIN approve or reject from the same page. Every approval bumps the job's `version` and writes a `TimelineEvent`, rendered as a timeline on `/jobs/[id]`.
- **CEO dashboard** (`/ceo-dashboard`): completed/in-progress counts, owners + estimated hours, total earning, forecast earning, and a job/money/people search box.
- **Production timeline** (`/production`): task creation under a job, lead assignment, ops assignment by shift (APAC/EMEA/AMER/GEN, GEN editable as default), capacity vs. booked vs. remaining hours per person and in total, leave marking (self, or bulk by a lead/manager), EOD comments, search by job/person/task. Shift times are editable in the same page.
- **Auth** (`/login`): credentials-based; every other route is behind middleware requiring a session; logo shown on login and in the app sidebar.
- **Admin** (`/admin`): users, clients, designations, and a role × page permission matrix — page itself only reachable by CEO/ADMIN.
- **Per-role dashboards** (`/dashboard`): different content for PM, PRODUCTION_LEAD, OPS, CEO/ADMIN.
- **Theme**: light/dark toggle in the topbar, persisted via `next-themes`.

## 4. Notes / things to revisit before go-live

- Seed data is for demonstration only — replace clients/jobs or just run migrations without `npm run seed` for a clean production database.
- `NEXTAUTH_SECRET` must be a real secret in production, not the placeholder.
- Soft-deletes are used for users (`isActive`) to preserve historical job/task references — there's no hard user-delete endpoint by design.
- The app was built and code-reviewed in a sandboxed environment without outbound access to `binaries.prisma.sh`, so `prisma generate` / `next build` could not be executed end-to-end in that sandbox. The code was verified via `npm install` (succeeded), TypeScript syntax checking of every source file (no errors outside the expected "missing generated Prisma types" noise), and manual cross-checks of every Prisma model against every API route that reads/writes it. Run `npm install && npx prisma generate && npm run build` once on your machine or in CI/Vercel (where Prisma's CDN is reachable) as the final build confirmation.
