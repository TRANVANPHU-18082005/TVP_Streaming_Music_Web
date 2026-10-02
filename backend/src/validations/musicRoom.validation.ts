import { z } from "zod";
import { objectIdSchema } from "./common.validate";

const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{6}$/, "Mã phòng không hợp lệ");

export const createRoomSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, "Tên phòng là bắt buộc").max(60),
    description: z.string().trim().max(300).optional(),
    theme: z.enum(["bar", "lounge", "festival", "chill", "hype"]).optional(),
    isPublic: z.boolean().optional(),
    maxMembers: z.number().int().min(2).max(100).optional(),
    password: z.string().min(1).max(128).optional(),
    queueMode: z.enum(["open", "approval"]).optional(),
    trackId: objectIdSchema.optional(),
    playlistId: objectIdSchema.optional(),
  }),
});

export const roomCodeParamSchema = z.object({
  params: z.object({
    roomCode: roomCodeSchema,
  }),
});

export const addToQueueSchema = z.object({
  params: z.object({
    roomCode: roomCodeSchema,
  }),
  body: z.object({
    trackId: objectIdSchema,
  }),
});

export const roomTrackParamSchema = z.object({
  params: z.object({
    roomCode: roomCodeSchema,
    trackId: objectIdSchema,
  }),
});

export const addCollectionSchema = z.object({
  params: z.object({
    roomCode: roomCodeSchema,
  }),
  body: z
    .object({
      trackIds: z.array(objectIdSchema).max(30).optional(),
      playlistId: objectIdSchema.optional(),
      albumId: objectIdSchema.optional(),
    })
    .refine((body) => Boolean(body.trackIds?.length || body.playlistId || body.albumId), {
      message: "Cần danh sách bài, playlist hoặc album",
    }),
});

export const updateRoomSettingsSchema = z.object({
  params: z.object({
    roomCode: roomCodeSchema,
  }),
  body: z.object({
    queueMode: z.enum(["open", "approval"]),
  }),
});

export const setCoHostSchema = z.object({
  params: z.object({
    roomCode: roomCodeSchema,
  }),
  body: z.object({
    userId: objectIdSchema,
    enabled: z.boolean(),
  }),
});

export const assignHostSchema = z.object({
  params: z.object({
    roomCode: roomCodeSchema,
  }),
  body: z.object({
    userId: objectIdSchema,
  }),
});

export const kickRoomMemberSchema = z.object({
  params: z.object({
    roomCode: roomCodeSchema,
    userId: objectIdSchema,
  }),
});
