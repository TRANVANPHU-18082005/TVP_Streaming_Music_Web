import winston from "winston";
import path from "path";

// ============================================================
// CONSTANTS
// ============================================================

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const LOG_DIR = path.resolve(process.cwd(), "logs");
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? "info" : "debug");

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
  json(),
);

const developmentFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  devConsoleFormat,
);

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
if (IS_PRODUCTION || process.env.LOG_TO_FILE === "true") {
  // Tất cả logs từ level "info" trở lên
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, "combined.log"),
      format: productionFormat,
      maxsize: 20 * 1024 * 1024, // 20MB mỗi file
      maxFiles: 14, // Giữ tối đa 14 file (rotate)
      tailable: true, // File mới nhất luôn là combined.log
    }),
  );

  // Chỉ errors — dễ alert & monitor
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, "error.log"),
      level: "error",
      format: productionFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 30, // Giữ 30 file error (lâu hơn để audit)
      tailable: true,
    }),
  );
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
    exceptionHandlers: [
      new winston.transports.File({
        filename: path.join(LOG_DIR, "exceptions.log"),
        format: productionFormat,
      }),
    ],
    rejectionHandlers: [
      new winston.transports.File({
        filename: path.join(LOG_DIR, "rejections.log"),
        format: productionFormat,
      }),
    ],
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
