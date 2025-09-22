/**
 * Configuration object for supported currencies and API settings
 */
const CACHE_CONFIG = {
    // Supported cryptocurrencies with their CoinGecko IDs
    supportedCryptos: {
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
        'SUSHI': 'sushi',
        'YFI': 'yearn-finance',
        'COMP': 'compound-governance-token',
        'MKR': 'maker',
        'SNX': 'havven',
        'UMA': 'uma',
        'ZEC': 'zcash',
        'DASH': 'dash',
        'XMR': 'monero',
        'BSV': 'bitcoin-cash-sv',
        'AVAX': 'avalanche-2',
        'MATIC': 'matic-network'
    },

    // Supported fiat currencies
    supportedFiats: [
        'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY',
        'SEK', 'NZD', 'MXN', 'SGD', 'HKD', 'NOK', 'KRW', 'TRY',
        'RUB', 'INR', 'BRL', 'ZAR', 'BGN'
    ],

    // Supported currencies for crypto price fetching (BGN not supported by CoinGecko for crypto)
    cryptoVsCurrencies: [
        'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY',
        'SEK', 'NOK', 'KRW', 'TRY', 'RUB', 'INR', 'BRL'
    ],

    // API settings
    api: {
        baseUrl: 'https://api.coingecko.com/api/v3',
        endpoints: {
            cryptoPrices: '/simple/price',
            exchangeRates: '/exchange_rates'
        },
        // Rate limiting settings
        rateLimits: {
            requestsPerMinute: 30, // CoinGecko free tier limit
            retryDelay: 5000, // 5 seconds
            maxRetries: 3
        }
    },

    // Cache settings
    cache: {
        refreshIntervalMs: 900000, // 15 minutes
        staleThresholdMs: 3600000, // 1 hour
        retryIntervalMs: 300000 // 5 minutes for failed refreshes
    },

    // Default preferences
    defaults: {
        preferredCurrency: 'BGN',
        preferredCryptoCurrency: 'USD'
    }
};

/**
 * Get all supported crypto coin IDs as a comma-separated string
 * @returns {string} Comma-separated coin IDs for API requests
 */
function getSupportedCoinIds() {
    return Object.values(CACHE_CONFIG.supportedCryptos).join(',');
}

/**
 * Get all supported fiat currencies as a comma-separated string
 * @returns {string} Comma-separated currency codes for API requests
 */
function getSupportedFiatCurrencies() {
    return CACHE_CONFIG.supportedFiats.map(c => c.toLowerCase()).join(',');
}

/**
 * Get coin ID from crypto symbol
 * @param {string} symbol - Crypto symbol (e.g., 'BTC')
 * @returns {string|null} CoinGecko coin ID or null if not supported
 */
function getCoinIdFromSymbol(symbol) {
    return CACHE_CONFIG.supportedCryptos[symbol.toUpperCase()] || null;
}

/**
 * Get crypto symbol from coin ID
 * @param {string} coinId - CoinGecko coin ID
 * @returns {string|null} Crypto symbol or null if not found
 */
function getSymbolFromCoinId(coinId) {
    for (const [symbol, id] of Object.entries(CACHE_CONFIG.supportedCryptos)) {
        if (id === coinId) {
            return symbol;
        }
    }
    return null;
}

/**
 * Validate if a currency is supported for fiat conversions
 * @param {string} currency - Currency code
 * @returns {boolean} True if supported
 */
function isSupportedFiatCurrency(currency) {
    return CACHE_CONFIG.supportedFiats.includes(currency.toUpperCase());
}

// Export configuration and helper functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CACHE_CONFIG,
        getSupportedCoinIds,
        getSupportedFiatCurrencies,
        getCoinIdFromSymbol,
        getSymbolFromCoinId,
        isSupportedFiatCurrency
    };
}