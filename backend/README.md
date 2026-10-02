# TVP Music backend

Express 5 API for TVP Music, plus one separately started audio worker. This package is a modular monolith process model: one API process and `src/workers/processTrack.worker.ts`. It is not a set of deployed microservices.

Node.js `>=22`. Default listen port is **8000**.

## Process model

| Process | Script | Entry |
|---|---|---|
| API | `npm run dev`, `npm start` | `src/index.ts` → `dist/index.js` |
| Audio worker | `npm run dev:worker`, `npm run start:worker` | `src/workers/processTrack.worker.ts` |

`src/index.ts` listens on `0.0.0.0` first, then connects cache Redis, queue Redis, and MongoDB, then mounts `src/routes/index.ts` at `/api`. If that startup fails, the process exits so the platform can restart it.

After routes mount, the same process starts:

- Socket.IO on the HTTP server
- the notification worker (`notification-delivery`), after `initSocket`
- cron
- the interaction worker (`interaction-tasks`)
- the view worker (`view-updates`)

`processTrack.worker.ts` is not imported by the API. `workers/mashup.worker.ts` is not imported, and `addProcessMashupJob` throws instead of enqueueing `mashup-processing`. `scheduleExternalHealthJob()` is never called from startup, so the `system-health` queue is not running. `routes/system.route.ts` is not mounted; the 03:00 cron calls `systemService` directly.

## Stack

- Express 5, TypeScript (CommonJS)
- MongoDB via Mongoose (`MONGO_URI`)
- ioredis: `cacheRedis` and `queueRedis`
- BullMQ on `queueRedis`
- Socket.IO
- Passport (Google and Facebook are optional)
- Zod validation
- Backblaze B2 (S3-compatible) for audio, Cloudinary for images
- `ffmpeg-static` / `ffprobe-static` / `fluent-ffmpeg` in the audio worker

## MongoDB

`config/db.ts` connects with `config.mongoUri`. Production boot refuses to start without `MONGO_URI`. Development still needs a reachable database or route handlers that touch Mongo will fail after listen.

Models are one file each under `src/models/`. There is no migration framework.

User roles: `user`, `artist`, `admin`. Track `status`: `pending`, `processing`, `ready`, `failed`.

`PlayLog.listenedAt` expires after 2592000 seconds (30 days). An existing database needs `npm run migrate:playlog-ttl` before that TTL replaces the old 8-day index. Lifetime `track.playCount` is incremented by the 5-minute view cron from Redis `views:track:*`, not by summing `PlayLog`.

## Redis

`src/config/redis.ts`:

| Client | Selection order | Used for |
|---|---|---|
| `cacheRedis` | `UPSTASH_REDIS_URL`, then `REDIS_URL`, then `redis://localhost:6379` | Cache, view counters, sessions, chart cache, rate limits that use Redis |
| `queueRedis` | `QUEUE_REDIS_URL`, then `redis://localhost:6380` | BullMQ. `maxRetriesPerRequest` is `null` |

`rediss://` turns on TLS (`rejectUnauthorized: true`). `REDIS_TLS_CA` is an optional PEM when the provider CA is not in Node’s trust store.

Production (`missingProductionEnv` in `config/env.ts`) requires `QUEUE_REDIS_URL` and either `UPSTASH_REDIS_URL` or `REDIS_URL`, in addition to `MONGO_URI`, `JWT_SECRET`, and `JWT_REFRESH_SECRET`.

## Socket.IO

`initSocket` attaches to the API HTTP server. Clients send the access JWT on `handshake.auth.token`. The server verifies it with `JWT_SECRET` and loads the user. `handshake.query.userId` is not an authority. Guests are `guest_{socketId}`.

Music-room membership stays on this one API process. There is no Socket.IO Redis adapter, so a second machine does not share `music_room:*` rooms. The 5-second playback advance also runs in this process.

Intervals inside that process:

| Interval | Event | Condition |
|---|---|---|
| 5 seconds | `admin_analytics_update` | `admin_room` has members |
| 10 seconds | `chart_update` | `live_chart_room` has members |
| 30 seconds | `room:heartbeat` | active `music_room:*` rooms |
| 5 seconds | room playback advance | active rooms whose `endsAt` has passed |

`join_admin_dashboard` joins `admin_room` only when the database role is `admin`.

## Charts

`services/chart.service.ts` `getRealtimeChart`:

- Aggregates `PlayLog` from the last 24 hours.
- Counts a listener once per track per hour (`userId`, otherwise `ip`) with timezone `+07:00`.
- Keeps up to 100 public, ready, non-deleted tracks. A short list is filled from lifetime `playCount`.
- Adds a 24-hour series for the current top 3.
- Stores the payload in cache Redis at `chart:live:top100` for **30 seconds**.

