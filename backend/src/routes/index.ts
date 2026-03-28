import express from "express";
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

const router = express.Router();

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

export default router;
