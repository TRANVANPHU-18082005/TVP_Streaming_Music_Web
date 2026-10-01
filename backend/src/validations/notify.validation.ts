import { z } from "zod";
import { objectIdSchema } from "./common.validate";

export const notificationIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});
