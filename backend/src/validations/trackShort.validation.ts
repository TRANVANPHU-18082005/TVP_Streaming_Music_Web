import { z } from "zod";
import { objectIdSchema } from "./common.validate";

const shortFields = {
  track: objectIdSchema,
  moodVideo: objectIdSchema,
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  title: z.string().trim().max(200).optional(),
  caption: z.string().trim().max(500).optional(),
  isPublished: z.boolean().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  suggestedByAi: z.boolean().optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
};

function durationIsValid(body: { startTime?: number; endTime?: number }): boolean {
  if (body.startTime === undefined || body.endTime === undefined) return true;
  const duration = body.endTime - body.startTime;
  return body.startTime < body.endTime && duration >= 10 && duration <= 60;
}

export const shortIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const createShortSchema = z.object({
  body: z.object(shortFields).refine(durationIsValid, {
    message: "Short duration must be between 10 and 60 seconds",
    path: ["endTime"],
  }),
});

export const updateShortSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z
    .object({
      track: shortFields.track.optional(),
      moodVideo: shortFields.moodVideo.optional(),
      startTime: shortFields.startTime.optional(),
      endTime: shortFields.endTime.optional(),
      title: shortFields.title,
      caption: shortFields.caption,
      isPublished: shortFields.isPublished,
      priority: shortFields.priority,
      suggestedByAi: shortFields.suggestedByAi,
      aiConfidence: shortFields.aiConfidence,
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: "At least one field is required",
    })
    .refine(durationIsValid, {
      message: "Short duration must be between 10 and 60 seconds",
      path: ["endTime"],
    }),
});
