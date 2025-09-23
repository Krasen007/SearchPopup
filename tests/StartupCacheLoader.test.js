/**
 * Unit tests for StartupCacheLoader class
 * Tests cache loading coordination, error handling, and retry logic
 */

const StartupCacheLoader = require('../js/cache/StartupCacheLoader');

// Mock dependencies
const CacheStatusMonitor = require('../js/cache/CacheStatusMonitor');
class MockCoinGeckoAPIClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.shouldFailCrypto = false;
        this.shouldFailFiat = false;
        this.shouldFailAuth = false;
        this.callCount = 0;
    }

    async fetchAllCryptoPricesBulk(coinIds, vsCurrencies) {
        this.callCount++;
        
        if (this.shouldFailAuth) {
            throw new Error('Authentication failed: Invalid API key');
        }
        
        if (this.shouldFailCrypto) {
            throw new Error('Network error: Unable to fetch crypto prices');
        }

        // Mock successful crypto response
        const mockData = {};
        coinIds.forEach(coinId => {
            mockData[coinId] = {};
            vsCurrencies.forEach(currency => {
                mockData[coinId][currency] = Math.random() * 1000 + 1;
            });
        });

        return {
            data: mockData,
            metadata: {
                requestedCoins: coinIds.length,
                requestedCurrencies: vsCurrencies.length,
                receivedCoins: coinIds.length,
                timestamp: Date.now()
            }
        };
    }

    async fetchExchangeRates() {
        this.callCount++;
        
        if (this.shouldFailAuth) {
            throw new Error('Authentication failed: Invalid API key');
        }
        
        if (this.shouldFailFiat) {
            throw new Error('Network error: Unable to fetch exchange rates');
        }

        // Mock successful fiat response
        return {
            rates: {
                'USD': { value: 1.0, name: 'US Dollar' },
                'EUR': { value: 0.85, name: 'Euro' },
                'GBP': { value: 0.73, name: 'British Pound' },
                'BGN': { value: 1.65, name: 'Bulgarian Lev' }
            }
        };
    }

    parseExchangeRatesResponse(response) {
        const parsedRates = {};
        for (const [currency, rateData] of Object.entries(response.rates)) {
            parsedRates[currency.toUpperCase()] = {
                value: rateData.value,
                name: rateData.name
            };
        }
        return { rates: parsedRates };
    }
}

class MockRateCacheManager {
    constructor() {
        this.isReady = false;
        this.error = null;
        this.cryptoCount = 0;
        this.fiatCount = 0;
        this.lastUpdated = null;
        this.populateCalled = false;
    }

    populateCache(cryptoData, fiatData) {
        this.populateCalled = true;
        this.cryptoCount = Object.keys(cryptoData || {}).length;
        this.fiatCount = Object.keys(fiatData || {}).length;
        this.lastUpdated = Date.now();
        this.isReady = true;
        this.error = null;
    }

    getStatus() {
        return {
            isReady: this.isReady,
            lastUpdated: this.lastUpdated,
            isStale: false,
            cryptoCount: this.cryptoCount,
            fiatCount: this.fiatCount,
            error: this.error
        };
    }

    clear() {
        this.isReady = false;
        this.error = null;
        this.cryptoCount = 0;
        this.fiatCount = 0;
        this.lastUpdated = null;
        this.populateCalled = false;
    }
}

// Mock global dependencies
global.CoinGeckoAPIClient = MockCoinGeckoAPIClient;
global.RateCacheManager = MockRateCacheManager;

