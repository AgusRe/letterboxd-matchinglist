/**
 * LETTERBOXD MATCH — Configuration File (Template)
 *
 * INSTRUCTIONS:
 * 1. Duplicate this file and rename it to `config.js` in the root directory (optional).
 * 2. Configure your Cloudflare Worker URL (reverse proxy for Letterboxd and TMDB).
 *    In production, the Worker handles TMDB authentication server-side.
 * 3. (Optional) You can provide a direct TMDB_API_KEY for local development or direct querying.
 */

window.APP_CONFIG = {
  // Cloudflare Worker Base URL (used as reverse proxy for Letterboxd & TMDB in production)
  // Default points to the deployed instance: https://letterboxd-proxy.agustin2-re.workers.dev
  WORKER_BASE_URL: "https://letterboxd-proxy.agustin2-re.workers.dev",

  // (Optional) Direct TMDB API v3 Key (32 hex characters) or v4 Bearer Read Access Token.
  // If provided, queries to TMDB go directly to the official TMDB API without proxying.
  // Useful for local testing if the Cloudflare Worker is not yet configured with TMDB secrets.
  TMDB_API_KEY: "",

  // Default region code (ISO 3166-1 alpha-2, e.g. "AR", "US", "ES", "MX") for Watch Providers
  TMDB_REGION: "AR",

  // Cache duration in hours for TMDB search & provider availability
  STREAMING_CACHE_TTL_HOURS: 48,

  // Maximum concurrent requests to TMDB to prevent rate-limiting
  TMDB_MAX_CONCURRENCY: 6
};

