# Chamber.Law Desktop

Desktop sidekick client for Chamber.Law, built with Electron + React + TypeScript.

## What it does

- Authenticates against the Chamber backend
- Connects to `/sidekick` Socket.IO namespace
- Streams local watcher status/file activity to the sidekick channel
- Provides desktop UI for connection health and activity feed

## Environment

Create and edit `.env` in this folder:

- `VITE_API_URL` — backend API base (e.g. `http://localhost:5100/api/v1`)
- `VITE_SOCKET_URL` (optional) — explicit socket base (e.g. `http://localhost:5100`)
- `VITE_SOCKET_RECONNECT_ATTEMPTS`
- `VITE_SOCKET_RECONNECT_DELAY_MS`
- `VITE_SOCKET_RECONNECT_MAX_DELAY_MS`
- `VITE_SOCKET_TIMEOUT_MS`

Use `.env.example` as the starting template.

## Development

1. Install dependencies
2. Set `.env`
3. Run dev server

## Build

- `npm run build` builds renderer + electron artifacts and packages desktop app.

## Security notes

- Desktop/session tokens are stored through Electron IPC secure-store handlers.
- When Electron `safeStorage` is available, values are encrypted at rest.
- If unavailable, secure-store falls back to local plaintext values on disk.

## Current maturity

- Env-driven API/socket endpoints: ✅
- Reconnect diagnostics/backoff: ✅
- Basic token persistence with secure IPC path: ✅
- Offline queue/replay + conflict management: ⏳ pending
