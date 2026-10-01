import mongoose from "mongoose";
import { cacheRedis, queueRedis } from "../config/redis";

export const ROUTES_MOUNTED_KEY = "apiRoutesMounted";

const PROBE_TIMEOUT_MS = 1_000;

export type DepState = "up" | "down";

export type ReadinessBody = {
  status: "ready" | "not_ready";
  checks: {
    mongo: DepState;
    cacheRedis: DepState;
    queueRedis: DepState;
    routes: DepState;
  };
};

type RedisProbe = {
  status: string;
  ping: () => Promise<string>;
};

export function toReadinessBody(input: {
  routesMounted: boolean;
  mongo: boolean;
  cacheRedis: boolean;
  queueRedis: boolean;
}): { httpStatus: 200 | 503; body: ReadinessBody } {
  const checks: ReadinessBody["checks"] = {
    mongo: input.mongo ? "up" : "down",
    cacheRedis: input.cacheRedis ? "up" : "down",
    queueRedis: input.queueRedis ? "up" : "down",
    routes: input.routesMounted ? "up" : "down",
  };
  const ready =
    input.routesMounted &&
    input.mongo &&
    input.cacheRedis &&
    input.queueRedis;

  return {
    httpStatus: ready ? 200 : 503,
    body: { status: ready ? "ready" : "not_ready", checks },
  };
}

async function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function probeRedis(
  client: RedisProbe,
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<boolean> {
  // Do not call ping() unless a connection already exists. A ping on a
  // lazy client would open one from the readiness probe.
  if (client.status !== "ready") return false;
  try {
    const result = await withTimeout(client.ping(), timeoutMs);
    return result === "PONG";
  } catch {
    return false;
  }
}

export async function probeMongo(timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  const db = mongoose.connection.db;
  if (mongoose.connection.readyState !== 1 || !db) return false;
  try {
    await withTimeout(db.admin().command({ ping: 1 }), timeoutMs);
    return true;
  } catch {
    return false;
  }
}

export async function collectReadiness(routesMounted: boolean) {
  const [mongo, cache, queue] = await Promise.all([
    probeMongo(),
    probeRedis(cacheRedis),
    probeRedis(queueRedis),
  ]);
  return toReadinessBody({
    routesMounted,
    mongo,
    cacheRedis: cache,
    queueRedis: queue,
  });
}
