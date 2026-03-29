/**
 * @fileoverview SearchPopup - Smart text selection popup with search, copy, and unit conversion
 * @author Krasen Ivanov
 * @version 1.73.5
 * @license MIT
 * 
 * This content script provides intelligent popup functionality when users select text on web pages.
 * Features include:
 * - Smart URL detection and search engine integration
 * - Unit conversion (currency, temperature, weight, distance, etc.)
 * - Cryptocurrency price conversion
 * - Time zone conversion
 * - Clipboard operations with fallback support
 * - Theme-aware UI that adapts to page styling
 * - Performance-optimized DOM operations
 * - Comprehensive error handling and logging
 * 
 * Architecture:
 * - ErrorHandler: Centralized error management with statistics tracking
 * - PopupManager: Centralized popup state and orchestration
 * - EventManager: Optimized event handling with throttling/debouncing
 * - DOMCache: Performance-optimized DOM element caching
 * - PerformanceUtils: Throttling and debouncing utilities
 * 
 * @requires chrome.storage.sync (for preferences)
 * @requires navigator.clipboard (for clipboard API, with fallback)
 */

// Content script for handling text selection and popup display
// Copyright 2025-2026 Krasen Ivanov

// ===== CONFIGURATION AND CONSTANTS =====

/**
 * Application configuration constants
 * @namespace CONFIG
 * @readonly
 */
const CONFIG = {
  /** @type {number} Maximum characters allowed for text selection */
  MAX_SELECTION_LENGTH: 7000,
  
  /** @type {number} Minimum characters required for text selection */
  MIN_SELECTION_LENGTH: 2,
  
  /** @type {number} Delay in milliseconds before automatically hiding popup (3 seconds) */
  HIDE_DELAY: 3000,
  
  /** @type {number} Cache duration for exchange rates in milliseconds (24 hours) */
  CACHE_DURATION: 24 * 60 * 60 * 1000,
  
  /** @type {number} Cache duration for crypto rates in milliseconds (24 hours) */
  CRYPTO_CACHE_DURATION: 24 * 60 * 60 * 1000,
  
  /** @type {number} Maximum number of API retry attempts */
  MAX_API_ATTEMPTS: 3,
  
  /** @type {number} Base delay in milliseconds for API retry exponential backoff */
  BASE_RETRY_DELAY: 1000,
  
  /** @type {number} Margin in pixels from viewport edges for popup positioning */
  POPUP_MARGIN: 10,
  
  /** @type {number} Gap in pixels between selection and popup (includes arrow height) */
  ARROW_GAP: 10,
  
  /** @type {number} Fade transition duration in milliseconds */
  FADE_TRANSITION_DURATION: 200,
};

/**
 * Pre-compiled regex patterns for performance optimization
 * @namespace REGEX_PATTERNS
 * @readonly
 */
const REGEX_PATTERNS = {
  /**
   * URL detection pattern
   * @type {RegExp}
   * @example
   * REGEX_PATTERNS.url.test('https://example.com') // true
   * REGEX_PATTERNS.url.test('example.com') // true
   */
  url: /^(https?:\/\/)?(([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)(\/[^\s]*)?$/,

  /**
   * Time zone pattern for conversion
   * Supports formats: "5 PM PST", "11:30 am CET", "14:00 EST", "10:00pm PT"
   * @type {RegExp}
   */
  timeZone: /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?\s*([A-Z]{2,5})$/i,

  /**
   * Currency symbol pattern for unit detection
   * @type {string}
   */
  currencySymbol: "[a-zA-Z°/€$£¥₺₽₹₩₪₱฿₣₦₲₵₡₫₭₮₯₠₢₳₴₸₼₾₿]",

  /**
   * Value-unit pattern (number followed by unit)
   * Dynamically constructed at runtime
   * @type {RegExp|null}
   */
  valueUnit: null,

  /**
   * Unit-value pattern (unit followed by number)
   * Dynamically constructed at runtime
   * @type {RegExp|null}
   */
  unitValue: null,

  /**
   * RGBA color pattern for transparency detection
   * @type {RegExp}
   */
  rgba: /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/,

  /**
   * RGB color pattern for color parsing
   * @type {RegExp}
   */
  rgb: /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/,

  /**
   * Hex color pattern
   * @type {RegExp}
   */
  hex: /^#([a-f0-9]{3}|[a-f0-9]{6})$/i,

  /**
   * Number parsing patterns
   */
  thousandsSeparator: /[.\,\s](?=\d{3}(\D|$))/g,
  decimalComma: /,/g,
  fraction: /^(\d+)\/(\d+)$/,

  /**
   * Temperature unit pattern
   * @type {RegExp}
   */
  temperatureUnit: /^(\d+(?:\.\d+)?)\s*°\s*$/,

  /**
   * Initialize dynamic regex patterns that depend on currency symbols
   * Called once during initialization for optimal performance
   * @method
   */
  initDynamicPatterns() {
    // Construct value-unit pattern (number followed by unit)
    this.valueUnit = new RegExp(
      `^(-?\\d{1,3}(?:[.,\\s]\\d{3})*(?:[.,]\\d+)?|\\d+/\\d+)\\s*(${this.currencySymbol}+|[a-zA-Z]+(?:\\s+[a-zA-Z]+)*)[.,;:!?]*$`,
      "i",
    );

    // Construct unit-value pattern (unit followed by number)
    this.unitValue = new RegExp(
      `^(${this.currencySymbol}+|[a-zA-Z]+(?:\\s+[a-zA-Z]+)*)\\s*(-?\\d{1,3}(?:[.,\\s]\\d{3})*(?:[.,]\\d+)?|\\d+/\\d+)[.,;:!?]*$`,
      "i",
    );
  },
};

// Construct dynamic regex patterns
REGEX_PATTERNS.initDynamicPatterns();

// --- Currency Symbols Mapping ---
const CURRENCY_SYMBOLS = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  INR: "₹",
  RUB: "₽",
  KRW: "₩",
  TRY: "₺",
  BRL: "R$",
  ZAR: "R",
  MXN: "$",
  SGD: "S$",
  HKD: "HK$",
  NZD: "NZ$",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
  CHF: "Fr",
  CAD: "C$",
  AUD: "A$",
  ILS: "₪",
  RON: "lei",
  HUF: "Ft",
  CZK: "Kč",
  PHP: "₱",
  THB: "฿",
  IDR: "Rp",
  MYR: "RM",
  BGN: "лв",
};

// --- Utility Functions for Date Formatting ---

/**
 * Formats a timestamp into a human-readable relative time string
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Human-readable time difference (e.g., "today", "yesterday", "3 days ago")
 * 
 * @example
 * formatLastUpdate(Date.now() - 86400000) // "yesterday"
 * formatLastUpdate(Date.now() - 172800000) // "2 days ago"
 * formatLastUpdate(Date.now() - 3600000) // "today"
 * formatLastUpdate(0) // "unknown time"
 */
function formatLastUpdate(timestamp) {
  if (!timestamp) return "unknown time";
  
  const now = new Date();
  const lastUpdate = new Date(timestamp);
  const diffMs = now - lastUpdate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return "today";
  } else if (diffDays === 1) {
    return "yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return lastUpdate.toLocaleDateString();
  }
}

// --- Cryptocurrency Data ---
const CRYPTO_CURRENCIES = {
  BTC: "bitcoin",
  ETH: "ethereum",
  XRP: "ripple",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  ADA: "cardano",
  DOT: "polkadot",
  LINK: "chainlink",
  XLM: "stellar",
  DOGE: "dogecoin",
  USDT: "tether",
  BNB: "binancecoin",
  SOL: "solana",
  TRX: "tron",
  EOS: "eos",
  XTZ: "tezos",
  ATOM: "cosmos",
  VET: "vechain",
  ETC: "ethereum-classic",
  FIL: "filecoin",
  AAVE: "aave",
  UNI: "uniswap",
  SUSHI: "sushiswap",
  YFI: "yearn-finance",
  COMP: "compound",
  MKR: "maker",
  SNX: "synthetix-network-token",
  UMA: "uma",
  ZEC: "zcash",
  DASH: "dash",
  XMR: "monero",
  BSV: "bitcoin-sv",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
};

// --- Time Zone Abbreviations Mapping ---
const TIME_ZONE_ABBRS = {
  PST: "America/Los_Angeles",
  PDT: "America/Los_Angeles",
  PT: "America/Los_Angeles",
  MST: "America/Denver",
  MDT: "America/Denver",
  MT: "America/Denver",
  CST: "America/Chicago",
  CDT: "America/Chicago",
  CT: "America/Chicago",
  EST: "America/New_York",
  EDT: "America/New_York",
  ET: "America/New_York",
  AKST: "America/Anchorage",
  AKDT: "America/Anchorage",
  HST: "Pacific/Honolulu",
  GMT: "Etc/GMT",
  UTC: "Etc/UTC",
  CET: "Europe/Berlin",
  CEST: "Europe/Berlin",
  EET: "Europe/Helsinki",
  EEST: "Europe/Helsinki",
  BST: "Europe/London",
  IST: "Asia/Kolkata",
  JST: "Asia/Tokyo",
  KST: "Asia/Seoul",
  AEST: "Australia/Sydney",
  AEDT: "Australia/Sydney",
  ACST: "Australia/Adelaide",
  ACDT: "Australia/Adelaide",
  AWST: "Australia/Perth",
};

// --- Currency Names to ISO Codes Mapping ---
const CURRENCY_NAMES = {
  dollar: "USD",
  dollars: "USD",
  euro: "EUR",
  euros: "EUR",
  pound: "GBP",
  pounds: "GBP",
  yen: "JPY",
  won: "KRW",
  yuan: "CNY",
  ruble: "RUB",
  rubles: "RUB",
  rupee: "INR",
  rupees: "INR",
  franc: "CHF",
  francs: "CHF",
  lira: "TRY",
  liras: "TRY",
  peso: "MXN",
  pesos: "MXN", // Defaulting to Mexican Peso for generic 'peso'
  zloty: "PLN",
  zlotys: "PLN",
  kroner: "NOK", // Generic, could be SEK/DKK too but often used for one of them
  krone: "NOK",
  shekel: "ILS",
  shekels: "ILS",
  rand: "ZAR",
  real: "BRL",
  reais: "BRL",
  lev: "BGN",
  leva: "BGN",
};

