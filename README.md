# April2026 — Architecture Diagram Builder

An improved reimplementation of the [ThinkInfoSec hub](https://thinkinfosec.org)
"Architecture Diagram Builder" tool. Compose security architecture diagrams from a
catalog of blocks (CrowdStrike Falcon modules, identity, cloud, network, SIEM/SOAR,
data, and alliance partners), organize them into zones, connect them, and export to
**Mermaid**, **D2**, and **SVG** (plus a client-side **PNG** download).

## What's different / better than the original

- **Server-side, deterministic exporters** for Mermaid, D2, and SVG that are fully
  unit tested — instead of ad-hoc client-only generation.
- **A validated diagram model** (`src/model.ts`) that rejects unknown block types,
  dangling edges, duplicate ids, and bad zone references, returning actionable errors.
- **A data-driven block catalog** (`src/catalog.ts`) served over an API, so the
  palette is easy to extend.
- **A persistence API** to save, list, load, and delete diagrams.
- **A clean, modern drag-and-drop canvas UI** with zones, labeled/dashed connections,
  live inspector editing, and in-panel export previews.

## Requirements

- Node.js >= 22 (the Cloud Agent default image already provides Node 22)
- npm 10+

## Getting started

```bash
npm ci        # install dependencies from the lockfile
npm run dev   # start the dev server with hot reload on http://localhost:3000
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the server with hot reload (`tsx watch`). |
| `npm run build` | Type-check and compile TypeScript to `dist/`. |
| `npm start` | Run the compiled server from `dist/`. |
| `npm run lint` | Lint the codebase with ESLint. |
| `npm test` | Run the Vitest test suite. |
| `npm run typecheck` | Type-check without emitting output. |

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health/uptime probe and supported export formats. |
| `GET` | `/api/catalog` | Block categories and block types. |
| `GET` | `/api/diagrams` | List saved diagrams. |
| `POST` | `/api/diagrams` | Create/save a diagram (validated). |
| `GET` | `/api/diagrams/:id` | Fetch a diagram. |
| `PUT` | `/api/diagrams/:id` | Update a diagram. |
| `DELETE` | `/api/diagrams/:id` | Delete a diagram. |
| `POST` | `/api/export/:format` | Export a diagram (`format` = `mermaid` \| `d2` \| `svg`). |

The root path `/` serves the diagram builder UI.

### Diagram model

```jsonc
{
  "id": "optional",
  "title": "Falcon Reference Architecture",
  "zones": [{ "id": "z1", "label": "Zone", "x": 40, "y": 40, "w": 320, "h": 240 }],
  "nodes": [{ "id": "n1", "type": "falcon-edr", "label": "EDR", "x": 80, "y": 90, "w": 150, "h": 64, "zone": "z1" }],
  "edges": [{ "id": "e1", "from": "n1", "to": "n2", "label": "telemetry", "style": "solid" }]
}
```

## Project layout

- `src/catalog.ts` — block categories and types.
- `src/model.ts` — diagram types and validation.
- `src/generators/` — Mermaid, D2, and SVG exporters.
- `src/store.ts` — in-memory diagram store (seeded with a sample).
- `src/app.ts` / `src/server.ts` — Express API and server.
- `public/` — the browser UI (`index.html`, `styles.css`, `app.js`).
- `test/` — Vitest unit and API tests.

## Cloud Agent environment

The environment is defined in [`.cursor/environment.json`](.cursor/environment.json):

- `install`: `npm ci` restores dependencies from `package-lock.json`.
- `terminals`: a `dev-server` terminal runs `npm run dev` so the app is reachable
  while the agent works.
