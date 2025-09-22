/**
 * Integration tests for fiat currency conversion flow
 * Tests the updated content.js fiat currency detection and conversion using cache system
 */

// Mock the cache system
const mockCacheManager = {
    isReady: true,
    fiatRates: new Map([
        ['USD', { value: 1.0, timestamp: Date.now(), source: 'coingecko' }], // 1 USD = 1 USD (base)
        ['EUR', { value: 0.85, timestamp: Date.now(), source: 'coingecko' }], // 1 USD = 0.85 EUR
        ['GBP', { value: 0.74, timestamp: Date.now(), source: 'coingecko' }], // 1 USD = 0.74 GBP
        ['JPY', { value: 147.75, timestamp: Date.now(), source: 'coingecko' }] // 1 USD = 147.75 JPY
        // Note: BGN is not in cache to simulate real-world scenario
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
global.exchangeRates = { rates: { USD: 1.8 } }; // Mock legacy exchange rates for BGN fallback

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
            expect(result.rate).toBeCloseTo(1.8, 3); // 1 USD = 1.8 BGN (from legacy fallback)
            expect(result.fromCurrency).toBe('USD');
            expect(result.toCurrency).toBe('BGN');
            expect(result.cacheAge).toBe(900000);
            expect(result.isStale).toBe(false);
        });

        test('should convert EUR to BGN using cache rates', () => {
            const result = getFiatConversionFromCache('EUR', 'BGN');

            expect(result).not.toBeNull();
            expect(result.rate).toBeCloseTo(2.12, 2); // EUR to BGN: (1.8 / 0.85) = 2.12
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
            expect(result.converted).toContain('180.00 лв'); // 100 * 1.8 = 180
            expect(result.converted).toContain('15m ago');
            expect(result.value).toBeCloseTo(180, 2);
            expect(result.cacheAge).toBe(900000);
        });

        test('should detect and convert EUR amount with symbol after', async () => {
            const result = await detectAndConvertUnit('50€');

            expect(result).not.toBeNull();
            expect(result.original).toBe('50 EUR');
            expect(result.converted).toContain('105.88 лв'); // 50 * (1.8/0.85) = 105.88
            expect(result.converted).toContain('15m ago');
            expect(result.value).toBeCloseTo(105.88, 2);
        });

        test('should detect and convert currency with three-letter code', async () => {
            const result = await detectAndConvertUnit('75 GBP');

            expect(result).not.toBeNull();
            expect(result.original).toBe('75 GBP');
            expect(result.converted).toContain('182.43 лв'); // 75 * (1.8/0.74) = 182.43
            expect(result.value).toBeCloseTo(182.43, 2);
        });

        test('should detect single currency code and show rate', async () => {
            const result = await detectAndConvertUnit('USD');

            expect(result).not.toBeNull();
            expect(result.original).toBe('1 USD');
            expect(result.converted).toContain('1.8000 лв'); // 1 USD = 1.8 BGN
            expect(result.converted).toContain('15m ago');
            expect(result.value).toBeCloseTo(1.8, 4);
        });

        test('should handle decimal amounts', async () => {
            const result = await detectAndConvertUnit('$25.50');

            expect(result).not.toBeNull();
            expect(result.original).toBe('25.5 USD');
            expect(result.converted).toContain('45.90 лв'); // 25.5 * 1.8 = 45.9
            expect(result.value).toBeCloseTo(45.9, 2);
        });

        test('should handle comma as decimal separator', async () => {
            const result = await detectAndConvertUnit('€12,75');

            expect(result).not.toBeNull();
            expect(result.original).toBe('12.75 EUR');
            expect(result.converted).toContain('27.00 лв'); // 12.75 * (1.8/0.85) = 27.0
            expect(result.value).toBeCloseTo(27.0, 2);
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
            expect(result.value).toBeCloseTo(0.018, 4); // 0.01 * 1.8 = 0.018
        });

        test('should handle large amounts', async () => {
            const result = await detectAndConvertUnit('$1000000');

            expect(result).not.toBeNull();
            expect(result.value).toBeCloseTo(1800000, 0); // 1000000 * 1.8 = 1800000
        });

        test('should handle zero amount', async () => {
            const result = await detectAndConvertUnit('$0');

            expect(result).not.toBeNull();
            expect(result.value).toBe(0);
        });
    });
});