import express from "express";
import os from "os";
import mongoose from "mongoose";
import { cacheRedis, queueRedis } from "../config/redis";
import authRoutes from "./auth.route";
import userRoutes from "./user.route";
import trackRoutes from "./track.route";
import albumRoutes from "./album.route";
import playlistRoutes from "./playlist.route";
import interactionRoutes from "./interaction.route";
import searchRoutes from "./search.route";
import genreRoutes from "./genre.route";
import artistRoutes from "./artist.route";
import dashboardRoutes from "./dashboard.route";
import verificationRoutes from "./verification.route";
import analyticRoutes from "./analytics.routes";
import notifyRoutes from "./notify.route";
import profileRoutes from "./profile.route";
import moodVideoRoutes from "./moodVideo.route";

const router = express.Router();

// Robust health check for platforms (reads MongoDB + Redis + memory)
router.get("/health", async (_req, res) => {
	const start = Date.now();

	const summary: Record<string, any> = {
		uptime: process.uptime(),
		time: new Date().toISOString(),
	};

	// Memory check (optional): set HEALTH_MAX_RSS_PCT (0-1) or HEALTH_MAX_RSS_BYTES
	try {
		const rss = process.memoryUsage().rss;
		summary.memory = { rss };
		const pctEnv = process.env.HEALTH_MAX_RSS_PCT;
		const bytesEnv = process.env.HEALTH_MAX_RSS_BYTES;
		if (pctEnv) {
			const pct = Math.max(0, Math.min(1, parseFloat(pctEnv)));
			const total = os.totalmem();
			summary.memory.total = total;
			summary.memory.ratio = rss / total;
			if (rss / total > pct) {
				return res.status(503).json({ ok: false, reason: "memory_exceeded", summary });
			}
		}
		if (bytesEnv) {
			const maxBytes = parseInt(bytesEnv, 10) || 0;
			if (maxBytes > 0) {
				summary.memory.maxBytes = maxBytes;
				if (rss > maxBytes) {
					return res.status(503).json({ ok: false, reason: "memory_exceeded", summary });
				}
			}
		}
	} catch (err) {
		// Non-fatal; continue
		summary.memoryError = String(err);
	}

	// Timeout helper
	const timeout = (ms: number) =>
		new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));

	// 1) MongoDB
	try {
		const state = mongoose.connection.readyState; // 1 = connected
		summary.mongo = { state };
		if (state !== 1) {
			// try a ping if not already connected
			await Promise.race([
				mongoose.connection.db?.admin().ping(),
				timeout(3000),
			]);
			summary.mongo.ping = "ok";
		}
	} catch (err: any) {
		summary.mongoError = err.message || String(err);
		return res.status(503).json({ ok: false, reason: "mongo_unreachable", summary });
	}

	// Redis ping helper (tries connect if not ready)
	const pingRedis = async (client: any, name: string) => {
		try {
			if (!client) throw new Error("no_client");
			if (client.status !== "ready") {
				// attempt connect but don't hang forever
				await Promise.race([client.connect(), timeout(3000)]);
			}
			const r = await Promise.race([client.ping(), timeout(2000)]);
			return r === "PONG" || r === "pong" ? { ok: true } : { ok: false, resp: r };
		} catch (err: any) {
			return { ok: false, error: err.message || String(err) };
		}
	};

	// 2) Cache Redis (UPSTASH)
	try {
		const cacheRes = await pingRedis(cacheRedis, "cache");
		summary.cache = cacheRes;
		if (!cacheRes.ok) {
			return res.status(503).json({ ok: false, reason: "cache_unreachable", summary });
		}
	} catch (err: any) {
		summary.cacheError = err.message || String(err);
		return res.status(503).json({ ok: false, reason: "cache_unreachable", summary });
	}

	// 3) Queue Redis (BullMQ)
	try {
		const queueRes = await pingRedis(queueRedis, "queue");
		summary.queue = queueRes;
		if (!queueRes.ok) {
			return res.status(503).json({ ok: false, reason: "queue_unreachable", summary });
		}
	} catch (err: any) {
		summary.queueError = err.message || String(err);
		return res.status(503).json({ ok: false, reason: "queue_unreachable", summary });
	}

	summary.elapsed = Date.now() - start;
	return res.status(200).json({ ok: true, summary });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/artists", artistRoutes);
router.use("/profile", profileRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/tracks", trackRoutes);
router.use("/albums", albumRoutes);
router.use("/playlists", playlistRoutes);
router.use("/interactions", interactionRoutes);
router.use("/search", searchRoutes);
router.use("/verification", verificationRoutes);
router.use("/analytics", analyticRoutes);
router.use("/notifications", notifyRoutes);
router.use("/genres", genreRoutes);
router.use("/mood-videos", moodVideoRoutes);

export default router;