// --- Unit Conversion Definitions ---
const UNIT_CONVERSIONS = {
  // Weight
  lb: { to: "kg", factor: 0.45359237 },
  lbs: { to: "kg", factor: 0.45359237 },
  pound: { to: "kg", factor: 0.45359237 },
  pounds: { to: "kg", factor: 0.45359237 },
  kg: { to: "lb", factor: 2.20462262 },
  kilogram: { to: "lb", factor: 2.20462262 },
  kilograms: { to: "lb", factor: 2.20462262 },
  kilo: { to: "lb", factor: 2.20462262 },
  kilos: { to: "lb", factor: 2.20462262 },
  oz: { to: "g", factor: 28.3495231 },
  ounce: { to: "g", factor: 28.3495231 },
  ounces: { to: "g", factor: 28.3495231 },
  g: { to: "oz", factor: 0.0352739619 },
  gram: { to: "oz", factor: 0.0352739619 },
  grams: { to: "oz", factor: 0.0352739619 },

  // Temperature
  "°F": { to: "°C", convert: (val) => ((val - 32) * 5) / 9 },
  "°C": { to: "°F", convert: (val) => (val * 9) / 5 + 32 },
  fahrenheit: { to: "°C", convert: (val) => ((val - 32) * 5) / 9 },
  celsius: { to: "°F", convert: (val) => (val * 9) / 5 + 32 },
  centigrade: { to: "°F", convert: (val) => (val * 9) / 5 + 32 },

  // Cooking Measurements
  cup: { to: "ml", factor: 236.588 },
  cups: { to: "ml", factor: 236.588 },
  cupsful: { to: "ml", factor: 236.588 },
  tbsp: { to: "ml", factor: 14.7868 },
  "tbsp.": { to: "ml", factor: 14.7868 },
  tbsps: { to: "ml", factor: 14.7868 },
  tablespoon: { to: "ml", factor: 14.7868 },
  tablespoons: { to: "ml", factor: 14.7868 },
  tsp: { to: "ml", factor: 4.92892 },
  "tsp.": { to: "ml", factor: 4.92892 },
  tsps: { to: "ml", factor: 4.92892 },
  teaspoon: { to: "ml", factor: 4.92892 },
  teaspoons: { to: "ml", factor: 4.92892 },
  "fl oz": { to: "ml", factor: 29.5735 },
  floz: { to: "ml", factor: 29.5735 },
  "fluid ounce": { to: "ml", factor: 29.5735 },
  "fluid ounces": { to: "ml", factor: 29.5735 },
  pint: { to: "ml", factor: 473.176 },
  pints: { to: "ml", factor: 473.176 },
  quart: { to: "ml", factor: 946.353 },
  quarts: { to: "ml", factor: 946.353 },
  gallon: { to: "ml", factor: 3785.41 },
  gallons: { to: "ml", factor: 3785.41 },

  // Speed
  mph: { to: "km/h", factor: 1.609344 },
  milesperhour: { to: "km/h", factor: 1.609344 },
  "miles per hour": { to: "km/h", factor: 1.609344 },
  "km/h": { to: "mph", factor: 0.621371192 },
  kph: { to: "mph", factor: 0.621371192 },
  kmh: { to: "mph", factor: 0.621371192 },
  kilometersperhour: { to: "mph", factor: 0.621371192 },
  "kilometers per hour": { to: "mph", factor: 0.621371192 },
  mpg: { to: "l/100km", convert: (val) => 235.214583 / val },
  "l/100km": { to: "mpg", convert: (val) => 235.214583 / val },

  // Volume
  gal: { to: "l", factor: 3.78541178 },
  l: { to: "gal", factor: 0.264172052 },
  liter: { to: "gal", factor: 0.264172052 },
  litre: { to: "gal", factor: 0.264172052 },
  qt: { to: "l", factor: 0.946352946 },
  fl: { to: "ml", factor: 29.5735295625 },
  ml: { to: "fl", factor: 0.0338140227 },
  milliliter: { to: "fl", factor: 0.0338140227 },
  millilitre: { to: "fl", factor: 0.0338140227 },

  // Distance
  mi: { to: "km", factor: 1.609344 },
  mile: { to: "km", factor: 1.609344 },
  miles: { to: "km", factor: 1.609344 },
  km: { to: "mi", factor: 0.621371192 },
  kilometer: { to: "mi", factor: 0.621371192 },
  kilometre: { to: "mi", factor: 0.621371192 },
  kilometers: { to: "mi", factor: 0.621371192 },
  kilometres: { to: "mi", factor: 0.621371192 },
  yd: { to: "m", factor: 0.9144 },
  yard: { to: "m", factor: 0.9144 },
  yards: { to: "m", factor: 0.9144 },
  m: { to: "yd", factor: 1.0936133 },
  meter: { to: "yd", factor: 1.0936133 },
  metre: { to: "yd", factor: 1.0936133 },
  meters: { to: "yd", factor: 1.0936133 },
  metres: { to: "yd", factor: 1.0936133 },
  ft: { to: "m", factor: 0.3048 },
  foot: { to: "m", factor: 0.3048 },
  feet: { to: "m", factor: 0.3048 },
  in: { to: "cm", factor: 2.54 },
  inch: { to: "cm", factor: 2.54 },
  inches: { to: "cm", factor: 2.54 },
  centimeter: { to: "in", factor: 0.393700787 },
  centimetre: { to: "in", factor: 0.393700787 },
  centimeters: { to: "in", factor: 0.393700787 },
  centimetres: { to: "in", factor: 0.393700787 },
  cm: { to: "in", factor: 0.393700787 },
  mm: { to: "in", factor: 0.0393700787 },
  millimeter: { to: "in", factor: 0.0393700787 },
  millimetre: { to: "in", factor: 0.0393700787 },
  millimeters: { to: "in", factor: 0.0393700787 },
  millimetres: { to: "in", factor: 0.0393700787 },

  // Power
  kW: { to: "hp", factor: 1.34102209 },
  kilowatt: { to: "hp", factor: 1.34102209 },
  kilowatts: { to: "hp", factor: 1.34102209 },
  hp: { to: "kW", factor: 0.745699872 },
  horsepower: { to: "kW", factor: 0.745699872 },
  "horse power": { to: "kW", factor: 0.745699872 },

  // Torque
  "lb ft": { to: "Nm", factor: 1.35581795 },
  "lb-ft": { to: "Nm", factor: 1.35581795 },
  poundfoot: { to: "Nm", factor: 1.35581795 },
  "pound-foot": { to: "Nm", factor: 1.35581795 },
  "pound feet": { to: "Nm", factor: 1.35581795 },
  Nm: { to: "lb ft", factor: 0.737562149 },
  newtonmeter: { to: "lb ft", factor: 0.737562149 },
  "newton-meter": { to: "lb ft", factor: 0.737562149 },
  "newton metres": { to: "lb ft", factor: 0.737562149 },

  // Nautical Distance
  nmi: { to: "km", factor: 1.852 },
  "nautical mile": { to: "km", factor: 1.852 },
  "nautical miles": { to: "km", factor: 1.852 },
  
  // Bitcoin Subunits (only works when crypto API is available)
  BITS: { 
    to: "USD", 
    convert: (val) => val * 0.000001 * (cryptoRates.prices?.bitcoin?.usd || 0) 
  }, // 1 bit = 0.000001 BTC, then convert to USD
  SATS: { 
    to: "USD", 
    convert: (val) => val * 0.00000001 * (cryptoRates.prices?.bitcoin?.usd || 0) 
  }, // 1 satoshi = 0.00000001 BTC, then convert to USD
};

// ===== ERROR HANDLING SYSTEM =====

