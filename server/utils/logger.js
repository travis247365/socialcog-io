// server/utils/logger.js (Final Global Instance Version)
const winston = require('winston');

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  let log = `${timestamp} ${level}: ${message}`;
  if (stack) log = `${log}\n${stack}`;
  return log;
});

const logger = winston.createLogger({
  level: 'debug',
  format: combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [new winston.transports.Console()],
  exitOnError: false,
});

// Export only the logger instance
module.exports = logger;

