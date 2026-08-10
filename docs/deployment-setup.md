# Deployment setup guide

One-time setup for the 3-environment pipeline (dev → staging → production). Everything in the code is already done; this guide covers the dashboards: **GitHub**, **TiDB Cloud** (databases), **Vercel**, and **Squarespace** (DNS).

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

## 2. Databases — one TiDB Cloud Serverless cluster, three databases

All environments use a single free [TiDB Cloud](https://tidbcloud.com) Serverless cluster (MySQL-compatible, 5GB storage + 50M request units/month free, publicly reachable over TLS — no IP whitelisting, so it works from Vercel and your machine alike).

1. Sign up at tidbcloud.com (no credit card) → **Create Cluster** → choose **Serverless**, pick a region close to your Vercel region (US East is a safe default), name it e.g. `nurture`.
2. Open the cluster → **Connect** → generate/copy the password. Note the host (like `gateway01.us-east-1.prod.aws.tidbcloud.com`), port (`4000`), and user (like `xxxxxxxx.root`).
3. Create the three databases. In the cluster's **SQL Editor** (or Chat2Query) run:
   ```sql
   CREATE DATABASE IF NOT EXISTS nurture_dev;
   CREATE DATABASE IF NOT EXISTS nurture_staging;
   CREATE DATABASE IF NOT EXISTS nurture_prod;
   ```
4. Build one connection string per environment — TLS is required, hence the `ssl` param:
   ```
   mysql://<user>:<password>@<host>:4000/nurture_dev?ssl={"rejectUnauthorized":true}
   mysql://<user>:<password>@<host>:4000/nurture_staging?ssl={"rejectUnauthorized":true}
   mysql://<user>:<password>@<host>:4000/nurture_prod?ssl={"rejectUnauthorized":true}
   ```
5. From your machine, create the tables in each (idempotent, data-safe — only `CREATE TABLE IF NOT EXISTS`):
   ```bash
   DATABASE_URL="<dev-url>" npm run db:schema
   DATABASE_URL="<staging-url>" npm run db:schema
   DATABASE_URL="<prod-url>" npm run db:schema
   ```
6. Seed demo data into dev and staging only:
   ```bash
   DATABASE_URL="<dev-url>" npm run seed
   DATABASE_URL="<staging-url>" npm run seed
   ```
   **Never run `npm run seed` against production** — it inserts demo leads (and the script refuses when `NODE_ENV=production`).
7. Put the dev URL in `server/.env` as `DATABASE_URL`.

## 3. Vercel — project, env vars, domains

1. vercel.com → **Add New → Project** → import the GitHub repo. Leave the root directory as the repo root; `vercel.json` supplies the install/build commands and routing. Deploy.
2. Project → **Settings → Functions**: make sure **Fluid compute** is enabled (default on new projects). The function is configured for `maxDuration: 300` so report generation has headroom.
3. Project → **Settings → Environment Variables**:
   | Variable | Environment | Value |
   | --- | --- | --- |
   | `DATABASE_URL` | Production | the `nurture_prod` TiDB URI from step 2 |
   | `OPENAI_API_KEY` | Production | production key |
   | `LOGO_DEV_TOKEN` | Production | publishable token from [logo.dev](https://logo.dev) (free) |
   | `DATABASE_URL` | Preview → *limit to branch `staging`* | the `nurture_staging` TiDB URI |
   | `OPENAI_API_KEY` | Preview → *limit to branch `staging`* | staging key (can be the same) |
   | `LOGO_DEV_TOKEN` | Preview → *limit to branch `staging`* | same token |

   Company logos come from logo.dev, which answers 401 without a token — leads
   simply show lettermark avatars until `LOGO_DEV_TOKEN` is set. The token is
   *publishable* (designed to be visible in image URLs), and it is added to
   logo URLs as they leave the API, so rotating it needs no data changes.

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
3. Smoke-test the UI. Confirm `nurture_prod` contains the `lne_*` tables and no demo data.

**Rollback drill (do this once so it's familiar)**
1. Deploy a trivial visible change to production.
2. Vercel → Deployments → previous production deployment → **⋯ → Instant Rollback**.
3. Confirm the site reverted within seconds, then roll forward (redeploy the newest).

## 6. Database maintenance notes (TiDB Cloud)

- The free tier gives 5GB storage + 50M request units/month across the cluster — generous for this app; usage is visible on the cluster overview page.
- Nothing expires and nothing sleeps: no periodic refresh chore. To reset staging or dev data, just re-run `DATABASE_URL=<env-url> npm run seed` (idempotent) or drop/recreate that one database in the SQL Editor.
- If Vercel env vars ever change, remember a **Redeploy** is needed for them to take effect.
