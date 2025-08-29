/**
 * SocialCog.io - Main Server Application
 * TM (2025) - TPCL, LLC
 * Production-ready Express server with Twitter & LinkedIn integration
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// Import middleware
const errorHandler = require("./middleware/errorHandler");
const rateLimiter = require("./middleware/rateLimiter");

// Import routes
const apiRoutes = require("./routes/api");
const twitterRoutes = require("./routes/twitter");
const linkedinRoutes = require("./routes/linkedin");

// Import services
const TwitterService = require("./services/twitterService");
const LinkedInService = require("./services/linkedinService");

// Import utilities
const logger = require("./utils/logger");

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://api.twitter.com",
          "https://api.linkedin.com",
        ],
      },
    },
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// Apply rate limiting
app.use("/api", rateLimiter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "SocialCog.io API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use("/api", apiRoutes);
app.use("/api/twitter", twitterRoutes);
app.use("/api/linkedin", linkedinRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "SocialCog.io API Server",
    version: "1.0.0",
    author: "TM (2025) - TPCL, LLC",
    endpoints: {
      health: "/health",
      api: "/api",
      twitter: "/api/twitter",
      linkedin: "/api/linkedin",
    },
    documentation: "https://github.com/your-username/socialcog-api",
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    message: `The requested endpoint ${req.originalUrl} was not found on this server.`,
    service: "SocialCog.io API",
  });
});

// Initialize services and start server
async function startServer() {
  try {
    // Initialize Twitter service
    const twitterService = new TwitterService();
    const twitterStatus = await twitterService.checkApiStatus();
    logger.info("Twitter API Status:", twitterStatus);

    // Initialize LinkedIn service
    const linkedinService = new LinkedInService();
    const linkedinStatus = await linkedinService.checkApiStatus();
    logger.info("LinkedIn API Status:", linkedinStatus);

    // Store service instances for use in routes
    app.locals.twitterService = twitterService;
    app.locals.linkedinService = linkedinService;

    // Start the server
    app.listen(PORT, () => {
      logger.info(`🚀 SocialCog.io API Server running on port ${PORT}`);
      logger.info(
        `🌍 Frontend URL: ${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }`
      );
      logger.info(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
      logger.info("🔗 API Endpoints available:");
      logger.info("   GET  /health - Health check");
      logger.info("   GET  /api/status - Service status");
      logger.info("   POST /api/twitter/profile - Get Twitter profile");
      logger.info("   POST /api/linkedin/profile - Get LinkedIn profile");
      logger.info("   POST /api/network/analyze - Analyze social network");
    });
  } catch (error) {
    logger.error("❌ Failed to start SocialCog.io server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  app.close(() => {
    logger.info("HTTP server closed");
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT signal received: closing HTTP server");
  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start the server
startServer();

module.exports = app;