// --- Centralized error handling for consistent error management ---
const ErrorHandler = {
  // Error statistics tracking
  stats: {
    total: 0,
    byContext: {},
    byLevel: { error: 0, warn: 0, info: 0 },
    recent: [] // Keep last 10 errors for debugging
  },

  /**
   * Log an error with context and appropriate level
   * @param {Error|string} error - The error to log
   * @param {string} context - Context where the error occurred
   * @param {string} level - Log level ('error', 'warn', 'info')
   */
  log(error, context, level = 'warn') {
    const timestamp = new Date().toISOString();
    const message = error instanceof Error ? error.message : error;
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}`;
    
    // Update statistics
    this.stats.total++;
    this.stats.byLevel[level] = (this.stats.byLevel[level] || 0) + 1;
    this.stats.byContext[context] = (this.stats.byContext[context] || 0) + 1;
    
    // Keep recent errors for debugging
    this.stats.recent.unshift({
      timestamp,
      message,
      context,
      level,
      stack: error instanceof Error ? error.stack : null
    });
    if (this.stats.recent.length > 10) {
      this.stats.recent.pop();
    }
    
    // Output to console with appropriate level
    switch (level) {
      case 'error':
        console.error(logMessage);
        if (error instanceof Error && error.stack) {
          console.error('Stack trace:', error.stack);
        }
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'info':
        // console.info(logMessage); // no basic console log in production
        break;
      default:
        // console.log(logMessage); // no basic console log in production
    }
  },

  /**
   * Get error statistics for debugging
   */
  getStats() {
    return { ...this.stats };
  },

  /**
   * Clear error statistics
   */
  clearStats() {
    this.stats = {
      total: 0,
      byContext: {},
      byLevel: { error: 0, warn: 0, info: 0 },
      recent: []
    };
  },

  /**
   * Handle API errors with fallback and retry logic
   * @param {Error} error - The API error
   * @param {string} context - API context (e.g., 'exchange-rates', 'crypto-rates')
   * @param {Function} fallback - Fallback function to execute
   * @param {Object} options - Additional options
   */
  handleApiError(error, context, fallback = null, options = {}) {
    const { retryCount = 0, maxRetries = 3 } = options;
    
    // Enhanced error logging with more details
    const errorDetails = {
      message: error.message,
      name: error.name,
      context: context,
      timestamp: new Date().toISOString(),
      retryCount,
      userAgent: navigator.userAgent,
      url: this.getLastApiUrl(context)
    };
    
    this.log(`API Error Details: ${JSON.stringify(errorDetails, null, 2)}`, context, 'error');
    
    // Determine error type and provide appropriate message
    let userMessage = 'Service temporarily unavailable';
    if (error.message.includes('Rate limit')) {
      userMessage = 'Rate limit exceeded. Please try again later.';
    } else if (error.message.includes('CORS') || error.message.includes('blocked')) {
      userMessage = 'Service access blocked. Using cached data.';
    } else if (error.message.includes('Network') || error.message.includes('ERR_FAILED')) {
      userMessage = 'Network error. Using cached data.';
    } else if (error.message.includes('Failed to fetch')) {
      userMessage = 'Fetch failed - possible network interception or DNS issue.';
    } else if (error.message.includes('429')) {
      userMessage = 'Too many requests. Please try again later.';
    } else if (error.message.includes('403')) {
      userMessage = 'Access forbidden. Using cached data.';
    }
    
    // Log retry information if applicable
    if (retryCount > 0) {
      this.log(`Retry attempt ${retryCount}/${maxRetries}`, `${context}-retry`, 'info');
    }
    
    // Execute fallback if provided
    if (fallback && typeof fallback === 'function') {
      try {
        fallback(userMessage);
      } catch (fallbackError) {
        this.log(fallbackError, `${context}-fallback`, 'error');
      }
    }
    
    return userMessage;
  },

  /**
   * Store last API URL for debugging
   */
  lastApiUrls: {
    'crypto-rates': null,
    'exchange-rates': null
  },

  /**
   * Get last API URL for error context
   */
  getLastApiUrl(context) {
    return this.lastApiUrls[context] || 'unknown';
  },

  /**
   * Set last API URL for error context
   */
  setLastApiUrl(context, url) {
    this.lastApiUrls[context] = url;
  },

  /**
   * Handle DOM errors with appropriate fallback
   * @param {Error} error - The DOM error
   * @param {string} context - DOM operation context
   * @param {boolean} silent - Whether to suppress user-facing messages
   */
  handleDomError(error, context, silent = false) {
    this.log(error, context, silent ? 'info' : 'warn');
    
    // For cross-origin iframe errors, handle silently
    if (error.message.includes('cross-origin') || error.message.includes('SecurityError')) {
      return null;
    }
    
    // Return error state for UI updates
    return this.createErrorState('DOM operation failed', context);
  },

  /**
   * Create a standardized error state object
   * @param {string} message - Error message
   * @param {string} context - Error context
   * @param {Object} additional - Additional error data
   */
  createErrorState(message, context, additional = {}) {
    return {
      error: true,
      message,
      context,
      timestamp: Date.now(),
      ...additional
    };
  },

  /**
   * Wrap a function with error handling
   * @param {Function} fn - Function to wrap
   * @param {string} context - Error context
   * @param {Function} errorHandler - Custom error handler
   */
  wrap(fn, context, errorHandler = null) {
    return (...args) => {
      try {
        return fn(...args);
      } catch (error) {
        if (errorHandler && typeof errorHandler === 'function') {
          return errorHandler(error, context);
        } else {
          this.handleDomError(error, context);
          return null;
        }
      }
    };
  },

  /**
   * Wrap an async function with error handling
   * @param {Function} fn - Async function to wrap
   * @param {string} context - Error context
   * @param {Function} errorHandler - Custom error handler
   */
  wrapAsync(fn, context, errorHandler = null) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        if (errorHandler && typeof errorHandler === 'function') {
          return errorHandler(error, context);
        } else {
          return this.handleApiError(error, context);
        }
      }
    };
  },

  /**
   * Log performance metrics
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {Object} metadata - Additional metadata
   */
  logPerformance(operation, duration, metadata = {}) {
    const level = duration > 1000 ? 'warn' : duration > 500 ? 'info' : 'info';
    const message = `Operation "${operation}" took ${duration}ms`;
    this.log(message, `performance-${operation}`, level);
    
    // Log additional metadata if provided
    if (Object.keys(metadata).length > 0) {
      this.log(`Metadata: ${JSON.stringify(metadata)}`, `performance-${operation}-metadata`, 'info');
    }
  },

  /**
   * Log user interactions for debugging
   * @param {string} action - User action
   * @param {Object} details - Action details
   */
  logUserAction(action, details = {}) {
    const message = `User action: ${action}`;
    this.log(message, `user-action-${action}`, 'info');
    
    if (Object.keys(details).length > 0) {
      this.log(`Action details: ${JSON.stringify(details)}`, `user-action-${action}-details`, 'info');
    }
  }
};

// ===== PERFORMANCE VALIDATION SYSTEM =====

/**
 * Performance monitoring and validation system
 * @namespace PerformanceValidator
 * @readonly
 */
const PerformanceValidator = {
  // Performance metrics tracking
  metrics: {
    popupShowTimes: [],
    conversionTimes: [],
    apiCallTimes: [],
    domOperationTimes: [],
  },

  /**
   * Start timing an operation
   * @param {string} operation - Operation name to track
   * @returns {number} Start timestamp
   */
  startTimer(operation) {
    return performance.now();
  },

  /**
   * End timing an operation and record the result
   * @param {string} operation - Operation name
   * @param {number} startTime - Start timestamp from startTimer()
   * @returns {number} Duration in milliseconds
   */
  endTimer(operation, startTime) {
    const duration = performance.now() - startTime;
    this.recordMetric(operation, duration);
    return duration;
  },

  /**
   * Record a performance metric
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   */
  recordMetric(operation, duration) {
    if (!this.metrics[operation + 'Times']) {
      this.metrics[operation + 'Times'] = [];
    }
    
    this.metrics[operation + 'Times'].push({
      duration,
      timestamp: Date.now()
    });

    // Keep only last 50 measurements to prevent memory leaks
    if (this.metrics[operation + 'Times'].length > 50) {
      this.metrics[operation + 'Times'].shift();
    }

    // Log performance warnings for slow operations
    if (duration > 100) {
      ErrorHandler.logPerformance(operation, duration, { 
        warning: 'Slow operation detected',
        threshold: '100ms'
      });
    }
  },

  /**
   * Get performance statistics for an operation
   * @param {string} operation - Operation name
   * @returns {Object} Performance statistics
   */
  getStats(operation) {
    const times = this.metrics[operation + 'Times'] || [];
    if (times.length === 0) return null;

    const durations = times.map(t => t.duration);
    return {
      count: durations.length,
      average: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      median: this.calculateMedian(durations),
      p95: this.calculatePercentile(durations, 95),
      recent: times.slice(-10) // Last 10 measurements
    };
  },

  /**
   * Calculate median value
   * @param {number[]} values - Array of values
   * @returns {number} Median value
   */
  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  },

  /**
   * Calculate percentile value
   * @param {number[]} values - Array of values
   * @param {number} percentile - Percentile to calculate (0-100)
   * @returns {number} Percentile value
   */
  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  },

  /**
   * Validate performance against expected thresholds
   * @returns {Object} Validation results
   */
  validatePerformance() {
    const results = {
      passed: true,
      violations: [],
      summary: {}
    };

    const thresholds = {
      popupShow: 50, // ms
      conversion: 100, // ms
      apiCall: 2000, // ms
      domOperation: 20 // ms
    };

    for (const [operation, threshold] of Object.entries(thresholds)) {
      const stats = this.getStats(operation);
      if (stats && stats.p95 > threshold) {
        results.passed = false;
        results.violations.push({
          operation,
          threshold,
          actual: stats.p95,
          severity: stats.p95 > threshold * 2 ? 'high' : 'medium'
        });
      }
      results.summary[operation] = stats;
    }

    return results;
  },

  /**
   * Clear all performance metrics
   */
  clearMetrics() {
    Object.keys(this.metrics).forEach(key => {
      this.metrics[key] = [];
    });
  }
};

// --- DOM Caching System for Performance Optimization ---
const DOMCache = {
  // Cached DOM elements
  searchButton: null,
  copyButton: null,
  conversionContainer: null,
  errorContainer: null,
  convertedValueSpan: null,
  copyConvertedButton: null,
  buttonContainer: null,

  /**
   * Initialize DOM cache by storing references to frequently accessed elements
   * Updated to work with optimized DOM structure
   */
  init() {
    // Cache main popup elements using the optimized structure
    this.searchButton = shadowRoot.getElementById("extensionSearchButton");
    this.copyButton = shadowRoot.getElementById("extensionCopyButton");
    this.conversionContainer = shadowRoot.getElementById("conversionContainer");
    this.errorContainer = shadowRoot.getElementById("errorContainer");

    // Cache nested elements with fallback for optimized structure
    if (this.conversionContainer) {
      this.convertedValueSpan =
        this.conversionContainer.querySelector(".converted-value");
      this.copyConvertedButton =
        this.conversionContainer.querySelector(".copy-button");
    }

    // Cache button container
    this.buttonContainer =
      shadowRoot.querySelector('[style*="display: flex"]') ||
      shadowRoot.querySelector('div[style*="flex"]');

    // Store references to optimized elements if available
    if (typeof popupElements !== "undefined") {
      this.searchButton = this.searchButton || popupElements.searchButton;
      this.copyButton = this.copyButton || popupElements.copyButton2;
      this.conversionContainer =
        this.conversionContainer || popupElements.conversionContainer;
      this.errorContainer = this.errorContainer || popupElements.errorContainer;
      this.convertedValueSpan =
        this.convertedValueSpan || popupElements.convertedValueSpan;
      this.copyConvertedButton =
        this.copyConvertedButton || popupElements.copyButton;
      this.buttonContainer =
        this.buttonContainer || popupElements.buttonContainer;
    }
  },

  /**
   * Get cached element or fallback to DOM query
   * @param {string} elementKey - Key for the cached element
   * @returns {Element|null} - The cached element or null
   */
  get(elementKey) {
    const element = this[elementKey];
    return element || null;
  },

  /**
   * Clear cache (useful for cleanup or re-initialization)
   */
  clear() {
    this.searchButton = null;
    this.copyButton = null;
    this.conversionContainer = null;
    this.errorContainer = null;
    this.convertedValueSpan = null;
    this.copyConvertedButton = null;
    this.buttonContainer = null;
  },
};

// ===== PERFORMANCE UTILITIES =====

// --- Performance optimization utilities for throttling and debouncing ---
const PerformanceUtils = {
  /**
   * Throttles a function to execute at most once per specified time limit
   * @param {Function} func - The function to throttle
   * @param {number} limit - The time limit in milliseconds
   * @returns {Function} - The throttled function
   */
  throttle(func, limit) {
    let inThrottle;
    return function () {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  /**
   * Debounces a function to execute only after it hasn't been called for specified delay
   * @param {Function} func - The function to debounce
   * @param {number} delay - The delay in milliseconds
   * @returns {Function} - The debounced function
   */
  debounce(func, delay) {
    let timeoutId;
    return function () {
      const args = arguments;
      const context = this;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(context, args), delay);
    };
  },
};

// ===== POPUP MANAGEMENT SYSTEM =====

// --- Centralized popup management with simplified orchestration ---
const PopupManager = {
  isVisible: false,
  currentSelection: null,
  hideTimeout: null,
  lastSelection: null,
  showDebounceTimeout: null,
  isShowing: false,
  mouseDownTimeout: null,

  /**
   * Initialize popup manager
   */
  init() {
    this.bindEvents();
    initPopupButtons();
  },

  /**
   * Show popup with optimal positioning
   */
  async show(rect, selectionContextElement) {
    // Clear any existing show debounce timeout
    if (this.showDebounceTimeout) {
      clearTimeout(this.showDebounceTimeout);
      this.showDebounceTimeout = null;
    }

    // Check if selection has changed
    if (this.lastSelection === currentSelectedText && this.isVisible) {
      return; // Same selection already showing, don't redraw
    }

    // Prevent rapid successive shows
    if (this.isShowing) {
      return;
    }

    this.isShowing = true;

    const startTime = PerformanceValidator.startTimer('popupShow');
    
    this.lastSelection = currentSelectedText;
    this.currentSelection = currentSelectedText;
    this.isVisible = true;

    // Log user action for debugging
    ErrorHandler.logUserAction('popup-show', { 
      textLength: this.currentSelection?.length,
      position: { x: rect.left, y: rect.top }
    });

    try {
      await showAndPositionPopup(rect, selectionContextElement);
    } finally {
      this.isShowing = false;
    }
    
    PerformanceValidator.endTimer('popupShow', startTime);
  },

  /**
   * Hide popup with cleanup
   */
  hide() {
    if (!this.isVisible) return;

    this.isVisible = false;
    this.currentSelection = null;
    clearTimeout(this.hideTimeout);
    clearTimeout(this.mouseDownTimeout);
    clearTimeout(this.showDebounceTimeout);

    hidePopup();

    // Log user action for debugging
    ErrorHandler.logUserAction('popup-hide');
  },

  /**
   * Schedule auto-hide with delay
   */
  scheduleAutoHide() {
    this.hideTimeout = setTimeout(() => {
      this.hide();
    }, CONFIG.HIDE_DELAY);
  },

  /**
   * Cancel scheduled auto-hide
   */
  cancelAutoHide() {
    clearTimeout(this.hideTimeout);
  },

  /**
   * Check if click target is within popup
   */
  isPopupTarget(target) {
    return shadowHost.contains(target);
  },

  /**
   * Handle mouse up events for text selection
   */
  handleMouseUp(e) {
    if (this.isPopupTarget(e.target)) return;

    // Clear any pending mouse down timeout to prevent race conditions
    if (this.mouseDownTimeout) {
      clearTimeout(this.mouseDownTimeout);
      this.mouseDownTimeout = null;
    }

    let selection, selectedTextTrimmed, range, rect;
    try {
      selection = window.getSelection();
      selectedTextTrimmed = selection.toString().trim();
    } catch (err) {
      // Handle cross-origin iframe errors silently
      ErrorHandler.handleDomError(err, 'selection-get', true);
      return;
    }

    // Validate selection length
    if (
      selectedTextTrimmed &&
      selectedTextTrimmed.length >= CONFIG.MIN_SELECTION_LENGTH &&
      selectedTextTrimmed.length <= CONFIG.MAX_SELECTION_LENGTH
    ) {
      currentSelectedText = selectedTextTrimmed;
      try {
        range = selection.getRangeAt(0);
        rect = range.getBoundingClientRect();
      } catch (err) {
        // Handle cross-origin iframe errors silently
        ErrorHandler.handleDomError(err, 'selection-range', true);
        return;
      }
      
      if (rect.width > 0 || rect.height > 0) {
        // Debounce the show operation to handle rapid double-clicks
        this.showDebounceTimeout = setTimeout(() => {
          this.show(rect, range.commonAncestorContainer);
          // Schedule auto-hide after short delay
          setTimeout(() => {
            this.scheduleAutoHide();
          }, 100);
        }, 50); // Small delay to handle double-click scenarios
      } else {
        this.hide();
      }
    } else if (!this.isPopupTarget(e.target)) {
      this.hide();
    }
  },

  /**
   * Handle mouse down events
   */
  handleMouseDown(e) {
    this.cancelAutoHide();
    
    // Debounce hide operation to prevent race with mouse up
    if (this.isVisible && !this.isPopupTarget(e.target)) {
      // Use a timeout to check if this is part of a double-click
      this.mouseDownTimeout = setTimeout(() => {
        this.hide();
      }, 100); // Wait to see if mouse up follows quickly (double-click)
    }
  },

  /**
   * Bind popup events
   */
  bindEvents() {
    // Events are now handled by EventManager
    // This method is kept for consistency but doesn't need to bind individual events
  }
};

// ===== EVENT MANAGEMENT SYSTEM =====

// --- Centralized event management with performance optimizations ---
const EventManager = {
  /**
   * Initialize the event management system
   */
  init() {
    this.createOptimizedHandlers();
    this.bindEvents();
  },

  /**
   * Create throttled and debounced handlers for performance optimization
   */
  createOptimizedHandlers() {
    // Throttle scroll events to maximum 10 times per second (100ms intervals)
    this.throttledScrollHandler = PerformanceUtils.throttle(() => {
      if (PopupManager.isVisible) {
        PopupManager.hide();
      }
    }, 100);

    // Debounce resize events to execute once after 250ms of inactivity
    this.debouncedResizeHandler = PerformanceUtils.debounce(() => {
      if (PopupManager.isVisible) {
        PopupManager.hide();
      }
    }, 250);
  },

  /**
   * Bind all event listeners with optimized handlers
   */
  bindEvents() {
    document.addEventListener("mouseup", PopupManager.handleMouseUp.bind(PopupManager));
    document.addEventListener("mousedown", PopupManager.handleMouseDown.bind(PopupManager));
    window.addEventListener("scroll", this.throttledScrollHandler, {
      passive: true,
    });
    window.addEventListener("resize", this.debouncedResizeHandler, {
      passive: true,
    });

    // Error handlers
    window.addEventListener("error", this.handleError.bind(this));
    window.addEventListener(
      "unhandledrejection",
      this.handleUnhandledRejection.bind(this),
    );
  },

  /**
   * Handle global errors
   * @param {ErrorEvent} event - The error event
   */
  handleError(event) {
    ErrorHandler.handleDomError(event.error || new Error(event.message), 'global-error', true);
    // Prevent error from bubbling up
    event.preventDefault();
    return false;
  },

  /**
   * Handle unhandled promise rejections
   * @param {PromiseRejectionEvent} event - The promise rejection event
   */
  handleUnhandledRejection(event) {
    ErrorHandler.handleDomError(event.reason || new Error('Unhandled promise rejection'), 'unhandled-promise-rejection', true);
    // Prevent error from bubbling up
    event.preventDefault();
    return false;
  },
};

// --- Global variable to store the currently selected text ---
let currentSelectedText = "";
let isUrlSelected = false;
let convertedValue = null;
let exchangeRatesError = null;
let cryptoRatesError = null;
let isSelectionComplete = false;

// --- Preferred currency (default to BGN) ---
let preferredCurrency = "BGN";
let preferredCryptoCurrency = "USD";
let preferredSearchEngine = "google";

// --- Currency exchange rates cache ---
let exchangeRates = {
  // Store as Unix epoch (ms) to survive JSON serialisation
  lastUpdated: 0,
  rates: {
    // Default rates will be populated from API
    EUR: 1.95583, // Default EUR to BGN rate
    USD: 1.8, // Default USD to BGN rate
    GBP: 2.3, // Default GBP to BGN rate
  },
};

let cryptoRates = {
  lastUpdated: 0,
  prices: {}, // e.g., { bitcoin: { usd: 50000 } }
};

// Fetch all preferences from chrome.storage.sync
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
  chrome.storage.sync.get(
    ["preferredCurrency", "preferredCryptoCurrency", "preferredSearchEngine"],
    (result) => {
      if (result.preferredCurrency) {
        preferredCurrency = result.preferredCurrency;
      }
      if (result.preferredCryptoCurrency) {
        preferredCryptoCurrency = result.preferredCryptoCurrency;
      }
      if (result.preferredSearchEngine) {
        preferredSearchEngine = result.preferredSearchEngine;
      }
      // Fetch rates once on startup for caching
      fetchExchangeRates();
      fetchCryptoRates();
    },
  );
} else {
  fetchExchangeRates();
  fetchCryptoRates();
}

async function fetchCryptoRates() {
  const now = Date.now();
  if (
    cryptoRates.lastUpdated &&
    now - cryptoRates.lastUpdated < CONFIG.CRYPTO_CACHE_DURATION
  ) {
    return;
  }

  const coinIds = Object.values(CRYPTO_CURRENCIES).join(",");
  let vsCurrency = preferredCryptoCurrency
    ? preferredCryptoCurrency.toLowerCase()
    : "usd";
  let fetchVs = vsCurrency;
  if (vsCurrency === "bgn") fetchVs = "eur"; // Fetch EUR if BGN is selected
  
  // Store the API URL for debugging
  const apiUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=${fetchVs}`;
  ErrorHandler.setLastApiUrl('crypto-rates', apiUrl);
  
  const handleCryptoError = (errorMessage) => {
    cryptoRatesError = errorMessage;
    
    // Try to load from cache
    const cached = localStorage.getItem("cryptoRates");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.prices && parsed.lastUpdated) {
          cryptoRates = parsed;
          const lastUpdateFormatted = formatLastUpdate(parsed.lastUpdated);
          ErrorHandler.log(`Using cached crypto rates from ${lastUpdateFormatted}`, 'crypto-rates-cache', 'info');
          cryptoRatesError = `Using crypto prices from ${lastUpdateFormatted} (API unavailable)`;
        }
      } catch (parseError) {
        ErrorHandler.log(parseError, 'crypto-rates-cache-parse', 'error');
        cryptoRatesError = "Crypto data unavailable (cache corrupted)";
      }
    } else {
      ErrorHandler.log("No cached crypto data available", 'crypto-rates-cache', 'warn');
      cryptoRatesError = "No crypto data available (API and cache unavailable)";
    }
  };
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        mode: 'cors'
      }
    );
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      } else if (response.status === 403) {
        throw new Error("API access forbidden. Using cached data.");
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }
    
    const data = await response.json();
    if (!data) {
      throw new Error("Invalid response format from CoinGecko API");
    }

    cryptoRates.prices = data;
    cryptoRates.lastUpdated = now;
    cryptoRatesError = null; // Clear error on success

    // Add to UNIT_CONVERSIONS
    for (const [symbol, id] of Object.entries(CRYPTO_CURRENCIES)) {
      if (cryptoRates.prices[id] && cryptoRates.prices[id][fetchVs]) {
        let convertFn;
        let toLabel = preferredCryptoCurrency;
        if (
          vsCurrency === "bgn" &&
          exchangeRates.rates &&
          exchangeRates.rates["EUR"]
        ) {
          // Convert EUR price to BGN
          convertFn = (val) =>
            val * cryptoRates.prices[id]["eur"] * exchangeRates.rates["EUR"];
          toLabel = "BGN";
        } else {
          convertFn = (val) => val * cryptoRates.prices[id][fetchVs];
        }
        UNIT_CONVERSIONS[symbol] = {
          to: toLabel,
          convert: convertFn,
        };
      }
    }

    localStorage.setItem("cryptoRates", JSON.stringify(cryptoRates));
  } catch (error) {
    ErrorHandler.handleApiError(error, 'crypto-rates', handleCryptoError);
  }
}

