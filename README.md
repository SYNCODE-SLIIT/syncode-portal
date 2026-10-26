# SYNCODE Client Portal

Private portal for Team SYNCODE clients: projects, progress updates, feature requests, invoices and payments.
Live at **https://portal.teamsyncode.com**.

The full plan, including build steps, data model and rules, is in [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md).

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) · Supabase (PostgreSQL, Auth, Storage) · Vercel

## Getting started

1. Install dependencies. On the SYNCODE development PC the default npm registry is blocked, so use the mirror:

   ```sh
   npm install --registry=https://registry.npmmirror.com
   ```

2. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and publishable key.
3. Run the dev server and open http://localhost:3000:

   ```sh
   npm run dev
   ```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

## Notes for developers

- **Next.js 16 differs from older versions.** Middleware is now `src/proxy.ts`, and Cache Components is on: anything that reads cookies or the session must render inside a `<Suspense>` boundary. Read the bundled docs in `node_modules/next/dist/docs/` before writing new patterns.
- Supabase clients: `src/lib/supabase/client.ts` (browser), `server.ts` (server only), `proxy.ts` (session refresh).
- Never put the Supabase service-role key in a `NEXT_PUBLIC_` variable or in client code.
