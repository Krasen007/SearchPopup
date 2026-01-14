// Content script for handling text selection and popup display
// Copyright 2025 Krasen Ivanov

// ===== CONFIGURATION AND CONSTANTS =====

// --- Application Configuration ---
const CONFIG = {
  MAX_SELECTION_LENGTH: 7000, // Maximum characters for text selection
  MIN_SELECTION_LENGTH: 2, // Minimum characters for text selection
  HIDE_DELAY: 3000, // 3 seconds delay before hiding popup
  CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  CRYPTO_CACHE_DURATION: 5 * 60 * 1000, // 5 minutes in milliseconds
  MAX_API_ATTEMPTS: 3, // Maximum API retry attempts
  BASE_RETRY_DELAY: 1000, // 1 second base retry delay
  POPUP_MARGIN: 10, // Margin from viewport edges
  ARROW_GAP: 10, // Gap between selection and popup (includes arrow height)
  FADE_TRANSITION_DURATION: 200, // Fade transition duration in milliseconds
};

// --- Pre-compiled Regex Patterns ---
const REGEX_PATTERNS = {
  // URL detection pattern - Pre-compiled for performance
  url: /^(https?:\/\/)?(([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)(\/[^\s]*)?$/,

  // Time zone pattern for conversion - Pre-compiled for performance
  timeZone: /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?\s*([A-Z]{2,5})$/i,

  // Currency symbol pattern for unit detection - Pre-compiled for performance
  currencySymbol: "[a-zA-Z°/€$£¥₺₽₹₩₪₱฿₣₦₲₵₡₫₭₮₯₠₢₳₴₸₼₾₿]",

  // Value-unit pattern (number followed by unit) - Will be constructed once
  valueUnit: null,

  // Unit-value pattern (unit followed by number) - Will be constructed once
  unitValue: null,

  // RGBA color pattern for transparency detection - Pre-compiled for performance
  rgba: /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/,

  // RGB color pattern for color parsing - Pre-compiled for performance
  rgb: /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/,

  // Hex color pattern - Pre-compiled for performance
  hex: /^#([a-f0-9]{3}|[a-f0-9]{6})$/i,

  // Number parsing patterns - Pre-compiled for performance
  thousandsSeparator: /[.\,\s](?=\d{3}(\D|$))/g,
  decimalComma: /,/g,
  fraction: /^(\d+)\/(\d+)$/,

  // Common unit patterns - Pre-compiled for performance
  temperatureUnit: /^(\d+(?:\.\d+)?)\s*°\s*$/,

  /**
   * Initialize dynamic regex patterns that depend on currency symbols
   * This is called once during initialization for optimal performance
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
};

// ===== DOM CACHE SYSTEM =====

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
      // Check if popup is visible (display !== "none" and opacity > 0)
      if (popup.style.display !== "none" && popup.style.opacity !== "0") {
        hidePopup();
      }
    }, 100);

    // Debounce resize events to execute once after 250ms of inactivity
    this.debouncedResizeHandler = PerformanceUtils.debounce(() => {
      // Check if popup is visible (display !== "none" and opacity > 0)
      if (popup.style.display !== "none" && popup.style.opacity !== "0") {
        hidePopup();
      }
    }, 250);
  },

  /**
   * Bind all event listeners with optimized handlers
   */
  bindEvents() {
    document.addEventListener("mouseup", this.handleMouseUp.bind(this));
    document.addEventListener("mousedown", this.handleMouseDown.bind(this));
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
   * Handle mouseup events for text selection
   * @param {MouseEvent} e - The mouseup event
   */
  handleMouseUp(e) {
    if (shadowHost.contains(e.target)) {
      return;
    }

    let selection, selectedTextTrimmed, range, rect;
    try {
      selection = window.getSelection();
      selectedTextTrimmed = selection.toString().trim();
    } catch (err) {
      // Likely a cross-origin iframe, do nothing
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
        // Likely a cross-origin iframe, do nothing
        return;
      }
      if (rect.width > 0 || rect.height > 0) {
        showAndPositionPopup(rect, range.commonAncestorContainer);
        // Set selection complete flag after a short delay to allow for mouse movement
        setTimeout(() => {
          let isSelectionComplete = false;
          // Start the hide timer
          hidePopupTimeout = setTimeout(() => {
            hidePopup();
          }, CONFIG.HIDE_DELAY);
        }, 100);
      } else {
        hidePopup();
      }
    } else if (!shadowHost.contains(e.target)) {
      hidePopup();
    }
  },

  /**
   * Handle mousedown events for resetting selection state
   * @param {MouseEvent} e - The mousedown event
   */
  handleMouseDown(e) {
    isSelectionComplete = false;
    clearTimeout(hidePopupTimeout); // Clear any existing timer
    if (popup.style.display === "block" && !shadowHost.contains(e.target)) {
      hidePopup();
    }
  },

  /**
   * Handle global errors
   * @param {ErrorEvent} event - The error event
   */
  handleError(event) {
    // Prevent error from bubbling up
    event.preventDefault();
    return false;
  },

  /**
   * Handle unhandled promise rejections
   * @param {PromiseRejectionEvent} event - The promise rejection event
   */
  handleUnhandledRejection(event) {
    // Prevent error from bubbling up
    event.preventDefault();
    return false;
  },
};

// ===== GLOBAL STATE VARIABLES =====

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
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=${fetchVs}`,
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
    cryptoRatesError = "Could not fetch crypto rates.";
    const cached = localStorage.getItem("cryptoRates");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.prices) {
        cryptoRates = parsed;
      }
    }
  }
}

// --- Rate limiting for API calls ---
let apiCallAttempts = 0;

// --- Helper function to fetch exchange rates ---
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
      "Could not fetch latest rates. Please try again later.";
    return;
  }

  try {
    apiCallAttempts++;
    const response = await fetch(
      "https://api.exchangerate-api.com/v4/latest/EUR",
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Validate the response data structure
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
    } catch (storageError) {}
  } catch (error) {
    // Exponential backoff for retries
    if (apiCallAttempts < CONFIG.MAX_API_ATTEMPTS) {
      const retryDelay =
        CONFIG.BASE_RETRY_DELAY * Math.pow(2, apiCallAttempts - 1);
      setTimeout(() => fetchExchangeRates(), retryDelay);
      return; // Exit early to prevent fallback execution during retry attempts
    }
    exchangeRatesError =
      "Could not fetch latest rates. Please try again later.";
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
          // Validate that the cached data is not too old (more than 7 days)
          const now = Date.now();
          const cacheAge = now - parsed.lastUpdated;
          const maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
          if (cacheAge < maxCacheAge) {
            exchangeRates = parsed;
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
        }
      }
    } catch (parseError) {
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
  }
}

// --- Improved Time Zone Conversion ---
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

// --- Helper function to detect and convert units ---
async function detectAndConvertUnit(text) {
  // First, check for crypto
  const upperCaseText = text.toUpperCase();
  if (CRYPTO_CURRENCIES[upperCaseText]) {
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
  }

  // --- Time Zone Conversion ---
  const tzResult = convertTimeZone(text);
  if (tzResult) return tzResult;

  // Match pattern: number (including fractions) followed by unit with optional space
  // Updated pattern to handle currency symbols before or after the number
  // Allow both comma, period, and space as decimal/thousands separators
  // Allow trailing punctuation like periods, commas, etc.
  // Expanded currency symbols to include ₺, ₽, ₹, ₩, ₪, ₱, ฿, ₣, ₦, ₲, ₵, ₡, ₫, ₭, ₮, ₯, ₠, ₢, ₳, ₴, ₸, ₼, ₾, ₿, and others
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

  // Handle fractions using pre-compiled pattern
  if (value.includes("/")) {
    const fractionMatch = value.match(REGEX_PATTERNS.fraction);
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
      value = numerator / denominator;
    } else {
      return null; // Invalid fraction format
    }
  } else {
    // Normalize value using pre-compiled patterns for better performance
    value = value.replace(REGEX_PATTERNS.thousandsSeparator, ""); // Remove thousands separators
    value = value.replace(REGEX_PATTERNS.decimalComma, "."); // Replace decimal comma with period
    value = parseFloat(value);
  }

  // Special case for temperature without F suffix using pre-compiled pattern
  const tempMatch = text.trim().match(REGEX_PATTERNS.temperatureUnit);
  if (unit === "°" || tempMatch) {
    const tempValue = tempMatch ? parseFloat(tempMatch[1]) : value;
    return {
      original: `${tempValue}°`,
      converted: `${(((tempValue - 32) * 5) / 9).toFixed(1)}°C`,
      value: ((tempValue - 32) * 5) / 9,
    };
  }

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

// --- Optimized clipboard fallback with minimal DOM manipulation ---
async function handleClipboardFallback(textToCopy) {
  try {
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

    textArea.value = textToCopy;

    // Single DOM insertion
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      // Try using the modern Clipboard API with the selected text
      await navigator.clipboard.writeText(textArea.value);
    } catch (err) {
      // Fallback to execCommand if available
      try {
        document.execCommand("copy");
      } catch (execErr) {
        // Silent fail - clipboard operation not supported
      }
    } finally {
      // Clean up with optimized removal
      DOMOptimizer.cleanupElement(textArea);
      hidePopup();
    }
  }
}

// --- Theme and Background Detection Helpers (Optimized with pre-compiled patterns) ---
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

// --- Helper function to detect URLs in text ---
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

// --- Initialize button event listeners (called once on script load) ---
function initPopupButtons() {
  // Use cached DOM elements for better performance
  const searchButton = DOMCache.get("searchButton");
  const copyButton = DOMCache.get("copyButton");
  const conversionContainer = DOMCache.get("conversionContainer");
  const convertedValueSpan = DOMCache.get("convertedValueSpan");
  const copyConvertedButton = DOMCache.get("copyConvertedButton");

  if (searchButton) {
    searchButton.addEventListener("click", () => {
      if (currentSelectedText) {
        if (isUrlSelected) {
          const url = formatUrl(currentSelectedText);
          try {
            const urlObj = new URL(url);
            if (urlObj.protocol === "http:" || urlObj.protocol === "https:") {
              window.open(url, "_blank", "noopener,noreferrer");
            } else {
              const searchUrl = getSearchUrl(currentSelectedText);
              window.open(searchUrl, "_blank", "noopener,noreferrer");
            }
          } catch (e) {
            const searchUrl = getSearchUrl(currentSelectedText);
            window.open(searchUrl, "_blank", "noopener,noreferrer");
          }
        } else {
          const searchUrl = getSearchUrl(currentSelectedText);
          window.open(searchUrl, "_blank", "noopener,noreferrer");
        }
        hidePopup();
      }
    });
  }

  if (copyButton) {
    copyButton.addEventListener("click", () => {
      if (currentSelectedText) {
        handleClipboardFallback(currentSelectedText);
      }
    });
  }

  if (copyConvertedButton) {
    copyConvertedButton.addEventListener("click", (e) => {
      e.stopPropagation();
      if (convertedValue) {
        handleClipboardFallback(convertedValue.converted);
      }
    });
  }
}

// --- Optimized popup positioning with minimal reflows ---
async function showAndPositionPopup(rect, selectionContextElement) {
  // Batch initial style changes to minimize reflows
  DOMOptimizer.applyStylesBatch(popup, {
    opacity: "0",
    display: "block",
  });

  // Use cached DOM elements for better performance
  const errorContainer = DOMCache.get("errorContainer");
  const conversionContainer = DOMCache.get("conversionContainer");
  const convertedValueSpan = DOMCache.get("convertedValueSpan");

  // Check for unit conversion
  convertedValue = await detectAndConvertUnit(currentSelectedText);
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

  // Update button text based on URL detection using cached element
  const searchButton = DOMCache.get("searchButton");
  isUrlSelected = detectUrl(currentSelectedText);
  if (searchButton) {
    searchButton.textContent = isUrlSelected ? "Visit website" : "Search";
  }

  // Get dimensions in a single batch to minimize layout thrashing
  const popupRect = popup.getBoundingClientRect();
  const popupHeight = popupRect.height;
  const popupWidth = popupRect.width;
  const margin = CONFIG.POPUP_MARGIN;
  const arrowGap = CONFIG.ARROW_GAP;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
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

  // Determine background and apply theme/arrow
  const pageBackgroundColor = getEffectiveBackgroundColor(
    selectionContextElement,
  );
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

// --- Optimized popup hiding with minimal reflows ---
let hidePopupTimeout;
function hidePopup() {
  // Batch style changes for optimal performance
  DOMOptimizer.applyStylesBatch(popup, {
    opacity: "0",
  });

  shadowHost.style.pointerEvents = "none";
  clearTimeout(hidePopupTimeout);

  hidePopupTimeout = setTimeout(() => {
    DOMOptimizer.applyStylesBatch(popup, {
      display: "none",
    });
    popup.classList.remove("arrow-top", "arrow-bottom");
  }, CONFIG.FADE_TRANSITION_DURATION);
}

// --- Initialize ---
DOMCache.init(); // Initialize DOM cache for performance optimization
initPopupButtons();
EventManager.init(); // Initialize optimized event management system
fetchExchangeRates(); // Fetch exchange rates on startup
fetchCryptoRates(); // Fetch crypto rates on startup

// Memory cleanup handled automatically by browser