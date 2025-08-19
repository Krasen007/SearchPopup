// Content script for handling text selection and popup display
// Copyright 2025 Krasen Ivanov

// --- Global variable to store the currently selected text ---
let currentSelectedText = '';
let isUrlSelected = false;
let convertedValue = null;
let exchangeRatesError = null;
let cryptoRatesError = null;

// --- Preferred currency (default to BGN) ---
let preferredCurrency = 'BGN';
let preferredCryptoCurrency = 'USD';
let preferredSearchEngine = 'google';

// Fetch all preferences from chrome.storage.sync
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['preferredCurrency', 'preferredCryptoCurrency', 'preferredSearchEngine'], (result) => {
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
    });
} else {
    fetchExchangeRates();
    fetchCryptoRates();
}

// --- Input validation constants ---
const MAX_SELECTION_LENGTH = 7000; // Maximum characters for text selection
const MIN_SELECTION_LENGTH = 2;     // Minimum characters for text selection

// --- Currency exchange rates cache ---
let exchangeRates = {
    // Store as Unix epoch (ms) to survive JSON serialisation
    lastUpdated: 0,
    rates: {
        // Default rates will be populated from API
        EUR: 1.95583, // Default EUR to BGN rate
        USD: 1.8,     // Default USD to BGN rate
        GBP: 2.3      // Default GBP to BGN rate
    }
};

// --- Cryptocurrency data ---
const cryptoCurrencies = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'XRP': 'ripple',
    'LTC': 'litecoin',
    'BCH': 'bitcoin-cash',
    'ADA': 'cardano',
    'DOT': 'polkadot',
    'LINK': 'chainlink',
    'XLM': 'stellar',
    'DOGE': 'dogecoin',
    'USDT': 'tether',
    'BNB': 'binancecoin',
    'SOL': 'solana',
    'TRX': 'tron',
    'EOS': 'eos',
    'XTZ': 'tezos',
    'ATOM': 'cosmos',
    'VET': 'vechain',
    'ETC': 'ethereum-classic',
    'FIL': 'filecoin',
    'AAVE': 'aave',
    'UNI': 'uniswap',
    'SUSHI': 'sushiswap',
    'YFI': 'yearn-finance',
    'COMP': 'compound',
    'MKR': 'maker',
    'SNX': 'synthetix-network-token',
    'UMA': 'uma',
    'ZEC': 'zcash',
    'DASH': 'dash',
    'XMR': 'monero',
    'BSV': 'bitcoin-sv',
    'AVAX': 'avalanche-2',
    'MATIC': 'matic-network'
};

let cryptoRates = {
    lastUpdated: 0,
    prices: {} // e.g., { bitcoin: { usd: 50000 } }
};

