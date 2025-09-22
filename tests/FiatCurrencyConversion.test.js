/**
 * Integration tests for fiat currency conversion flow
 * Tests the updated content.js fiat currency detection and conversion using cache system
 */

// Mock the cache system
const mockCacheManager = {
    isReady: true,
    fiatRates: new Map([
        ['USD', { value: 1.8, timestamp: Date.now(), source: 'coingecko' }],
        ['EUR', { value: 1.95583, timestamp: Date.now(), source: 'coingecko' }],
        ['GBP', { value: 2.3, timestamp: Date.now(), source: 'coingecko' }],
        ['JPY', { value: 0.012, timestamp: Date.now(), source: 'coingecko' }],
        ['BGN', { value: 1, timestamp: Date.now(), source: 'coingecko' }]
    ]),

    getStatus() {
        return {
            isReady: this.isReady,
            lastUpdated: Date.now() - 900000, // 15 minutes ago
            isStale: false,
            cryptoCount: 0,
            fiatCount: this.fiatRates.size,
            error: null,
            cacheAge: 900000 // 15 minutes
        };
    },

    getFiatRate(currency) {
        const entry = this.fiatRates.get(currency);
        return entry ? entry.value : null;
    }
};

// Mock global functions and variables
global.getCacheManager = () => mockCacheManager;
global.preferredCurrency = 'BGN';
global.currencySymbols = {
    'EUR': '€',
    'USD': '$',
    'GBP': '£',
    'JPY': '¥',
    'BGN': 'лв'
};
global.cryptoCurrencies = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum'
};
global.convertTimeZone = () => null; // Mock function to avoid errors
global.unitConversions = {}; // Mock empty unit conversions

// Load the functions we want to test
const fs = require('fs');
const path = require('path');
const contentJs = fs.readFileSync(path.join(__dirname, '../js/content.js'), 'utf8');

// Extract the functions we need to test
eval(contentJs.match(/function getFiatConversionFromCache[\s\S]*?^}/m)[0]);
eval(contentJs.match(/async function detectAndConvertUnit[\s\S]*?^}/m)[0]);

