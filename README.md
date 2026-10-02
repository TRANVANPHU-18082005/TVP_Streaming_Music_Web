# TVP Music

TVP Music is a music streaming app: HLS playback, playlists, charts, an admin catalog, music rooms, karaoke, shorts, and mashups.

This repository is a **modular monolith**. One React app and one Express API live in the same git repo. A second Node process transcodes audio. MongoDB stores metadata. Two Redis connections split cache from queues. There is no microservices deployment in this repo, and there is no `docker-compose` file.

User-facing API messages and most UI copy are Vietnamese.

## Architecture

| Process | What starts it | What it runs |
|---|---|---|
| API | `npm run dev` or `npm start` in `backend/` | HTTP, Socket.IO, cron, notification worker, interaction worker, view worker |
| Audio worker | `npm run dev:worker` or `npm run start:worker` in `backend/` | `src/workers/processTrack.worker.ts` only |
| Frontend | `npm run dev` in `frontend/` | Vite dev server |

The API listens on port **8000** unless `PORT` is set. The frontend dev server uses Vite’s default port **5173** (`frontend/vite.config.ts` does not set `server.port`).

Fly.io, as checked in, runs the API container only (`node dist/index.js`). `backend/fly.toml` does not define a worker process.

Notification delivery, interaction tasks, and play-history writes run **inside the API process**. They are not separate deployments. `workers/mashup.worker.ts` is a placeholder and is not started. `addProcessMashupJob` refuses to enqueue `mashup-processing`. `scheduleExternalHealthJob()` is not called from startup. `system.route.ts` is not mounted; the 03:00 cron calls `systemService` directly.

## Stack

| Area | What the repo uses |
|---|---|
| Frontend | React 18, Vite, TypeScript, React Router 7, Tailwind 4, Radix, Redux Toolkit, TanStack Query, react-hook-form, Zod, hls.js, Socket.IO client |
| Backend | Node.js `>=22`, Express 5, TypeScript, Mongoose, ioredis, BullMQ, Socket.IO, Passport, Zod |
| Data | MongoDB (`MONGO_URI`) |
| Cache Redis | `UPSTASH_REDIS_URL`, else `REDIS_URL`, else `redis://localhost:6379` |
| Queue Redis | `QUEUE_REDIS_URL`, else `redis://localhost:6380` |
| Audio | `ffmpeg-static` and `ffprobe-static` inside the worker. One AAC HLS playlist, 10-second segments |
| Storage | Backblaze B2 for audio, Cloudinary for images |
| CDN | Frontend reads `VITE_CDN_URL`. Backend config reads `CDN_DOMAIN` |

## 1. Prerequisites

- Node.js `>=22` (backend `engines` and `backend/Dockerfile` use Node 22)
- MongoDB reachable through `MONGO_URI`
- Two Redis endpoints, or two local Redis servers on ports `6379` (cache) and `6380` (queue)
- npm

Install dependencies inside `frontend/` and `backend/`. There is no root `package.json`.

The audio worker launches FFmpeg from the `ffmpeg-static` package. A system FFmpeg binary on `PATH` is not what that process uses.

## 2. Repository structure

```text
frontend/     React app. Run npm scripts here.
backend/      Express API and the audio worker. Run npm scripts here.
AGENTS.md     Notes for coding agents. Describes the code as it is.
```

```text
frontend/src/
  app/            router, providers
  features/       feature modules
  pages/          route-level screens
  layouts/
  components/ui/
  store/          Redux
  lib/            Axios, query client
  config/         env, paths

backend/src/
  routes/ controllers/ services/ models/
  validations/ middlewares/
  queue/ workers/ cron/
  config/ utils/
```

## 3. Frontend setup

```bash
cd frontend
npm install
```

Create `frontend/.env.development` (Vite loads it for `npm run dev`):

```env
VITE_API_URL=http://localhost:8000/api
VITE_SOCKET_URL=http://localhost:8000
VITE_APP_NAME=TVP Music
VITE_CDN_URL=
```

