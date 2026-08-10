# Relationship Engine — Honest Taskers

AI lead-nurturing platform (reporting MVP). React + TypeScript + Material UI, styled to the Honest Taskers brand (Video-Brandbook palette: HT Blue `#2345ff`, Sky `#3e59ff`, Aqua `#2dd0e8`, Navy).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

Login is a mock single-admin account (any credentials work).

## Screens

| Route | Wireframe | Page |
|---|---|---|
| `/login` | RE0 | Login |
| `/` | RE1 | Dashboard (KPIs, due leads, bulk generate) |
| `/import` | RE2 | CSV import with column mapping + dedupe |
| `/leads` | RE3 | Leads list (All/Due/Sent, search, multi-select) |
| `/leads/new`, `/leads/:id/edit` | RE4 | Add / edit lead |
| `/leads/:id` | RE5 | Lead detail + report history |
| (dialog) | RE6 | Generate report modal |
| `/leads/:leadId/report/:reportId` | RE7 | Report preview, Mark as sent |
| `/settings` | RE8 | Brand, cadence, template, AI settings |

## Architecture

- `src/theme/` — MUI theme carrying the brand identity
- `src/data/types.ts` — data model, mirrors the future **MySQL** schema (`leads`, `reports`, `settings`)
- `src/data/mock.ts` — seed data (dates relative to today so cadence states stay live)
- `src/context/AppContext.tsx` — all reads/mutations go through context methods; swap these for `fetch` calls to the Node/Express + MySQL API in the next phase without touching pages
- `src/pages/`, `src/components/`, `src/layouts/` — UI

## Next phase (not built yet)

- Node.js/Express API + MySQL (schema mirrors `data/types.ts`), real Claude report generation server-side (API key stays off the client), PDF rendering, real auth
- Postcard function, research agent, vendor API integration (per 2026-08-03 meeting)
