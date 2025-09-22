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

// Make variables globally accessible for the cache system
if (typeof window !== 'undefined') {
    window.preferredCurrency = preferredCurrency;
    window.preferredCryptoCurrency = preferredCryptoCurrency;
    window.preferredSearchEngine = preferredSearchEngine;
}

// Fetch all preferences from chrome.storage.sync
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['preferredCurrency', 'preferredCryptoCurrency', 'preferredSearchEngine'], (result) => {
        if (result.preferredCurrency) {
            preferredCurrency = result.preferredCurrency;
            if (typeof window !== 'undefined') window.preferredCurrency = preferredCurrency;
        }
        if (result.preferredCryptoCurrency) {
            preferredCryptoCurrency = result.preferredCryptoCurrency;
            if (typeof window !== 'undefined') window.preferredCryptoCurrency = preferredCryptoCurrency;
        }
        if (result.preferredSearchEngine) {
            preferredSearchEngine = result.preferredSearchEngine;
            if (typeof window !== 'undefined') window.preferredSearchEngine = preferredSearchEngine;
        }
        
        // Update rates from cache system (cache system handles the actual fetching)
        updateRatesFromCache();
    });
} else {
    // Update rates from cache system
    updateRatesFromCache();
}

/**
 * Update legacy rate objects from the cache system
 * This maintains backward compatibility while using the new cache system
 */