async function fetchCryptoRates() {
    const now = Date.now();
    if (cryptoRates.lastUpdated && now - cryptoRates.lastUpdated < 5 * 60 * 1000) { // 5-minute cache
        return;
    }

    const coinIds = Object.values(cryptoCurrencies).join(',');
    let vsCurrency = preferredCryptoCurrency ? preferredCryptoCurrency.toLowerCase() : 'usd';
    let fetchVs = vsCurrency;
    if (vsCurrency === 'bgn') fetchVs = 'eur'; // Fetch EUR if BGN is selected
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=${fetchVs}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        if (!data) {
            throw new Error('Invalid response format from CoinGecko API');
        }

        cryptoRates.prices = data;
        cryptoRates.lastUpdated = now;
        cryptoRatesError = null; // Clear error on success

        // Add to unitConversions
        for (const [symbol, id] of Object.entries(cryptoCurrencies)) {
            if (cryptoRates.prices[id] && cryptoRates.prices[id][fetchVs]) {
                let convertFn;
                let toLabel = preferredCryptoCurrency;
                if (vsCurrency === 'bgn' && exchangeRates.rates && exchangeRates.rates['EUR']) {
                    // Convert EUR price to BGN
                    convertFn = (val) => val * cryptoRates.prices[id]['eur'] * exchangeRates.rates['EUR'];
                    toLabel = 'BGN';
                } else {
                    convertFn = (val) => val * cryptoRates.prices[id][fetchVs];
                }
                unitConversions[symbol] = {
                    to: toLabel,
                    convert: convertFn
                };
            }
        }

        localStorage.setItem('cryptoRates', JSON.stringify(cryptoRates));
    } catch (error) {
        cryptoRatesError = 'Could not fetch crypto rates.';
        const cached = localStorage.getItem('cryptoRates');
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
const MAX_API_ATTEMPTS = 3;
const BASE_RETRY_DELAY = 1000; // 1 second

// Currency symbols mapping
const currencySymbols = {
    'EUR': '€',
    'USD': '$',
    'GBP': '£',
    'JPY': '¥',
    'CNY': '¥',
    'INR': '₹',
    'RUB': '₽',
    'KRW': '₩',
    'TRY': '₺',
    'BRL': 'R$',
    'ZAR': 'R',
    'MXN': '$',
    'SGD': 'S$',
    'HKD': 'HK$',
    'NZD': 'NZ$',
    'SEK': 'kr',
    'NOK': 'kr',
    'DKK': 'kr',
    'PLN': 'zł',
    'CHF': 'Fr',
    'CAD': 'C$',
    'AUD': 'A$',
    'ILS': '₪',
    'RON': 'lei',
    'HUF': 'Ft',
    'CZK': 'Kč',
    'PHP': '₱',
    'THB': '฿',
    'IDR': 'Rp',
    'MYR': 'RM',
    'BGN': 'лв'
};

// --- Unit conversion definitions ---
const unitConversions = {
    // Weight
    'lb': { to: 'kg', factor: 0.45359237 },
    'lbs': { to: 'kg', factor: 0.45359237 },
    'kg': { to: 'lb', factor: 2.20462262 },
    'oz': { to: 'g', factor: 28.3495231 },
    'g': { to: 'oz', factor: 0.0352739619 },

    //Currency - will be populated dynamically
    'EUR': { to: 'BGN', convert: (val) => val * exchangeRates.rates.EUR },
    '€': { to: 'BGN', convert: (val) => val * exchangeRates.rates.EUR },
    'USD': { to: 'BGN', convert: (val) => val * exchangeRates.rates.USD },
    '$': { to: 'BGN', convert: (val) => val * exchangeRates.rates.USD },
    'GBP': { to: 'BGN', convert: (val) => val * exchangeRates.rates.GBP },
    '£': { to: 'BGN', convert: (val) => val * exchangeRates.rates.GBP },

    // Temperature
    '°F': { to: '°C', convert: (val) => (val - 32) * 5/9 },
    '°C': { to: '°F', convert: (val) => (val * 9/5) + 32 },
    
    // Cooking Measurements
    'cup': { to: 'ml', factor: 236.588 },
    'cups': { to: 'ml', factor: 236.588 },
    'tbsp': { to: 'ml', factor: 14.7868 },
    'tbsp.': { to: 'ml', factor: 14.7868 },
    'tbsps': { to: 'ml', factor: 14.7868 },
    'tsp': { to: 'ml', factor: 4.92892 },
    'tsp.': { to: 'ml', factor: 4.92892 },
    'tsps': { to: 'ml', factor: 4.92892 },
    'fl oz': { to: 'ml', factor: 29.5735 },
    'pint': { to: 'ml', factor: 473.176 },
    'pints': { to: 'ml', factor: 473.176 },
    'quart': { to: 'ml', factor: 946.353 },
    'quarts': { to: 'ml', factor: 946.353 },
    'gallon': { to: 'ml', factor: 3785.41 },
    'gallons': { to: 'ml', factor: 3785.41 },
    
    // Speed
    'mph': { to: 'km/h', factor: 1.609344 },
    'km/h': { to: 'mph', factor: 0.621371192 },
    'mpg': { to: 'l/100km', convert: (val) => 235.214583 / val },
    'l/100km': { to: 'mpg', convert: (val) => 235.214583 / val },
    
    // Volume
    'gal': { to: 'l', factor: 3.78541178 },
    'l': { to: 'gal', factor: 0.264172052 },
    'qt': { to: 'l', factor: 0.946352946 },
    'fl': { to: 'ml', factor: 29.5735295625 },
    'ml': { to: 'fl', factor: 0.0338140227 },
    
    // Distance
    'mi': { to: 'km', factor: 1.609344 },
    'km': { to: 'mi', factor: 0.621371192 },
    'yd': { to: 'm', factor: 0.9144 },
    'm': { to: 'yd', factor: 1.0936133 },
    'ft': { to: 'm', factor: 0.3048 },
    'in': { to: 'cm', factor: 2.54 },
    'cm': { to: 'in', factor: 0.393700787 },
    'mm': { to: 'in', factor: 0.0393700787 },
    
    // Power
    'kW': { to: 'hp', factor: 1.34102209 },
    'hp': { to: 'kW', factor: 0.745699872 },
    
    // Torque
    'lb ft': { to: 'Nm', factor: 1.35581795 },
    'Nm': { to: 'lb ft', factor: 0.737562149 }
};

// --- Helper function to fetch exchange rates ---
async function fetchExchangeRates() {
    // Check if we need to update rates (once per day)
    const now = Date.now();
    if (exchangeRates.lastUpdated && 
        now - exchangeRates.lastUpdated < 24 * 60 * 60 * 1000) {
        return; // Use cached rates if less than 24 hours old
    }

    // Rate limiting check
    if (apiCallAttempts >= MAX_API_ATTEMPTS) {
        exchangeRatesError = 'Could not fetch latest rates. Please try again later.';
        return;
    }

    try {
        apiCallAttempts++;
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Validate the response data structure
        if (!data || !data.rates || typeof data.rates !== 'object') {
            throw new Error('Invalid response format from exchange rate API');
        }
        
        // Reset API attempts on success
        apiCallAttempts = 0;
        exchangeRatesError = null; // Clear error on success
        
        // Update rates (converting to preferredCurrency)
        exchangeRates.rates = {};
        const target = preferredCurrency || 'BGN';
        for (const [currency, rate] of Object.entries(data.rates)) {
            if (typeof rate !== 'number' || isNaN(rate)) {
                continue;
            }
            // Calculate conversion rate to preferred currency
            if (currency !== target) {
                exchangeRates.rates[currency] = data.rates[target] / rate;
            } else {
                exchangeRates.rates[currency] = 1; // Correct: base currency rate is always 1
            }
            // Add currency conversion to unitConversions
            if (currency !== target) {
                unitConversions[currency] = {
                    to: target,
                    convert: (val) => val * exchangeRates.rates[currency]
                };
                // Add symbol conversion if available
                if (currencySymbols[currency]) {
                    unitConversions[currencySymbols[currency]] = {
                        to: target,
                        convert: (val) => val * exchangeRates.rates[currency]
                    };
                }
            }
        }
        exchangeRates.lastUpdated = now;   // store epoch ms
        // Save to localStorage
        try {
            localStorage.setItem('exchangeRates', JSON.stringify(exchangeRates));
        } catch (storageError) {
        }
    } catch (error) {
        // Exponential backoff for retries
        if (apiCallAttempts < MAX_API_ATTEMPTS) {
            const retryDelay = BASE_RETRY_DELAY * Math.pow(2, apiCallAttempts - 1);
            setTimeout(() => fetchExchangeRates(), retryDelay);
            return; // Exit early to prevent fallback execution during retry attempts
        }
        exchangeRatesError = 'Could not fetch latest rates. Please try again later.';
        // Load from localStorage if available (only when max retries reached)
        try {
            const cached = localStorage.getItem('exchangeRates');
            if (cached) {
                const parsed = JSON.parse(cached);
                // Validate cached data structure
                if (parsed && typeof parsed === 'object' && 
                    parsed.rates && typeof parsed.rates === 'object' &&
                    parsed.lastUpdated && typeof parsed.lastUpdated === 'number') {
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
                                GBP: 2.3
                            }
                        };
                    }
                } else {
                    // Reset to default rates
                    exchangeRates = {
                        lastUpdated: 0, // Force refresh on next call
                        rates: {
                            EUR: 1.95583,
                            USD: 1.8,
                            GBP: 2.3
                        }
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
                    GBP: 2.3
                }
            };
        }
    }
}

