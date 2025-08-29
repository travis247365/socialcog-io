/**
 * SocialCog.io - Rate Limiting Middleware
 * TM (2025) - TPCL, LLC
 */

const rateLimit = require("express-rate-limit");
const logger = require("../utils/logger");

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests",
    message: "Too many requests from this IP, please try again later.",
    service: "SocialCog.io API",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: "Too many requests",
      message: "Too many requests from this IP, please try again later.",
      service: "SocialCog.io API",
      timestamp: new Date().toISOString(),
    });
  },
});

// Strict limiter for expensive operations
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 requests per hour
  message: {
    error: "Rate limit exceeded",
    message: "Too many expensive requests. Please try again in an hour.",
    service: "SocialCog.io API",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication-based limiter (higher limits for authenticated users)
const createAuthLimiter = (maxRequests = 500) =>
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: maxRequests,
    keyGenerator: (req) => {
      return req.user?.id || req.ip; // Use user ID if authenticated, otherwise IP
    },
    message: {
      error: "Rate limit exceeded",
      message:
        "API rate limit exceeded. Please upgrade your plan for higher limits.",
      service: "SocialCog.io API",
    },
  });

module.exports = {
  generalLimiter,
  strictLimiter,
  createAuthLimiter,
};
