// server.js (Final Version to Prevent Circular Dependencies)

// Load environment variables FIRST
require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});

// ONLY import the logger at the top level
const logger = require("./utils/logger");

// All other imports will be inside the async function to break cycles
const express = require("express");

async function startServer() {
  try {
    const app = express();
    const PORT = process.env.PORT || 5000;

    // --- Import modules inside the function ---
    const cors = require("cors");
    const helmet = require("helmet");
    const morgan = require("morgan");
    const { errorHandler } = require("./middleware/errorHandler");
    const { generalLimiter } = require("./middleware/rateLimiter");
    const apiRoutes = require("./routes/api");
    const twitterRoutes = require("./routes/twitter");
    const linkedinRoutes = require("./routes/linkedin");
    const TwitterService = require("./services/twitterService");
    const LinkedInService = require("./services/linkedinService");

    // --- Middleware ---
    app.use(helmet());
    app.use(
      cors({
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        credentials: true,
      })
    );
    app.use(express.json({ limit: "10kb" }));
    app.use(
      morgan("combined", {
        stream: { write: (message) => logger.info(message.trim()) },
      })
    );
    app.use("/api", generalLimiter);

    // --- Routes ---
    app.get("/health", (req, res) =>
      res.status(200).json({ status: "healthy" })
    );
    app.use("/api", apiRoutes);
    app.use("/api/twitter", twitterRoutes);
    app.use("/api/linkedin", linkedinRoutes);

    // --- Service Initialization ---
    logger.info("Initializing services...");
    app.locals.twitterService = new TwitterService();
    app.locals.linkedinService = new LinkedInService();
    await app.locals.twitterService.checkApiStatus();
    await app.locals.linkedinService.checkApiStatus();
    logger.info("Services initialized successfully.");

    // --- Error Handling (must be last) ---
    app.use(errorHandler);
    app.use((req, res, next) =>
      res.status(404).json({ error: "Endpoint not found" })
    );

    // --- Start Listening ---
    app.listen(PORT, () => {
      logger.info(
        `🚀 SocialCog.io API Server is now running and listening on port ${PORT}`
      );
    });
  } catch (error) {
    // Use console.error as a fallback in case the logger itself fails
    console.error("❌ Fatal error during server startup:", error);
    process.exit(1);
  }
}

// --- Execute the server start ---
startServer();