// --- Improved Time Zone Conversion ---
function convertTimeZone(text, userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
    // Enhanced time zone mappings with more comprehensive coverage
    const tzAbbrs = {
        'PST': 'America/Los_Angeles', 'PDT': 'America/Los_Angeles', 'PT': 'America/Los_Angeles',
        'MST': 'America/Denver',      'MDT': 'America/Denver',      'MT': 'America/Denver',
        'CST': 'America/Chicago',     'CDT': 'America/Chicago',     'CT': 'America/Chicago',
        'EST': 'America/New_York',    'EDT': 'America/New_York',    'ET': 'America/New_York',
        'AKST': 'America/Anchorage',  'AKDT': 'America/Anchorage',
        'HST': 'Pacific/Honolulu',
        'GMT': 'Etc/GMT', 'UTC': 'Etc/UTC',
        'CET': 'Europe/Berlin', 'CEST': 'Europe/Berlin',
        'EET': 'Europe/Helsinki', 'EEST': 'Europe/Helsinki',
        'BST': 'Europe/London', 'IST': 'Asia/Kolkata',
        'JST': 'Asia/Tokyo', 'KST': 'Asia/Seoul',
        'AEST': 'Australia/Sydney', 'AEDT': 'Australia/Sydney',
        'ACST': 'Australia/Adelaide', 'ACDT': 'Australia/Adelaide',
        'AWST': 'Australia/Perth',
    };
    // 12-hour: 5 PM PST, 11:30 am CET, 10:00pm PT; 24-hour: 14:00 EST
    const timeZonePattern = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?\s*([A-Z]{2,5})$/i;
    const matchTZ = text.trim().match(timeZonePattern);
    if (!matchTZ) return null;
    let hour = parseInt(matchTZ[1], 10);
    let minute = matchTZ[2] ? parseInt(matchTZ[2], 10) : 0;
    let ampm = matchTZ[3] ? matchTZ[3].toUpperCase() : null;
    let tz = matchTZ[4].toUpperCase();
    if (isNaN(hour) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    if (ampm) {
        if (ampm === 'PM' && hour < 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;
    }
    if (!tzAbbrs[tz]) return null;
    try {
        // Use today's date for conversion
        const now = new Date();
        // Build a date string in the source time zone
        const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00`;
        // Get the source time zone IANA name
        const srcTimeZone = tzAbbrs[tz];
        // Convert to UTC from the source time zone
        const srcDate = new Date(new Date(dateStr + getTimeZoneOffsetString(srcTimeZone, dateStr)).toISOString());
        // Format in user's local time zone
        const localFormatter = new Intl.DateTimeFormat([], {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: userTimeZone
        });
        const localTime = localFormatter.format(srcDate);
        return {
            original: text,
            converted: `${localTime} (your time)`,
            value: localTime
        };
    } catch (e) {
        return null;
    }
}
// Helper to get the offset string for a given IANA time zone and date
function getTimeZoneOffsetString(timeZone, dateStr) {
    try {
        const dtf = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour12: false,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        const parts = dtf.formatToParts(new Date(dateStr));
        const y = parts.find(p => p.type === 'year').value;
        const m = parts.find(p => p.type === 'month').value;
        const d = parts.find(p => p.type === 'day').value;
        const h = parts.find(p => p.type === 'hour').value;
        const min = parts.find(p => p.type === 'minute').value;
        const s = parts.find(p => p.type === 'second').value;
        const utc = Date.UTC(y, m-1, d, h, min, s);
        const local = new Date(`${dateStr}`).getTime();
        const offset = (local - utc) / 60000;
        const sign = offset <= 0 ? '+' : '-';
        const abs = Math.abs(offset);
        const hh = String(Math.floor(abs/60)).padStart(2,'0');
        const mm = String(abs%60).padStart(2,'0');
        return `${sign}${hh}:${mm}`;
    } catch {
        return '+00:00';
    }
}

// --- Helper function to detect and convert units ---
async function detectAndConvertUnit(text) {
    // First, check for crypto
    const upperCaseText = text.toUpperCase();
    if (cryptoCurrencies[upperCaseText]) {
        await fetchCryptoRates();
        const id = cryptoCurrencies[upperCaseText];
        let vsCurrency = preferredCryptoCurrency ? preferredCryptoCurrency.toLowerCase() : 'usd';
        let price = null;
        if (vsCurrency === 'bgn' && cryptoRates.prices[id] && cryptoRates.prices[id]['eur'] && exchangeRates.rates && exchangeRates.rates['EUR']) {
            price = cryptoRates.prices[id]['eur'] * exchangeRates.rates['EUR'];
        } else if (cryptoRates.prices[id] && cryptoRates.prices[id][vsCurrency]) {
            price = cryptoRates.prices[id][vsCurrency];
        }
        if (price !== null) {
            return {
                original: `1 ${upperCaseText}`,
                converted: `${price.toFixed(2)} ${preferredCryptoCurrency.toUpperCase()}`,
                value: price
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
    const currencySymbolPattern = '[a-zA-Z°/€$£¥₺₽₹₩₪₱฿₣₦₲₵₡₫₭₮₯₠₢₳₴₸₼₾₿]';
    const valueUnitPattern = new RegExp(`^(-?\\d{1,3}(?:[.,\\s]\\d{3})*(?:[.,]\\d+)?|\\d+/\\d+)\\s*(${currencySymbolPattern}+(?:\\s+[a-zA-Z]+)?)?[.,;:!?]*$`, 'i');
    const unitValuePattern = new RegExp(`^(${currencySymbolPattern}+(?:\\s+[a-zA-Z]+)?)\\s*(-?\\d{1,3}(?:[.,\\s]\\d{3})*(?:[.,]\\d+)?|\\d+/\\d+)[.,;:!?]*$`, 'i');
    
    const valueUnitMatch = text.trim().match(valueUnitPattern);
    const unitValueMatch = text.trim().match(unitValuePattern);
    
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
    
    // Handle fractions
    if (value.includes('/')) {
        const [numerator, denominator] = value.split('/');
        value = parseFloat(numerator.replace(',', '.').replace(/\s/g, '')) / parseFloat(denominator.replace(',', '.').replace(/\s/g, ''));
    } else {
        // Normalize value: remove thousands separators (dot, comma, space), replace decimal comma with period
        value = value.replace(/[.\,\s](?=\d{3}(\D|$))/g, ''); // Remove thousands sep (dot, comma, space)
        value = value.replace(',', '.'); // Replace decimal comma with period
        value = parseFloat(value);
    }
    
    // Special case for temperature without F suffix
    if (unit === '°') {
        return {
            original: `${value}°`,
            converted: `${((value - 32) * 5/9).toFixed(1)}°C`,
            value: (value - 32) * 5/9
        };
    }
    
    // Find matching unit conversion
    // Normalize unit: trim, lowercase, remove spaces and handle common variants
    let normUnit = (unit || '').toLowerCase().replace(/\s+/g, '');
    if (normUnit === 'l/100km' || normUnit === 'l/100km' || normUnit === 'l/100km' || normUnit === 'l/100km') {
        normUnit = 'l/100km';
    } else if (normUnit === 'mpg') {
        normUnit = 'mpg';
    }
    for (const [key, conversion] of Object.entries(unitConversions)) {
        let normKey = key.toLowerCase().replace(/\s+/g, '');
        if (normKey === normUnit) {
            let converted;
            if (conversion.convert) {
                converted = conversion.convert(value);
            } else {
                converted = value * conversion.factor;
            }
            // Round to 2 decimal places for currency, 4 for other units
            const decimals = key.match(/[€$£]/) || cryptoCurrencies[key.toUpperCase()] ? 2 : 4;
            converted = Math.round(converted * Math.pow(10, decimals)) / Math.pow(10, decimals);
            return {
                original: `${value} ${key}`,
                converted: `${converted} ${conversion.to}`,
                value: converted
            };
        }
    }
    
    return null;
}

// --- Add styles to document head (once) ---
const styleElement = document.createElement('style');
styleElement.textContent = `
    #text-selection-popup-extension {
        position: fixed;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 4px;
        display: none;
        opacity: 0;
        width: 160px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: normal;
        font-style: normal;
        line-height: 1.4;
        text-transform: none;
        letter-spacing: normal;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 2147483647;
        transition: opacity 0.2s ease-in-out;
        box-sizing: border-box;
    }

    /* Arrow Base Styling */
    #text-selection-popup-extension::before,
    #text-selection-popup-extension::after {
        content: '';
        position: absolute;
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        display: none;
    }

    #text-selection-popup-extension.arrow-bottom::after {
        display: block;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        border-top: 8px solid white;
    }

    #text-selection-popup-extension.arrow-top::before {
        display: block;
        top: -8px;
        left: 50%;
        transform: translateX(-50%);
        border-bottom: 8px solid white;
    }

    #text-selection-popup-extension.dark-mode {
        background: #333333;
        border-color: #555555;
        color: #FFFFFF;
    }

    #text-selection-popup-extension.dark-mode.arrow-bottom::after {
        border-top-color: #333333;
    }

    #text-selection-popup-extension.dark-mode.arrow-top::before {
        border-bottom-color: #333333;
    }

    .extension-action-button {
        flex: 1;
        padding: 3px 10px;
        border: none;
        border-radius: 5px;
        background-color: #AAAAAA;
        color: white;
        cursor: pointer;
        transition: background-color 0.18s, box-shadow 0.18s;
        font-family: Arial, sans-serif;
        font-size: 12px;
        font-weight: normal;
        font-style: normal;
        line-height: 1.4;
        text-transform: none;
        letter-spacing: normal;
        text-align: center;
        white-space: nowrap;
        box-shadow: none;
    }

    .extension-action-button:hover, .extension-action-button:focus {
        background-color: #9e9e9eff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.10);
        outline: none;
    }

    #text-selection-popup-extension.dark-mode .extension-action-button {
        background-color: #555555;
        color: #FFFFFF;
    }

    #text-selection-popup-extension.dark-mode .extension-action-button:hover, #text-selection-popup-extension.dark-mode .extension-action-button:focus {
        background-color: #5a5959ff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.18);
        outline: none;
    }

    .conversion-result {
        padding: 4px 8px;
        margin: 4px 0;
        background: #f5f5f5;
        color: #000;
        border-radius: 4px;
        cursor: pointer;
    }

    .conversion-result:hover {
        background: #f0f0f0;
    }

    .conversion-result {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .conversion-result .copy-button {
        display: none;
        padding: 2px 6px;
        font-size: 12px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        margin-left: 8px;
        flex-shrink: 0;
    }

    .conversion-result:hover .copy-button {
        display: inline-block;
    }

    #text-selection-popup-extension.dark-mode .conversion-result {
        background: #5a5a5a;
        color: #fff;
    }

    #text-selection-popup-extension.dark-mode .conversion-result:hover {
        background: #6a6a6a;
    }
