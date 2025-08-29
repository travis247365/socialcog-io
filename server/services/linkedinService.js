/**
 * SocialCog.io - LinkedIn Service
 * TM (2025) - TPCL, LLC
 * Production LinkedIn API integration
 */

const axios = require("axios");
const NodeCache = require("node-cache");
const logger = require("../utils/logger");

class LinkedInService {
  constructor() {
    this.validateConfig();

    // LinkedIn API base URL
    this.baseURL = "https://api.linkedin.com/v2";

    // Default headers for all requests
    this.defaultHeaders = {
      Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "User-Agent": "SocialCog.io/1.0",
    };

    // Cache for API responses (TTL: 10 minutes)
    this.cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

    // Rate limiting tracker
    this.requestTracker = new Map();

    logger.info("✅ SocialCog.io LinkedIn Service initialized successfully");
  }

  validateConfig() {
    const required = [
      "LINKEDIN_CLIENT_ID",
      "LINKEDIN_CLIENT_SECRET",
      "LINKEDIN_ACCESS_TOKEN",
    ];

    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing LinkedIn API credentials: ${missing.join(", ")}`
      );
    }

    logger.info("✅ LinkedIn API configuration validated");
  }

  async checkApiStatus() {
    try {
      logger.info("🔍 SocialCog.io: Checking LinkedIn API status...");

      // Try to get current user profile
      const response = await axios.get(`${this.baseURL}/people/~`, {
        headers: this.defaultHeaders,
        timeout: 10000,
      });

      return {
        status: "connected",
        service: "LinkedIn API",
        user_id: response.data.id || "unknown",
        timestamp: new Date().toISOString(),
        rate_limit: this.extractRateLimit(response.headers),
      };
    } catch (error) {
      logger.error(
        "❌ SocialCog.io: LinkedIn API check failed:",
        error.message
      );

      return {
        status: "error",
        error: error.response?.data?.message || error.message,
        status_code: error.response?.status,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getUserProfile(profileUrl) {
    const cacheKey = `linkedin_profile_${this.hashString(profileUrl)}`;

    try {
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.info(`📋 SocialCog.io: Returning cached LinkedIn profile`);
        return cached;
      }

      logger.info(
        `🔍 SocialCog.io: Fetching LinkedIn profile for: ${profileUrl}`
      );

      // Extract profile identifier from URL
      const profileId = this.extractProfileId(profileUrl);

      // Fetch profile data
      const profileResponse = await this.makeAPIRequest(
        `/people/${profileId}`,
        {
          projection: [
            "id",
            "firstName",
            "lastName",
            "headline",
            "summary",
            "industryName",
            "locationName",
            "numConnections",
            "numConnectionsDisplay",
            "profilePicture(displayImage~:playableStreams)",
            "publicProfileUrl",
          ].join(","),
        }
      );

      if (!profileResponse.data) {
        throw new Error("LinkedIn profile not found");
      }

      const userData = profileResponse.data;

      // Format profile data for SocialCog.io
      const profile = {
        id: userData.id,
        username: profileId,
        name: `${userData.firstName?.localized?.en_US || ""} ${
          userData.lastName?.localized?.en_US || ""
        }`.trim(),
        platform: "linkedin",
        connections: this.parseConnectionCount(userData.numConnectionsDisplay),
        headline: userData.headline?.localized?.en_US || "",
        summary: userData.summary?.localized?.en_US || "",
        industry: userData.industryName?.localized?.en_US || null,
        location: userData.locationName?.localized?.en_US || null,
        profile_url: userData.publicProfileUrl || profileUrl,
        profile_image_url: this.extractProfileImage(userData.profilePicture),
        verified: true, // LinkedIn profiles are inherently verified
        created_at: null, // Not available via API
        updated_at: new Date().toISOString(),
        fetched_by: "SocialCog.io",
        api_version: "v2",
      };

      logger.info(
        `✅ SocialCog.io: Successfully fetched LinkedIn profile for ${profile.name}`
      );
      logger.info(
        `📊 Profile data: ${profile.connections} connections, ${profile.industry}`
      );

      // Cache the result
      this.cache.set(cacheKey, profile);

      return profile;
    } catch (error) {
      logger.error(
        `❌ SocialCog.io: Error fetching LinkedIn profile:`,
        error.message
      );

      // Return mock data for development/fallback
      return this.getMockProfile(profileUrl, error.message);
    }
  }

  async getUserConnections(profileId, maxResults = 100) {
    const cacheKey = `linkedin_connections_${profileId}_${maxResults}`;

    try {
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.info(`📋 SocialCog.io: Returning cached LinkedIn connections`);
        return cached;
      }

      logger.info(
        `🔍 SocialCog.io: Fetching connections for LinkedIn profile: ${profileId}`
      );

      // Note: Direct connections API requires special permissions
      // For now, we'll return mock data or use available public data

      const result = {
        profile_id: profileId,
        count: 0,
        connections: [],
        note: "LinkedIn connections require special API permissions",
        fetched_at: new Date().toISOString(),
        fetched_by: "SocialCog.io",
      };

      // Cache the result
      this.cache.set(cacheKey, result);

      return result;
    } catch (error) {
      logger.error(
        `❌ SocialCog.io: Error fetching LinkedIn connections:`,
        error.message
      );

      return this.getMockConnections(profileId, maxResults, error.message);
    }
  }

  async getCompanyProfile(companyUrl) {
    const cacheKey = `linkedin_company_${this.hashString(companyUrl)}`;

    try {
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      logger.info(
        `🔍 SocialCog.io: Fetching LinkedIn company profile: ${companyUrl}`
      );

      const companyId = this.extractCompanyId(companyUrl);

      const companyResponse = await this.makeAPIRequest(
        `/companies/${companyId}`,
        {
          projection: [
            "id",
            "name",
            "description",
            "industryV2",
            "headquarter",
            "companyType",
            "employeeCountRange",
            "foundedOn",
            "websiteUrl",
            "logo(displayImage~:playableStreams)",
            "followersCount",
          ].join(","),
        }
      );

      const companyData = companyResponse.data;

      const companyProfile = {
        id: companyData.id,
        name: companyData.name?.localized?.en_US || "Unknown Company",
        platform: "linkedin",
        description: companyData.description?.localized?.en_US || "",
        industry: companyData.industryV2?.localized?.en_US || null,
        employee_count: this.parseEmployeeCount(companyData.employeeCountRange),
        headquarters: this.formatHeadquarters(companyData.headquarter),
        founded_year: companyData.foundedOn?.year || null,
        website: companyData.websiteUrl || null,
        followers: companyData.followersCount || 0,
        logo_url: this.extractCompanyLogo(companyData.logo),
        profile_url: companyUrl,
        updated_at: new Date().toISOString(),
        fetched_by: "SocialCog.io",
        api_version: "v2",
      };

      // Cache the result
      this.cache.set(cacheKey, companyProfile);

      logger.info(
        `✅ SocialCog.io: Successfully fetched company profile for ${companyProfile.name}`
      );
      return companyProfile;
    } catch (error) {
      logger.error(
        `❌ SocialCog.io: Error fetching LinkedIn company:`,
        error.message
      );
      return this.getMockCompany(companyUrl, error.message);
    }
  }

  async searchPeople(query, maxResults = 10) {
    const cacheKey = `linkedin_search_${this.hashString(query)}_${maxResults}`;

    try {
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      logger.info(`🔍 SocialCog.io: Searching LinkedIn people: ${query}`);

      // LinkedIn People Search API (requires specific permissions)
      const searchResponse = await this.makeAPIRequest("/people-search", {
        keywords: query,
        count: maxResults,
        projection: [
          "elements*(id,firstName,lastName,headline,industryName,locationName,publicProfileUrl,profilePicture(displayImage~:playableStreams))",
        ].join(","),
      });

      const results = searchResponse.data?.elements || [];

      const searchResults = {
        query: query,
        count: results.length,
        results: results.map((person) => ({
          id: person.id,
          name: `${person.firstName?.localized?.en_US || ""} ${
            person.lastName?.localized?.en_US || ""
          }`.trim(),
          headline: person.headline?.localized?.en_US || "",
          industry: person.industryName?.localized?.en_US || null,
          location: person.locationName?.localized?.en_US || null,
          profile_url: person.publicProfileUrl,
          profile_image_url: this.extractProfileImage(person.profilePicture),
          platform: "linkedin",
        })),
        searched_at: new Date().toISOString(),
        searched_by: "SocialCog.io",
      };

      // Cache the result
      this.cache.set(cacheKey, searchResults);

      logger.info(
        `✅ SocialCog.io: Found ${searchResults.count} LinkedIn profiles for "${query}"`
      );
      return searchResults;
    } catch (error) {
      logger.error(
        `❌ SocialCog.io: Error searching LinkedIn people:`,
        error.message
      );
      return this.getMockSearchResults(query, maxResults, error.message);
    }
  }

  // Utility methods
  async makeAPIRequest(endpoint, params = {}) {
    try {
      // Rate limiting check
      await this.checkRateLimit();

      const url = `${this.baseURL}${endpoint}`;
      const response = await axios.get(url, {
        headers: this.defaultHeaders,
        params: params,
        timeout: 15000,
      });

      // Track rate limit info
      this.updateRateLimit(response.headers);

      return response;
    } catch (error) {
      if (error.response?.status === 429) {
        logger.warn("⚠️ SocialCog.io: LinkedIn rate limit exceeded");
        throw new Error("Rate limit exceeded - please try again later");
      }

      if (error.response?.status === 401) {
        logger.error("🔐 SocialCog.io: LinkedIn authentication failed");
        throw new Error("LinkedIn authentication failed - check access token");
      }

      throw error;
    }
  }

  extractProfileId(profileUrl) {
    // Extract profile identifier from LinkedIn URL
    const patterns = [
      /linkedin\.com\/in\/([^\/\?]+)/,
      /linkedin\.com\/profile\/view\?id=([^&]+)/,
    ];

    for (const pattern of patterns) {
      const match = profileUrl.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // If no pattern matches, assume it's already an ID
    return profileUrl;
  }

  extractCompanyId(companyUrl) {
    // Extract company identifier from LinkedIn URL
    const patterns = [
      /linkedin\.com\/company\/([^\/\?]+)/,
      /linkedin\.com\/companies\/([^\/\?]+)/,
    ];

    for (const pattern of patterns) {
      const match = companyUrl.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return companyUrl;
  }

  extractProfileImage(profilePicture) {
    if (!profilePicture?.displayImage) return null;

    try {
      const elements = profilePicture.displayImage["~"]?.elements || [];
      const largestImage = elements
        .filter(
          (el) =>
            el.data?.["com.linkedin.digitalmedia.mediaartifact.StillImage"]
        )
        .sort((a, b) => {
          const aSize =
            a.data["com.linkedin.digitalmedia.mediaartifact.StillImage"]
              .storageSize?.width || 0;
          const bSize =
            b.data["com.linkedin.digitalmedia.mediaartifact.StillImage"]
              .storageSize?.width || 0;
          return bSize - aSize;
        })[0];

      return largestImage?.identifiers?.[0]?.identifier || null;
    } catch (error) {
      logger.warn("⚠️ Error extracting profile image:", error.message);
      return null;
    }
  }

  extractCompanyLogo(logo) {
    return this.extractProfileImage(logo);
  }

  parseConnectionCount(displayString) {
    if (!displayString) return 0;

    // Parse "500+ connections", "1,234 connections", etc.
    const match = displayString.match(/(\d+[\d,]*)/);
    if (match) {
      return parseInt(match[1].replace(/,/g, ""));
    }

    if (displayString.includes("500+")) return 500;
    return 0;
  }

  parseEmployeeCount(employeeRange) {
    if (!employeeRange) return null;

    const ranges = {
      SIZE_1: "1",
      SIZE_2_TO_10: "2-10",
      SIZE_11_TO_50: "11-50",
      SIZE_51_TO_200: "51-200",
      SIZE_201_TO_500: "201-500",
      SIZE_501_TO_1000: "501-1000",
      SIZE_1001_TO_5000: "1001-5000",
      SIZE_5001_TO_10000: "5001-10000",
      SIZE_10001_OR_MORE: "10000+",
    };

    return ranges[employeeRange] || "Unknown";
  }

  formatHeadquarters(headquarter) {
    if (!headquarter) return null;

    const parts = [];
    if (headquarter.city?.localized?.en_US)
      parts.push(headquarter.city.localized.en_US);
    if (headquarter.geographicArea?.localized?.en_US)
      parts.push(headquarter.geographicArea.localized.en_US);
    if (headquarter.country?.localized?.en_US)
      parts.push(headquarter.country.localized.en_US);

    return parts.join(", ") || null;
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  async checkRateLimit() {
    const now = Date.now();
    const windowStart = now - 60 * 1000; // 1-minute window

    // Clean old requests
    for (const [timestamp] of this.requestTracker) {
      if (timestamp < windowStart) {
        this.requestTracker.delete(timestamp);
      }
    }

    // Check if we're at the limit (LinkedIn allows ~100 requests per minute)
    if (this.requestTracker.size >= 90) {
      const oldestRequest = Math.min(...this.requestTracker.keys());
      const waitTime = oldestRequest + 60000 - now;

      if (waitTime > 0) {
        logger.warn(`⏳ SocialCog.io: Rate limiting - waiting ${waitTime}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    this.requestTracker.set(now, true);
  }