describe('StartupCacheLoader', () => {
    let loader;
    let mockConfig;

    beforeEach(() => {
        mockConfig = {
            supportedCryptos: {
                'BTC': 'bitcoin',
                'ETH': 'ethereum',
                'XRP': 'ripple'
            },
            supportedFiats: ['USD', 'EUR', 'GBP', 'BGN'],
            api: {
                rateLimits: {
                    maxRetries: 3,
                    retryDelay: 100 // Shorter delay for tests
                }
            }
        };
    });

    afterEach(() => {
        if (loader) {
            loader.reset();
        }
    });

    describe('Constructor', () => {
        test('should create instance with valid API key', () => {
            loader = new StartupCacheLoader('test-api-key', mockConfig);
            
            expect(loader).toBeInstanceOf(StartupCacheLoader);
            expect(loader.apiClient).toBeInstanceOf(MockCoinGeckoAPIClient);
            expect(loader.cacheManager).toBeInstanceOf(MockRateCacheManager);
            expect(loader.config).toEqual(mockConfig);
        });

        test('should create instance without API key (free tier)', () => {
            loader = new StartupCacheLoader(null, mockConfig);
            
            expect(loader).toBeInstanceOf(StartupCacheLoader);
            expect(loader.apiClient).toBeInstanceOf(MockCoinGeckoAPIClient);
            expect(loader.cacheManager).toBeInstanceOf(MockRateCacheManager);
            expect(loader.config).toEqual(mockConfig);
        });

        test('should use default config when none provided', () => {
            loader = new StartupCacheLoader('test-api-key');
            
            expect(loader.config).toBeDefined();
            expect(loader.config.supportedCryptos).toBeDefined();
            expect(loader.config.supportedFiats).toBeDefined();
        });
    });

    describe('loadAllRates', () => {
        beforeEach(() => {
            loader = new StartupCacheLoader('test-api-key', mockConfig);
        });

        test('should successfully load all rates', async () => {
            const result = await loader.loadAllRates();

            expect(result.success).toBe(true);
            expect(result.cryptoCount).toBeGreaterThan(0);
            expect(result.fiatCount).toBeGreaterThan(0);
            expect(result.timestamp).toBeDefined();
            expect(result.cacheStatus.isReady).toBe(true);
        });

        test('should handle crypto loading failure gracefully', async () => {
            loader.apiClient.shouldFailCrypto = true;

            const result = await loader.loadAllRates();

            expect(result.success).toBe(true);
            expect(result.cryptoCount).toBe(0);
            expect(result.fiatCount).toBeGreaterThan(0);
        });

        test('should handle fiat loading failure gracefully', async () => {
            loader.apiClient.shouldFailFiat = true;

            const result = await loader.loadAllRates();

            expect(result.success).toBe(true);
            expect(result.cryptoCount).toBeGreaterThan(0);
            expect(result.fiatCount).toBe(0);
        });

        test('should fail when both crypto and fiat loading fail', async () => {
            loader.apiClient.shouldFailCrypto = true;
            loader.apiClient.shouldFailFiat = true;

            await expect(loader.loadAllRates()).rejects.toThrow('All rate loading failed');
        });

        test('should prevent concurrent loading', async () => {
            const promise1 = loader.loadAllRates();
            
            await expect(loader.loadAllRates()).rejects.toThrow('Cache loading is already in progress');
            
            await promise1; // Clean up
        });

        test('should call event callbacks during loading', async () => {
            const onLoadStart = jest.fn();
            const onLoadProgress = jest.fn();
            const onLoadComplete = jest.fn();

            loader.setOnLoadStart(onLoadStart);
            loader.setOnLoadProgress(onLoadProgress);
            loader.setOnLoadComplete(onLoadComplete);

            await loader.loadAllRates();

            expect(onLoadStart).toHaveBeenCalledWith({ attempt: 1 });
            expect(onLoadProgress).toHaveBeenCalledTimes(4); // crypto start/complete, fiat start/complete
            expect(onLoadComplete).toHaveBeenCalledWith(expect.objectContaining({
                success: true
            }));
        });
    });

    describe('loadCryptoRates', () => {
        beforeEach(() => {
            loader = new StartupCacheLoader('test-api-key', mockConfig);
        });

        test('should load crypto rates successfully', async () => {
            const cryptoData = await loader.loadCryptoRates();

            expect(cryptoData).toBeDefined();
            expect(typeof cryptoData).toBe('object');
            expect(Object.keys(cryptoData).length).toBeGreaterThan(0);
        });

        test('should handle API errors', async () => {
            loader.apiClient.shouldFailCrypto = true;

            await expect(loader.loadCryptoRates()).rejects.toThrow('Crypto rates loading failed');
        });

        test('should validate response data', async () => {
            // Mock invalid response
            loader.apiClient.fetchAllCryptoPricesBulk = jest.fn().mockResolvedValue(null);

            await expect(loader.loadCryptoRates()).rejects.toThrow('Invalid crypto rates response from API');
        });
    });

    describe('loadFiatRates', () => {
        beforeEach(() => {
            loader = new StartupCacheLoader('test-api-key', mockConfig);
        });

        test('should load fiat rates successfully', async () => {
            const fiatData = await loader.loadFiatRates();

            expect(fiatData).toBeDefined();
            expect(typeof fiatData).toBe('object');
            expect(Object.keys(fiatData).length).toBeGreaterThan(0);
        });

        test('should handle API errors', async () => {
            loader.apiClient.shouldFailFiat = true;

            await expect(loader.loadFiatRates()).rejects.toThrow('Fiat rates loading failed');
        });

        test('should filter to supported currencies only', async () => {
            const fiatData = await loader.loadFiatRates();

            const supportedCurrencies = mockConfig.supportedFiats;
            for (const currency of Object.keys(fiatData)) {
                expect(supportedCurrencies).toContain(currency);
            }
        });
    });

    describe('populateCache', () => {
        beforeEach(() => {
            loader = new StartupCacheLoader('test-api-key', mockConfig);
        });

        test('should populate cache with valid data', async () => {
            const cryptoData = { bitcoin: { usd: 50000 } };
            const fiatData = { USD: 1.0, EUR: 0.85 };

            await loader.populateCache(cryptoData, fiatData);

            expect(loader.cacheManager.populateCalled).toBe(true);
            expect(loader.cacheManager.getStatus().isReady).toBe(true);
        });

        test('should handle empty data', async () => {
            await expect(loader.populateCache(null, null)).rejects.toThrow('No data available to populate cache');
        });

        test('should handle cache population failure', async () => {
            // Mock cache manager failure
            loader.cacheManager.populateCache = jest.fn(() => {
                loader.cacheManager.isReady = false;
                loader.cacheManager.error = 'Mock cache error';
            });

            const cryptoData = { bitcoin: { usd: 50000 } };
            const fiatData = { USD: 1.0 };

            await expect(loader.populateCache(cryptoData, fiatData)).rejects.toThrow('Cache population failed');
        });
    });

    describe('Configuration helpers', () => {
        beforeEach(() => {
            loader = new StartupCacheLoader('test-api-key', mockConfig);
        });

        test('should get supported coin IDs from config', () => {
            const coinIds = loader.getSupportedCoinIds();

            expect(coinIds).toEqual(['bitcoin', 'ethereum', 'ripple']);
        });

        test('should get supported fiat currencies from config', () => {
            const fiats = loader.getSupportedFiatCurrencies();

            expect(fiats).toEqual(['usd', 'eur', 'gbp', 'bgn']);
        });

        test('should use fallback when config is missing', () => {
            loader.config = {};
            
            const coinIds = loader.getSupportedCoinIds();
            const fiats = loader.getSupportedFiatCurrencies();

            expect(coinIds).toEqual(['bitcoin', 'ethereum', 'ripple', 'litecoin']);
            expect(fiats).toEqual(['usd', 'eur', 'gbp', 'bgn']);
        });
    });

    describe('Status and state management', () => {
        beforeEach(() => {
            loader = new StartupCacheLoader('test-api-key', mockConfig);
        });

        test('should track loading status', () => {
            const status = loader.getLoadingStatus();

            expect(status.isLoading).toBe(false);
            expect(status.loadAttempts).toBe(0);
            expect(status.maxRetries).toBe(3);
            expect(status.cacheStatus).toBeDefined();
        });

        test('should reset state properly', () => {
            loader.isLoading = true;
            loader.loadAttempts = 2;

            loader.reset();

            expect(loader.isLoading).toBe(false);
            expect(loader.loadAttempts).toBe(0);
            expect(loader.cacheManager.getStatus().isReady).toBe(false);
        });

        test('should provide cache manager access', () => {
            const cacheManager = loader.getCacheManager();

            expect(cacheManager).toBe(loader.cacheManager);
            expect(cacheManager).toBeInstanceOf(MockRateCacheManager);
        });
    });

    describe('Event callbacks', () => {
        beforeEach(() => {
            loader = new StartupCacheLoader('test-api-key', mockConfig);
        });

        test('should set and call event callbacks', async () => {
            const callbacks = {
                onLoadStart: jest.fn(),
                onLoadProgress: jest.fn(),
                onLoadComplete: jest.fn(),
                onLoadError: jest.fn()
            };

            loader.setOnLoadStart(callbacks.onLoadStart);
            loader.setOnLoadProgress(callbacks.onLoadProgress);
            loader.setOnLoadComplete(callbacks.onLoadComplete);
            loader.setOnLoadError(callbacks.onLoadError);

            await loader.loadAllRates();

            expect(callbacks.onLoadStart).toHaveBeenCalled();
            expect(callbacks.onLoadProgress).toHaveBeenCalled();
            expect(callbacks.onLoadComplete).toHaveBeenCalled();
            expect(callbacks.onLoadError).not.toHaveBeenCalled();
        });

        test('should call error callback on failure', async () => {
            const onLoadError = jest.fn();
            loader.setOnLoadError(onLoadError);
            
            loader.apiClient.shouldFailCrypto = true;
            loader.apiClient.shouldFailFiat = true;

            try {
                await loader.loadAllRates();
            } catch (error) {
                // Expected to fail
            }

            expect(onLoadError).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                error: expect.any(String)
            }));
        });
    });

    describe('Retry logic', () => {
        beforeEach(() => {
            loader = new StartupCacheLoader('test-api-key', mockConfig);
        });

        test('should increment attempt counter on retry', async () => {
            loader.apiClient.shouldFailCrypto = true;
            loader.apiClient.shouldFailFiat = true;

            try {
                await loader.loadAllRates();
            } catch (error) {
                expect(loader.loadAttempts).toBe(1);
            }
        });

        test('should reset attempt counter on success', async () => {
            loader.loadAttempts = 2; // Simulate previous failures

            await loader.loadAllRates();

            expect(loader.loadAttempts).toBe(0);
        });
    });

    describe('Static methods', () => {
        test('should validate configuration correctly', () => {
            const validConfig = {
                supportedCryptos: { BTC: 'bitcoin' },
                supportedFiats: ['USD', 'EUR']
            };

            expect(StartupCacheLoader.validateConfig(validConfig)).toBe(true);
            expect(StartupCacheLoader.validateConfig(null)).toBe(false);
            expect(StartupCacheLoader.validateConfig({})).toBe(false);
            expect(StartupCacheLoader.validateConfig({
                supportedCryptos: 'invalid'
            })).toBe(false);
        });
    });

    describe('Error handling', () => {
        beforeEach(() => {
            loader = new StartupCacheLoader('test-api-key', mockConfig);
        });

        test('should handle authentication errors', async () => {
            loader.apiClient.shouldFailAuth = true;

            await expect(loader.loadAllRates()).rejects.toThrow('Authentication failed');
        });

        test('should provide detailed error information', async () => {
            loader.apiClient.shouldFailCrypto = true;
            loader.apiClient.shouldFailFiat = true;

            try {
                await loader.loadAllRates();
            } catch (error) {
                expect(error.message).toContain('All rate loading failed');
            }
        });
    });
});