`;
document.head.appendChild(styleElement);

// --- Create the popup element (once) ---
const popup = document.createElement('div');
popup.id = 'text-selection-popup-extension'; // ID is used by CSS

// --- Create popup content (once) using safe DOM manipulation ---
// Error container
const errorContainer = document.createElement('div');
errorContainer.id = 'errorContainer';
errorContainer.style.display = 'none';
errorContainer.style.color = 'red';
errorContainer.style.padding = '4px';
errorContainer.style.textAlign = 'center';
popup.appendChild(errorContainer);

// Conversion container
const conversionContainer = document.createElement('div');
conversionContainer.id = 'conversionContainer';
conversionContainer.style.display = 'none';

const conversionResult = document.createElement('div');
conversionResult.className = 'conversion-result';

const convertedValueSpan = document.createElement('span');
convertedValueSpan.className = 'converted-value';
conversionResult.appendChild(convertedValueSpan);

const copyButton = document.createElement('button');
copyButton.className = 'copy-button';
copyButton.textContent = 'Copy';
conversionResult.appendChild(copyButton);

conversionContainer.appendChild(conversionResult);
popup.appendChild(conversionContainer);

// Button container
const buttonContainer = document.createElement('div');
buttonContainer.style.display = 'flex';
buttonContainer.style.flexDirection = 'row';
buttonContainer.style.gap = '8px';
buttonContainer.style.justifyContent = 'space-between';

// Search button
const searchButton = document.createElement('button');
searchButton.id = 'extensionSearchButton';
searchButton.className = 'extension-action-button';
searchButton.textContent = 'Search';
buttonContainer.appendChild(searchButton);

// Copy button
const copyButton2 = document.createElement('button');
copyButton2.id = 'extensionCopyButton';
copyButton2.className = 'extension-action-button';
copyButton2.textContent = 'Copy';
buttonContainer.appendChild(copyButton2);

popup.appendChild(buttonContainer);
document.body.appendChild(popup);

// --- Helper function to handle clipboard fallback for copying text ---
async function handleClipboardFallback(textToCopy) {
    try {
        // Try using the modern Clipboard API first
        await navigator.clipboard.writeText(textToCopy);
        hidePopup();
    } catch (err) {
        // Fallback to a more modern approach using a temporary input
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            // Try using the modern Clipboard API with the selected text
            await navigator.clipboard.writeText(textArea.value);
        } catch (err) {
        } finally {
            document.body.removeChild(textArea);
            hidePopup();
        }
    }
}

// --- Theme and Background Detection Helpers (from previous robust version) ---
function isEffectivelyTransparent(colorString) {
    if (!colorString) return true;
    const lowerColorString = colorString.toLowerCase();
    if (lowerColorString === 'transparent') return true;
    const match = lowerColorString.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
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
        if (currentElement === document.body || currentElement === document.documentElement) {
            break;
        }
        currentElement = currentElement.parentElement;
    }
    let finalBgColor = window.getComputedStyle(document.body).backgroundColor;
    if (!isEffectivelyTransparent(finalBgColor)) return finalBgColor;
    finalBgColor = window.getComputedStyle(document.documentElement).backgroundColor;
    if (!isEffectivelyTransparent(finalBgColor)) return finalBgColor;
    return 'rgb(255, 255, 255)'; // Absolute fallback
}

function isColorDark(colorString) {
    if (isEffectivelyTransparent(colorString)) return false;
    let r, g, b;
    const lowerColorString = colorString.toLowerCase();
    if (lowerColorString.startsWith('rgb')) {
        const match = lowerColorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
        if (!match) return false;
        [r, g, b] = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    } else if (lowerColorString.startsWith('#')) {
        let hex = lowerColorString.slice(1);
        if (hex.length === 3) hex = hex.split('').map(char => char + char).join('');
        if (hex.length !== 6) return false;
        [r, g, b] = [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
    } else {
        const tempElem = document.createElement('div');
        tempElem.style.color = lowerColorString;
        document.body.appendChild(tempElem);
        const computedColor = window.getComputedStyle(tempElem).color;
        document.body.removeChild(tempElem);
        if (!computedColor.startsWith('rgb')) return false;
        const match = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!match) return false;
        [r, g, b] = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    }
    const luminance = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
    return luminance < 0.5;
}

/**
 * Applies theme and arrow classes to the popup.
 * @param {boolean} isPageDark - True if the page background is dark.
 * @param {boolean} isPopupBelowSelection - True if the popup is positioned below the selection.
 */
function applyThemeAndArrow(isPageDark, isPopupBelowSelection) {
    popup.classList.toggle('dark-mode', isPageDark);
    if (isPopupBelowSelection) {
        popup.classList.add('arrow-top');
        popup.classList.remove('arrow-bottom');
    } else {
        popup.classList.add('arrow-bottom');
        popup.classList.remove('arrow-top');
    }
}

// --- Helper function to detect URLs in text ---
function detectUrl(text) {
    // More comprehensive URL pattern
    const urlPattern = /^(https?:\/\/)?(([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)(\/[^\s]*)?$/;
    
    return urlPattern.test(text);
}

// --- Helper function to format URL ---
function formatUrl(text) {
    if (!text.startsWith('http://') && !text.startsWith('https://')) {
        return 'https://' + text;
    }
    return text;
}

function getSearchUrl(query) {
    switch (preferredSearchEngine) {
        case 'duckduckgo':
            return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
        case 'bing':
            return `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
        case 'yahoo':
            return `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
        case 'startpage':
            return `https://www.startpage.com/do/dsearch?query=${encodeURIComponent(query)}`;
        case 'brave':
            return `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
        case 'qwant':
            return `https://www.qwant.com/?q=${encodeURIComponent(query)}`;
        case 'ecosia':
            return `https://www.ecosia.org/search?q=${encodeURIComponent(query)}`;
        case 'google':
        default:
            return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    }
}

