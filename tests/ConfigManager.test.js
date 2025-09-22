/**
 * Tests for ConfigManager class
 */

// Mock Chrome storage API
global.chrome = {
    storage: {
        sync: {
            get: jest.fn(),
            set: jest.fn()
        }
    },
    runtime: {
        lastError: null
    }
};

// Mock CACHE_CONFIG
global.CACHE_CONFIG = {
    cache: {
        refreshIntervalMs: 900000,
        staleThresholdMs: 3600000,
        retryIntervalMs: 300000
    },
    defaults: {
        preferredCurrency: 'BGN',
        preferredCryptoCurrency: 'USD'
    },
    supportedCryptos: {
        'BTC': 'bitcoin',
        'ETH': 'ethereum'
    },
    supportedFiats: ['USD', 'EUR', 'BGN'],
    cryptoVsCurrencies: ['USD', 'EUR'],
    api: {
        baseUrl: 'https://api.coingecko.com/api/v3',
        endpoints: {
            cryptoPrices: '/simple/price',
            exchangeRates: '/exchange_rates'
        },
        rateLimits: {
            requestsPerMinute: 30,
            retryDelay: 5000,
            maxRetries: 3
        }
    }
};

// Mock helper function
global.isSupportedFiatCurrency = jest.fn((currency) => {
    return ['USD', 'EUR', 'BGN'].includes(currency.toUpperCase());
});

const ConfigManager = require('../js/cache/ConfigManager.js');

