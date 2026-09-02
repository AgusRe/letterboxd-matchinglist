/**
 * LETTERBOXD MATCH — Configuration File (Template)
 *
 * INSTRUCTIONS:
 * 1. Duplicate this file and rename it to `config.js` in the root directory.
 * 2. Add your TMDB (The Movie Database) v3 API key below.
 * 3. `config.js` is included in .gitignore to avoid committing sensitive keys.
 */

window.APP_CONFIG = {
  // TMDB API v3 Key (32-character hex string, e.g. "d4e1a2b3c4d5e6f7a8b9c0d1e2f3a4b5")
  // Get one for free at: https://www.themoviedb.org/settings/api
  TMDB_API_KEY: "",

  // Default region code (ISO 3166-1 alpha-2, e.g. "AR", "US", "ES", "MX") for Watch Providers
  TMDB_REGION: "AR",

  // Cache duration in hours for TMDB search & provider availability
  STREAMING_CACHE_TTL_HOURS: 48,

  // Maximum concurrent requests to TMDB to prevent rate-limiting
  TMDB_MAX_CONCURRENCY: 6
};
