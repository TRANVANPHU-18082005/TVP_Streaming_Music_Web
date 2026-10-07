/**
 * `errorCode` do backend trả về (xem backend/src/middlewares/error.middleware.ts
 * và các ApiError). Dùng chung để tránh gõ chuỗi thô ở nhiều nơi.
 */
export const ERROR_CODES = {
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_ID: "INVALID_ID",
  DUPLICATE_RESOURCE: "DUPLICATE_RESOURCE",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  INVALID_JSON: "INVALID_JSON",
  RATE_LIMITED: "RATE_LIMITED",
  ROUTE_NOT_FOUND: "ROUTE_NOT_FOUND",
  SERVICE_STARTING: "SERVICE_STARTING",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  CORS_NOT_ALLOWED: "CORS_NOT_ALLOWED",
} as const;

export type KnownErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
