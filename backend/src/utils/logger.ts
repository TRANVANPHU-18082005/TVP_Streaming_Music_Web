import winston from "winston";
import path from "path";
import config, { isProd } from "../config/env";
import { isSensitiveKey, redactLogValue } from "./logRedact";

// ============================================================
// CONSTANTS
// ============================================================

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const redactFormat = winston.format((info) => {
  for (const key of Object.keys(info)) {
    info[key] = (
      isSensitiveKey(key) ? "[Redacted]" : redactLogValue(info[key])
    ) as typeof info[typeof key];
  }
  return info;
});

const LOG_DIR = path.resolve(process.cwd(), "logs");
const IS_PRODUCTION = isProd();
const LOG_LEVEL = config.logLevel || (IS_PRODUCTION ? "info" : "debug");

// ============================================================
// CUSTOM FORMATS
// ============================================================

/**
 * Format đẹp cho môi trường development (console)
 * Output: 2024-01-15 10:30:45 [ERROR] [Queue] Job failed — message
 */
const devConsoleFormat = printf(
  ({ level, message, timestamp, stack, ...meta }) => {
    // Loại bỏ các key nội bộ của Winston khỏi meta
    const { service: _s, ...cleanMeta } = meta as any;

    const metaStr =
      Object.keys(cleanMeta).length > 0
        ? `\n  ${JSON.stringify(cleanMeta, null, 2)}`
        : "";

    const stackStr = stack ? `\n${stack}` : "";

    return `${timestamp} [${level}] ${message}${metaStr}${stackStr}`;
  },
);

/**
 * Format production: JSON thuần — dễ parse bởi log aggregators
 * (Datadog, Logtail, AWS CloudWatch, etc.)
 */
const productionFormat = combine(
  timestamp({ format: "YYYY-MM-DDTHH:mm:ss.SSSZ" }),
  errors({ stack: true }), // Ghi đầy đủ stack trace vào JSON
  redactFormat(),
  json(),
);

const developmentFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  redactFormat(),
  devConsoleFormat,
);

export const ROTATING_LOG_FILES = [
  { filename: "combined.log", maxsize: 20 * 1024 * 1024, maxFiles: 14 },
  {
    filename: "error.log",
    level: "error",
    maxsize: 10 * 1024 * 1024,
    maxFiles: 30,
  },
  { filename: "exceptions.log", maxsize: 10 * 1024 * 1024, maxFiles: 14 },
  { filename: "rejections.log", maxsize: 10 * 1024 * 1024, maxFiles: 14 },
] as const;

export function rotatingFileOptions(entry: {
  filename: string;
  maxsize: number;
  maxFiles: number;
}) {
  if (!Number.isFinite(entry.maxsize) || entry.maxsize <= 0) {
    throw new Error(`Unbounded log file refused: ${entry.filename}`);
  }
  if (!Number.isFinite(entry.maxFiles) || entry.maxFiles <= 0) {
    throw new Error(`Unbounded log file refused: ${entry.filename}`);
  }
  return {
    maxsize: entry.maxsize,
    maxFiles: entry.maxFiles,
    tailable: true as const,
  };
}

function rotatingFile(entry: {
  filename: string;
  level?: string;
  maxsize: number;
  maxFiles: number;
}) {
  const bounds = rotatingFileOptions(entry);
  return new winston.transports.File({
    filename: path.join(LOG_DIR, entry.filename),
    level: entry.level,
    format: productionFormat,
    maxsize: bounds.maxsize,
    maxFiles: bounds.maxFiles,
    tailable: bounds.tailable,
  });
}

const MESSAGE = Symbol.for("message");

/** JSON line after the same redaction used by the runtime logger. */
export function renderSafeLog(fields: Record<string, unknown>): string {
  const message = typeof fields.message === "string" ? fields.message : "log";
  const transformed = productionFormat.transform({
    level: "error",
    ...fields,
    message,
  });
  if (!transformed || typeof transformed === "boolean") return "";
  const line = (transformed as { [MESSAGE]?: unknown })[MESSAGE];
  return typeof line === "string" ? line : JSON.stringify(transformed);
}

// ============================================================
// TRANSPORTS
// ============================================================

const transports: winston.transport[] = [
  // --- 1. Console ---
  // Production: JSON (để log collector parse được)
  // Development: Colorized, human-readable
  new winston.transports.Console({
    format: IS_PRODUCTION ? productionFormat : developmentFormat,
  }),
];

// --- 2. File transports (chỉ bật ở production hoặc khi có LOG_TO_FILE) ---
if (IS_PRODUCTION || config.logToFile) {
  transports.push(rotatingFile(ROTATING_LOG_FILES[0]));
  transports.push(rotatingFile(ROTATING_LOG_FILES[1]));
}

// ============================================================
// LOGGER INSTANCE
// ============================================================

const logger = winston.createLogger({
  // Level hierarchy: error > warn > info > http > debug
  level: LOG_LEVEL,

  // Metadata mặc định đính kèm vào mọi log
  defaultMeta: { service: "music-stream-api" },

  transports,

  // Không crash app khi logger gặp lỗi nội bộ
  exitOnError: false,

  // Bắt unhandled exception & rejection tự động log vào file riêng
  // (chỉ nên bật ở production để tránh nhiễu test)
  ...(IS_PRODUCTION && {
    exceptionHandlers: [rotatingFile(ROTATING_LOG_FILES[2])],
    rejectionHandlers: [rotatingFile(ROTATING_LOG_FILES[3])],
  }),
});

// ============================================================
// STREAM — Tích hợp Morgan HTTP logger (nếu dùng)
// ============================================================
// Dùng trong app.ts:
//   import morgan from "morgan";
//   app.use(morgan("combined", { stream: logger.stream }));

(logger as any).stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// ============================================================
// HELPERS — Typed child loggers cho từng module
// ============================================================

/**
 * Tạo child logger với context cố định.
 * Mọi log từ child sẽ tự động đính thêm field "module".
 *
 * @example
 * const log = createModuleLogger("InteractionWorker");
 * log.info("Job started"); // → { ..., module: "InteractionWorker" }
 */
export function createModuleLogger(moduleName: string) {
  return logger.child({ module: moduleName });
}

export default logger;