// ... (rest of the code remains the same)
let apiCallAttempts = 0;
// --- Exchange Rate API Service ---
async function fetchExchangeRates() {
  // Check if we need to update rates (once per day)
  const now = Date.now();
  if (
    exchangeRates.lastUpdated &&
    now - exchangeRates.lastUpdated < CONFIG.CACHE_DURATION
  ) {
    return; // Use cached rates if less than 24 hours old
  }

  // Rate limiting check
  if (apiCallAttempts >= CONFIG.MAX_API_ATTEMPTS) {
    exchangeRatesError =
      "Exchange rates temporarily unavailable. Using cached rates.";
    return;
  }

  // Store the API URL for debugging
  const apiUrl = "https://api.exchangerate-api.com/v4/latest/EUR";
  ErrorHandler.setLastApiUrl('exchange-rates', apiUrl);

  const handleExchangeError = (errorMessage) => {
    exchangeRatesError = errorMessage;
    
    // Load from localStorage if available (only when max retries reached)
    try {
      const cached = localStorage.getItem("exchangeRates");
      if (cached) {
        const parsed = JSON.parse(cached);
        // Validate cached data structure
        if (
          parsed &&
          typeof parsed === "object" &&
          parsed.rates &&
          typeof parsed.rates === "object" &&
          parsed.lastUpdated &&
          typeof parsed.lastUpdated === "number"
        ) {
          // Validate that cached data is not too old (more than 7 days)
          const now = Date.now();
          const cacheAge = now - parsed.lastUpdated;
          const maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
          if (cacheAge < maxCacheAge) {
            exchangeRates = parsed;
            ErrorHandler.log(`Using cached exchange rates from ${formatLastUpdate(parsed.lastUpdated)}`, 'exchange-rates-cache', 'info');
          } else {
            // Reset to default rates
            exchangeRates = {
              lastUpdated: 0, // Force refresh on next call
              rates: {
                EUR: 1.95583,
                USD: 1.8,
                GBP: 2.3,
              },
            };
            ErrorHandler.log("Cached exchange rates expired, using defaults", 'exchange-rates-cache', 'warn');
          }
        } else {
          // Reset to default rates
          exchangeRates = {
            lastUpdated: 0, // Force refresh on next call
            rates: {
              EUR: 1.95583,
              USD: 1.8,
              GBP: 2.3,
            },
          };
          ErrorHandler.log("Invalid cached exchange rates structure, using defaults", 'exchange-rates-cache', 'warn');
        }
      } else {
        // Reset to default rates
        exchangeRates = {
          lastUpdated: 0, // Force refresh on next call
          rates: {
            EUR: 1.95583,
            USD: 1.8,
            GBP: 2.3,
          },
        };
        ErrorHandler.log("No cached exchange rates available, using defaults", 'exchange-rates-cache', 'warn');
      }
    } catch (parseError) {
      ErrorHandler.log(parseError, 'exchange-rates-cache-parse', 'error');
      // Reset to default rates
      exchangeRates = {
        lastUpdated: 0, // Force refresh on next call
        rates: {
          EUR: 1.95583,
          USD: 1.8,
          GBP: 2.3,
        },
      };
    }
  };
  
  try {
    apiCallAttempts++;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Validate response data structure
    if (!data || !data.rates || typeof data.rates !== "object") {
      throw new Error("Invalid response format from exchange rate API");
    }

    // Reset API attempts on success
    apiCallAttempts = 0;
    exchangeRatesError = null; // Clear error on success

    // Update rates (converting to preferredCurrency)
    exchangeRates.rates = {};
    const target = preferredCurrency || "BGN";

    for (const [currency, rate] of Object.entries(data.rates)) {
      if (typeof rate !== "number" || isNaN(rate)) {
        continue;
      }
      // Calculate conversion rate to preferred currency
      if (currency !== target) {
        exchangeRates.rates[currency] = data.rates[target] / rate;
      } else {
        exchangeRates.rates[currency] = 1; // Correct: base currency rate is always 1
      }
      // Add currency conversion to UNIT_CONVERSIONS
      if (currency !== target) {
        UNIT_CONVERSIONS[currency] = {
          to: target,
          convert: (val) => val * exchangeRates.rates[currency],
        };
        // Add symbol conversion if available
        if (CURRENCY_SYMBOLS[currency]) {
          UNIT_CONVERSIONS[CURRENCY_SYMBOLS[currency]] = {
            to: target,
            convert: (val) => val * exchangeRates.rates[currency],
          };
        }
      }
    }

    // Add currency names to UNIT_CONVERSIONS
    for (const [name, code] of Object.entries(CURRENCY_NAMES)) {
      if (exchangeRates.rates[code] && code !== target) {
        UNIT_CONVERSIONS[name] = {
          to: target,
          convert: (val) => val * exchangeRates.rates[code],
        };
      }
    }
    exchangeRates.lastUpdated = now; // store epoch ms
    // Save to localStorage
    try {
      localStorage.setItem("exchangeRates", JSON.stringify(exchangeRates));
    } catch (storageError) {
      ErrorHandler.log(storageError, 'exchange-rates-storage', 'warn');
    }
  } catch (error) {
    // Exponential backoff for retries
    if (apiCallAttempts < CONFIG.MAX_API_ATTEMPTS) {
      const retryDelay =
        CONFIG.BASE_RETRY_DELAY * Math.pow(2, apiCallAttempts - 1);
      ErrorHandler.log(`Retrying exchange rates fetch in ${retryDelay}ms`, 'exchange-rates-retry', 'info');
      setTimeout(() => fetchExchangeRates(), retryDelay);
      return; // Exit early to prevent fallback execution during retry attempts
    }
    ErrorHandler.handleApiError(error, 'exchange-rates', handleExchangeError);
  }
}

