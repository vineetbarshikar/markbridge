/**
 * MarkBridge – Lightweight Analytics Module
 *
 * Privacy-first, anonymous usage tracking stored entirely in
 * chrome.storage.local. No data is sent to any server.
 *
 * Tracks:
 * - Total conversions (lifetime + per day)
 * - Feature usage (copy, download, options toggled)
 * - Page types detected (Cloud, Server/DC, unknown)
 * - First install date and last active date
 *
 * Data shape in chrome.storage.local:
 * {
 *   "mb_analytics": {
 *     "installedAt": "2026-02-13T...",
 *     "lastActiveAt": "2026-02-13T...",
 *     "totalConversions": 42,
 *     "totalCopies": 30,
 *     "totalDownloads": 18,
 *     "pageTypes": { "Cloud": 30, "Server/DC": 10, "unknown": 2 },
 *     "optionUsage": {
 *       "frontmatter": 38,
 *       "title": 40,
 *       "embedImages": 25
 *     },
 *     "dailyStats": {
 *       "2026-02-13": { "conversions": 5, "copies": 3, "downloads": 2 }
 *     }
 *   }
 * }
 */

/* global chrome */

const MarkBridgeAnalytics = (function () {
  'use strict';

  const STORAGE_KEY = 'mb_analytics';

  // Keep only the last 90 days of daily stats to avoid unbounded growth
  const MAX_DAILY_ENTRIES = 90;

  /**
   * Get today's date string in YYYY-MM-DD format.
   */
  function today() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Load analytics data from chrome.storage.local.
   * @returns {Promise<Object>} The analytics data object.
   */
  async function load() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        const data = result[STORAGE_KEY] || createDefault();
        resolve(data);
      });
    });
  }

  /**
   * Save analytics data to chrome.storage.local.
   * @param {Object} data - The analytics data object.
   * @returns {Promise<void>}
   */
  async function save(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: data }, resolve);
    });
  }

  /**
   * Create a fresh analytics data object.
   */
  function createDefault() {
    return {
      installedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      totalConversions: 0,
      totalCopies: 0,
      totalDownloads: 0,
      pageTypes: {},
      optionUsage: {
        frontmatter: 0,
        title: 0,
        embedImages: 0,
      },
      dailyStats: {},
    };
  }

  /**
   * Ensure today's daily stats entry exists.
   */
  function ensureDaily(data) {
    const d = today();
    if (!data.dailyStats[d]) {
      data.dailyStats[d] = { conversions: 0, copies: 0, downloads: 0 };
    }
    return d;
  }

  /**
   * Prune old daily stats beyond MAX_DAILY_ENTRIES.
   */
  function pruneDailyStats(data) {
    const keys = Object.keys(data.dailyStats).sort();
    while (keys.length > MAX_DAILY_ENTRIES) {
      delete data.dailyStats[keys.shift()];
    }
  }

  /**
   * Track a successful conversion.
   * @param {string} pageType - "Cloud", "Server/DC", or "unknown"
   * @param {Object} options - { frontmatter: bool, title: bool, embedImages: bool }
   */
  async function trackConversion(pageType, options) {
    const data = await load();
    const d = ensureDaily(data);

    data.totalConversions++;
    data.dailyStats[d].conversions++;
    data.lastActiveAt = new Date().toISOString();

    // Page type
    const pt = pageType || 'unknown';
    data.pageTypes[pt] = (data.pageTypes[pt] || 0) + 1;

    // Option usage — only count when the option is ON
    if (options) {
      if (options.frontmatter) data.optionUsage.frontmatter++;
      if (options.title) data.optionUsage.title++;
      if (options.embedImages) data.optionUsage.embedImages++;
    }

    pruneDailyStats(data);
    await save(data);
  }

  /**
   * Track a copy-to-clipboard action.
   */
  async function trackCopy() {
    const data = await load();
    const d = ensureDaily(data);

    data.totalCopies++;
    data.dailyStats[d].copies++;
    data.lastActiveAt = new Date().toISOString();

    await save(data);
  }

  /**
   * Track a file download action.
   */
  async function trackDownload() {
    const data = await load();
    const d = ensureDaily(data);

    data.totalDownloads++;
    data.dailyStats[d].downloads++;
    data.lastActiveAt = new Date().toISOString();

    await save(data);
  }

  /**
   * Track that the popup was opened (for engagement metrics).
   */
  async function trackPopupOpen() {
    const data = await load();
    data.lastActiveAt = new Date().toISOString();
    await save(data);
  }

  /**
   * Get a summary of analytics for display in the popup.
   * @returns {Promise<Object>} Summary object.
   */
  async function getSummary() {
    const data = await load();
    const d = today();
    const todayStats = data.dailyStats[d] || { conversions: 0, copies: 0, downloads: 0 };

    return {
      totalConversions: data.totalConversions,
      totalCopies: data.totalCopies,
      totalDownloads: data.totalDownloads,
      todayConversions: todayStats.conversions,
      installedAt: data.installedAt,
      daysSinceInstall: Math.floor(
        (Date.now() - new Date(data.installedAt).getTime()) / (1000 * 60 * 60 * 24)
      ),
    };
  }

  /**
   * Reset all analytics data. Useful for debugging.
   */
  async function reset() {
    await save(createDefault());
  }

  // Public API
  return {
    trackConversion,
    trackCopy,
    trackDownload,
    trackPopupOpen,
    getSummary,
    reset,
  };
})();