function updateRatesFromCache() {
    // The cache system initialization happens automatically via startup.js
    // This function updates the legacy global variables when cache is ready
    
    const cacheManager = getCacheManager();
    if (cacheManager && cacheManager.getStatus().isReady) {
        // Cache is ready, update immediately (silently)
        fetchExchangeRates();
        fetchCryptoRates();
    } else {
        // Cache not ready yet, wait for initialization (reduce logging)
        let hasLoggedWaiting = false;
        
        // Check periodically for cache readiness
        const checkCacheReady = () => {
            const manager = getCacheManager();
            if (manager && manager.getStatus().isReady) {
                if (!hasLoggedWaiting) {
                    console.log('Cache system ready, updating rates');
                }
                fetchExchangeRates();
                fetchCryptoRates();
            } else {
                if (!hasLoggedWaiting) {
                    console.log('Waiting for cache system to initialize...');
                    hasLoggedWaiting = true;
                }
                // Check again in 500ms
                setTimeout(checkCacheReady, 500);
            }
        };
        
        // Start checking after a short delay to allow initialization
        setTimeout(checkCacheReady, 1000);
    }
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

// Flag to prevent multiple simultaneous API calls
let isFetchingCryptoRates = false;

async function fetchCryptoRates() {
    // This function is now deprecated - crypto rates are loaded via the cache system
    // Keep for backward compatibility but use cache system instead
    
    const cacheManager = getCacheManager();
    if (!cacheManager) {
        return; // Silently return if cache manager not available
    }
    
    const cacheStatus = cacheManager.getStatus();
    if (!cacheStatus.isReady) {
        return; // Silently return if cache not ready
    }
    
    // Update legacy cryptoRates object from cache for backward compatibility
    cryptoRates.lastUpdated = cacheStatus.lastUpdated || Date.now();
    cryptoRates.prices = {};
    
    // Populate crypto prices from cache
    for (const [symbol, coinId] of Object.entries(cryptoCurrencies)) {
        cryptoRates.prices[coinId] = {};
        
        // Get rates for common currencies
        const currencies = ['usd', 'eur', 'bgn'];
        for (const currency of currencies) {
            const rate = cacheManager.getCryptoRate(coinId, currency);
            if (rate !== null) {
                cryptoRates.prices[coinId][currency] = rate;
            }
        }
    }
    
    // Update unit conversions for crypto currencies
    updateCryptoUnitConversions(cacheManager);
    
    cryptoRatesError = null; // Clear any previous errors
    // Only log once per session to reduce noise
    if (!window.hasLoggedCryptoRates) {
        console.log('Crypto rates updated from cache:', Object.keys(cryptoRates.prices).length, 'coins');
        window.hasLoggedCryptoRates = true;
    }
}

/**
 * Update crypto currency conversions in unitConversions using cache data
 */
function updateCryptoUnitConversions(cacheManager) {
    try {
        const targetCurrency = preferredCryptoCurrency ? preferredCryptoCurrency.toLowerCase() : 'usd';
        
        for (const [symbol, coinId] of Object.entries(cryptoCurrencies)) {
            let rate = cacheManager.getCryptoRate(coinId, targetCurrency);
            let toLabel = preferredCryptoCurrency || 'USD';
            
            // Handle BGN conversion through EUR if needed
            if (targetCurrency === 'bgn' && rate === null) {
                const eurRate = cacheManager.getCryptoRate(coinId, 'eur');
                const bgnToEurRate = cacheManager.getFiatRate('EUR');
                
                if (eurRate !== null && bgnToEurRate !== null) {
                    rate = eurRate * bgnToEurRate;
                    toLabel = 'BGN';
                }
            }
            
            if (rate !== null) {
                unitConversions[symbol] = {
                    to: toLabel,
                    convert: (val) => val * rate
                };
            }
        }
        
        // Only log once per session to reduce noise
        if (!window.hasLoggedCryptoConversions) {
            console.log('Crypto unit conversions updated for', Object.keys(cryptoCurrencies).length, 'currencies');
            window.hasLoggedCryptoConversions = true;
        }
        
    } catch (error) {
        console.error('Failed to update crypto unit conversions:', error);
    }
}

/**
 * Get cryptocurrency price from cache system
 * @param {string} cryptoSymbol - Crypto symbol (e.g., 'BTC')
 * @returns {Object|null} Price object with value, currency, and cache info, or null if not found
 */
function getCryptoPriceFromCache(cryptoSymbol) {
    try {
        const cacheManager = getCacheManager();
        if (!cacheManager) {
            console.log('Cache manager not available');
            return null;
        }
        
        const cacheStatus = cacheManager.getStatus();
        if (!cacheStatus.isReady) {
            console.log('Cache not ready yet');
            return null;
        }
        
        const coinId = cryptoCurrencies[cryptoSymbol];
        if (!coinId) {
            console.log('Unsupported crypto symbol:', cryptoSymbol);
            return null;
        }
        
        const targetCurrency = preferredCryptoCurrency ? preferredCryptoCurrency.toLowerCase() : 'usd';
        let rate = cacheManager.getCryptoRate(coinId, targetCurrency);
        let currency = preferredCryptoCurrency || 'USD';
        
        // Handle BGN conversion through EUR if direct BGN rate not available
        if (targetCurrency === 'bgn' && rate === null) {
            const eurRate = cacheManager.getCryptoRate(coinId, 'eur');
            const bgnToEurRate = cacheManager.getFiatRate('EUR');
            
            if (eurRate !== null && bgnToEurRate !== null) {
                rate = eurRate * bgnToEurRate;
                currency = 'BGN';
                console.log(`Using EUR->BGN conversion: ${eurRate} EUR * ${bgnToEurRate} = ${rate} BGN`);
            }
        }
        
        if (rate === null) {
            console.log(`No rate found for ${coinId} in ${targetCurrency}`);
            return null;
        }
        
        return {
            value: rate,
            currency: currency,
            cacheAge: cacheStatus.cacheAge,
            isStale: cacheStatus.isStale,
            lastUpdated: cacheStatus.lastUpdated
        };
        
    } catch (error) {
        console.error('Error getting crypto price from cache:', error);
        return null;
    }
}

/**
 * Get fiat currency conversion rate from cache system
 * @param {string} fromCurrency - Source currency code (e.g., 'USD')
 * @param {string} toCurrency - Target currency code (e.g., 'BGN')
 * @returns {Object|null} Conversion object with rate, currencies, and cache info, or null if not found
 */
function getFiatConversionFromCache(fromCurrency, toCurrency) {
    try {
        const cacheManager = getCacheManager();
        if (!cacheManager) {
            console.log('Cache manager not available');
            return null;
        }
        
        const cacheStatus = cacheManager.getStatus();
        if (!cacheStatus.isReady) {
            console.log('Cache not ready yet');
            return null;
        }
        

        
        // Normalize currency codes to uppercase
        fromCurrency = fromCurrency.toUpperCase();
        toCurrency = toCurrency.toUpperCase();
        
        // If same currency, return 1:1 rate
        if (fromCurrency === toCurrency) {
            return {
                rate: 1,
                fromCurrency: fromCurrency,
                toCurrency: toCurrency,
                cacheAge: cacheStatus.cacheAge,
                isStale: cacheStatus.isStale,
                lastUpdated: cacheStatus.lastUpdated
            };
        }
        
        // Get rates for both currencies
        // The cache stores rates as "how many units of currency = 1 USD"
        let fromRate = cacheManager.getFiatRate(fromCurrency);
        let toRate = cacheManager.getFiatRate(toCurrency);
        
        // Handle BGN fallback - if BGN is not in cache, use legacy exchange rates
        if (toCurrency === 'BGN' && toRate === null) {
            // BGN is the target currency but not in cache
            // Use legacy exchange rates system as fallback
            if (typeof exchangeRates !== 'undefined' && exchangeRates.rates && exchangeRates.rates.USD) {
                toRate = exchangeRates.rates.USD; // How many BGN = 1 USD
            } else {
                toRate = 1.8; // Default: 1 USD = 1.8 BGN
            }
        }
        
        if (fromCurrency === 'BGN' && fromRate === null) {
            // BGN is the source currency but not in cache
            // Use legacy exchange rates system as fallback
            if (typeof exchangeRates !== 'undefined' && exchangeRates.rates && exchangeRates.rates.USD) {
                fromRate = exchangeRates.rates.USD; // How many BGN = 1 USD
            } else {
                fromRate = 1.8; // Default: 1 USD = 1.8 BGN
            }
        }
        
        if (fromRate === null || toRate === null) {
            console.log(`Fiat rates not found: ${fromCurrency}=${fromRate}, ${toCurrency}=${toRate}`);
            return null;
        }
        
        // Convert: fromCurrency -> USD -> toCurrency
        // If 1 USD = fromRate units of fromCurrency
        // And 1 USD = toRate units of toCurrency  
        // Then 1 unit of fromCurrency = (toRate / fromRate) units of toCurrency
        const conversionRate = toRate / fromRate;
        
        return {
            rate: conversionRate,
            fromCurrency: fromCurrency,
            toCurrency: toCurrency,
            cacheAge: cacheStatus.cacheAge,
            isStale: cacheStatus.isStale,
            lastUpdated: cacheStatus.lastUpdated
        };
        
    } catch (error) {
        console.error('Error getting fiat conversion from cache:', error);
        return null;
    }
}


// --- Rate limiting for API calls ---
let apiCallAttempts = 0;
const MAX_API_ATTEMPTS = 3;
const BASE_RETRY_DELAY = 1000; // 1 second

// Flag to prevent multiple simultaneous exchange rate API calls
let isFetchingExchangeRates = false;

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
    'pound': { to: 'kg', factor: 0.45359237 },
    'pounds': { to: 'kg', factor: 0.45359237 },
    'kg': { to: 'lb', factor: 2.20462262 },
    'kilogram': { to: 'lb', factor: 2.20462262 },
    'kilograms': { to: 'lb', factor: 2.20462262 },
    'kilo': { to: 'lb', factor: 2.20462262 },
    'kilos': { to: 'lb', factor: 2.20462262 },
    'oz': { to: 'g', factor: 28.3495231 },
    'ounce': { to: 'g', factor: 28.3495231 },
    'ounces': { to: 'g', factor: 28.3495231 },
    'g': { to: 'oz', factor: 0.0352739619 },
    'gram': { to: 'oz', factor: 0.0352739619 },
    'grams': { to: 'oz', factor: 0.0352739619 },

    //Currency - will be populated dynamically
    'EUR': { to: 'BGN', convert: (val) => val * exchangeRates.rates.EUR },
    '€': { to: 'BGN', convert: (val) => val * exchangeRates.rates.EUR },
    'USD': { to: 'BGN', convert: (val) => val * exchangeRates.rates.USD },
    '$': { to: 'BGN', convert: (val) => val * exchangeRates.rates.USD },
    'GBP': { to: 'BGN', convert: (val) => val * exchangeRates.rates.GBP },
    '£': { to: 'BGN', convert: (val) => val * exchangeRates.rates.GBP },

    // Temperature
    '°F': { to: '°C', convert: (val) => (val - 32) * 5 / 9 },
    '°C': { to: '°F', convert: (val) => (val * 9 / 5) + 32 },
    'fahrenheit': { to: '°C', convert: (val) => (val - 32) * 5 / 9 },
    'celsius': { to: '°F', convert: (val) => (val * 9 / 5) + 32 },
    'centigrade': { to: '°F', convert: (val) => (val * 9 / 5) + 32 },

    // Cooking Measurements
    'cup': { to: 'ml', factor: 236.588 },
    'cups': { to: 'ml', factor: 236.588 },
    'cupsful': { to: 'ml', factor: 236.588 },
    'tbsp': { to: 'ml', factor: 14.7868 },
    'tbsp.': { to: 'ml', factor: 14.7868 },
    'tbsps': { to: 'ml', factor: 14.7868 },
    'tablespoon': { to: 'ml', factor: 14.7868 },
    'tablespoons': { to: 'ml', factor: 14.7868 },
    'tsp': { to: 'ml', factor: 4.92892 },
    'tsp.': { to: 'ml', factor: 4.92892 },
    'tsps': { to: 'ml', factor: 4.92892 },
    'teaspoon': { to: 'ml', factor: 4.92892 },
    'teaspoons': { to: 'ml', factor: 4.92892 },
    'fl oz': { to: 'ml', factor: 29.5735 },
    'floz': { to: 'ml', factor: 29.5735 },
    'fluid ounce': { to: 'ml', factor: 29.5735 },
    'fluid ounces': { to: 'ml', factor: 29.5735 },
    'pint': { to: 'ml', factor: 473.176 },
    'pints': { to: 'ml', factor: 473.176 },
    'quart': { to: 'ml', factor: 946.353 },
    'quarts': { to: 'ml', factor: 946.353 },
    'gallon': { to: 'ml', factor: 3785.41 },
    'gallons': { to: 'ml', factor: 3785.41 },

    // Speed
    'mph': { to: 'km/h', factor: 1.609344 },
    'milesperhour': { to: 'km/h', factor: 1.609344 },
    'miles per hour': { to: 'km/h', factor: 1.609344 },
    'km/h': { to: 'mph', factor: 0.621371192 },
    'kph': { to: 'mph', factor: 0.621371192 },
    'kmh': { to: 'mph', factor: 0.621371192 },
    'kilometersperhour': { to: 'mph', factor: 0.621371192 },
    'kilometers per hour': { to: 'mph', factor: 0.621371192 },
    'mpg': { to: 'l/100km', convert: (val) => 235.214583 / val },
    'l/100km': { to: 'mpg', convert: (val) => 235.214583 / val },

    // Volume
    'gal': { to: 'l', factor: 3.78541178 },
    'l': { to: 'gal', factor: 0.264172052 },
    'liter': { to: 'gal', factor: 0.264172052 },
    'litre': { to: 'gal', factor: 0.264172052 },
    'qt': { to: 'l', factor: 0.946352946 },
    'fl': { to: 'ml', factor: 29.5735295625 },
    'ml': { to: 'fl', factor: 0.0338140227 },
    'milliliter': { to: 'fl', factor: 0.0338140227 },
    'millilitre': { to: 'fl', factor: 0.0338140227 },

    // Distance
    'mi': { to: 'km', factor: 1.609344 },
    'mile': { to: 'km', factor: 1.609344 },
    'miles': { to: 'km', factor: 1.609344 },
    'km': { to: 'mi', factor: 0.621371192 },
    'kilometer': { to: 'mi', factor: 0.621371192 },
    'kilometre': { to: 'mi', factor: 0.621371192 },
    'kilometers': { to: 'mi', factor: 0.621371192 },
    'kilometres': { to: 'mi', factor: 0.621371192 },
    'yd': { to: 'm', factor: 0.9144 },
    'yard': { to: 'm', factor: 0.9144 },
    'yards': { to: 'm', factor: 0.9144 },
    'm': { to: 'yd', factor: 1.0936133 },
    'meter': { to: 'yd', factor: 1.0936133 },
    'metre': { to: 'yd', factor: 1.0936133 },
    'meters': { to: 'yd', factor: 1.0936133 },
    'metres': { to: 'yd', factor: 1.0936133 },
    'ft': { to: 'm', factor: 0.3048 },
    'foot': { to: 'm', factor: 0.3048 },
    'feet': { to: 'm', factor: 0.3048 },
    'in': { to: 'cm', factor: 2.54 },
    'inch': { to: 'cm', factor: 2.54 },
    'inches': { to: 'cm', factor: 2.54 },
    'centimeter': { to: 'in', factor: 0.393700787 },
    'centimetre': { to: 'in', factor: 0.393700787 },
    'centimeters': { to: 'in', factor: 0.393700787 },
    'centimetres': { to: 'in', factor: 0.393700787 },
    'cm': { to: 'in', factor: 0.393700787 },
    'mm': { to: 'in', factor: 0.0393700787 },
    'millimeter': { to: 'in', factor: 0.0393700787 },
    'millimetre': { to: 'in', factor: 0.0393700787 },
    'millimeters': { to: 'in', factor: 0.0393700787 },
    'millimetres': { to: 'in', factor: 0.0393700787 },

    // Power
    'kW': { to: 'hp', factor: 1.34102209 },
    'kilowatt': { to: 'hp', factor: 1.34102209 },
    'kilowatts': { to: 'hp', factor: 1.34102209 },
    'hp': { to: 'kW', factor: 0.745699872 },
    'horsepower': { to: 'kW', factor: 0.745699872 },
    'horse power': { to: 'kW', factor: 0.745699872 },

    // Torque
    'lb ft': { to: 'Nm', factor: 1.35581795 },
    'lb-ft': { to: 'Nm', factor: 1.35581795 },
    'poundfoot': { to: 'Nm', factor: 1.35581795 },
    'pound-foot': { to: 'Nm', factor: 1.35581795 },
    'pound feet': { to: 'Nm', factor: 1.35581795 },
    'Nm': { to: 'lb ft', factor: 0.737562149 },
    'newtonmeter': { to: 'lb ft', factor: 0.737562149 },
    'newton-meter': { to: 'lb ft', factor: 0.737562149 },
    'newton metres': { to: 'lb ft', factor: 0.737562149 }
};