The 10-second socket push calls this function, so it reuses the cache inside that TTL. Nothing recomputes the Top 100 on a one-minute timer.

`getTopSevenTracks` caches `top7:day`, `top7:week`, and `top7:month` for **300 seconds**. Day, week, and month rank from `PlayLog` over 1, 7, and 30 days. A list shorter than 7 is filled from lifetime `playCount`.

HTTP: `GET /api/tracks/charts/realtime`.

## Audio and HLS

`services/audio/transcoder.service.ts` `transcodeToHLS` writes **one** rendition:

- `-vn -c:a aac -ar 44100 -ac 2`
- bitrate `min(source bitrate, 320)` kbps, or 320 kbps when the source bitrate is 0
- `-f hls -hls_time 10 -hls_list_size 0 -hls_flags independent_segments`
- output playlist path `index.m3u8` plus `.ts` segments
- transcode timeout 30 minutes

There is no second rendition and no master playlist of variants.

`workers/processTrack.worker.ts` consumes queue `audio-transcoding`, job name `transcode`. For a transcode it downloads the B2 original, reads metadata, runs `transcodeToHLS`, uploads the `.m3u8` and `.ts` files back to B2, and sets `hlsUrl` plus `status`. A `full` job continues to `ready` if lyrics or AI throw. Lyrics-only and AI-only jobs rethrow those errors.

The worker enables transcode, lyrics, mood, and AI for `full`, and for `transcode_only`, `lyric_only`, `mood_only`, `ai_only`, or `custom` tasks `transcode`, `lyrics`, `mood`, and `ai`. `karaoke_only` is part of `TrackProcessingType` and is not a separate branch in `processTrack.worker.ts` (the file notes karaoke as part of the lyric fallback).

FFmpeg and ffprobe come from `ffmpeg-static` and `ffprobe-static`. The worker throws at startup if those binaries are missing.

## Workers and cron that are not the audio worker

Started inside the API process:

| Piece | Queue or schedule |
|---|---|
| `startNotificationWorker` | `notification-delivery` |
| interaction worker | `interaction-tasks` |
| view worker | `view-updates` (writes `PlayLog`; does not set lifetime `track.playCount`) |
| `cron/sync-views.ts` | `*/5 * * * *`, lock `lock:viewSync` |
| `cron/maintenance.ts` | `0 3 * * *`, timezone `Asia/Ho_Chi_Minh` |
| `cron/cleanupRooms.ts` | `*/15 * * * *` |

Present in the tree and not started by the API:

| Piece | State |
|---|---|
| `workers/mashup.worker.ts` | Placeholder. `addProcessMashupJob` refuses to enqueue |
| `queue/systemHealth.queue.ts` | Worker object exists in the module. Nothing in `index.ts` imports it. `scheduleExternalHealthJob` is not called |

## HTTP

Mounted prefixes in `src/routes/index.ts` (all under `/api`):

`/auth`, `/users`, `/artists`, `/profile`, `/dashboard`, `/tracks`, `/albums`, `/playlists`, `/interactions`, `/search`, `/verification`, `/analytics`, `/notifications`, `/genres`, `/mood-videos`, `/ai`, `/shorts`, `/mashups`, `/rooms`, `/karaoke`.

`GET /api/health` is registered in `app.ts` before the limiter and always returns `200` `{ "status": "ok" }`. Fly.io polls that path.

`GET /api/ready` checks MongoDB, `cacheRedis`, `queueRedis`, and whether routes have mounted. The body is `{ status: "ready" | "not_ready", checks: { mongo, cacheRedis, queueRedis, routes } }` with HTTP 200 or 503.

Catalog controllers return `{ success, message, data }`. Several mashup handlers return `{ success, data }`.

## Authentication