describe('ConfigManager', () => {
    let configManager;

    beforeEach(() => {
        configManager = new ConfigManager();
        jest.clearAllMocks();
        chrome.runtime.lastError = null;
    });

    describe('initialization', () => {
        test('should initialize with default configuration', async () => {
            chrome.storage.sync.get.mockImplementation((keys, callback) => {
                callback({});
            });

            const result = await configManager.initialize();

            expect(result).toBe(true);
            expect(configManager.isInitialized).toBe(true);
            expect(configManager.getConfiguration()).toMatchObject({
                coinGeckoApiKey: '',
                refreshIntervalMs: 900000,
                staleThresholdMs: 3600000,
                preferredCurrency: 'BGN',
                preferredCryptoCurrency: 'USD'
            });
        });

        test('should initialize with stored configuration', async () => {
            const storedConfig = {
                coinGeckoApiKey: 'test-api-key-12345',
                refreshIntervalMs: 600000,
                preferredCurrency: 'USD'
            };

            chrome.storage.sync.get.mockImplementation((keys, callback) => {
                callback(storedConfig);
            });

            const result = await configManager.initialize();

            expect(result).toBe(true);
            expect(configManager.get('coinGeckoApiKey')).toBe('test-api-key-12345');
            expect(configManager.get('refreshIntervalMs')).toBe(600000);
            expect(configManager.get('preferredCurrency')).toBe('USD');
        });

        test('should handle storage errors during initialization', async () => {
            chrome.storage.sync.get.mockImplementation((keys, callback) => {
                chrome.runtime.lastError = { message: 'Storage error' };
                callback({});
            });

            const result = await configManager.initialize();

            expect(result).toBe(false);
            expect(configManager.isInitialized).toBe(false);
        });

        test('should work without Chrome storage (testing environment)', async () => {
            const originalChrome = global.chrome;
            global.chrome = undefined;

            const result = await configManager.initialize();

            expect(result).toBe(true);
            expect(configManager.isInitialized).toBe(true);

            global.chrome = originalChrome;
        });
    });

    describe('configuration validation', () => {
        beforeEach(async () => {
            chrome.storage.sync.get.mockImplementation((keys, callback) => {
                callback({});
            });
            await configManager.initialize();
        });

        test('should validate API key format', () => {
            expect(configManager.isValidApiKey('valid-api-key-123')).toBe(true);
            expect(configManager.isValidApiKey('validapikey123')).toBe(true);
            expect(configManager.isValidApiKey('valid_api_key_123')).toBe(true);
            
            expect(configManager.isValidApiKey('')).toBe(false);
            expect(configManager.isValidApiKey('short')).toBe(false);
            expect(configManager.isValidApiKey('invalid@key!')).toBe(false);
            expect(configManager.isValidApiKey(null)).toBe(false);
            expect(configManager.isValidApiKey(undefined)).toBe(false);
        });

        test('should validate interval values', () => {
            expect(configManager.isValidInterval(300000, 60000, 3600000)).toBe(true);
            expect(configManager.isValidInterval(60000, 60000, 3600000)).toBe(true);
            expect(configManager.isValidInterval(3600000, 60000, 3600000)).toBe(true);
            
            expect(configManager.isValidInterval(30000, 60000, 3600000)).toBe(false);
            expect(configManager.isValidInterval(4000000, 60000, 3600000)).toBe(false);
            expect(configManager.isValidInterval('300000', 60000, 3600000)).toBe(false);
            expect(configManager.isValidInterval(null, 60000, 3600000)).toBe(false);
        });

        test('should detect validation errors', async () => {
            const invalidConfig = {
                coinGeckoApiKey: 'invalid@key',
                refreshIntervalMs: 30000, // Too short
                staleThresholdMs: 100000, // Too short
                preferredCurrency: 'INVALID'
            };

            chrome.storage.sync.get.mockImplementation((keys, callback) => {
                callback(invalidConfig);
            });

            await configManager.initialize();

            expect(configManager.isValid()).toBe(false);
            const errors = configManager.getValidationErrors();
            expect(errors.length).toBeGreaterThan(0);
            expect(errors.some(error => error.includes('API key'))).toBe(true);
            expect(errors.some(error => error.includes('Refresh interval'))).toBe(true);
        });

        test('should pass validation with valid configuration', async () => {
            const validConfig = {
                coinGeckoApiKey: 'valid-api-key-123456',
                refreshIntervalMs: 900000,
                staleThresholdMs: 3600000,
                retryIntervalMs: 300000,
                preferredCurrency: 'USD',
                preferredCryptoCurrency: 'EUR'
            };

            chrome.storage.sync.get.mockImplementation((keys, callback) => {
                callback(validConfig);
            });

            await configManager.initialize();

            expect(configManager.isValid()).toBe(true);
            expect(configManager.getValidationErrors()).toHaveLength(0);
        });
    });

    describe('configuration updates', () => {
        beforeEach(async () => {
            chrome.storage.sync.get.mockImplementation((keys, callback) => {
                callback({});
            });
            await configManager.initialize();
        });

        test('should update valid configuration', async () => {
            chrome.storage.sync.set.mockImplementation((data, callback) => {
                callback();
            });

            const updates = {
                coinGeckoApiKey: 'new-valid-api-key-123',
                refreshIntervalMs: 600000
            };

            const result = await configManager.updateConfiguration(updates);

            expect(result).toBe(true);
            expect(configManager.get('coinGeckoApiKey')).toBe('new-valid-api-key-123');
            expect(configManager.get('refreshIntervalMs')).toBe(600000);
            expect(chrome.storage.sync.set).toHaveBeenCalledWith(updates, expect.any(Function));
        });

        test('should reject invalid configuration updates', async () => {
            const invalidUpdates = {
                coinGeckoApiKey: 'invalid@key',
                refreshIntervalMs: 30000 // Too short
            };

            const result = await configManager.updateConfiguration(invalidUpdates);

            expect(result).toBe(false);
            expect(configManager.get('coinGeckoApiKey')).toBe(''); // Should remain unchanged
            expect(chrome.storage.sync.set).not.toHaveBeenCalled();
        });

        test('should handle storage errors during update', async () => {
            chrome.storage.sync.set.mockImplementation((data, callback) => {
                chrome.runtime.lastError = { message: 'Storage error' };
                callback();
            });

            const updates = {
                coinGeckoApiKey: 'valid-api-key-123456'
            };

            const result = await configManager.updateConfiguration(updates);

            expect(result).toBe(false);
        });
    });

    describe('configuration getters', () => {
        beforeEach(async () => {
            const testConfig = {
                coinGeckoApiKey: 'test-api-key-123456',
                refreshIntervalMs: 600000,
                preferredCurrency: 'USD'
            };

            chrome.storage.sync.get.mockImplementation((keys, callback) => {
                callback(testConfig);
            });
            await configManager.initialize();
        });

        test('should get specific configuration values', () => {
            expect(configManager.get('coinGeckoApiKey')).toBe('test-api-key-123456');
            expect(configManager.get('refreshIntervalMs')).toBe(600000);
            expect(configManager.get('nonexistent', 'default')).toBe('default');
        });

        test('should check if API key is valid', () => {
            expect(configManager.hasValidApiKey()).toBe(true);
        });

        test('should get API configuration', () => {
            const apiConfig = configManager.getApiConfig();
            
            expect(apiConfig).toMatchObject({
                baseUrl: 'https://api.coingecko.com/api/v3',
                apiKey: 'test-api-key-123456',
                hasApiKey: true
            });
        });

        test('should get cache configuration', () => {
            const cacheConfig = configManager.getCacheConfig();
            
            expect(cacheConfig).toMatchObject({
                refreshIntervalMs: 600000,
                staleThresholdMs: 3600000,
                retryIntervalMs: 300000
            });
        });

        test('should get currency configuration', () => {
            const currencyConfig = configManager.getCurrencyConfig();
            
            expect(currencyConfig).toMatchObject({
                preferredCurrency: 'USD',
                preferredCryptoCurrency: 'USD'
            });
            expect(currencyConfig.supportedCryptos).toBeDefined();
            expect(currencyConfig.supportedFiats).toBeDefined();
        });
    });

    describe('configuration reset', () => {
        beforeEach(async () => {
            chrome.storage.sync.get.mockImplementation((keys, callback) => {
                callback({
                    coinGeckoApiKey: 'test-key',
                    refreshIntervalMs: 600000
                });
            });
            await configManager.initialize();
        });

        test('should reset to default configuration', async () => {
            chrome.storage.sync.set.mockImplementation((data, callback) => {
                callback();
            });

            const result = await configManager.resetToDefaults();

            expect(result).toBe(true);
            expect(configManager.get('coinGeckoApiKey')).toBe('');
            expect(configManager.get('refreshIntervalMs')).toBe(900000);
            expect(configManager.get('preferredCurrency')).toBe('BGN');
        });
    });

    describe('configuration export', () => {
        beforeEach(async () => {
            chrome.storage.sync.get.mockImplementation((keys, callback) => {
                callback({
                    coinGeckoApiKey: 'test-api-key-123456789',
                    preferredCurrency: 'USD'
                });
            });
            await configManager.initialize();
        });

        test('should export configuration with masked API key', () => {
            const exported = configManager.exportConfiguration();

            expect(exported).toMatchObject({
                isValid: true,
                hasApiKey: true
            });
            expect(exported.config.coinGeckoApiKey).toBe('test**************6789');
            expect(exported.config.preferredCurrency).toBe('USD');
        });

        test('should return null when not initialized', () => {
            const uninitializedManager = new ConfigManager();
            const exported = uninitializedManager.exportConfiguration();

            expect(exported).toBeNull();
        });
    });

    describe('error handling', () => {
        test('should handle missing configuration gracefully', () => {
            const uninitializedManager = new ConfigManager();

            expect(uninitializedManager.getConfiguration()).toBeNull();
            expect(uninitializedManager.get('anyKey', 'default')).toBe('default');
            expect(uninitializedManager.isValid()).toBe(false);
            expect(uninitializedManager.hasValidApiKey()).toBe(false);
            expect(uninitializedManager.getApiConfig()).toBeNull();
        });

        test('should handle validation errors properly', async () => {
            chrome.storage.sync.get.mockImplementation((keys, callback) => {
                callback({
                    coinGeckoApiKey: 'invalid',
                    refreshIntervalMs: 'not-a-number'
                });
            });

            await configManager.initialize();

            expect(configManager.isValid()).toBe(false);
            const errors = configManager.getValidationErrors();
            expect(errors.length).toBeGreaterThan(0);
        });
    });
});