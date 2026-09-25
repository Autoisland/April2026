# April2026

A minimal Node.js + TypeScript + Express starter used to bootstrap the Cloud Agent
development environment. It exposes a small tasks API and serves a single-page UI so
the environment can be validated end to end.

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
| `GET` | `/api/health` | Health/uptime probe. |
| `GET` | `/api/tasks` | List tasks. |
| `POST` | `/api/tasks` | Create a task (`{ "title": "..." }`). |

The root path `/` serves a small web UI backed by these endpoints.

## Cloud Agent environment

The environment is defined in [`.cursor/environment.json`](.cursor/environment.json):

- `install`: `npm ci` restores dependencies from `package-lock.json`.
- `terminals`: a `dev-server` terminal runs `npm run dev` so the app is reachable
  while the agent works.