// ===== CONVERSION ENGINE =====

// --- Time Zone Conversion ---
function convertTimeZone(
  text,
  userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  // 12-hour: 5 PM PST, 11:30 am CET, 10:00pm PT; 24-hour: 14:00 EST
  const matchTZ = text.trim().match(REGEX_PATTERNS.timeZone);
  if (!matchTZ) return null;
  let hour = parseInt(matchTZ[1], 10);
  let minute = matchTZ[2] ? parseInt(matchTZ[2], 10) : 0;
  let ampm = matchTZ[3] ? matchTZ[3].toUpperCase() : null;
  let tz = matchTZ[4].toUpperCase();
  if (isNaN(hour) || hour < 0 || hour > 23 || minute < 0 || minute > 59)
    return null;
  if (ampm) {
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
  }
  if (!TIME_ZONE_ABBRS[tz]) return null;
  try {
    // Use today's date for conversion
    const now = new Date();
    // Build a date string in the source time zone
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
    // Get the source time zone IANA name
    const srcTimeZone = TIME_ZONE_ABBRS[tz];
    // Convert to UTC from the source time zone
    const srcDate = new Date(
      new Date(
        dateStr + getTimeZoneOffsetString(srcTimeZone, dateStr),
      ).toISOString(),
    );
    // Format in user's local time zone
    const localFormatter = new Intl.DateTimeFormat([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: userTimeZone,
    });
    const localTime = localFormatter.format(srcDate);
    return {
      original: text,
      converted: `${localTime} (your time)`,
      value: localTime,
    };
  } catch (e) {
    return null;
  }
}
// Helper to get the offset string for a given IANA time zone and date
function getTimeZoneOffsetString(timeZone, dateStr) {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(new Date(dateStr));
    const y = parts.find((p) => p.type === "year").value;
    const m = parts.find((p) => p.type === "month").value;
    const d = parts.find((p) => p.type === "day").value;
    const h = parts.find((p) => p.type === "hour").value;
    const min = parts.find((p) => p.type === "minute").value;
    const s = parts.find((p) => p.type === "second").value;
    const utc = Date.UTC(y, m - 1, d, h, min, s);
    const local = new Date(`${dateStr}`).getTime();
    const offset = (local - utc) / 60000;
    const sign = offset <= 0 ? "+" : "-";
    const abs = Math.abs(offset);
    const hh = String(Math.floor(abs / 60)).padStart(2, "0");
    const mm = String(abs % 60).padStart(2, "0");
    return `${sign}${hh}:${mm}`;
  } catch {
    return "+00:00";
  }
}