describe('Fiat Currency Conversion Integration Tests', () => {

    describe('getFiatConversionFromCache', () => {
        test('should convert USD to BGN using cache rates', () => {
            const result = getFiatConversionFromCache('USD', 'BGN');

            expect(result).not.toBeNull();
            expect(result.rate).toBeCloseTo(0.556, 3); // 1 / 1.8 = 0.556
            expect(result.fromCurrency).toBe('USD');
            expect(result.toCurrency).toBe('BGN');
            expect(result.cacheAge).toBe(900000);
            expect(result.isStale).toBe(false);
        });

        test('should convert EUR to BGN using cache rates', () => {
            const result = getFiatConversionFromCache('EUR', 'BGN');

            expect(result).not.toBeNull();
            expect(result.rate).toBeCloseTo(0.511, 3); // 1 / 1.95583 = 0.511
            expect(result.fromCurrency).toBe('EUR');
            expect(result.toCurrency).toBe('BGN');
        });

        test('should handle same currency conversion', () => {
            const result = getFiatConversionFromCache('BGN', 'BGN');

            expect(result).not.toBeNull();
            expect(result.rate).toBe(1);
            expect(result.fromCurrency).toBe('BGN');
            expect(result.toCurrency).toBe('BGN');
        });

        test('should return null for unsupported currency', () => {
            const result = getFiatConversionFromCache('XYZ', 'BGN');

            expect(result).toBeNull();
        });

        test('should handle cache not ready', () => {
            mockCacheManager.isReady = false;
            const result = getFiatConversionFromCache('USD', 'BGN');

            expect(result).toBeNull();

            // Reset for other tests
            mockCacheManager.isReady = true;
        });
    });

    describe('detectAndConvertUnit - Fiat Currency Detection', () => {
        test('should detect and convert USD amount with symbol before', async () => {
            const result = await detectAndConvertUnit('$100');

            expect(result).not.toBeNull();
            expect(result.original).toBe('100 USD');
            expect(result.converted).toContain('55.56 лв'); // 100 * (1/1.8) = 55.56
            expect(result.converted).toContain('15m ago');
            expect(result.value).toBeCloseTo(55.56, 2);
            expect(result.cacheAge).toBe(900000);
        });

        test('should detect and convert EUR amount with symbol after', async () => {
            const result = await detectAndConvertUnit('50€');

            expect(result).not.toBeNull();
            expect(result.original).toBe('50 EUR');
            expect(result.converted).toContain('25.56 лв'); // 50 * (1/1.95583) = 25.56
            expect(result.converted).toContain('15m ago');
            expect(result.value).toBeCloseTo(25.56, 2);
        });

        test('should detect and convert currency with three-letter code', async () => {
            const result = await detectAndConvertUnit('75 GBP');

            expect(result).not.toBeNull();
            expect(result.original).toBe('75 GBP');
            expect(result.converted).toContain('32.61 лв');
            expect(result.value).toBeCloseTo(32.61, 2);
        });

        test('should detect single currency code and show rate', async () => {
            const result = await detectAndConvertUnit('USD');

            expect(result).not.toBeNull();
            expect(result.original).toBe('1 USD');
            expect(result.converted).toContain('0.5556 лв');
            expect(result.converted).toContain('15m ago');
            expect(result.value).toBeCloseTo(0.5556, 4);
        });

        test('should handle decimal amounts', async () => {
            const result = await detectAndConvertUnit('$25.50');

            expect(result).not.toBeNull();
            expect(result.original).toBe('25.5 USD');
            expect(result.converted).toContain('14.17 лв');
            expect(result.value).toBeCloseTo(14.17, 2);
        });

        test('should handle comma as decimal separator', async () => {
            const result = await detectAndConvertUnit('€12,75');

            expect(result).not.toBeNull();
            expect(result.original).toBe('12.75 EUR');
            expect(result.converted).toContain('6.52 лв');
            expect(result.value).toBeCloseTo(6.52, 2);
        });

        test('should not detect unsupported currency', async () => {
            const result = await detectAndConvertUnit('100 XYZ');

            // Should fall through to general unit conversion (which should return null for XYZ)
            expect(result).toBeNull();
        });

        test('should not detect non-currency text', async () => {
            const result = await detectAndConvertUnit('hello world');

            expect(result).toBeNull();
        });

        test('should handle cache not available gracefully', async () => {
            const originalGetCacheManager = global.getCacheManager;
            global.getCacheManager = () => null;

            const result = await detectAndConvertUnit('$100');

            expect(result).toBeNull();

            // Restore
            global.getCacheManager = originalGetCacheManager;
        });
    });

    describe('Timestamp Formatting', () => {
        test('should show minutes for recent cache', () => {
            // Cache age of 30 minutes
            const originalGetStatus = mockCacheManager.getStatus;
            mockCacheManager.getStatus = () => ({
                isReady: true,
                lastUpdated: Date.now() - 1800000, // 30 minutes ago
                cacheAge: 1800000,
                isStale: false
            });

            const result = getFiatConversionFromCache('USD', 'BGN');
            expect(result).not.toBeNull();
            expect(result.cacheAge).toBe(1800000);

            // Restore original
            mockCacheManager.getStatus = originalGetStatus;
        });

        test('should show hours for older cache', async () => {
            // Cache age of 2 hours
            const originalGetStatus = mockCacheManager.getStatus;
            mockCacheManager.getStatus = () => ({
                isReady: true,
                lastUpdated: Date.now() - 7200000, // 2 hours ago
                cacheAge: 7200000,
                isStale: false
            });

            const result = await detectAndConvertUnit('$100');
            expect(result.converted).toContain('2h ago');

            // Restore original
            mockCacheManager.getStatus = originalGetStatus;
        });
    });

    describe('Edge Cases', () => {
        test('should handle very small amounts', async () => {
            const result = await detectAndConvertUnit('$0.01');

            expect(result).not.toBeNull();
            expect(result.value).toBeCloseTo(0.0056, 4);
        });

        test('should handle large amounts', async () => {
            const result = await detectAndConvertUnit('$1000000');

            expect(result).not.toBeNull();
            expect(result.value).toBeCloseTo(555555.56, 0); // 1000000 * (1/1.8) = 555555.56
        });

        test('should handle zero amount', async () => {
            const result = await detectAndConvertUnit('$0');

            expect(result).not.toBeNull();
            expect(result.value).toBe(0);
        });
    });
});