  updateRateLimit(headers) {
    const limit = headers["x-ratelimit-limit"];
    const remaining = headers["x-ratelimit-remaining"];
    const reset = headers["x-ratelimit-reset"];

    if (limit && remaining) {
      logger.debug(
        `📊 LinkedIn API Rate Limit: ${remaining}/${limit} remaining`
      );
    }
  }

  extractRateLimit(headers) {
    return {
      limit: parseInt(headers["x-ratelimit-limit"]) || null,
      remaining: parseInt(headers["x-ratelimit-remaining"]) || null,
      reset: parseInt(headers["x-ratelimit-reset"]) || null,
    };
  }

  // Mock data methods for fallback/development
  getMockProfile(profileUrl, errorReason = "API_LIMIT") {
    const username = this.extractProfileId(profileUrl);

    return {
      id: Math.random().toString(36).substr(2, 9),
      username: username,
      name: `Mock LinkedIn User`,
      platform: "linkedin",
      connections: Math.floor(Math.random() * 500) + 50,
      headline: "Mock Professional Title at Mock Company",
      summary: "Mock professional summary for development purposes.",
      industry: "Technology",
      location: "Global",
      profile_url: profileUrl,
      profile_image_url: `https://via.placeholder.com/128x128?text=LI`,
      verified: true,
      created_at: null,
      updated_at: new Date().toISOString(),
      fetched_by: "SocialCog.io (Mock)",
      api_version: "v2-mock",
      mock_reason: errorReason,
    };
  }

