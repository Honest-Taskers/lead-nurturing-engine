# Lead Nurturing Engine

Honest Taskers' relationship engine: track healthcare leads, generate AI-written industry reports (web + print PDF), and manage send cadences.

- `server/` — Express 5 + TypeScript API (MySQL via mysql2, OpenAI report generation, @react-pdf print rendering)
- `app/` — Vite + React 19 + MUI single-page app (calls the API via relative `/api` paths)

## Environments

| Env | URL | Branch | Database |
| --- | --- | --- | --- |
| dev | http://localhost:5173 | any | Railway temporary MySQL (expires every 24h — recreate + reseed) |
| staging | https://nurture-staging.honesttaskers.com | `staging` | Railway temporary MySQL (same 24h caveat) |
| production | https://nurture.honesttaskers.com | `main` | Platform MySQL (shared server, `lne_`-prefixed tables) |

Hosting is one Vercel project: pushes to `staging` deploy the staging domain, merges to `main` deploy production. The Express app runs as a single serverless function (`api/index.ts`); the frontend is static (`app/dist`); `vercel.json` wires routing. All tables are prefixed `lne_` (see `server/src/db/tables.ts`) because production shares a database with the main platform. Report cover images are stored as MySQL BLOBs (`lne_report_images`) — serverless has no persistent disk.

## Local development

Requires Node 22+ (`.nvmrc`).

```bash
cp server/.env.example server/.env   # fill in DATABASE_URL (+ OPENAI_API_KEY for real reports)
npm --prefix server install
npm --prefix app install
npm run db:schema                    # apply schema (idempotent)
npm run seed                         # demo data (dev/staging only)
npm run dev:server                   # API on :4000
npm run dev:app                      # Vite on :5173, proxies /api → :4000
```

### Environment variables (server)

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | MySQL connection URI |
| `OPENAI_API_KEY` | Report + cover image generation (unset → deterministic stub reports) |
| `PORT` | Local API port (default 4000; unused on Vercel) |
| `NODE_ENV` | `production` disables CORS and blocks seeding |
| `ALLOW_SEED` | `1` overrides the seed guard (staging only — never production) |

## Testing

```bash
npm test                 # both packages
npm --prefix server test # unit tests; set TEST_DATABASE_URL for DB integration tests
npm --prefix app test    # vitest + Testing Library
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, builds, and all tests — including API integration tests against a disposable MySQL 8 container — on every PR to `staging`/`main`. Branch protection requires these checks, so nothing reaches production without passing tests.

## Branching & deploys

1. Feature branch → PR into `staging` → CI must pass → merge auto-deploys **staging**.
2. When staging looks good: PR `staging` → `main` → CI must pass → merge auto-deploys **production**.

## Rollback

Vercel dashboard → project → **Deployments** → pick the previous production deployment → **Instant Rollback**. Takes effect in seconds. Database rollback is out of scope: the schema is additive and idempotent (`CREATE TABLE IF NOT EXISTS`), and older code runs fine against a newer schema.

## Runbooks

- **Full deployment setup** (Vercel, GitHub, Squarespace DNS, database access): [docs/deployment-setup.md](docs/deployment-setup.md)
- **Refresh the staging DB** (after the 24h Railway expiry): create a new Railway MySQL → update `DATABASE_URL` in Vercel (Preview scope, `staging` branch) → locally: `DATABASE_URL=<new-url> npm run seed` → redeploy staging (Deployments → ⋯ → Redeploy).
- **Apply schema to production** (first time or after schema changes): `DATABASE_URL=<prod-url> npm run db:schema` from your machine. Never seed production — `seed.ts` refuses when `NODE_ENV=production`.
