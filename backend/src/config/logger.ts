import winston from "winston";
import { isProd } from "./env";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
  ),
  transports: [
    // Ghi lỗi ra file error.log (nếu chạy local)
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

// Nếu không phải production thì in ra console có màu mè cho dễ nhìn
if (isProd()) {
  // In production, also emit logs to stdout/stderr in JSON for log collectors
  logger.add(
    new winston.transports.Console({
      stderrLevels: ["error"],
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.json(),
      ),
    }),
  );
} else {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, stack }) => {
          return `${timestamp} ${level}: ${message} ${stack || ""}`;
        }),
      ),
    }),
  );
}

export default logger;