// --- Initialize button event listeners (called once on script load) ---
function initPopupButtons() {
    const searchButton = document.getElementById('extensionSearchButton');
    const copyButton = document.getElementById('extensionCopyButton');
    const conversionContainer = document.getElementById('conversionContainer');
    const convertedValueSpan = conversionContainer.querySelector('.converted-value');
    const copyConvertedButton = conversionContainer.querySelector('.copy-button');

    if (searchButton) {
        searchButton.addEventListener('click', () => {
            if (currentSelectedText) {
                if (isUrlSelected) {
                    const url = formatUrl(currentSelectedText);
                    try {
                        const urlObj = new URL(url);
                        if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
                            window.open(url, '_blank');
                        } else {
                            const searchUrl = getSearchUrl(currentSelectedText);
                            window.open(searchUrl, '_blank');
                        }
                    } catch (e) {
                        const searchUrl = getSearchUrl(currentSelectedText);
                        window.open(searchUrl, '_blank');
                    }
                } else {
                    const searchUrl = getSearchUrl(currentSelectedText);
                    window.open(searchUrl, '_blank');
                }
                hidePopup();
            }
        });
    }

    if (copyButton) {
        copyButton.addEventListener('click', () => {
            if (currentSelectedText) {
                handleClipboardFallback(currentSelectedText);
            }
        });
    }

    if (copyConvertedButton) {
        copyConvertedButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (convertedValue) {
                handleClipboardFallback(convertedValue.converted);
            }
        });
    }
}

