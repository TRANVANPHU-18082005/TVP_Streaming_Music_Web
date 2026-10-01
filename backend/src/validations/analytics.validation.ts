import { z } from "zod";
import { optionalObjectIdSchema } from "./common.validate";

export const heartbeatSchema = z.object({
  body: z.object({
    trackId: optionalObjectIdSchema,
  }),
});
