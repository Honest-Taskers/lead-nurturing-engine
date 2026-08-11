# Relationship Engine — API server

Express + TypeScript + MySQL backend for the Relationship Engine (`../app` is the React frontend).

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and (optionally) ANTHROPIC_API_KEY
npm run seed           # creates tables + demo data (idempotent)
npm run dev            # http://localhost:4000
```

> **The current Railway MySQL instance is temporary.** When it expires, point `DATABASE_URL` at a new MySQL instance and run `npm run seed` — it recreates the schema and all demo data (also preserved as backup in `../app/src/data/mock.ts`).

## Endpoints

| Method & path | Purpose |
|---|---|
| `GET /api/health` | DB + AI config status |
| `GET /api/leads` · `GET /api/leads/:id` | list / detail (+reports) |
| `POST /api/leads` · `PUT /api/leads/:id` | create / update |
| `POST /api/leads/import` | bulk import, dedupe on (organization, persona) |
| `POST /api/reports/generate` | Claude generates a report → stored as JSON sections |
| `GET /api/reports/stats` · `GET /api/reports/:id` | stats / detail |
| `POST /api/reports/:id/mark-sent` | mark sent; reschedules lead +cadence days |
| `GET /api/settings` · `PUT /api/settings` | singleton settings |

## Report generation (OpenAI)

- Reports follow the **HFMA "Revenue Cycle of the Future"** magazine format (reference copy in [sample_report/](sample_report/)), rebranded to Honest Taskers: pop-art cover with a generated illustration, badge, dek, pull quotes, SURVEY QUESTION bar charts, numbered lessons, square-bullet subtopics, and a supplement closer.
- Generation runs a three-agent Claude pipeline, each with its own skill (loaded as that agent's system prompt) — edit the skill files to change behavior without touching code: [skills/ht-research/SKILL.md](skills/ht-research/SKILL.md) (web research → verified brief), [skills/ht-report-writer/SKILL.md](skills/ht-report-writer/SKILL.md) (structure/tone/exhibits), and [skills/ht-goal-check/SKILL.md](skills/ht-goal-check/SKILL.md) (rubric audit on claude-haiku-4-5, feeding one repair pass). Citations are print-style (by name, never URLs); a server-side sanitizer strips any stray link artifacts.
- Text: OpenAI Responses API with strict JSON-schema structured output + the `web_search` tool for real, current statistics. Model selected in Settings (`gpt-5.1` / `gpt-5-mini` / `gpt-4o`).
- Cover art: `gpt-image-1` (pop-art halftone, HT blue/aqua palette), saved to `public/report-images/` and served at `/api/images/...`.
- Content is stored as **JSON sections** in `reports.sections` (not PDFs). The frontend shows a web preview; **Download PDF** calls `GET /api/reports/:id/pdf`, which renders the content through the fixed **print template** [src/services/reportPdf.tsx](src/services/reportPdf.tsx) (@react-pdf/renderer): 585×783pt trim like the reference, full-bleed cover, feature opener, two-column editorial grid, navy #203667 + warm gold #F7B84A halftone/burst system, keep-together quote/chart/number blocks, recurring navy footer with page numbers, supplement page and full-bleed back cover. All text is live vector type with embedded fonts (Bebas Neue / Oswald / Source Serif 4 / Source Sans 3 in `assets/fonts/` — licensed-free equivalents of the reference's Dharma Gothic / Exchange / Mallory system). The template is reused for every generation, so formatting and structure are deterministic — the model only fills content slots.
- **No `ANTHROPIC_API_KEY`?** Generation returns a deterministic stub so the whole app still demos.

## Auth (phase 3)

Login is currently a mock single-admin account. Phase 3 will integrate with Honest Taskers' existing platform: check the shared user store (e.g. an `is_signedin`-style flag / shared session) — signed-in users go straight to the dashboard, others are redirected to the platform's sign-in page.