`VITE_API_URL` must include `/api`. The app does not read `VITE_CDN_DOMAIN`.

```bash
npm run dev
```

Open `http://localhost:5173`.

## 4. Backend setup

```bash
cd backend
npm install
```

Create `backend/.env.development`. Outside production, `config/env.ts` loads `.env.${NODE_ENV}` first, then `.env`. dotenv does not override keys that are already set, so values in `.env.development` win over `.env` when `NODE_ENV=development`.

`npm run dev` sets `NODE_ENV=development`.

Copy the variable names from `backend/.env.example` and from section 5. Do not commit `.env`, `.env.development`, or `.env.production`.

```bash
npm run dev
```

The API logs that it is online on port `8000` (or `PORT`). It listens first, then connects Redis and Mongo, then mounts routes at `/api`.

## 5. Environment configuration

### Production boot

When `NODE_ENV=production`, startup exits if any of these are missing:

- `MONGO_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `QUEUE_REDIS_URL`
- `UPSTASH_REDIS_URL` or `REDIS_URL`

### Backend variables read by `config/env.ts`

| Variable | Role |
|---|---|
| `PORT` | API port. Default `8000` |
| `NODE_ENV` | `development` or `production` |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Access token (15 minutes, `{ id, role }`) |
| `JWT_REFRESH_SECRET` | Refresh token cookie `refreshToken` (7 days, or 30 with remember-me) |
| `CLIENT_URL` | Frontend origin. Default `http://localhost:5173` |
| `ALLOW_ORIGINS` | Extra CORS origins, comma-separated |
| `UPSTASH_REDIS_URL` | Cache Redis. Falls back to `REDIS_URL` |
| `REDIS_URL` | Cache Redis when `UPSTASH_REDIS_URL` is empty |
| `QUEUE_REDIS_URL` | Queue Redis for BullMQ |
| `UPSTASH_DB_ID`, `UPSTASH_API_KEY` | Read for an external health helper that startup does not schedule |
| `B2_ENDPOINT`, `B2_REGION`, `B2_KEY_ID`, `B2_APP_KEY`, `B2_BUCKET_NAME`, `B2_BUCKET_ID` | Backblaze B2 |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary. The app does not read `CLOUDINARY_URL` |
| `CDN_DOMAIN` | Backend CDN base (`config.cdnDomain`). Used when building stored playback URLs |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Google login. Both id and secret must be set or Google stays disabled and the API still listens |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_CALLBACK_URL` | Facebook login. Optional |
| `EMAIL_USER`, `EMAIL_PASS` | Nodemailer |
| `GEMINI_API_KEY` | Gemini metadata. A `full` transcode job still finishes if AI fails |
| `WORKER_CONCURRENCY` | Audio worker concurrency. Default `5` |
| `LOG_LEVEL`, `LOG_TO_FILE` | Winston |

Also read, but not through the `config` object:

| Variable | Where |
|---|---|
| `REDIS_TLS_CA` | Optional PEM for `rediss://` URLs (`config/redisTls.ts`). Leave unset for public CAs |
| `CLOUDFLARE_DOMAIN` | `controllers/karaoke.controller.ts` only. `backend/.env.example` lists this name and does not list `CDN_DOMAIN` |
| `ALIGNER_SCRIPT` | Lyric aligner script path. Not required for API startup |

### Frontend variables the app reads

| Variable | Role |
|---|---|
| `VITE_API_URL` | Axios base URL, including `/api`. Fallback `https://tvp-backend.fly.dev/api` |
| `VITE_SOCKET_URL` | Socket.IO URL, without `/api`. Fallback `https://tvp-backend.fly.dev` |
| `VITE_APP_NAME` | App name. Fallback `Music App` |
| `VITE_CDN_URL` | CDN origin for playback URLs. Mapped to the field `CDN_DOMAIN` in `frontend/src/config/env.ts`. Fallback `https://cdn.tvpmusic.site` |

