import { z } from "zod";
import { objectIdSchema } from "./common.validate";

export const generatePlaylistSchema = z.object({
  body: z.object({
    prompt: z.string().trim().min(1, "Prompt không hợp lệ").max(1000),
  }),
});

export const generateAutoMixSchema = z.object({
  body: z.object({
    recentTracks: z
      .array(
        z.object({
          _id: objectIdSchema,
          title: z.string().trim().max(300).optional(),
          artist: z
            .union([
              z.string().trim().max(200),
              z.object({
                name: z.string().trim().max(200).optional(),
              }),
            ])
            .nullable()
            .optional(),
          aiMetadata: z
            .object({
              moods: z.array(z.string().trim().max(50)).max(20).optional(),
            })
            .nullable()
            .optional(),
        }),
      )
      .max(10),
  }),
});

export const analyzeTrackSchema = z.object({
  body: z.object({
    trackId: objectIdSchema,
  }),
});
