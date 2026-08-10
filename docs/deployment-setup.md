# Deployment setup guide

One-time setup for the 3-environment pipeline (dev → staging → production). Everything in the code is already done; this guide covers the dashboards: **GitHub**, **Vercel**, **Squarespace** (DNS), and your MySQL host (Cloudways) for the production database.

---

## 1. GitHub — repo, branches, protection

1. Create a repository (e.g. `honesttaskers/lead-nurturing-engine`) at github.com → **New repository** (private).
2. Push both branches from your machine:
   ```bash
   git remote add origin git@github.com:<org>/lead-nurturing-engine.git
   git push -u origin main
   git push -u origin staging
   ```
3. Repo → **Settings → Branches → Add branch ruleset** (or classic protection rule), one for `main` and one for `staging`:
   - Require a pull request before merging.
   - Require status checks to pass: select **server** and **app** (the two `ci` jobs — they appear in the list after the first PR runs).
   - Block force pushes.

   This is the test gate: nothing merges to `main` (and therefore nothing deploys to production) unless CI is green.

## 2. Production database — new tables on the platform MySQL

The app uses tables prefixed `lne_` so it can safely share the existing platform database (no name collisions).

1. **Enable remote access** so both Vercel and your machine can connect. On Cloudways: **Server → Security** — Vercel's serverless functions have *dynamic* IPs, so you must allow MySQL connections from all IPs (`%`). Mitigations, strongly recommended:
   - Create a **dedicated MySQL user** for this app (not the platform's main user) with privileges only on the platform database — or at minimum a very strong generated password.
   - On Cloudways this is: application → **Access Details → Database Access** for credentials; ask Cloudways support to add a MySQL user or allow remote access if the UI doesn't expose it.
2. Build the production connection string:
   ```
   mysql://<user>:<password>@<server-ip>:3306/<database-name>
   ```
3. From your machine, create the tables (idempotent, data-safe — it only runs `CREATE TABLE IF NOT EXISTS`):
   ```bash
   DATABASE_URL="mysql://..." npm run db:schema
   ```
   **Never run `npm run seed` against production** — it inserts demo leads (and the script refuses when `NODE_ENV=production`).

## 3. Vercel — project, env vars, domains

1. vercel.com → **Add New → Project** → import the GitHub repo. Leave the root directory as the repo root; `vercel.json` supplies the install/build commands and routing. Deploy.
2. Project → **Settings → Functions**: make sure **Fluid compute** is enabled (default on new projects). The function is configured for `maxDuration: 300` so report generation has headroom.
3. Project → **Settings → Environment Variables**:
   | Variable | Environment | Value |
   | --- | --- | --- |
   | `DATABASE_URL` | Production | the platform MySQL URI from step 2 |
   | `OPENAI_API_KEY` | Production | production key |
   | `DATABASE_URL` | Preview → *limit to branch `staging`* | the staging Railway MySQL URI |
   | `OPENAI_API_KEY` | Preview → *limit to branch `staging`* | staging key (can be the same) |

   (`NODE_ENV=production` is set automatically by Vercel for both production and preview builds.)
4. Project → **Settings → Git**: confirm the production branch is `main`.
5. Project → **Settings → Domains**:
   - Add `nurture.honesttaskers.com` → assigned to Production (`main`).
   - Add `nurture-staging.honesttaskers.com` → when prompted for the environment/branch, choose Preview with branch **`staging`**.
6. Optional staging privacy: **Settings → Deployment Protection** → enable *Vercel Authentication* for Preview deployments (team members log in with their Vercel accounts). Leave it off if you want the team to open staging with no login.

## 4. Squarespace — DNS records

1. Squarespace → **Domains → honesttaskers.com → DNS Settings → Custom Records**.
2. Add two CNAME records (Vercel shows the exact target on the Domains page — normally `cname.vercel-dns.com`):
   | Type | Host | Data |
   | --- | --- | --- |
   | CNAME | `nurture` | `cname.vercel-dns.com` |
   | CNAME | `nurture-staging` | `cname.vercel-dns.com` |
3. Back in Vercel → Domains, wait for both to show **Valid Configuration** (propagation is usually minutes, can take up to an hour). SSL certificates are issued automatically.

## 5. First deploys — verification checklist

**Staging**
1. Push any commit to `staging` (or merge a PR) → watch the deploy in Vercel.
2. `https://nurture-staging.honesttaskers.com/api/health` → expect `{"ok":true,"db":"up",...}`.
3. Seed staging demo data from your machine: `DATABASE_URL=<staging-url> npm run seed`.
4. Browse the app: leads list loads, generate a report end-to-end, open the PDF (this exercises OpenAI, BLOB image storage, and the bundled fonts — the main serverless integration risks).

**Production**
1. Open a PR `staging` → `main`; confirm the CI checks appear and pass; merge.
2. `https://nurture.honesttaskers.com/api/health` → `{"ok":true,...}`.
3. Smoke-test the UI. Confirm the `lne_*` tables appeared in the platform DB and nothing else changed.

**Rollback drill (do this once so it's familiar)**
1. Deploy a trivial visible change to production.
2. Vercel → Deployments → previous production deployment → **⋯ → Instant Rollback**.
3. Confirm the site reverted within seconds, then roll forward (redeploy the newest).

## 6. Staging DB refresh (Railway 24h expiry)

The staging database is a temporary Railway instance by choice. When it expires:

1. Railway → create a new MySQL database → copy its public connection URL.
2. Vercel → Settings → Environment Variables → edit `DATABASE_URL` (Preview / `staging` branch) → save.
3. Locally: `DATABASE_URL=<new-url> npm run seed` (creates schema + demo data).
4. Vercel → Deployments → latest staging deployment → **⋯ → Redeploy** (env var changes need a redeploy).

~3 minutes total. If staging ever needs to be permanent, swap in any persistent MySQL and only step 2–4 change.
