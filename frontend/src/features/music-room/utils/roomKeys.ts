export const roomKeys = {
  all: ["rooms"] as const,
  lists: () => [...roomKeys.all, "list"] as const,
  list: (params: { page?: number; limit?: number; q?: string }) =>
    [...roomKeys.lists(), { params }] as const,
  details: () => [...roomKeys.all, "detail"] as const,
  detail: (code: string) => [...roomKeys.details(), code] as const,
  chats: () => [...roomKeys.all, "chat"] as const,
  chat: (code: string) => [...roomKeys.chats(), code] as const,
};