`frontend/.env.example` also contains `VITE_NODE_ENV`. Application code does not read it.

## 6. MongoDB

Set `MONGO_URI` to a MongoDB server the API can reach (local or Atlas). Mongoose connects from `config/db.ts` after the HTTP server is listening. There is no database service defined in this repo.

Models live in `backend/src/models/`. There is no migration framework. Optional data scripts, from `backend/`:

```bash
npm run seed
npm run seed:genre
npm run migrate:identities
npm run migrate:room-passwords
npm run migrate:playlog-ttl
```

## 7. Redis

Cache and queues are different clients in `backend/src/config/redis.ts`.

| Client | Environment | Local fallback |
|---|---|---|
| `cacheRedis` | `UPSTASH_REDIS_URL`, then `REDIS_URL` | `redis://localhost:6379` |
| `queueRedis` | `QUEUE_REDIS_URL` | `redis://localhost:6380` |

BullMQ requires `maxRetriesPerRequest: null` on `queueRedis`. That is already set. Do not point both clients at one URL unless you intend to share that Redis.

`rediss://` URLs enable TLS. `REDIS_TLS_CA` is optional.

Cache keys already in use include `views:`, `limit:play:`, `room:sessions:`, `lock:viewSync`, `social_auth:`, and `chart:live:top100`.

## 8. Worker

Start the API and the audio worker in two terminals, both from `backend/`:

```bash
npm run dev
```

```bash
npm run dev:worker
```

`dev:worker` runs `src/workers/processTrack.worker.ts` with `NODE_ENV=development`. It consumes the BullMQ queue `audio-transcoding`.

Upload flow:

1. The API stores the original file on B2 and enqueues a `transcode` job.
2. The worker downloads it, reads metadata, and writes **one** AAC HLS playlist (`index.m3u8`) plus `.ts` segments of about 10 seconds (`-hls_time 10`, `-hls_list_size 0`). Bitrate is the source bitrate capped at 320 kbps.
3. The worker uploads that playlist to B2 and sets the track `hlsUrl` and `status` to `ready` or `failed`.

This is not a multi-rendition adaptive-bitrate encode. The player uses hls.js on that single playlist.

A `full` job still marks the track ready if the lyrics step or the AI step fails. The worker runs steps for `full`, `transcode_only`, `lyric_only`, `mood_only`, `ai_only`, and `custom` tasks named `transcode`, `lyrics`, `mood`, and `ai`. `karaoke_only` is declared on the job type and has no separate branch in the worker.

These workers are **not** started by `dev:worker`:

| Code | How it actually runs |
|---|---|
| `workers/notify.worker.ts` | Inside the API process, after Socket.IO starts. Queue `notification-delivery` |
| `workers/interaction.worker.ts` | Inside the API process. Queue `interaction-tasks` |
| `workers/view.worker.ts` | Inside the API process. Queue `view-updates` |
| `workers/mashup.worker.ts` | Not imported. Enqueue is refused |
| `queue/systemHealth.queue.ts` | Not started from `index.ts`. Queue name `system-health` |

Cron, also inside the API process:

| Schedule | Job |
|---|---|
| `*/5 * * * *` | Flush Redis `views:*` into Mongo `playCount` |
| `0 3 * * *` in `Asia/Ho_Chi_Minh` | `systemService.syncAll()` |
| `*/15 * * * *` | Close inactive music rooms |

## 9. Development commands

From `backend/`:

```bash
npm run dev
npm run dev:worker
npm run type-check
npm run test
npm run build
npm run start
npm run start:worker
```

From `frontend/`:

```bash
npm run dev
npm run type-check
npm run lint
npm run test
npm run build
npm run preview
```

`GET /api/health` returns `200` and `{ "status": "ok" }` without checking Mongo or Redis. `GET /api/ready` reports MongoDB, cache Redis, queue Redis, and whether routes have mounted (`ready` or `not_ready`).

## 10. Testing

