/**
 * Unit tests for RateCacheManager
 */

// Import the RateCacheManager class
// In a browser environment, this would be loaded via script tag
// For Node.js testing, we use require
let RateCacheManager;
if (typeof require !== 'undefined') {
    RateCacheManager = require('../js/cache/RateCacheManager.js');
} else {
    // Browser environment - assume it's already loaded
    RateCacheManager = window.RateCacheManager;
}

describe('RateCacheManager', () => {
    let cacheManager;

    beforeEach(() => {
        cacheManager = new RateCacheManager();
    });

    describe('initialization', () => {
        test('should initialize with empty cache', () => {
            expect(cacheManager.isReady).toBe(false);
            expect(cacheManager.lastUpdated).toBe(null);
            expect(cacheManager.error).toBe(null);
            expect(cacheManager.cryptoRates.size).toBe(0);
            expect(cacheManager.fiatRates.size).toBe(0);
        });

        test('should report correct initial status', () => {
            const status = cacheManager.getStatus();
            expect(status.isReady).toBe(false);
            expect(status.lastUpdated).toBe(null);
            expect(status.isStale).toBe(true);
            expect(status.cryptoCount).toBe(0);
            expect(status.fiatCount).toBe(0);
            expect(status.error).toBe(null);
            expect(status.cacheAge).toBe(null);
        });
    });

    describe('populateCache', () => {
        test('should populate crypto rates correctly', () => {
            const cryptoData = {
                bitcoin: { usd: 50000, eur: 42000 },
                ethereum: { usd: 3000, eur: 2520 }
            };
            const fiatData = { USD: 1.8, EUR: 1.95583 };

            cacheManager.populateCache(cryptoData, fiatData);

            expect(cacheManager.isReady).toBe(true);
            expect(cacheManager.lastUpdated).toBeCloseTo(Date.now(), -2);
            expect(cacheManager.error).toBe(null);
            expect(cacheManager.cryptoRates.size).toBe(4); // 2 coins × 2 currencies
            expect(cacheManager.fiatRates.size).toBe(2);
        });

        test('should handle empty crypto data', () => {
            const cryptoData = {};
            const fiatData = { USD: 1.8 };

            cacheManager.populateCache(cryptoData, fiatData);

            expect(cacheManager.isReady).toBe(true);
            expect(cacheManager.cryptoRates.size).toBe(0);
            expect(cacheManager.fiatRates.size).toBe(1);
        });

        test('should handle null/undefined data gracefully', () => {
            cacheManager.populateCache(null, null);

            expect(cacheManager.isReady).toBe(true);
            expect(cacheManager.cryptoRates.size).toBe(0);
            expect(cacheManager.fiatRates.size).toBe(0);
        });

        test('should handle invalid fiat rates', () => {
            const cryptoData = {};
            const fiatData = { 
                USD: 1.8, 
                EUR: 'invalid', 
                GBP: NaN,
                JPY: null
            };

            cacheManager.populateCache(cryptoData, fiatData);

            expect(cacheManager.fiatRates.size).toBe(1); // Only USD should be stored
            expect(cacheManager.getFiatRate('USD')).toBe(1.8);
            expect(cacheManager.getFiatRate('EUR')).toBe(null);
        });
    });

    describe('getCryptoRate', () => {
        beforeEach(() => {
            const cryptoData = {
                bitcoin: { usd: 50000, eur: 42000 },
                ethereum: { usd: 3000, eur: 2520 }
            };
            cacheManager.populateCache(cryptoData, {});
        });

        test('should return correct crypto rate', () => {
            expect(cacheManager.getCryptoRate('bitcoin', 'usd')).toBe(50000);
            expect(cacheManager.getCryptoRate('ethereum', 'eur')).toBe(2520);
        });

        test('should handle case insensitive currency', () => {
            expect(cacheManager.getCryptoRate('bitcoin', 'USD')).toBe(50000);
            expect(cacheManager.getCryptoRate('bitcoin', 'Usd')).toBe(50000);
        });

        test('should return null for non-existent rates', () => {
            expect(cacheManager.getCryptoRate('bitcoin', 'gbp')).toBe(null);
            expect(cacheManager.getCryptoRate('litecoin', 'usd')).toBe(null);
        });
    });

    describe('getFiatRate', () => {
        beforeEach(() => {
            const fiatData = { USD: 1.8, EUR: 1.95583, GBP: 2.3 };
            cacheManager.populateCache({}, fiatData);
        });

        test('should return correct fiat rate', () => {
            expect(cacheManager.getFiatRate('USD')).toBe(1.8);
            expect(cacheManager.getFiatRate('EUR')).toBe(1.95583);
        });

        test('should return null for non-existent currency', () => {
            expect(cacheManager.getFiatRate('JPY')).toBe(null);
            expect(cacheManager.getFiatRate('INVALID')).toBe(null);
        });
    });

    describe('cache age and staleness', () => {
        test('should calculate cache age correctly', () => {
            expect(cacheManager.getCacheAge()).toBe(null);

            cacheManager.populateCache({}, {});
            const age = cacheManager.getCacheAge();
            expect(age).toBeGreaterThanOrEqual(0);
            expect(age).toBeLessThan(100); // Should be very recent
        });

        test('should detect stale cache', async () => {
            expect(cacheManager.isStale()).toBe(true); // No data yet

            cacheManager.populateCache({}, {});
            expect(cacheManager.isStale()).toBe(false); // Fresh data

            // Test with custom threshold - add small delay to ensure time passes
            await new Promise(resolve => setTimeout(resolve, 1));
            expect(cacheManager.isStale(0)).toBe(true); // 0ms threshold
            expect(cacheManager.isStale(1000000)).toBe(false); // 1000s threshold
        });

        test('should handle stale cache with old timestamp', () => {
            cacheManager.populateCache({}, {});
            // Manually set old timestamp
            cacheManager.lastUpdated = Date.now() - 7200000; // 2 hours ago

            expect(cacheManager.isStale()).toBe(true); // Default 1 hour threshold
            expect(cacheManager.getCacheAge()).toBeGreaterThan(7000000);
        });
    });

    describe('clear', () => {
        test('should clear all cache data', () => {
            const cryptoData = { bitcoin: { usd: 50000 } };
            const fiatData = { USD: 1.8 };
            cacheManager.populateCache(cryptoData, fiatData);

            expect(cacheManager.isReady).toBe(true);
            expect(cacheManager.cryptoRates.size).toBe(1);

            cacheManager.clear();

            expect(cacheManager.isReady).toBe(false);
            expect(cacheManager.lastUpdated).toBe(null);
            expect(cacheManager.error).toBe(null);
            expect(cacheManager.cryptoRates.size).toBe(0);
            expect(cacheManager.fiatRates.size).toBe(0);
        });
    });

    describe('getAvailableCryptoIds', () => {
        test('should return empty array for empty cache', () => {
            expect(cacheManager.getAvailableCryptoIds()).toEqual([]);
        });

        test('should return unique coin IDs', () => {
            const cryptoData = {
                bitcoin: { usd: 50000, eur: 42000 },
                ethereum: { usd: 3000, eur: 2520 }
            };
            cacheManager.populateCache(cryptoData, {});

            const coinIds = cacheManager.getAvailableCryptoIds();
            expect(coinIds).toContain('bitcoin');
            expect(coinIds).toContain('ethereum');
            expect(coinIds.length).toBe(2);
        });
    });

    describe('getAvailableFiatCurrencies', () => {
        test('should return empty array for empty cache', () => {
            expect(cacheManager.getAvailableFiatCurrencies()).toEqual([]);
        });

        test('should return all fiat currencies', () => {
            const fiatData = { USD: 1.8, EUR: 1.95583, GBP: 2.3 };
            cacheManager.populateCache({}, fiatData);

            const currencies = cacheManager.getAvailableFiatCurrencies();
            expect(currencies).toContain('USD');
            expect(currencies).toContain('EUR');
            expect(currencies).toContain('GBP');
            expect(currencies.length).toBe(3);
        });
    });

    describe('error handling', () => {
        test('should handle errors during cache population', () => {
            // Mock console.error to avoid test output noise
            const originalError = console.error;
            console.error = jest.fn();

            // Force an error by passing invalid data that will cause an exception
            const invalidData = {
                get bitcoin() {
                    throw new Error('Test error');
                }
            };

            cacheManager.populateCache(invalidData, {});

            expect(cacheManager.isReady).toBe(false);
            expect(cacheManager.error).toBe('Test error');

            // Restore console.error
            console.error = originalError;
        });
    });
});

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RateCacheManager };
}