  getMockConnections(
    profileId,
    count = 10,
    errorReason = "API_ACCESS_REQUIRED"
  ) {
    const connections = [];

    for (let i = 0; i < count; i++) {
      connections.push({
        id: Math.random().toString(36).substr(2, 9),
        name: `Mock Connection ${i + 1}`,
        headline: `Mock Title ${i + 1}`,
        industry: ["Technology", "Finance", "Healthcare", "Education"][i % 4],
        location: ["New York", "San Francisco", "London", "Toronto"][i % 4],
        profile_url: `https://linkedin.com/in/mock-connection-${i + 1}`,
        profile_image_url: `https://via.placeholder.com/64x64?text=C${i + 1}`,
        platform: "linkedin",
      });
    }

    return {
      profile_id: profileId,
      count: connections.length,
      connections: connections,
      fetched_at: new Date().toISOString(),
      fetched_by: "SocialCog.io (Mock)",
      mock_reason: errorReason,
    };
  }

  getMockCompany(companyUrl, errorReason = "API_LIMIT") {
    const companyName = this.extractCompanyId(companyUrl);

    return {
      id: Math.random().toString(36).substr(2, 9),
      name: `Mock Company (${companyName})`,
      platform: "linkedin",
      description: "Mock company description for development purposes.",
      industry: "Technology",
      employee_count: "1001-5000",
      headquarters: "San Francisco, CA, USA",
      founded_year: 2010,
      website: "https://example.com",
      followers: Math.floor(Math.random() * 100000),
      logo_url: `https://via.placeholder.com/128x128?text=${companyName}`,
      profile_url: companyUrl,
      updated_at: new Date().toISOString(),
      fetched_by: "SocialCog.io (Mock)",
      api_version: "v2-mock",
      mock_reason: errorReason,
    };
  }

  getMockSearchResults(query, count = 10, errorReason = "API_LIMIT") {
    const results = [];

    for (let i = 0; i < count; i++) {
      results.push({
        id: Math.random().toString(36).substr(2, 9),
        name: `${query} Result ${i + 1}`,
        headline: `Mock Professional matching "${query}"`,
        industry: "Technology",
        location: "Global",
        profile_url: `https://linkedin.com/in/mock-search-${i + 1}`,
        profile_image_url: `https://via.placeholder.com/64x64?text=S${i + 1}`,
        platform: "linkedin",
      });
    }

    return {
      query: query,
      count: results.length,
      results: results,
      searched_at: new Date().toISOString(),
      searched_by: "SocialCog.io (Mock)",
      mock_reason: errorReason,
    };
  }

  // Cache management
  clearCache() {
    this.cache.flushAll();
    logger.info("🗑️ SocialCog.io: LinkedIn service cache cleared");
  }

  getCacheStats() {
    return {
      keys: this.cache.keys().length,
      hits: this.cache.getStats().hits,
      misses: this.cache.getStats().misses,
    };
  }
}

module.exports = LinkedInService;
