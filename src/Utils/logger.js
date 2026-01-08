// Utils/logger.js - Simple production logger
import fs from "fs";
import path from "path";

const logLevel = process.env.NODE_ENV === "production" ? "error" : "debug";

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const log = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...meta,
  };

  // Console output for development
  if (process.env.NODE_ENV !== "production") {
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, meta);
  }

  // File output for production
  if (level === "error" || process.env.NODE_ENV === "production") {
    const logFile = level === "error" ? "error.log" : "combined.log";
    const logPath = path.join(logsDir, logFile);

    fs.appendFileSync(logPath, JSON.stringify(logEntry) + "\n");
  }
};

export const logger = {
  error: (message, meta) => log("error", message, meta),
  warn: (message, meta) => log("warn", message, meta),
  info: (message, meta) => log("info", message, meta),
  debug: (message, meta) => log("debug", message, meta),
};

export default logger;