// --- Unit Conversion Helpers ---
/**
 * Handle cryptocurrency conversion
 */
async function handleCryptoConversion(text) {
  const upperCaseText = text.toUpperCase();
  if (!CRYPTO_CURRENCIES[upperCaseText]) return null;

  // Show loading state
  const errorContainer = DOMCache.get("errorContainer");
  const conversionContainer = DOMCache.get("conversionContainer");
  
  if (errorContainer) {
    errorContainer.textContent = "Loading crypto prices...";
    errorContainer.style.display = "block";
  }
  if (conversionContainer) conversionContainer.style.display = "none";
  
  await fetchCryptoRates();
  const id = CRYPTO_CURRENCIES[upperCaseText];
  let vsCurrency = preferredCryptoCurrency
    ? preferredCryptoCurrency.toLowerCase()
    : "usd";
  let price = null;
  if (
    vsCurrency === "bgn" &&
    cryptoRates.prices[id] &&
    cryptoRates.prices[id]["eur"] &&
    exchangeRates.rates &&
    exchangeRates.rates["EUR"]
  ) {
    price = cryptoRates.prices[id]["eur"] * exchangeRates.rates["EUR"];
  } else if (cryptoRates.prices[id] && cryptoRates.prices[id][vsCurrency]) {
    price = cryptoRates.prices[id][vsCurrency];
  }
  if (price !== null) {
    return {
      original: `1 ${upperCaseText}`,
      converted: `${price.toFixed(2)} ${preferredCryptoCurrency.toUpperCase()}`,
      value: price,
    };
  }
  return null;
}

/**
 * Handle currency loading state and refresh
 */
function handleCurrencyLoading(text) {
  const currencyRegex = /[€$£¥₺₽₹₩₪₱฿₣₦₲₵₡₫₭₮₯₠₢₳₴₸₼₾₿]|[A-Z]{3}/;
  const isCurrencyLike = currencyRegex.test(text);
  
  if (isCurrencyLike && exchangeRatesError) {
    // Show loading state for currency rates
    const errorContainer = DOMCache.get("errorContainer");
    const conversionContainer = DOMCache.get("conversionContainer");
    
    if (errorContainer) {
      errorContainer.textContent = "Loading exchange rates...";
      errorContainer.style.display = "block";
    }
    if (conversionContainer) conversionContainer.style.display = "none";
    
    // Trigger a refresh of exchange rates
    fetchExchangeRates().then(() => {
      // Retry conversion after rates are loaded
      return detectAndConvertUnit(text);
    });
  }
}

/**
 * Parse value and unit from text using regex patterns
 */
function parseValueAndUnit(text) {
  const valueUnitMatch = text.trim().match(REGEX_PATTERNS.valueUnit);
  const unitValueMatch = text.trim().match(REGEX_PATTERNS.unitValue);

  if (!valueUnitMatch && !unitValueMatch) return null;

  let value, unit;

  // Check if currency symbol is before or after the number
  if (valueUnitMatch) {
    value = valueUnitMatch[1];
    unit = valueUnitMatch[2];
  } else if (unitValueMatch) {
    value = unitValueMatch[2];
    unit = unitValueMatch[1];
  } else {
    return null;
  }

  return { value, unit };
}

/**
 * Parse numeric value from string, handling fractions and different formats
 */
function parseNumericValue(valueStr) {
  // Handle fractions using pre-compiled pattern
  if (valueStr.includes("/")) {
    const fractionMatch = valueStr.match(REGEX_PATTERNS.fraction);
    if (fractionMatch) {
      const numerator = parseFloat(
        fractionMatch[1]
          .replace(REGEX_PATTERNS.decimalComma, ".")
          .replace(/\s/g, ""),
      );
      const denominator = parseFloat(
        fractionMatch[2]
          .replace(REGEX_PATTERNS.decimalComma, ".")
          .replace(/\s/g, ""),
      );
      return numerator / denominator;
    } else {
      return null; // Invalid fraction format
    }
  } else {
    // Normalize value using pre-compiled patterns for better performance
    let value = valueStr.replace(REGEX_PATTERNS.thousandsSeparator, ""); // Remove thousands separators
    value = value.replace(REGEX_PATTERNS.decimalComma, "."); // Replace decimal comma with period
    return parseFloat(value);
  }
}

/**
 * Handle temperature conversion
 */
function handleTemperatureConversion(text, value) {
  // Special case for temperature without F suffix using pre-compiled pattern
  const tempMatch = text.trim().match(REGEX_PATTERNS.temperatureUnit);
  if (tempMatch || value === null) {
    const tempValue = tempMatch ? parseFloat(tempMatch[1]) : value;
    return {
      original: `${tempValue}°`,
      converted: `${(((tempValue - 32) * 5) / 9).toFixed(1)}°C`,
      value: ((tempValue - 32) * 5) / 9,
    };
  }
  return null;
}

/**
 * Find and apply unit conversion
 */
function applyUnitConversion(value, unit) {
  // Find matching unit conversion
  // Normalize unit: trim, lowercase, remove spaces and handle common variants
  let normUnit = (unit || "").toLowerCase().replace(/\s+/g, "");

  if (normUnit === "l/100km") {
    normUnit = "l/100km";
  } else if (normUnit === "mpg") {
    normUnit = "mpg";
  }
  
  for (const [key, conversion] of Object.entries(UNIT_CONVERSIONS)) {
    let normKey = key.toLowerCase().replace(/\s+/g, "");
    if (normKey === normUnit) {
      let converted;
      if (conversion.convert) {
        converted = conversion.convert(value);
      } else {
        converted = value * conversion.factor;
      }
      // Round to 2 decimal places for currency, 4 for other units
      const decimals =
        key.match(/[€$£]/) || CRYPTO_CURRENCIES[key.toUpperCase()] ? 2 : 4;
      converted =
        Math.round(converted * Math.pow(10, decimals)) / Math.pow(10, decimals);
      return {
        original: `${value} ${key}`,
        converted: `${converted} ${conversion.to}`,
        value: converted,
      };
    }
  }

  return null;
}

// --- Unit Detection and Conversion ---
async function detectAndConvertUnit(text) {
  const startTime = PerformanceValidator.startTimer('conversion');
  
  // First, check for crypto
  const cryptoResult = await handleCryptoConversion(text);
  if (cryptoResult) {
    PerformanceValidator.endTimer('conversion', startTime);
    return cryptoResult;
  }

  // Time Zone Conversion
  const tzResult = convertTimeZone(text);
  if (tzResult) {
    PerformanceValidator.endTimer('conversion', startTime);
    return tzResult;
  }

  // Handle currency loading
  handleCurrencyLoading(text);

  // Parse value and unit
  const parsed = parseValueAndUnit(text);
  if (!parsed) {
    PerformanceValidator.endTimer('conversion', startTime);
    return null;
  }

  const { value: valueStr, unit } = parsed;
  
  // Parse numeric value
  const value = parseNumericValue(valueStr);
  if (value === null) {
    PerformanceValidator.endTimer('conversion', startTime);
    return null;
  }

  // Handle temperature conversion
  const tempResult = handleTemperatureConversion(text, value);
  if (tempResult) {
    PerformanceValidator.endTimer('conversion', startTime);
    return tempResult;
  }

  // Apply unit conversion
  const result = applyUnitConversion(value, unit);
  PerformanceValidator.endTimer('conversion', startTime);
  return result;
}

// --- Create shadow host and attach shadow root ---
const shadowHost = document.createElement("div");
shadowHost.id = "text-selection-popup-shadow-host";
shadowHost.style.cssText =
  "position: fixed; z-index: 2147483647; pointer-events: none;";

// Attach shadow root (closed mode prevents external JS from accessing shadow DOM)
const shadowRoot = shadowHost.attachShadow({ mode: "closed" });

// ===== CSS OPTIMIZATION SYSTEM =====