From `backend/`, `npm test` runs Node’s built-in test runner on the files listed in the `test` script in `backend/package.json`. `npm run type-check` is TypeScript only (`tsc --noEmit` and `tsc --noEmit -p tsconfig.test.json`). It does not run those tests.

From `frontend/`, `npm test` runs Vitest (`vitest run`) with `src/test/setup.ts`. `npm run test:watch` and `npm run test:coverage` are the other Vitest scripts.

## 11. Build

```bash
cd backend
npm run build
npm start
```

`npm run build` is `tsc`. `npm start` runs `node dist/index.js` with `NODE_ENV=production`. The audio worker build output is `dist/workers/processTrack.worker.js`:

```bash
npm run start:worker
```

```bash
cd frontend
npm run build
npm run preview
```

`npm run build` is `tsc --noEmit` and `vite build`. `npm run preview` serves the `dist` build (Vite’s default preview port is 4173; this repo does not override it).

## 12. Deployment

Checked-in deployment is the API on Fly.io:

- App name `tvp-backend` in `backend/fly.toml`
- Primary region `sin`
- HTTP service `internal_port = 8000`, process `app`
- Health check `GET /api/health` every 15 seconds
- Image: `backend/Dockerfile`, `node:22-bookworm-slim`, `EXPOSE 8000`, command `node dist/index.js`

That container command does not start `processTrack.worker.ts`. Run the worker as its own process with `npm run start:worker` where you host it. This repo does not define that process in `fly.toml`.

Production reads `.env.production` without overriding variables the host already set. Set the production boot variables from section 5 on the host. Do not commit those files.

## 13. Common troubleshooting

| Symptom | What to check |
|---|---|
| `npm install` or `npm run dev` fails at the repo root | Run the command in `frontend/` or `backend/` |
| Frontend calls port 5000 or `/api/v1` | API port is `8000`. `VITE_API_URL` should be `http://localhost:8000/api` |
| API exits on boot in production | `MONGO_URI`, both JWT secrets, `QUEUE_REDIS_URL`, and `UPSTASH_REDIS_URL` or `REDIS_URL` |
| Cache connects and queues do not | They are different URLs. Local fallbacks are `6379` and `6380` |
| Uploaded tracks stay `processing` | The audio worker is a second terminal: `npm run dev:worker` |
| Playback host is wrong | Frontend CDN variable is `VITE_CDN_URL`. Backend stored URLs use `CDN_DOMAIN`. Karaoke URLs in that controller use `CLOUDFLARE_DOMAIN` |
| Google login is missing | Set both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Missing values disable Google only |
| Fly restarts the machine | The platform polls `/api/health`, which must stay a cheap `200`. Dependency checks belong on `/api/ready` |

## Charts

The live Top 100 is `getRealtimeChart` in `backend/src/services/chart.service.ts`.

- It aggregates `PlayLog` rows from the last 24 hours.
- One listener counts once per track per hour (`userId`, or `ip` if there is no user), in timezone `+07:00`.
- The payload is stored at Redis key `chart:live:top100` for **30 seconds**.
- If fewer than 100 tracks qualify, the list is filled from lifetime `playCount`.
- The same payload includes a 24-hour series for the current top 3.
- Socket.IO emits `chart_update` every **10 seconds** to room `live_chart_room`, and only when someone has joined that room. The handler calls `getRealtimeChart`, so a warm cache is reused inside the 30-second TTL.

There is no job that recomputes the Top 100 every minute. `getTopSevenTracks` uses a separate cache, `top7:{period}`, for 300 seconds. Day, week, and month rank from `PlayLog` over 1, 7, and 30 days.

## Audio

`services/audio/transcoder.service.ts` writes one rendition:

- codec `aac`, sample rate `44100`, stereo
- bitrate `min(source, 320)` kbps, or 320 kbps when the source bitrate is missing
- container HLS, segment duration 10 seconds, full playlist (`hls_list_size 0`)

The worker then uploads the `.m3u8` and `.ts` files to B2.
