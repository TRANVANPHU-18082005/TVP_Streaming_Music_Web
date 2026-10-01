import { z } from "zod";

const rankedTrackSchema = z.object({
  _id: z.string(),
  title: z.string(),
  coverImage: z.string(),
  artist: z
    .object({
      _id: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  score: z.number(),
});

export const realtimeStatsSchema = z.object({
  activeUsers: z.number(),
  activeGuests: z.number(),
  listeningNow: z.number(),
  playsThisHour: z.number(),
  nowListening: z.array(rankedTrackSchema),
  trending: z.array(rankedTrackSchema),
  geoData: z.array(
    z.object({
      id: z.string(),
      value: z.number(),
      name: z.string().optional(),
    }),
  ),
  snapshotAt: z.string(),
});

export type RealtimeStatsSchema = z.infer<typeof realtimeStatsSchema>;