// --- Helper function to fetch exchange rates ---
async function fetchExchangeRates() {
    // This function is now deprecated - exchange rates are loaded via the cache system
    // Keep for backward compatibility but use cache system instead
    
    const cacheManager = getCacheManager();
    if (!cacheManager) {
        return; // Silently return if cache manager not available
    }
    
    const cacheStatus = cacheManager.getStatus();
    if (!cacheStatus.isReady) {
        return; // Silently return if cache not ready
    }
    
    // Update legacy exchangeRates object from cache for backward compatibility
    exchangeRates.lastUpdated = cacheStatus.lastUpdated || Date.now();
    exchangeRates.rates = {};
    
    const target = preferredCurrency || 'BGN';
    
    // Get the rate for the preferred currency (how many preferred currency units = 1 USD)
    const preferredRate = cacheManager.getFiatRate(target);
    
    if (preferredRate === null) {
        if (target !== 'BGN') { // Only log if not the default BGN (which often isn't in cache)
            console.log(`Preferred currency ${target} rate not found in cache`);
        }
        // Use default rates as fallback
        exchangeRates.rates = {
            EUR: 1.95583,
            USD: 1.8,
            GBP: 2.3
        };
        return;
    }
    
    // Populate rates from cache for supported fiat currencies
    const supportedFiats = ['EUR', 'USD', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NOK'];
    
    for (const currency of supportedFiats) {
        const sourceRate = cacheManager.getFiatRate(currency);
        if (sourceRate !== null) {
            if (currency === target) {
                exchangeRates.rates[currency] = 1; // Base currency is always 1
            } else {
                // Convert: source currency -> USD -> preferred currency
                // If 1 USD = sourceRate units of source currency
                // And 1 USD = preferredRate units of preferred currency
                // Then 1 unit of source currency = (preferredRate / sourceRate) units of preferred currency
                exchangeRates.rates[currency] = preferredRate / sourceRate;
            }
            
            // Add currency conversion to unitConversions
            if (currency !== target) {
                const conversionRate = exchangeRates.rates[currency];
                unitConversions[currency] = {
                    to: target,
                    convert: (val) => val * conversionRate
                };
                
                // Add symbol conversion if available
                if (currencySymbols[currency]) {
                    unitConversions[currencySymbols[currency]] = {
                        to: target,
                        convert: (val) => val * conversionRate
                    };
                }
            }
        }
    }
    
    exchangeRatesError = null; // Clear any previous errors
    // Only log once per session to reduce noise
    if (!window.hasLoggedExchangeRates) {
        console.log('Exchange rates updated from cache:', Object.keys(exchangeRates.rates).length, 'currencies');
        window.hasLoggedExchangeRates = true;
    }
}

// --- Improved Time Zone Conversion ---
function convertTimeZone(text, userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
    // Enhanced time zone mappings with more comprehensive coverage
    const tzAbbrs = {
        'PST': 'America/Los_Angeles', 'PDT': 'America/Los_Angeles', 'PT': 'America/Los_Angeles',
        'MST': 'America/Denver', 'MDT': 'America/Denver', 'MT': 'America/Denver',
        'CST': 'America/Chicago', 'CDT': 'America/Chicago', 'CT': 'America/Chicago',
        'EST': 'America/New_York', 'EDT': 'America/New_York', 'ET': 'America/New_York',
        'AKST': 'America/Anchorage', 'AKDT': 'America/Anchorage',
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
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
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
        const utc = Date.UTC(y, m - 1, d, h, min, s);
        const local = new Date(`${dateStr}`).getTime();
        const offset = (local - utc) / 60000;
        const sign = offset <= 0 ? '+' : '-';
        const abs = Math.abs(offset);
        const hh = String(Math.floor(abs / 60)).padStart(2, '0');
        const mm = String(abs % 60).padStart(2, '0');
        return `${sign}${hh}:${mm}`;
    } catch {
        return '+00:00';
    }
}

/**
 * Parse international number formats with various separators
 * Handles formats like: 1,600,000 | 569,00 | 569.00 | 1.234,56 | 5,00,000 | 10 | 20.5
 */
function parseInternationalNumber(numberStr) {
    if (!numberStr || typeof numberStr !== 'string') {
        return NaN;
    }
    
    // Remove any leading/trailing whitespace and handle negative numbers
    let cleaned = numberStr.trim();
    let isNegative = false;
    
    if (cleaned.startsWith('-')) {
        isNegative = true;
        cleaned = cleaned.substring(1).trim();
    }
    
    // If it's just digits, return as is
    if (/^\d+$/.test(cleaned)) {
        const result = parseFloat(cleaned);
        return isNegative ? -result : result;
    }
    
    // Count separators to determine format
    const commas = (cleaned.match(/,/g) || []).length;
    const dots = (cleaned.match(/\./g) || []).length;
    const spaces = (cleaned.match(/\s/g) || []).length;
    
    // Handle different separator patterns
    if (commas === 0 && dots === 0 && spaces === 0) {
        // Simple integer: "1000"
        const result = parseFloat(cleaned);
        return isNegative ? -result : result;
    }
    
    if (commas === 0 && dots === 1 && spaces === 0) {
        // Simple decimal with dot: "123.45"
        const result = parseFloat(cleaned);
        return isNegative ? -result : result;
    }
    
    if (commas === 1 && dots === 0 && spaces === 0) {
        // Could be decimal comma "123,45" or thousands separator "1,000"
        const parts = cleaned.split(',');
        if (parts[1].length <= 2) {
            // Decimal comma: "123,45" or "569,00"
            const result = parseFloat(parts[0] + '.' + parts[1]);
            return isNegative ? -result : result;
        } else {
            // Thousands separator: "1,000"
            const result = parseFloat(cleaned.replace(',', ''));
            return isNegative ? -result : result;
        }
    }
    
    // Multiple separators - need to determine which is decimal
    if (commas > 0 || dots > 0 || spaces > 0) {
        // Find the last separator - this is likely the decimal separator
        const lastCommaPos = cleaned.lastIndexOf(',');
        const lastDotPos = cleaned.lastIndexOf('.');
        const lastSpacePos = cleaned.lastIndexOf(' ');
        
        let decimalPos = -1;
        let decimalSep = '';
        
        // Determine which separator appears last (most likely decimal)
        if (lastCommaPos > lastDotPos && lastCommaPos > lastSpacePos) {
            decimalPos = lastCommaPos;
            decimalSep = ',';
        } else if (lastDotPos > lastCommaPos && lastDotPos > lastSpacePos) {
            decimalPos = lastDotPos;
            decimalSep = '.';
        } else if (lastSpacePos > lastCommaPos && lastSpacePos > lastDotPos) {
            decimalPos = lastSpacePos;
            decimalSep = ' ';
        }
        
        if (decimalPos > 0) {
            const beforeDecimal = cleaned.substring(0, decimalPos);
            const afterDecimal = cleaned.substring(decimalPos + 1);
            
            // Check if what's after the separator looks like decimals (1-3 digits)
            if (/^\d{1,3}$/.test(afterDecimal)) {
                // This looks like a decimal separator
                const integerPart = beforeDecimal.replace(/[.,\s]/g, ''); // Remove all separators from integer part
                const result = parseFloat(integerPart + '.' + afterDecimal);
                return isNegative ? -result : result;
            }
        }
        
        // If no clear decimal separator, treat all separators as thousands separators
        const result = parseFloat(cleaned.replace(/[.,\s]/g, ''));
        return isNegative ? -result : result;
    }
    
    return NaN;
}

// --- Helper function to detect and convert units ---
async function detectAndConvertUnit(text) {
    const trimmedText = text.trim();
    
    // First, check if the text contains any crypto or fiat currency content before doing expensive checks
    const upperCaseText = trimmedText.toUpperCase();
    const cryptoSymbols = Object.keys(cryptoCurrencies);
    const fiatSymbols = Object.keys(currencySymbols);
    const hasCryptoContent = cryptoSymbols.some(symbol => 
        upperCaseText.includes(symbol) || 
        upperCaseText.includes(cryptoCurrencies[symbol].toUpperCase())
    );
    const hasFiatContent = fiatSymbols.some(symbol => 
        upperCaseText.includes(symbol) || 
        upperCaseText.includes(currencySymbols[symbol])
    );
    const hasCurrencyContent = hasCryptoContent || hasFiatContent;
    
    // Only proceed with crypto detection if the text contains crypto-related content
    if (hasCryptoContent) {
        // Reduced logging for cleaner console
        
        // Check for crypto amounts with numbers
        const cryptoAmountPattern = /^([\d.,\s]+?)\s*([A-Z]{2,5})$/i;
        const cryptoMatch = trimmedText.match(cryptoAmountPattern);
        
        if (cryptoMatch) {
            const rawAmount = cryptoMatch[1].trim();
            const amount = parseInternationalNumber(rawAmount);
            if (isNaN(amount)) {
                console.log('Failed to parse crypto amount:', rawAmount);
                return null; // Invalid number format
            }
            const cryptoSymbol = cryptoMatch[2].toUpperCase();
            
            if (cryptoCurrencies[cryptoSymbol]) {
                // Reduced logging for cleaner console
                
                // Get price from cache system
                const price = getCryptoPriceFromCache(cryptoSymbol);
                
                if (price !== null) {
                    const totalValue = amount * price.value;
                    return {
                        original: `${amount} ${cryptoSymbol}`,
                        converted: `${totalValue.toFixed(2)} ${price.currency}`,
                        value: totalValue,
                        cacheAge: price.cacheAge
                    };
                }
            }
        }
        
        // Also check for single crypto symbols (e.g., "BTC", "bitcoin")
        if (cryptoCurrencies[upperCaseText]) {
            console.log('Crypto symbol detected:', upperCaseText, 'ID:', cryptoCurrencies[upperCaseText]);
            
            // Get price from cache system
            const price = getCryptoPriceFromCache(upperCaseText);
            console.log('Crypto price found:', price);
            
            if (price !== null) {
                return {
                    original: `1 ${upperCaseText}`,
                    converted: `${price.value.toFixed(2)} ${price.currency}`,
                    value: price.value,
                    cacheAge: price.cacheAge
                };
            }
        }
    }

    // --- Fiat Currency Detection and Conversion ---
    if (hasFiatContent) {
        console.log('Checking fiat currency for:', trimmedText);
        
        // Check for fiat currency amounts with numbers (e.g., "100 USD", "$50", "€25", "1,600,000 TRY", "569,00€")
        // More flexible pattern to handle various number formats and spacing
        const fiatAmountPattern = /^([€$£¥₺₽₹₩₪₱฿₣₦₲₵₡₫₭₮₯₠₢₳₴₸₼₾₿]?)\s*([\d.,\s]+?)\s*([A-Z]{3}|[€$£¥₺₽₹₩₪₱฿₣₦₲₵₡₫₭₮₯₠₢₳₴₸₼₾₿]?)$/i;
        const fiatMatch = trimmedText.match(fiatAmountPattern);
        
        if (fiatMatch) {
            const symbolBefore = fiatMatch[1];
            const rawAmount = fiatMatch[2].trim();
            const symbolAfter = fiatMatch[3];
            
            // Parse the amount using improved number parsing
            const amount = parseInternationalNumber(rawAmount);
            if (isNaN(amount)) {
                console.log('Failed to parse fiat amount:', rawAmount);
                return null; // Invalid number format
            }
            
            // Determine the currency from symbol or code
            let fromCurrency = null;
            
            if (symbolBefore) {
                // Symbol before number (e.g., "$100", "€50")
                for (const [code, symbol] of Object.entries(currencySymbols)) {
                    if (symbol === symbolBefore) {
                        fromCurrency = code;
                        break;
                    }
                }
            } else if (symbolAfter) {
                // Symbol or code after number (e.g., "100 USD", "50€")
                if (symbolAfter.length === 3) {
                    // Three-letter currency code
                    fromCurrency = symbolAfter.toUpperCase();
                } else {
                    // Currency symbol
                    for (const [code, symbol] of Object.entries(currencySymbols)) {
                        if (symbol === symbolAfter) {
                            fromCurrency = code;
                            break;
                        }
                    }
                }
            }
            
            if (fromCurrency && !isNaN(amount)) {
                console.log('Fiat amount detected:', amount, fromCurrency);
                
                // Get conversion rate from cache system
                const targetCurrency = preferredCurrency || 'BGN';
                const conversion = getFiatConversionFromCache(fromCurrency, targetCurrency);
                console.log('Fiat conversion found:', conversion);
                
                if (conversion !== null) {
                    const convertedAmount = amount * conversion.rate;
                    const targetSymbol = currencySymbols[targetCurrency] || targetCurrency;
                    
                    // Format timestamp for display
                    let timestampInfo = '';
                    if (conversion.lastUpdated) {
                        const ageMinutes = Math.floor(conversion.cacheAge / (1000 * 60));
                        if (ageMinutes < 60) {
                            timestampInfo = ` (${ageMinutes}m ago)`;
                        } else {
                            const ageHours = Math.floor(ageMinutes / 60);
                            timestampInfo = ` (${ageHours}h ago)`;
                        }
                    }
                    
                    return {
                        original: `${amount} ${fromCurrency}`,
                        converted: `${convertedAmount.toFixed(2)} ${targetSymbol}${timestampInfo}`,
                        value: convertedAmount,
                        cacheAge: conversion.cacheAge,
                        isStale: conversion.isStale,
                        lastUpdated: conversion.lastUpdated
                    };
                }
            }
        }
        
        // Also check for single currency codes (e.g., "USD", "EUR")
        const currencyCodePattern = /^([A-Z]{3})$/;
        const currencyCodeMatch = upperCaseText.match(currencyCodePattern);
        
        if (currencyCodeMatch && currencySymbols[currencyCodeMatch[1]]) {
            const fromCurrency = currencyCodeMatch[1];
            console.log('Currency code detected:', fromCurrency);
            
            // Get conversion rate for 1 unit
            const targetCurrency = preferredCurrency || 'BGN';
            const conversion = getFiatConversionFromCache(fromCurrency, targetCurrency);
            console.log('Currency conversion found:', conversion);
            
            if (conversion !== null) {
                const targetSymbol = currencySymbols[targetCurrency] || targetCurrency;
                
                // Format timestamp for display
                let timestampInfo = '';
                if (conversion.lastUpdated) {
                    const ageMinutes = Math.floor(conversion.cacheAge / (1000 * 60));
                    if (ageMinutes < 60) {
                        timestampInfo = ` (${ageMinutes}m ago)`;
                    } else {
                        const ageHours = Math.floor(ageMinutes / 60);
                        timestampInfo = ` (${ageHours}h ago)`;
                    }
                }
                
                return {
                    original: `1 ${fromCurrency}`,
                    converted: `${conversion.rate.toFixed(4)} ${targetSymbol}${timestampInfo}`,
                    value: conversion.rate,
                    cacheAge: conversion.cacheAge,
                    isStale: conversion.isStale,
                    lastUpdated: conversion.lastUpdated
                };
            }
        }
    }

    // --- Time Zone Conversion ---
    const tzResult = convertTimeZone(text);
    if (tzResult) return tzResult;

    // Match pattern: number (including fractions) followed by unit with optional space
    // Updated pattern to handle currency symbols before or after the number
    // Allow both comma, period, and space as decimal/thousands separators
    // Allow trailing punctuation like periods, commas, etc.
    // Support both Western (1,000,000) and Indian (10,00,000) number formats
    // Expanded currency symbols to include ₺, ₽, ₹, ₩, ₪, ₱, ฿, ₣, ₦, ₲, ₵, ₡, ₫, ₭, ₮, ₯, ₠, ₢, ₳, ₴, ₸, ₼, ₾, ₿, and others
    const currencySymbolPattern = '[a-zA-Z°/€$£¥₺₽₹₩₪₱฿₣₦₲₵₡₫₭₮₯₠₢₳₴₸₼₾₿]';
    // Updated pattern to handle both Western and Indian number formats
    // Western: 1,000,000 or 1.000.000 or 1 000 000
    // Indian: 10,00,000 or 1,00,000 or 5,00,000
    const valueUnitPattern = new RegExp(`^(-?\\d{1,3}(?:[.,\\s]\\d{2,3})*(?:[.,]\\d+)?|\\d+/\\d+)[\\s-]*(${currencySymbolPattern}+|[a-zA-Z]+(?:\\s+[a-zA-Z]+)*)[.,;:!?]*$`, 'i');
    const unitValuePattern = new RegExp(`^(${currencySymbolPattern}+|[a-zA-Z]+(?:\\s+[a-zA-Z]+)*)[\\s-]*(-?\\d{1,3}(?:[.,\\s]\\d{2,3})*(?:[.,]\\d+)?|\\d+/\\d+)[.,;:!?]*$`, 'i');

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
        const num = parseInternationalNumber(numerator);
        const den = parseInternationalNumber(denominator);
        if (isNaN(num) || isNaN(den) || den === 0) {
            return null;
        }
        value = num / den;
    } else {
        // Use improved international number parsing
        value = parseInternationalNumber(value);
        if (isNaN(value)) {
            return null;
        }
    }

    // Special case for temperature without F suffix
    if (unit === '°') {
        return {
            original: `${value}°`,
            converted: `${((value - 32) * 5 / 9).toFixed(1)}°C`,
            value: (value - 32) * 5 / 9
        };
    }

    // Find matching unit conversion
    // Normalize unit: trim, lowercase, remove spaces and handle common variants
    let normUnit = (unit || '').toLowerCase().replace(/\s+/g, '');

    if (normUnit === 'l/100km') {
        normUnit = 'l/100km';
    } else if (normUnit === 'mpg') {
        normUnit = 'mpg';
    }
    
    // Find matching unit conversion
    for (const [key, conversion] of Object.entries(unitConversions)) {
        let normKey = key.toLowerCase().replace(/\s+/g, '');
        if (normKey === normUnit) {
            let converted;
            if (conversion.convert) {
                converted = conversion.convert(value);
            } else {
                converted = value * conversion.factor;
            }
            
            // Check if this is a currency conversion to add timestamp info
            const isCurrency = key.match(/[€$£]/) || currencySymbols[key] || cryptoCurrencies[key.toUpperCase()];
            let timestampInfo = '';
            
            if (isCurrency) {
                // Get cache status for timestamp information
                const cacheManager = getCacheManager();
                if (cacheManager) {
                    const cacheStatus = cacheManager.getStatus();
                    if (cacheStatus.lastUpdated) {
                        const ageMinutes = Math.floor(cacheStatus.cacheAge / (1000 * 60));
                        if (ageMinutes < 60) {
                            timestampInfo = ` (${ageMinutes}m ago)`;
                        } else {
                            const ageHours = Math.floor(ageMinutes / 60);
                            timestampInfo = ` (${ageHours}h ago)`;
                        }
                    }
                }
            }
            
            // Round to 2 decimal places for currency, 4 for other units
            const decimals = isCurrency ? 2 : 4;
            converted = Math.round(converted * Math.pow(10, decimals)) / Math.pow(10, decimals);
            
            return {
                original: `${value} ${key}`,
                converted: `${converted} ${conversion.to}${timestampInfo}`,
                value: converted,
                cacheAge: isCurrency ? (cacheManager ? cacheManager.getStatus().cacheAge : null) : null
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
window.addEventListener('error', function (event) {
    // Prevent error from bubbling up
    event.preventDefault();
    return false;
});

window.addEventListener('unhandledrejection', function (event) {
    // Prevent error from bubbling up
    event.preventDefault();
    return false;
});

// --- Initialize ---
initPopupButtons();
// Note: fetchExchangeRates() and fetchCryptoRates() are called above in the preference loading section