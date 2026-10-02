import { z } from "zod";
import { objectIdSchema } from "./common.validate";

const transitionTypeSchema = z.enum([
  "crossfade",
  "cut",
  "beatmatch",
  "echo-out",
  "filter-sweep",
  "stutter",
  "build-drop",
  "vinyl-scratch",
]);

const mashupShortSchema = z.object({
  short: objectIdSchema,
  order: z.number().int().min(0),
  transitionType: transitionTypeSchema.optional(),
  transitionDuration: z.number().min(0).max(30000).optional(),
  trimStart: z.number().min(0).optional(),
  trimEnd: z.number().min(0).optional(),
  volume: z.number().min(0).max(1).optional(),
});

const mashupBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  coverImage: z.string().trim().max(2000).optional(),
  isPublished: z.boolean().optional(),
  energyCurve: z.enum(["build-up", "chill", "peak", "wave", "custom"]).optional(),
  shorts: z.array(mashupShortSchema).min(1).max(40),
});

export const mashupIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const createMashupSchema = z.object({
  body: mashupBodySchema,
});

export const updateMashupSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: mashupBodySchema.partial().refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required",
  }),
});

export const suggestShortsSchema = z.object({
  body: z.object({
    currentShortIds: z.array(objectIdSchema).max(100),
  }),
});

export const aiGenerateMashupSchema = z.object({
  body: z.object({
    prompt: z.string().trim().min(1).max(1000),
  }),
});