// --- Optimized CSS Generation using array.join() for better performance ---
const CSSOptimizer = {
  /**
   * Generate CSS using array.join() instead of template literals for better performance
   * @returns {string} - Optimized CSS string
   */
  generateCSS() {
    const cssRules = [
      "#text-selection-popup-extension {",
      "    position: fixed;",
      "    background: white;",
      "    border: 1px solid #ddd;",
      "    border-radius: 8px;",
      "    padding: 4px;",
      "    display: none;",
      "    opacity: 0;",
      "    width: 160px;",
      "    font-family: Arial, sans-serif;",
      "    font-size: 14px;",
      "    font-weight: normal;",
      "    font-style: normal;",
      "    line-height: 1.4;",
      "    text-transform: none;",
      "    letter-spacing: normal;",
      "    box-shadow: 0 4px 12px rgba(0,0,0,0.15);",
      "    transition: opacity 0.2s ease-in-out;",
      "    box-sizing: border-box;",
      "}",
      "",
      "/* Arrow Base Styling */",
      "#text-selection-popup-extension::before,",
      "#text-selection-popup-extension::after {",
      "    content: '';",
      "    position: absolute;",
      "    width: 0;",
      "    height: 0;",
      "    border-left: 8px solid transparent;",
      "    border-right: 8px solid transparent;",
      "    display: none;",
      "}",
      "",
      "#text-selection-popup-extension.arrow-bottom::after {",
      "    display: block;",
      "    bottom: -8px;",
      "    left: 50%;",
      "    transform: translateX(-50%);",
      "    border-top: 8px solid white;",
      "}",
      "",
      "#text-selection-popup-extension.arrow-top::before {",
      "    display: block;",
      "    top: -8px;",
      "    left: 50%;",
      "    transform: translateX(-50%);",
      "    border-bottom: 8px solid white;",
      "}",
      "",
      "#text-selection-popup-extension.dark-mode {",
      "    background: #333333;",
      "    border-color: #555555;",
      "    color: #FFFFFF;",
      "}",
      "",
      "#text-selection-popup-extension.dark-mode.arrow-bottom::after {",
      "    border-top-color: #333333;",
      "}",
      "",
      "#text-selection-popup-extension.dark-mode.arrow-top::before {",
      "    border-bottom-color: #333333;",
      "}",
      "",
      ".extension-action-button {",
      "    flex: 1;",
      "    padding: 3px 10px;",
      "    border: none;",
      "    border-radius: 5px;",
      "    background-color: #AAAAAA;",
      "    color: white;",
      "    cursor: pointer;",
      "    transition: background-color 0.18s, box-shadow 0.18s;",
      "    font-family: Arial, sans-serif;",
      "    font-size: 12px;",
      "    font-weight: normal;",
      "    font-style: normal;",
      "    line-height: 1.4;",
      "    text-transform: none;",
      "    letter-spacing: normal;",
      "    text-align: center;",
      "    white-space: nowrap;",
      "    box-shadow: none;",
      "}",
      "",
      ".extension-action-button:hover, .extension-action-button:focus {",
      "    background-color: #9e9e9eff;",
      "    box-shadow: 0 2px 8px rgba(0,0,0,0.10);",
      "    outline: none;",
      "}",
      "",
      "#text-selection-popup-extension.dark-mode .extension-action-button {",
      "    background-color: #555555;",
      "    color: #FFFFFF;",
      "}",
      "",
      "#text-selection-popup-extension.dark-mode .extension-action-button:hover,",
      "#text-selection-popup-extension.dark-mode .extension-action-button:focus {",
      "    background-color: #5a5959ff;",
      "    box-shadow: 0 2px 8px rgba(0,0,0,0.18);",
      "    outline: none;",
      "}",
      "",
      ".conversion-result {",
      "    padding: 4px 8px;",
      "    margin: 4px 0;",
      "    background: #f5f5f5;",
      "    color: #000;",
      "    border-radius: 4px;",
      "    cursor: pointer;",
      "    display: flex;",
      "    justify-content: space-between;",
      "    align-items: center;",
      "}",
      "",
      ".conversion-result:hover {",
      "    background: #f0f0f0;",
      "}",
      "",
      ".conversion-result .copy-button {",
      "    display: none;",
      "    padding: 2px 6px;",
      "    font-size: 12px;",
      "    background: #4CAF50;",
      "    color: white;",
      "    border: none;",
      "    border-radius: 3px;",
      "    cursor: pointer;",
      "    margin-left: 8px;",
      "    flex-shrink: 0;",
      "}",
      "",
      ".conversion-result:hover .copy-button {",
      "    display: inline-block;",
      "}",
      "",
      "#text-selection-popup-extension.dark-mode .conversion-result {",
      "    background: #5a5a5a;",
      "    color: #fff;",
      "}",
      "",
      "#text-selection-popup-extension.dark-mode .conversion-result:hover {",
      "    background: #6a6a6a;",
      "}",
    ];

    return cssRules.join("\n");
  },
};

// ===== DOM OPTIMIZATION SYSTEM =====

// --- Advanced DOM Operations using DocumentFragment for batch operations ---
const DOMOptimizer = {
  /**
   * Create popup structure using DocumentFragment for optimal performance
   * Minimizes reflows and repaints by batching DOM operations
   * @returns {DocumentFragment} - Optimized popup structure
   */
  createPopupStructure() {
    // Use DocumentFragment for batch DOM operations
    const fragment = document.createDocumentFragment();

    // Create main popup element
    const popup = document.createElement("div");
    popup.id = "text-selection-popup-extension";

    // Batch create all child elements before appending
    const elements = this.createAllElements();

    // Append all elements in a single batch operation
    popup.appendChild(elements.errorContainer);
    popup.appendChild(elements.conversionContainer);
    popup.appendChild(elements.buttonContainer);

    fragment.appendChild(popup);
    return { fragment, popup, elements };
  },

  /**
   * Create all popup elements in memory before DOM insertion
   * @returns {Object} - Object containing all created elements
   */
  createAllElements() {
    // Error container
    const errorContainer = document.createElement("div");
    errorContainer.id = "errorContainer";

    // Batch style operations to minimize reflows
    Object.assign(errorContainer.style, {
      display: "none",
      color: "red",
      padding: "4px",
      textAlign: "center",
    });

    // Conversion container with nested elements
    const conversionContainer = document.createElement("div");
    conversionContainer.id = "conversionContainer";
    conversionContainer.style.display = "none";

    const conversionResult = document.createElement("div");
    conversionResult.className = "conversion-result";

    const convertedValueSpan = document.createElement("span");
    convertedValueSpan.className = "converted-value";

    const copyButton = document.createElement("button");
    copyButton.className = "copy-button";
    copyButton.textContent = "Copy";

    // Batch append conversion elements
    conversionResult.appendChild(convertedValueSpan);
    conversionResult.appendChild(copyButton);
    conversionContainer.appendChild(conversionResult);

    // Button container
    const buttonContainer = document.createElement("div");

    // Batch style operations
    Object.assign(buttonContainer.style, {
      display: "flex",
      flexDirection: "row",
      gap: "8px",
      justifyContent: "space-between",
    });

    // Search button
    const searchButton = document.createElement("button");
    searchButton.id = "extensionSearchButton";
    searchButton.className = "extension-action-button";
    searchButton.textContent = "Search";

    // Copy button
    const copyButton2 = document.createElement("button");
    copyButton2.id = "extensionCopyButton";
    copyButton2.className = "extension-action-button";
    copyButton2.textContent = "Copy";

    // Batch append buttons
    buttonContainer.appendChild(searchButton);
    buttonContainer.appendChild(copyButton2);

    return {
      errorContainer,
      conversionContainer,
      conversionResult,
      convertedValueSpan,
      copyButton,
      buttonContainer,
      searchButton,
      copyButton2,
    };
  },

  /**
   * Optimized style application to minimize reflows
   * @param {HTMLElement} element - Element to style
   * @param {Object} styles - Style properties to apply
   */
  applyStylesBatch(element, styles) {
    // Use Object.assign for batch style operations
    Object.assign(element.style, styles);
  },

  /**
   * Memory-efficient cleanup for DOM elements
   * @param {HTMLElement} element - Element to clean up
   */
  cleanupElement(element) {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
    // Clear references to help garbage collection
    element = null;
  },
};

// Create style element INSIDE shadow root using optimized CSS
const styleElement = document.createElement("style");
styleElement.textContent = CSSOptimizer.generateCSS();
shadowRoot.appendChild(styleElement);

// --- Create the popup element using optimized DOM operations ---
const popupStructure = DOMOptimizer.createPopupStructure();
const popup = popupStructure.popup;
const popupElements = popupStructure.elements;

// Append the optimized structure to shadow root in a single operation
shadowRoot.appendChild(popupStructure.fragment);
document.body.appendChild(shadowHost);

// ===== UI COMPONENTS AND POPUP MANAGEMENT =====

// --- Clipboard Operations ---
async function handleClipboardFallback(textToCopy) {
  try {
    // Check if clipboard API is available
    if (!navigator.clipboard) {
      throw new Error("Clipboard API not available");
    }
    
    // Try using the modern Clipboard API first
    await navigator.clipboard.writeText(textToCopy);
    hidePopup();
  } catch (err) {
    // Optimized fallback approach with minimal reflows
    const textArea = document.createElement("textarea");

    // Batch style operations to minimize reflows
    DOMOptimizer.applyStylesBatch(textArea, {
      position: "fixed",
      left: "-9999px",
      top: "-9999px",
      opacity: "0",
      pointerEvents: "none",
    });

    try {
      // Handle potential errors in text assignment
      textArea.value = textToCopy || "";
      document.body.appendChild(textArea);
      textArea.select();
      textArea.setSelectionRange(0, 99999); // For mobile devices

      const successful = document.execCommand("copy");
      if (!successful) {
        throw new Error("Failed to copy text");
      }
      
      hidePopup();
    } catch (fallbackError) {
      // Handle clipboard fallback errors with proper logging
      ErrorHandler.handleDomError(fallbackError, 'clipboard-fallback', true);
    } finally {
      // Clean up with optimized removal
      DOMOptimizer.cleanupElement(textArea);
      hidePopup();
    }
  }
}

// --- Theme Detection and Styling ---
function isEffectivelyTransparent(colorString) {
  if (!colorString) return true;
  const lowerColorString = colorString.toLowerCase();
  if (lowerColorString === "transparent") return true;
  const match = lowerColorString.match(REGEX_PATTERNS.rgba);
  if (match) {
    const alpha = parseFloat(match[4]);
    return alpha <= 0.05;
  }
  return false;
}

function getEffectiveBackgroundColor(element) {
  let currentElement = element;
  if (currentElement && currentElement.nodeType === Node.TEXT_NODE) {
    currentElement = currentElement.parentElement;
  }
  while (currentElement) {
    if (!(currentElement instanceof Element)) {
      currentElement = currentElement.parentElement;
      continue;
    }
    const computedStyle = window.getComputedStyle(currentElement);
    const bgColor = computedStyle.backgroundColor;
    if (!isEffectivelyTransparent(bgColor)) {
      return bgColor;
    }
    if (
      currentElement === document.body ||
      currentElement === document.documentElement
    ) {
      break;
    }
    currentElement = currentElement.parentElement;
  }
  let finalBgColor = window.getComputedStyle(document.body).backgroundColor;
  if (!isEffectivelyTransparent(finalBgColor)) return finalBgColor;
  finalBgColor = window.getComputedStyle(
    document.documentElement,
  ).backgroundColor;
  if (!isEffectivelyTransparent(finalBgColor)) return finalBgColor;
  return "rgb(255, 255, 255)"; // Absolute fallback
}