// --- Function to show and position the popup ---
async function showAndPositionPopup(rect, selectionContextElement) {
    popup.style.opacity = '0';
    popup.style.display = 'block';

    const errorContainer = document.getElementById('errorContainer');
    const conversionContainer = document.getElementById('conversionContainer');
    const convertedValueSpan = conversionContainer.querySelector('.converted-value');

    // Check for unit conversion
    convertedValue = await detectAndConvertUnit(currentSelectedText);
    if (convertedValue) {
        errorContainer.style.display = 'none';
        conversionContainer.style.display = 'block';
        convertedValueSpan.textContent = convertedValue.converted;
    } else {
        // Only show error if selection looks like a currency/crypto value
        const upperCaseText = currentSelectedText.toUpperCase();
        const isCrypto = cryptoCurrencies[upperCaseText];
        const currencyRegex = /[€$£¥₺₽₹₩₪₱฿₣₦₲₵₡₫₭₮₯₠₢₳₴₸₼₾₿]|[A-Z]{3}/;
        if ((isCrypto && cryptoRatesError) || (currencyRegex.test(currentSelectedText) && exchangeRatesError)) {
            errorContainer.textContent = exchangeRatesError || cryptoRatesError;
            errorContainer.style.display = 'block';
        } else {
            errorContainer.style.display = 'none';
        }
        conversionContainer.style.display = 'none';
    }

    // Update button text based on URL detection
    const searchButton = document.getElementById('extensionSearchButton');
    isUrlSelected = detectUrl(currentSelectedText);
    if (searchButton) {
        searchButton.textContent = isUrlSelected ? 'Visit website' : 'Search';
    }

    const popupHeight = popup.offsetHeight;
    const popupWidth = popup.offsetWidth;
    const margin = 10; // Margin from viewport edges
    const arrowGap = 10; // Gap between selection and popup (includes arrow height)

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const selectionCenterX = rect.left + (rect.width / 2);

    let top, left;
    let isPopupBelow = false; // Flag to track popup position relative to selection

    // Try to position popup above the selection
    top = rect.top - popupHeight - arrowGap;
    left = selectionCenterX - (popupWidth / 2);

    // If positioning above makes it go off-screen (or not enough margin), position below
    if (top < margin) {
        top = rect.bottom + arrowGap;
        isPopupBelow = true;
    }

    // Adjust horizontal position to keep popup within viewport
    left = Math.max(margin, Math.min(left, viewportWidth - popupWidth - margin));

    // Final check to ensure popup stays within viewport vertically
    top = Math.max(margin, Math.min(top, viewportHeight - popupHeight - margin));

    // If clamping 'top' changed its relation to selection, re-evaluate isPopupBelow
    if (!isPopupBelow && top > rect.bottom) isPopupBelow = true;
    if (isPopupBelow && top < rect.top - popupHeight) isPopupBelow = false;


    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;

    // Determine background and apply theme/arrow
    const pageBackgroundColor = getEffectiveBackgroundColor(selectionContextElement);
    const isPageDark = isColorDark(pageBackgroundColor);
    
    // Force immediate theme application without transitions
    popup.style.transition = 'none';
    applyThemeAndArrow(isPageDark, isPopupBelow);
    
    // Re-enable transitions after theme is applied
    requestAnimationFrame(() => {
        popup.style.transition = 'opacity 0.2s ease-in-out';
    });

    requestAnimationFrame(() => {
        popup.style.opacity = '1'; // Fade in
    });
}

