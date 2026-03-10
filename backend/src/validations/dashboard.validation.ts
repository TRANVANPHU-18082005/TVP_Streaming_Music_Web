import { z } from "zod";
import { emptyToUndefined } from "./common.validate";

export const getAnalyticsSchema = z.object({
  query: z.object({
    // Nếu rỗng -> undefined -> tự fallback về "7d" an toàn
    range: z.preprocess(
      emptyToUndefined,
      z.enum(["7d", "30d", "90d"]).default("7d"),
    ),
  }),
});

export type GetAnalyticsQuery = z.infer<typeof getAnalyticsSchema>["query"];
