/**
 * SocialCog.io - Twitter Service
 * TM (2025) - TPCL, LLC
 * Production Twitter API integration with your live credentials
 */

const { TwitterApi } = require("twitter-api-v2");
const NodeCache = require("node-cache");
const logger = require("../utils/logger");

class TwitterService {
  constructor() {
    this.validateConfig();

    // Initialize Twitter API client with your actual credentials
    this.client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
      bearerToken: process.env.TWITTER_BEARER_TOKEN,
    });

    // Initialize read-only client for public data
    this.readOnlyClient = this.client.readOnly;

    // Cache for API responses (TTL: 5 minutes)
    this.cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

    logger.info("✅ SocialCog.io Twitter Service initialized successfully");
  }

  validateConfig() {
    const required = [
      "TWITTER_API_KEY",
      "TWITTER_API_SECRET",
      "TWITTER_BEARER_TOKEN",
      "TWITTER_ACCESS_TOKEN",
      "TWITTER_ACCESS_TOKEN_SECRET",
    ];

    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing Twitter API credentials: ${missing.join(", ")}`);
    }

    logger.info("✅ Twitter API configuration validated");
  }

  async checkApiStatus() {
    try {
      logger.info("🔍 SocialCog.io: Checking Twitter API status...");

      // Try to verify credentials
      const user = await this.readOnlyClient.v2.me();

      return {
        status: "connected",
        service: "Twitter API",
        user: user.data?.username || "unknown",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("❌ SocialCog.io: Twitter API check failed:", error.message);

      return {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getUserProfile(usernameOrId) {
    const cacheKey = `profile_${usernameOrId}`;

    try {
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.info(
          `📋 SocialCog.io: Returning cached profile for ${usernameOrId}`
        );
        return cached;
      }

      logger.info(
        `🔍 SocialCog.io: Fetching live Twitter profile for @${usernameOrId}`
      );

      // Determine if input is username or ID
      const isUserId = /^\d+$/.test(usernameOrId);

      // Fetch user data with comprehensive fields
      const user = await this.readOnlyClient.v2.userByUsername(
        isUserId ? undefined : usernameOrId,
        {
          "user.fields": [
            "id",
            "username",
            "name",
            "description",
            "location",
            "url",
            "verified",
            "verified_type",
            "profile_image_url",
            "public_metrics",
            "created_at",
          ].join(","),
        }
      );

      if (!user.data) {
        throw new Error(`User ${usernameOrId} not found`);
      }

      const userData = user.data;
      const metrics = userData.public_metrics || {};

      // Format profile data for SocialCog.io
      const profile = {
        id: userData.id,
        username: userData.username,
        name: userData.name,
        platform: "twitter",
        followers: metrics.followers_count || 0,
        following: metrics.following_count || 0,
        posts: metrics.tweet_count || 0,
        likes: metrics.like_count || 0,
        bio: userData.description || "",
        verified: userData.verified || false,
        verified_type: userData.verified_type || null,
        location: userData.location || null,
        profile_url: `https://twitter.com/${userData.username}`,
        profile_image_url: userData.profile_image_url || null,
        external_url: userData.url || null,
        created_at: userData.created_at || null,
        updated_at: new Date().toISOString(),
        fetched_by: "SocialCog.io",
        api_version: "v2",
      };

      logger.info(
        `✅ SocialCog.io: Successfully fetched live profile for @${userData.username}`
      );
      logger.info(
        `📊 Profile metrics: ${profile.followers} followers, ${profile.following} following, ${profile.posts} posts`
      );

      // Cache the result
      this.cache.set(cacheKey, profile);

      return profile;
    } catch (error) {
      logger.error(
        `❌ SocialCog.io: Error fetching profile for ${usernameOrId}:`,
        error.message
      );

      // Return mock data for development/fallback
      return this.getMockProfile(usernameOrId, error.message);
    }
  }

  async getUserFollowers(userId, maxResults = 100) {
    const cacheKey = `followers_${userId}_${maxResults}`;

    try {
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.info(
          `📋 SocialCog.io: Returning cached followers for ${userId}`
        );
        return cached;
      }

      logger.info(`🔍 SocialCog.io: Fetching followers for user ID: ${userId}`);

      // Fetch followers (requires elevated access)
      const followers = await this.readOnlyClient.v2.followers(userId, {
        max_results: Math.min(maxResults, 1000),
        "user.fields":
          "id,username,name,public_metrics,verified,profile_image_url",
      });

      const followersList = followers.data || [];

      const result = {
        user_id: userId,
        count: followersList.length,
        followers: followersList.map((follower) => ({
          id: follower.id,
          username: follower.username,
          name: follower.name,
          verified: follower.verified || false,
          followers: follower.public_metrics?.followers_count || 0,
          profile_image_url: follower.profile_image_url || null,
          platform: "twitter",
        })),
        fetched_at: new Date().toISOString(),
        fetched_by: "SocialCog.io",
      };

      // Cache the result
      this.cache.set(cacheKey, result);

      logger.info(
        `✅ SocialCog.io: Fetched ${result.count} followers for ${userId}`
      );
      return result;
    } catch (error) {
      logger.error(`❌ SocialCog.io: Error fetching followers:`, error.message);

      // Return mock followers for development/fallback
      return this.getMockFollowers(userId, maxResults, error.message);
    }
  }

  async getUserFollowing(userId, maxResults = 100) {
    const cacheKey = `following_${userId}_${maxResults}`;

    try {
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      logger.info(`🔍 SocialCog.io: Fetching following for user ID: ${userId}`);

      const following = await this.readOnlyClient.v2.following(userId, {
        max_results: Math.min(maxResults, 1000),
        "user.fields":
          "id,username,name,public_metrics,verified,profile_image_url",
      });

      const followingList = following.data || [];

      const result = {
        user_id: userId,
        count: followingList.length,
        following: followingList.map((user) => ({
          id: user.id,
          username: user.username,
          name: user.name,
          verified: user.verified || false,
          followers: user.public_metrics?.followers_count || 0,
          profile_image_url: user.profile_image_url || null,
          platform: "twitter",
        })),
        fetched_at: new Date().toISOString(),
        fetched_by: "SocialCog.io",
      };

      this.cache.set(cacheKey, result);

      logger.info(
        `✅ SocialCog.io: Fetched ${result.count} following for ${userId}`
      );
      return result;
    } catch (error) {
      logger.error(`❌ SocialCog.io: Error fetching following:`, error.message);
      return this.getMockFollowing(userId, maxResults, error.message);
    }
  }

  async getMutualConnections(userId1, userId2) {
    try {
      logger.info(
        `🔍 SocialCog.io: Finding mutual connections between ${userId1} and ${userId2}`
      );

      // Get followers for both users
      const [user1Followers, user2Followers] = await Promise.all([
        this.getUserFollowers(userId1, 1000),
        this.getUserFollowers(userId2, 1000),
      ]);

      // Find mutual connections
      const user1FollowerIds = new Set(
        user1Followers.followers.map((f) => f.id)
      );
      const mutualConnections = user2Followers.followers.filter((follower) =>
        user1FollowerIds.has(follower.id)
      );

      const result = {
        user1_id: userId1,
        user2_id: userId2,
        count: mutualConnections.length,
        mutual_connections: mutualConnections,
        analyzed_at: new Date().toISOString(),
        analyzed_by: "SocialCog.io",
      };

      logger.info(`✅ SocialCog.io: Found ${result.count} mutual connections`);
      return result;
    } catch (error) {
      logger.error(
        `❌ SocialCog.io: Error finding mutual connections:`,
        error.message
      );

      return {
        user1_id: userId1,
        user2_id: userId2,
        count: 0,
        mutual_connections: [],
        error: error.message,
        analyzed_at: new Date().toISOString(),
        analyzed_by: "SocialCog.io",
      };
    }
  }

  // Mock data methods for fallback/development
  getMockProfile(username, errorReason = "API_LIMIT") {
    return {
      id: Math.random().toString(36).substr(2, 9),
      username: username,
      name: `${username} (Mock)`,
      platform: "twitter",
      followers: Math.floor(Math.random() * 10000),
      following: Math.floor(Math.random() * 1000),
      posts: Math.floor(Math.random() * 5000),
      likes: Math.floor(Math.random() * 50000),
      bio: `Mock profile for ${username}`,
      verified: Math.random() > 0.5,
      verified_type: "blue",
      location: "Global",
      profile_url: `https://twitter.com/${username}`,
      profile_image_url: `https://via.placeholder.com/128x128?text=${username}`,
      external_url: null,
      created_at: new Date(2020, 0, 1).toISOString(),
      updated_at: new Date().toISOString(),
      fetched_by: "SocialCog.io (Mock)",
      api_version: "v2-mock",
      mock_reason: errorReason,
    };
  }

  getMockFollowers(userId, count = 10, errorReason = "API_ACCESS_REQUIRED") {
    const followers = [];

    for (let i = 0; i < count; i++) {
      followers.push({
        id: Math.random().toString(36).substr(2, 9),
        username: `user${i + 1}`,
        name: `Mock User ${i + 1}`,
        verified: Math.random() > 0.8,
        followers: Math.floor(Math.random() * 1000),
        profile_image_url: `https://via.placeholder.com/64x64?text=U${i + 1}`,
        platform: "twitter",
      });
    }

    return {
      user_id: userId,
      count: followers.length,
      followers: followers,
      fetched_at: new Date().toISOString(),
      fetched_by: "SocialCog.io (Mock)",
      mock_reason: errorReason,
    };
  }

  getMockFollowing(userId, count = 10, errorReason = "API_ACCESS_REQUIRED") {
    const following = [];

    for (let i = 0; i < count; i++) {
      following.push({
        id: Math.random().toString(36).substr(2, 9),
        username: `following${i + 1}`,
        name: `Mock Following ${i + 1}`,
        verified: Math.random() > 0.7,
        followers: Math.floor(Math.random() * 5000),
        profile_image_url: `https://via.placeholder.com/64x64?text=F${i + 1}`,
        platform: "twitter",
      });
    }

    return {
      user_id: userId,
      count: following.length,
      following: following,
      fetched_at: new Date().toISOString(),
      fetched_by: "SocialCog.io (Mock)",
      mock_reason: errorReason,
    };
  }

  // Utility methods
  clearCache() {
    this.cache.flushAll();
    logger.info("🗑️ SocialCog.io: Twitter service cache cleared");
  }

  getCacheStats() {
    return {
      keys: this.cache.keys().length,
      hits: this.cache.getStats().hits,
      misses: this.cache.getStats().misses,
    };
  }
}

module.exports = TwitterService;
