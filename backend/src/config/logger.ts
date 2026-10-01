/**
 * Auth, Passport, and errorHandler import this module.
 * It is the rotating logger in utils/logger.ts: one implementation,
 * size-capped files, and redaction of authentication fields.
 */
export { createModuleLogger } from "../utils/logger";
import logger from "../utils/logger";

export default logger;
