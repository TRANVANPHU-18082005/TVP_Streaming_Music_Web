# TVP Music frontend

React 18 app for TVP Music. It talks to the Express API in `../backend`. The API is one process. Audio transcoding is a second Node process in that package (`npm run dev:worker`). This folder does not run the API or the worker.

## Stack

- React 18, TypeScript, Vite (`rolldown-vite` 7)
- React Router 7
- Redux Toolkit and redux-persist for auth, playback, followed artists, and the music room
- TanStack Query for server data
- react-hook-form and Zod
- Tailwind CSS 4 and Radix UI
- hls.js for playback of the single AAC HLS playlist the worker produces
- socket.io-client

`vite.config.ts` does not set `server.port` or `preview.port`. `npm run dev` uses Vite’s default port **5173**. `npm run preview` uses Vite’s default port **4173**.

## Setup

```bash
cd frontend
npm install
```

Vite loads `.env`, `.env.local`, `.env.[mode]`, and `.env.[mode].local`. For `npm run dev`, mode is `development`, so `.env.development` is the file to use locally.

`frontend/.gitignore` ignores `.env.development`, `.env.production`, and `*.local`. It does not ignore a plain `.env`. Do not commit secrets in either file.

```env
VITE_API_URL=http://localhost:8000/api
VITE_SOCKET_URL=http://localhost:8000
VITE_APP_NAME=TVP Music
VITE_CDN_URL=
```

The backend must be listening on port **8000** (its default). Start it from `../backend` with `npm run dev`.

## Environment variables

`src/config/env.ts` reads these four variables:

| Variable | Used for | If unset |
|---|---|---|
| `VITE_API_URL` | Axios `baseURL`. Feature modules call paths such as `/tracks`, so this value already ends with `/api` | `https://tvp-backend.fly.dev/api` |
| `VITE_SOCKET_URL` | Socket.IO client. No `/api` suffix | `https://tvp-backend.fly.dev` |
| `VITE_APP_NAME` | Display name | `Music App` |
| `VITE_CDN_URL` | CDN origin. The module stores it on the field `CDN_DOMAIN` | `https://cdn.tvpmusic.site` |

`src/utils/track-helper.ts` builds playback URLs from `VITE_CDN_URL`. The name `VITE_CDN_DOMAIN` is not read. `frontend/.env.example` lists `VITE_CDN_URL` and also `VITE_NODE_ENV`; application code does not read `VITE_NODE_ENV`.

The backend’s own CDN setting is `CDN_DOMAIN` in `backend/src/config/env.ts`. Karaoke URL building in `karaoke.controller.ts` reads `CLOUDFLARE_DOMAIN`. Those are backend variables.

## Commands

```bash
npm run dev          # Vite dev server, port 5173
npm run type-check   # tsc --noEmit
npm run lint         # eslint .
npm run test         # vitest run
npm run test:watch   # vitest
npm run test:coverage
npm run build        # tsc --noEmit && vite build
npm run preview      # serve dist
```

Tests use `vitest.config.ts`: jsdom, `src/test/setup.ts`, and `src/**/*.{test,spec}.{ts,tsx}`.

## Architecture

`src/main.tsx` injects the Redux store into Axios, then renders providers. `RootLayout` runs auth bootstrap (`POST /api/auth/refresh-token` with the httpOnly cookie) and waits before rendering the tree. The access token stays in Redux memory. `MusicPlayer` is mounted once at the root.

Routes are composed in `src/app/routes/route.tsx`. Features export their own route arrays.

```text
src/
  app/             router, providers, sheets
  features/        one folder per feature (api, hooks, components, schemas)
  pages/           admin, client, and auth screens
  layouts/         RootLayout, ClientLayout, AdminLayout
  components/ui/   shared UI primitives
  store/           Redux store
  lib/             Axios and the query client
  config/          env.ts, paths
```

Feature folders in use include `auth`, `player`, `track`, `album`, `artist`, `playlist`, `genre`, `search`, `interaction`, `library`, `profile`, `user`, `dashboard`, `analytics`, `verification`, `mood-video`, `shorts`, `mashup`, `music-room`, `karaoke`, `ai`, `for-me`, and `track-topic`. The notifications folder is spelled `notifcation`.

Server data goes through TanStack Query. Playback, auth, and room state stay in Redux. `player` and `interaction.followedArtists` are persisted. `auth` and `room` are not.

The theme provider is `components/providers/theme-provider.tsx` (`storageKey="vite-ui-theme"`). The toaster mounted by the app provider imports `sonner` directly.

## Playback and realtime

The audio worker writes one AAC HLS playlist (10-second segments), not a multi-rendition ladder. This app plays that playlist with hls.js and rewrites storage URLs through `VITE_CDN_URL`.

The socket client sends `auth.token` and `query.userId`. Identity on the server is the access token. Chart pages join `live_chart_room` and listen for `chart_update`. The server emits that event every 10 seconds while the room has members. The chart payload itself is cached for 30 seconds on the API. This UI does not recompute the chart.

## API

With the local API:

- HTTP: `http://localhost:8000/api`
- Socket.IO: `http://localhost:8000`
- Liveness: `GET http://localhost:8000/api/health` returns `{ "status": "ok" }`