// --- Function to hide the popup with fade-out ---
let hidePopupTimeout;
const HIDE_DELAY = 3000; // 3 seconds delay before hiding popup
function hidePopup() {
    popup.style.opacity = '0';
    clearTimeout(hidePopupTimeout);
    hidePopupTimeout = setTimeout(() => {
        popup.style.display = 'none';
        popup.classList.remove('arrow-top', 'arrow-bottom');
    }, 200);
}

// --- Global Event Listeners ---
document.addEventListener('mouseup', function (e) {
    if (popup.contains(e.target)) {
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
    if (selectedTextTrimmed && 
        selectedTextTrimmed.length >= MIN_SELECTION_LENGTH && 
        selectedTextTrimmed.length <= MAX_SELECTION_LENGTH) {
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
                }, HIDE_DELAY);
            }, 100);
        } else {
            hidePopup();
        }
    } else if (!popup.contains(e.target)) {
        hidePopup();
    }
});

// Reset selection complete flag when selection changes
document.addEventListener('mousedown', function (e) {
    isSelectionComplete = false;
    clearTimeout(hidePopupTimeout); // Clear any existing timer
    if (popup.style.display === 'block' && !popup.contains(e.target)) {
        hidePopup();
    }
});

window.addEventListener('scroll', () => {
    if (popup.style.opacity === '1') {
        hidePopup();
    }
}, true);

window.addEventListener('resize', () => {
    if (popup.style.opacity === '1') {
        hidePopup();
    }
});

// --- Global error handler ---
window.addEventListener('error', function(event) {
    // Prevent error from bubbling up
    event.preventDefault();
    return false;
});

window.addEventListener('unhandledrejection', function(event) {
    // Prevent error from bubbling up
    event.preventDefault();
    return false;
});

// --- Initialize ---
initPopupButtons();
fetchExchangeRates(); // Fetch exchange rates on startup
fetchCryptoRates(); // Fetch crypto rates on startup