function isColorDark(colorString) {
  if (isEffectivelyTransparent(colorString)) return false;
  let r, g, b;
  const lowerColorString = colorString.toLowerCase();
  if (lowerColorString.startsWith("rgb")) {
    const match = lowerColorString.match(REGEX_PATTERNS.rgb);
    if (!match) return false;
    [r, g, b] = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
  } else if (lowerColorString.startsWith("#")) {
    const hexMatch = lowerColorString.match(REGEX_PATTERNS.hex);
    if (!hexMatch) return false;
    let hex = hexMatch[1];
    if (hex.length === 3)
      hex = hex
        .split("")
        .map((char) => char + char)
        .join("");
    [r, g, b] = [
      parseInt(hex.substring(0, 2), 16),
      parseInt(hex.substring(2, 4), 16),
      parseInt(hex.substring(4, 6), 16),
    ];
  } else {
    const tempElem = document.createElement("div");
    tempElem.style.color = lowerColorString;
    document.body.appendChild(tempElem);
    const computedColor = window.getComputedStyle(tempElem).color;
    document.body.removeChild(tempElem);
    if (!computedColor.startsWith("rgb")) return false;
    const match = computedColor.match(REGEX_PATTERNS.rgb);
    if (!match) return false;
    [r, g, b] = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
  }
  const luminance =
    0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return luminance < 0.5;
}

/**
 * Applies theme and arrow classes to the popup.
 * @param {boolean} isPageDark - True if the page background is dark.
 * @param {boolean} isPopupBelowSelection - True if the popup is positioned below the selection.
 */
function applyThemeAndArrow(isPageDark, isPopupBelowSelection) {
  popup.classList.toggle("dark-mode", isPageDark);
  if (isPopupBelowSelection) {
    popup.classList.add("arrow-top");
    popup.classList.remove("arrow-bottom");
  } else {
    popup.classList.add("arrow-bottom");
    popup.classList.remove("arrow-top");
  }
}

// --- URL Detection and Search ---
function detectUrl(text) {
  return REGEX_PATTERNS.url.test(text);
}

// --- Helper function to format URL ---
function formatUrl(text) {
  if (!text.startsWith("http://") && !text.startsWith("https://")) {
    return "https://" + text;
  }
  return text;
}

function getSearchUrl(query) {
  switch (preferredSearchEngine) {
    case "duckduckgo":
      return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    case "bing":
      return `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    case "yahoo":
      return `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
    case "startpage":
      return `https://www.startpage.com/do/dsearch?query=${encodeURIComponent(query)}`;
    case "brave":
      return `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
    case "qwant":
      return `https://www.qwant.com/?q=${encodeURIComponent(query)}`;
    case "ecosia":
      return `https://www.ecosia.org/search?q=${encodeURIComponent(query)}`;
    case "google":
    default:
      return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }
}

// --- Button Event Handlers ---
/**
 * Handle search button click - opens URL or performs search
 */
function handleSearchClick() {
  if (!currentSelectedText) return;
  
  if (isUrlSelected) {
    openUrlOrSearch(currentSelectedText);
  } else {
    const searchUrl = getSearchUrl(currentSelectedText);
    window.open(searchUrl, "_blank", "noopener,noreferrer");
  }
  hidePopup();
}

/**
 * Open URL if valid, otherwise perform search
 */
function openUrlOrSearch(text) {
  const url = formatUrl(text);
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol === "http:" || urlObj.protocol === "https:") {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      const searchUrl = getSearchUrl(text);
      window.open(searchUrl, "_blank", "noopener,noreferrer");
    }
  } catch (e) {
    const searchUrl = getSearchUrl(text);
    window.open(searchUrl, "_blank", "noopener,noreferrer");
  }
}

/**
 * Handle copy button click - copies selected text
 */
function handleCopyClick() {
  if (currentSelectedText) {
    handleClipboardFallback(currentSelectedText);
  }
}

/**
 * Handle copy converted button click - copies converted value
 */
function handleCopyConvertedClick(e) {
  e.stopPropagation();
  if (convertedValue) {
    handleClipboardFallback(convertedValue.converted);
  }
}

/**
 * Initialize search button event listener
 */
function initSearchButton(searchButton) {
  if (searchButton) {
    searchButton.addEventListener("click", handleSearchClick);
  }
}

/**
 * Initialize copy button event listener
 */
function initCopyButton(copyButton) {
  if (copyButton) {
    copyButton.addEventListener("click", handleCopyClick);
  }
}

/**
 * Initialize copy converted button event listener
 */
function initCopyConvertedButton(copyConvertedButton) {
  if (copyConvertedButton) {
    copyConvertedButton.addEventListener("click", handleCopyConvertedClick);
  }
}

// --- Event Handlers and User Interactions ---
function initPopupButtons() {
  // Use cached DOM elements for better performance
  const searchButton = DOMCache.get("searchButton");
  const copyButton = DOMCache.get("copyButton");
  const copyConvertedButton = DOMCache.get("copyConvertedButton");

  // Initialize each button separately for single responsibility
  initSearchButton(searchButton);
  initCopyButton(copyButton);
  initCopyConvertedButton(copyConvertedButton);
}

// --- Popup Content Management ---
/**
 * Update popup content based on unit conversion results
 */
function updatePopupContent() {
  const errorContainer = DOMCache.get("errorContainer");
  const conversionContainer = DOMCache.get("conversionContainer");
  const convertedValueSpan = DOMCache.get("convertedValueSpan");

  // Check for unit conversion
  if (convertedValue) {
    if (errorContainer) errorContainer.style.display = "none";
    if (conversionContainer) conversionContainer.style.display = "block";
    if (convertedValueSpan)
      convertedValueSpan.textContent = convertedValue.converted;
  } else {
    // Only show error if selection looks like a currency/crypto value
    const upperCaseText = currentSelectedText.toUpperCase();
    const isCrypto = CRYPTO_CURRENCIES[upperCaseText];
    const currencyRegex = /[€$£¥₺₽₹₩₪₱฿₣₦₲₵₡₫₭₮₯₠₢₳₴₸₼₾₿]|[A-Z]{3}/;
    if (
      (isCrypto && cryptoRatesError) ||
      (currencyRegex.test(currentSelectedText) && exchangeRatesError)
    ) {
      if (errorContainer) {
        errorContainer.textContent = exchangeRatesError || cryptoRatesError;
        errorContainer.style.display = "block";
      }
    } else {
      if (errorContainer) errorContainer.style.display = "none";
    }
    if (conversionContainer) conversionContainer.style.display = "none";
  }
}

/**
 * Update button text based on URL detection
 */
function updateButtonText() {
  const searchButton = DOMCache.get("searchButton");
  isUrlSelected = detectUrl(currentSelectedText);
  if (searchButton) {
    searchButton.textContent = isUrlSelected ? "Visit website" : "Search";
  }
}

/**
 * Calculate optimal popup position relative to selection
 */
function calculatePopupPosition(rect, popupRect) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const popupHeight = popupRect.height;
  const popupWidth = popupRect.width;
  const margin = CONFIG.POPUP_MARGIN;
  const arrowGap = CONFIG.ARROW_GAP;
  const selectionCenterX = rect.left + rect.width / 2;

  let top, left;
  let isPopupBelow = false;

  // Calculate optimal position
  top = rect.top - popupHeight - arrowGap;
  left = selectionCenterX - popupWidth / 2;

  // Adjust for viewport constraints
  if (top < margin) {
    top = rect.bottom + arrowGap;
    isPopupBelow = true;
  }

  left = Math.max(margin, Math.min(left, viewportWidth - popupWidth - margin));
  top = Math.max(margin, Math.min(top, viewportHeight - popupHeight - margin));

  // Re-evaluate position relationship
  if (!isPopupBelow && top > rect.bottom) isPopupBelow = true;
  if (isPopupBelow && top < rect.top - popupHeight) isPopupBelow = false;

  return { top, left, isPopupBelow };
}

/**
 * Apply popup positioning and theme styling
 */
function applyPopupStyling(left, top, isPopupBelow, selectionContextElement) {
  // Determine background and apply theme/arrow
  const pageBackgroundColor = getEffectiveBackgroundColor(selectionContextElement);
  const isPageDark = isColorDark(pageBackgroundColor);

  // Batch all final style changes to minimize reflows
  DOMOptimizer.applyStylesBatch(popup, {
    left: `${left}px`,
    top: `${top}px`,
    transition: "none",
  });

  // Apply theme classes
  applyThemeAndArrow(isPageDark, isPopupBelow);

  // Re-enable transitions and show popup
  requestAnimationFrame(() => {
    DOMOptimizer.applyStylesBatch(popup, {
      transition: "opacity 0.2s ease-in-out",
    });
    shadowHost.style.pointerEvents = "auto";

    requestAnimationFrame(() => {
      popup.style.opacity = "1";
    });
  });
}

// --- Optimized popup positioning with minimal reflows ---
async function showAndPositionPopup(rect, selectionContextElement) {
  // Batch initial style changes to minimize reflows
  DOMOptimizer.applyStylesBatch(popup, {
    opacity: "0",
    display: "block",
  });

  // Update popup content
  convertedValue = await detectAndConvertUnit(currentSelectedText);
  updatePopupContent();
  updateButtonText();

  // Get dimensions in a single batch to minimize layout thrashing
  const popupRect = popup.getBoundingClientRect();
  const { top, left, isPopupBelow } = calculatePopupPosition(rect, popupRect);

  // Apply positioning and theme
  applyPopupStyling(left, top, isPopupBelow, selectionContextElement);
}

// --- Optimized popup hiding with minimal reflows ---
function hidePopup() {
  // Batch style changes for optimal performance
  DOMOptimizer.applyStylesBatch(popup, {
    opacity: "0",
  });

  shadowHost.style.pointerEvents = "none";
  PopupManager.cancelAutoHide();

  setTimeout(() => {
    DOMOptimizer.applyStylesBatch(popup, {
      display: "none",
    });
    popup.classList.remove("arrow-top", "arrow-bottom");
  }, CONFIG.FADE_TRANSITION_DURATION);
}

// ===== INITIALIZATION AND STARTUP =====
DOMCache.init(); // Initialize DOM cache for performance optimization
EventManager.init(); // Initialize event management system
PopupManager.init(); // Initialize popup management system