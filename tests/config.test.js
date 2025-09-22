/**
 * Unit tests for cache configuration
 */

// Import configuration functions
let config;
if (typeof require !== 'undefined') {
    config = require('../js/cache/config.js');
} else {
    // Browser environment - assume it's already loaded
    config = window.cacheConfig;
}

const {
    CACHE_CONFIG,
    getSupportedCoinIds,
    getSupportedFiatCurrencies,
    getCoinIdFromSymbol,
    getSymbolFromCoinId,
    isSupportedFiatCurrency
} = config;

describe('Cache Configuration', () => {
    describe('CACHE_CONFIG', () => {
        test('should have required configuration sections', () => {
            expect(CACHE_CONFIG).toBeDefined();
            expect(CACHE_CONFIG.supportedCryptos).toBeDefined();
            expect(CACHE_CONFIG.supportedFiats).toBeDefined();
            expect(CACHE_CONFIG.api).toBeDefined();
            expect(CACHE_CONFIG.cache).toBeDefined();
            expect(CACHE_CONFIG.defaults).toBeDefined();
        });

        test('should have valid crypto currency mappings', () => {
            expect(typeof CACHE_CONFIG.supportedCryptos).toBe('object');
            expect(CACHE_CONFIG.supportedCryptos.BTC).toBe('bitcoin');
            expect(CACHE_CONFIG.supportedCryptos.ETH).toBe('ethereum');
            expect(Object.keys(CACHE_CONFIG.supportedCryptos).length).toBeGreaterThan(0);
        });

        test('should have valid fiat currency list', () => {
            expect(Array.isArray(CACHE_CONFIG.supportedFiats)).toBe(true);
            expect(CACHE_CONFIG.supportedFiats).toContain('USD');
            expect(CACHE_CONFIG.supportedFiats).toContain('EUR');
            expect(CACHE_CONFIG.supportedFiats).toContain('BGN');
            expect(CACHE_CONFIG.supportedFiats.length).toBeGreaterThan(0);
        });

        test('should have valid API configuration', () => {
            expect(CACHE_CONFIG.api.baseUrl).toBe('https://api.coingecko.com/api/v3');
            expect(CACHE_CONFIG.api.endpoints.cryptoPrices).toBe('/simple/price');
            expect(CACHE_CONFIG.api.endpoints.exchangeRates).toBe('/exchange_rates');
            expect(CACHE_CONFIG.api.rateLimits.requestsPerMinute).toBeGreaterThan(0);
        });

        test('should have valid cache settings', () => {
            expect(CACHE_CONFIG.cache.refreshIntervalMs).toBe(900000); // 15 minutes
            expect(CACHE_CONFIG.cache.staleThresholdMs).toBe(3600000); // 1 hour
            expect(CACHE_CONFIG.cache.retryIntervalMs).toBe(300000); // 5 minutes
        });

        test('should have valid default preferences', () => {
            expect(CACHE_CONFIG.defaults.preferredCurrency).toBe('BGN');
            expect(CACHE_CONFIG.defaults.preferredCryptoCurrency).toBe('USD');
        });
    });

    describe('getSupportedCoinIds', () => {
        test('should return comma-separated coin IDs', () => {
            const coinIds = getSupportedCoinIds();
            expect(typeof coinIds).toBe('string');
            expect(coinIds).toContain('bitcoin');
            expect(coinIds).toContain('ethereum');
            expect(coinIds.includes(',')).toBe(true);
        });

        test('should include all configured cryptocurrencies', () => {
            const coinIds = getSupportedCoinIds();
            const coinIdArray = coinIds.split(',');
            const configuredIds = Object.values(CACHE_CONFIG.supportedCryptos);
            
            expect(coinIdArray.length).toBe(configuredIds.length);
            configuredIds.forEach(id => {
                expect(coinIdArray).toContain(id);
            });
        });
    });

    describe('getSupportedFiatCurrencies', () => {
        test('should return comma-separated lowercase currency codes', () => {
            const currencies = getSupportedFiatCurrencies();
            expect(typeof currencies).toBe('string');
            expect(currencies).toContain('usd');
            expect(currencies).toContain('eur');
            expect(currencies).toContain('bgn');
            expect(currencies.includes(',')).toBe(true);
        });

        test('should include all configured fiat currencies in lowercase', () => {
            const currencies = getSupportedFiatCurrencies();
            const currencyArray = currencies.split(',');
            
            expect(currencyArray.length).toBe(CACHE_CONFIG.supportedFiats.length);
            CACHE_CONFIG.supportedFiats.forEach(currency => {
                expect(currencyArray).toContain(currency.toLowerCase());
            });
        });
    });

    describe('getCoinIdFromSymbol', () => {
        test('should return correct coin ID for valid symbols', () => {
            expect(getCoinIdFromSymbol('BTC')).toBe('bitcoin');
            expect(getCoinIdFromSymbol('ETH')).toBe('ethereum');
            expect(getCoinIdFromSymbol('btc')).toBe('bitcoin'); // lowercase
            expect(getCoinIdFromSymbol('Btc')).toBe('bitcoin'); // mixed case
        });

        test('should return null for invalid symbols', () => {
            expect(getCoinIdFromSymbol('INVALID')).toBe(null);
            expect(getCoinIdFromSymbol('')).toBe(null);
            expect(getCoinIdFromSymbol('123')).toBe(null);
        });

        test('should handle case insensitive input', () => {
            expect(getCoinIdFromSymbol('btc')).toBe('bitcoin');
            expect(getCoinIdFromSymbol('BTC')).toBe('bitcoin');
            expect(getCoinIdFromSymbol('Btc')).toBe('bitcoin');
        });
    });

    describe('getSymbolFromCoinId', () => {
        test('should return correct symbol for valid coin IDs', () => {
            expect(getSymbolFromCoinId('bitcoin')).toBe('BTC');
            expect(getSymbolFromCoinId('ethereum')).toBe('ETH');
            expect(getSymbolFromCoinId('ripple')).toBe('XRP');
        });

        test('should return null for invalid coin IDs', () => {
            expect(getSymbolFromCoinId('invalid-coin')).toBe(null);
            expect(getSymbolFromCoinId('')).toBe(null);
            expect(getSymbolFromCoinId('bitcoin-invalid')).toBe(null);
        });
    });

    describe('isSupportedFiatCurrency', () => {
        test('should return true for supported currencies', () => {
            expect(isSupportedFiatCurrency('USD')).toBe(true);
            expect(isSupportedFiatCurrency('EUR')).toBe(true);
            expect(isSupportedFiatCurrency('BGN')).toBe(true);
            expect(isSupportedFiatCurrency('usd')).toBe(true); // lowercase
            expect(isSupportedFiatCurrency('Usd')).toBe(true); // mixed case
        });

        test('should return false for unsupported currencies', () => {
            expect(isSupportedFiatCurrency('INVALID')).toBe(false);
            expect(isSupportedFiatCurrency('')).toBe(false);
            expect(isSupportedFiatCurrency('XYZ')).toBe(false);
        });

        test('should handle case insensitive input', () => {
            expect(isSupportedFiatCurrency('usd')).toBe(true);
            expect(isSupportedFiatCurrency('USD')).toBe(true);
            expect(isSupportedFiatCurrency('Usd')).toBe(true);
        });
    });

    describe('configuration consistency', () => {
        test('should have unique crypto symbols', () => {
            const symbols = Object.keys(CACHE_CONFIG.supportedCryptos);
            const uniqueSymbols = [...new Set(symbols)];
            expect(symbols.length).toBe(uniqueSymbols.length);
        });

        test('should have unique coin IDs', () => {
            const coinIds = Object.values(CACHE_CONFIG.supportedCryptos);
            const uniqueCoinIds = [...new Set(coinIds)];
            expect(coinIds.length).toBe(uniqueCoinIds.length);
        });

        test('should have unique fiat currencies', () => {
            const currencies = CACHE_CONFIG.supportedFiats;
            const uniqueCurrencies = [...new Set(currencies)];
            expect(currencies.length).toBe(uniqueCurrencies.length);
        });

        test('should have valid time intervals', () => {
            expect(CACHE_CONFIG.cache.refreshIntervalMs).toBeGreaterThan(0);
            expect(CACHE_CONFIG.cache.staleThresholdMs).toBeGreaterThan(0);
            expect(CACHE_CONFIG.cache.retryIntervalMs).toBeGreaterThan(0);
            
            // Refresh interval should be less than stale threshold
            expect(CACHE_CONFIG.cache.refreshIntervalMs).toBeLessThan(CACHE_CONFIG.cache.staleThresholdMs);
        });
    });
});

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { config };
}