- Access JWT: `JWT_SECRET`, 15 minutes, payload `{ id, role }`.
- Refresh JWT: `JWT_REFRESH_SECRET`, httpOnly cookie `refreshToken`, 7 days or 30 days with remember-me. Production cookie is `secure` and `SameSite=None`. Development is `SameSite=Lax`.
- Google strategy registers only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set. Otherwise Google login is off and listen still proceeds.
- Facebook uses `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, and `FACEBOOK_CALLBACK_URL` when those are set.
- OAuth callbacks store a one-time code in cache Redis (`social_auth:{code}`, 60 seconds) and redirect to the frontend. The access token is not placed in the redirect URL.

## Environment

Outside production, `config/env.ts` loads `.env.${NODE_ENV}` and then `.env`. dotenv does not override existing keys, so `.env.development` wins when `npm run dev` sets `NODE_ENV=development`. Production loads `.env.production` the same way; variables already set by the host stay.

`config` fields and the environment names they read:

| Name | Notes |
|---|---|
| `PORT` | Default `8000` |
| `MONGO_URI` | Required in production |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Required in production |
| `CLIENT_URL` | Default `http://localhost:5173`. Comma-separated lists pick a local URL in development and a non-local URL in production |
| `ALLOW_ORIGINS` | CORS. Development default is `*` when this and `CLIENT_URL` are empty |
| `UPSTASH_REDIS_URL`, `REDIS_URL` | Cache Redis. One of them is required in production |
| `QUEUE_REDIS_URL` | Queue Redis. Required in production |
| `UPSTASH_DB_ID`, `UPSTASH_API_KEY` | Only the unwired external health helper |
| `B2_ENDPOINT`, `B2_REGION`, `B2_KEY_ID`, `B2_APP_KEY`, `B2_BUCKET_NAME`, `B2_BUCKET_ID` | B2. The S3 client uses region `us-west-004` when `B2_REGION` is empty. The worker requires `B2_BUCKET_NAME` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Images. Not `CLOUDINARY_URL` |
| `CDN_DOMAIN` | `config.cdnDomain`, used by `utils/url.utils.ts` `buildBaseUrl` / `toCdnUrl` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Google. Callback default `/api/auth/google/callback` |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_CALLBACK_URL` | Facebook. Callback default `/api/auth/facebook/callback` |
| `EMAIL_USER`, `EMAIL_PASS` | Mail |
| `GEMINI_API_KEY` | Gemini |
| `WORKER_CONCURRENCY` | Default `5` |
| `LOG_LEVEL`, `LOG_TO_FILE` | Logs under `logs/` when file logging is on |
| `NODE_ENV` | Set by the npm scripts |

Read elsewhere:

| Name | Where |
|---|---|
| `REDIS_TLS_CA` | `config/redisTls.ts` |
| `CLOUDFLARE_DOMAIN` | `controllers/karaoke.controller.ts` only. Listed in `.env.example`. `CDN_DOMAIN` is not listed there |
| `ALIGNER_SCRIPT` | `services/lyrics/aligner.service.ts` |

The frontend CDN variable is `VITE_CDN_URL` in `frontend/src/config/env.ts`. This package does not read `VITE_*` variables.

Do not commit `.env`, `.env.development`, or `.env.production`. Backend `.gitignore` ignores all three.

## Scripts

From `backend/`:

```bash
npm run dev                      # nodemon src/index.ts, NODE_ENV=development
npm run build                    # tsc
npm start                        # node dist/index.js, NODE_ENV=production
npm run dev:worker               # ts-node src/workers/processTrack.worker.ts
npm run start:worker             # node dist/workers/processTrack.worker.js
npm run type-check               # tsc --noEmit && tsc --noEmit -p tsconfig.test.json
npm run test                     # node:test on the files in package.json "test"
npm run seed
npm run seed:genre
npm run migrate:identities
npm run migrate:room-passwords
npm run migrate:playlog-ttl          # collMod PlayLog TTL to 30 days
```

There is no `worker:dev` script. The audio worker script is `dev:worker`.

Local API:

```text
http://localhost:8000/api/health
http://localhost:8000/api/ready
```

## Testing

`npm test` uses Node’s built-in test runner (`node --test`) with `ts-node/register`. The file list is the `test` script in `package.json` (socket identity and rooms, health, mashup queue refusal, auth, Redis, env boot, and others). `npm run type-check` compiles `tsconfig.json` and `tsconfig.test.json`. It does not execute tests.

## Deployment

`Dockerfile`:

- build stage and runtime stage both use `node:22-bookworm-slim`
- runtime `EXPOSE 8000`
- command `node dist/index.js`

`fly.toml`:

- app `tvp-backend`, primary region `sin`
- `internal_port = 8000`, `processes = ['app']`
- health check `GET /api/health`, interval 15s, timeout 5s, grace period 60s
- one shared CPU, 512 MB

That Fly service is the API process. It does not start `processTrack.worker.ts`. Host the worker separately with `npm run start:worker` if uploads must finish. This repo has no Compose file and no second Fly process for the worker.

## Local run

```bash
cd backend
npm install
npm run dev
```

In another terminal:

```bash
cd backend
npm run dev:worker
```

Point the frontend `VITE_API_URL` at `http://localhost:8000/api` and `VITE_SOCKET_URL` at `http://localhost:8000`.
