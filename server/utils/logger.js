/**
 * SocialCog.io - Logging Utility
 * TM (2025) - TPCL, LLC
 */

const winston = require('winston');
const path = require('path');

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    
    // Add stack trace for errors
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    return logMessage;
  })
);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

// Winston logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'SocialCog.io' },
  transports: [
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Write error logs to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Write API access logs
    new winston.transports.File({
      filename: path.join(logsDir, 'api.log'),
      level: 'http',
      maxsize: 10485760, // 10MB
      maxFiles: 3,
      tailable: true
    })
  ],
  
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 2
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 2
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, stack }) => {
        let output = `${level}: ${message}`;
        if (stack) {
          output += `\n${stack}`;
        }
        return output;
      })
    )
  }));
}

// Create child loggers for different components
const createChildLogger = (componentName) => {
  return logger.child({ component: componentName });
};

// API request logger
const apiLogger = createChildLogger('API');

// Service loggers
const twitterLogger = createChildLogger('Twitter');
const linkedinLogger = createChildLogger('LinkedIn');
const networkLogger = createChildLogger('Network');

// Helper functions for structured logging
const logApiRequest = (req, res, responseTime) => {
  apiLogger.http('API Request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    contentLength: res.get('Content-Length')
  });
};

const logApiError = (req, error) => {
  apiLogger.error('API Error', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    error: error.message,
    stack: error.stack
  });
};

const logServiceCall = (service, method, params, duration, success = true