/**
 * SocialCog.io - Error Handling Middleware
 * TM (2025) - TPCL, LLC
 */

const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(`Error in ${req.method} ${req.originalUrl}:`, {
    message: err.message,
    stack: err.stack,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  // Default error response
  let statusCode = 500;
  let message = "Internal Server Error";
  let details = null;

  // Handle specific error types
  if (err.name === "ValidationError") {
    // Mongoose/Express validation error
    statusCode = 400;
    message = "Validation Error";
    details = Object.values(err.errors).map((error) => error.message);
  } else if (err.name === "CastError") {
    // Mongoose bad ObjectId
    statusCode = 400;
    message = "Invalid ID format";
  } else if (err.code === 11000) {
    // Mongoose duplicate key error
    statusCode = 400;
    message = "Duplicate field value";
    const duplicateField = Object.keys(err.keyValue)[0];
    details = `${duplicateField} already exists`;
  } else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  } else if (err.response && err.response.status) {
    // Axios or API errors
    statusCode = err.response.status;
    message = err.response.data?.message || err.message;
    details = err.response.data?.details;
  } else if (err.statusCode) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err.message.includes("Twitter API")) {
    statusCode = 503;
    message = "Twitter API unavailable";
    details = "Please try again later";
  } else if (err.message.includes("LinkedIn API")) {
    statusCode = 503;
    message = "LinkedIn API unavailable";
    details = "Please try again later";
  } else if (err.message.includes("Rate limit")) {
    statusCode = 429;
    message = "Rate limit exceeded";
    details = "Please try again later";
  }

  // Create error response
  const errorResponse = {
    success: false,
    error: message,
    service: "SocialCog.io API",
    timestamp: new Date().toISOString(),
    request_id: req.id || "unknown",
  };

  // Add details if available and not in production
  if (details) {
    errorResponse.details = details;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === "development") {
    errorResponse.stack = err.stack;
  }

  // Add specific error codes for API consumers
  const errorCodes = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    429: "RATE_LIMITED",
    500: "INTERNAL_ERROR",
    502: "BAD_GATEWAY",
    503: "SERVICE_UNAVAILABLE",
  };

  errorResponse.error_code = errorCodes[statusCode] || "UNKNOWN_ERROR";

  res.status(statusCode).json(errorResponse);
};

// 404 handler for undefined routes
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Async error handler wrapper
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = {
  errorHandler,
  notFound,
  asyncHandler,
};
