/**
 * Integration tests for ExtensionInitializer class
 * Tests extension startup flow, configuration validation, and user feedback
 */

const ExtensionInitializer = require('../js/cache/ExtensionInitializer');

// Mock dependencies
class MockStartupCacheLoader {
    constructor(apiKey, config) {
        this.apiKey = apiKey;
        this.config = config;
        this.isLoading = false;
        this.loadAttempts = 0;
        this.maxRetries = 3;
        this.cacheManager = new MockRateCacheManager();
        
        // Event callbacks
        this.onLoadStart = null;
        this.onLoadProgress = null;
        this.onLoadComplete = null;
        this.onLoadError = null;
        
        // Test control flags
        this.shouldFailLoad = false;
        this.shouldFailAuth = false;
    }

    async loadAllRates() {
        this.isLoading = true;
        this.loadAttempts++;

        if (this.onLoadStart) {
            this.onLoadStart({ attempt: this.loadAttempts });
        }

        if (this.shouldFailAuth) {
            throw new Error('Authentication failed: Invalid API key');
        }

        if (this.shouldFailLoad) {
            throw new Error('All rate loading failed: Network error');
        }

        // Simulate progress events
        if (this.onLoadProgress) {
            this.onLoadProgress({ stage: 'crypto', status: 'loading' });
            this.onLoadProgress({ stage: 'crypto', status: 'complete', count: 10 });
            this.onLoadProgress({ stage: 'fiat', status: 'loading' });
            this.onLoadProgress({ stage: 'fiat', status: 'complete', count: 5 });
        }

        // Simulate successful load
        this.cacheManager.populateCache({ bitcoin: { usd: 50000 } }, { USD: 1.0 });

        const result = {
            success: true,
            cryptoCount: 10,
            fiatCount: 5,
            timestamp: Date.now(),
            cacheStatus: this.cacheManager.getStatus()
        };

        if (this.onLoadComplete) {
            this.onLoadComplete(result);
        }

        this.isLoading = false;
        return result;
    }

    getCacheManager() {
        return this.cacheManager;
    }

    getLoadingStatus() {
        return {
            isLoading: this.isLoading,
            loadAttempts: this.loadAttempts,
            maxRetries: this.maxRetries,
            cacheStatus: this.cacheManager.getStatus()
        };
    }

    setOnLoadStart(callback) { this.onLoadStart = callback; }
    setOnLoadProgress(callback) { this.onLoadProgress = callback; }
    setOnLoadComplete(callback) { this.onLoadComplete = callback; }
    setOnLoadError(callback) { this.onLoadError = callback; }

    reset() {
        this.isLoading = false;
        this.loadAttempts = 0;
        this.cacheManager.clear();
    }
}

class MockRateCacheManager {
    constructor() {
        this.isReady = false;
        this.error = null;
        this.cryptoCount = 0;
        this.fiatCount = 0;
        this.lastUpdated = null;
    }

    populateCache(cryptoData, fiatData) {
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
    }
}

class MockCoinGeckoAPIClient {
    static validateApiKey(apiKey) {
        return apiKey && typeof apiKey === 'string' && apiKey.length >= 10;
    }
}

// Mock DOM and browser APIs
class MockDocument {
    constructor() {
        this.elements = new Map();
        this.head = { appendChild: jest.fn() };
        this.body = { appendChild: jest.fn() };
        this.readyState = 'complete';
    }

    createElement(tagName) {
        const element = {
            tagName: tagName.toUpperCase(),
            id: '',
            style: {},
            textContent: '',
            innerHTML: '',
            appendChild: jest.fn(),
            remove: jest.fn(),
            querySelector: jest.fn()
        };
        return element;
    }

    getElementById(id) {
        return this.elements.get(id) || null;
    }

    appendChild(element) {
        if (element.id) {
            this.elements.set(element.id, element);
        }
    }
}

class MockLocalStorage {
    constructor() {
        this.storage = new Map();
    }

    getItem(key) {
        return this.storage.get(key) || null;
    }

    setItem(key, value) {
        this.storage.set(key, value);
    }

    removeItem(key) {
        this.storage.delete(key);
    }

    clear() {
        this.storage.clear();
    }
}

class MockChrome {
    constructor() {
        this.storage = {
            sync: {
                get: jest.fn(),
                set: jest.fn()
            }
        };
        this.runtime = {
            lastError: null
        };
    }
}

// Setup global mocks
global.StartupCacheLoader = MockStartupCacheLoader;
global.CoinGeckoAPIClient = MockCoinGeckoAPIClient;
global.document = new MockDocument();
global.localStorage = new MockLocalStorage();
global.chrome = new MockChrome();

// Mock CACHE_CONFIG
global.CACHE_CONFIG = {
    supportedCryptos: {
        'BTC': 'bitcoin',
        'ETH': 'ethereum'
    },
    supportedFiats: ['USD', 'EUR', 'BGN'],
    api: {
        rateLimits: {
            maxRetries: 3,
            retryDelay: 100
        }
    }
};

describe('ExtensionInitializer', () => {
    let initializer;
    let mockConfig;

    beforeEach(() => {
        initializer = new ExtensionInitializer();
        mockConfig = {
            supportedCryptos: { 'BTC': 'bitcoin', 'ETH': 'ethereum' },
            supportedFiats: ['USD', 'EUR', 'BGN'],
            api: { rateLimits: { maxRetries: 3, retryDelay: 100 } }
        };

        // Reset mocks
        global.localStorage.clear();
        global.chrome.storage.sync.get.mockClear();
        global.chrome.storage.sync.set.mockClear();
        global.chrome.runtime.lastError = null;
        
        // Reset document mock
        global.document = new MockDocument();
    });

    afterEach(() => {
        if (initializer) {
            initializer.cleanup();
        }
    });

    describe('Constructor', () => {
        test('should create instance with default state', () => {
            expect(initializer).toBeInstanceOf(ExtensionInitializer);
            expect(initializer.isInitialized).toBe(false);
            expect(initializer.isInitializing).toBe(false);
            expect(initializer.initializationError).toBeNull();
            expect(initializer.startupLoader).toBeNull();
        });
    });

    describe('initialize', () => {
        test('should successfully initialize with API key and config', async () => {
            const options = {
                apiKey: 'test-api-key-12345',
                config: mockConfig,
                showUI: false
            };

            const result = await initializer.initialize(options);

            expect(result.success).toBe(true);
            expect(result.initialized).toBe(true);
            expect(result.cacheLoaded).toBe(true);
            expect(result.cryptoCount).toBe(10);
            expect(result.fiatCount).toBe(5);
            expect(initializer.isInitialized).toBe(true);
            expect(initializer.isInitializing).toBe(false);
        });

        test('should prevent concurrent initialization', async () => {
            const options = {
                apiKey: 'test-api-key-12345',
                config: mockConfig,
                showUI: false
            };

            const promise1 = initializer.initialize(options);
            
            await expect(initializer.initialize(options)).rejects.toThrow('Extension initialization already in progress');
            
            await promise1; // Clean up
        });

        test('should return status if already initialized', async () => {
            const options = {
                apiKey: 'test-api-key-12345',
                config: mockConfig,
                showUI: false
            };

            // First initialization
            await initializer.initialize(options);
            
            // Second call should return status
            const result = initializer.getInitializationStatus();
            
            expect(result.isInitialized).toBe(true);
        });

        test('should handle missing API key', async () => {
            const options = {
                config: mockConfig,
                showUI: false
            };

            // Mock chrome storage to return empty result
            global.chrome.storage.sync.get.mockImplementation((keys, callback) => {
                callback({});
            });

            await expect(initializer.initialize(options)).rejects.toThrow('CoinGecko API key not configured');
        }, 10000);

        test('should handle invalid API key', async () => {
            const options = {
                apiKey: 'invalid',
                config: mockConfig,
                showUI: false
            };

            await expect(initializer.initialize(options)).rejects.toThrow('Invalid API key format');
        });

        test('should handle cache loading failure', async () => {
            const options = {
                apiKey: 'test-api-key-12345',
                config: mockConfig,
                showUI: false
            };

            // Mock loader to fail
            const originalStartupLoader = global.StartupCacheLoader;
            global.StartupCacheLoader = class extends MockStartupCacheLoader {
                constructor(apiKey, config) {
                    super(apiKey, config);
                    this.shouldFailLoad = true;
                }
            };

            await expect(initializer.initialize(options)).rejects.toThrow('All rate loading failed');

            // Restore
            global.StartupCacheLoader = originalStartupLoader;
        });

        test('should call event callbacks during initialization', async () => {
            const callbacks = {
                onInitStart: jest.fn(),
                onInitProgress: jest.fn(),
                onInitComplete: jest.fn(),
                onInitError: jest.fn()
            };

            initializer.setOnInitStart(callbacks.onInitStart);
            initializer.setOnInitProgress(callbacks.onInitProgress);
            initializer.setOnInitComplete(callbacks.onInitComplete);
            initializer.setOnInitError(callbacks.onInitError);

            const options = {
                apiKey: 'test-api-key-12345',
                config: mockConfig,
                showUI: false
            };

            await initializer.initialize(options);

            expect(callbacks.onInitStart).toHaveBeenCalled();
            expect(callbacks.onInitProgress).toHaveBeenCalled();
            expect(callbacks.onInitComplete).toHaveBeenCalled();
            expect(callbacks.onInitError).not.toHaveBeenCalled();
        });
    });

    describe('loadApiKey', () => {
        test('should load API key from chrome storage', async () => {
            const testApiKey = 'test-api-key-from-chrome';
            global.chrome.storage.sync.get.mockImplementation((keys, callback) => {
                callback({ coinGeckoApiKey: testApiKey });
            });

            const apiKey = await initializer.loadApiKey();

            expect(apiKey).toBe(testApiKey);
            expect(global.chrome.storage.sync.get).toHaveBeenCalledWith(['coinGeckoApiKey'], expect.any(Function));
        });

        test('should load API key from localStorage as fallback', async () => {
            const testApiKey = 'test-api-key-from-localstorage';
            global.chrome.storage.sync.get.mockImplementation((keys, callback) => {
                callback({});
            });
            global.localStorage.setItem('coinGeckoApiKey', testApiKey);

            const apiKey = await initializer.loadApiKey();

            expect(apiKey).toBe(testApiKey);
        });

        test('should throw error when no API key found', async () => {
            global.chrome.storage.sync.get.mockImplementation((keys, callback) => {
                callback({});
            });

            await expect(initializer.loadApiKey()).rejects.toThrow('CoinGecko API key not configured');
        });
    });

    describe('saveApiKey', () => {
        test('should save API key to chrome storage and localStorage', async () => {
            const testApiKey = 'test-api-key-12345';
            global.chrome.storage.sync.set.mockImplementation((data, callback) => {
                callback();
            });

            await initializer.saveApiKey(testApiKey);

            expect(global.chrome.storage.sync.set).toHaveBeenCalledWith(
                { coinGeckoApiKey: testApiKey },
                expect.any(Function)
            );
            expect(global.localStorage.getItem('coinGeckoApiKey')).toBe(testApiKey);
            expect(initializer.apiKey).toBe(testApiKey);
        });

        test('should handle chrome storage error', async () => {
            const testApiKey = 'test-api-key-12345';
            global.chrome.runtime.lastError = { message: 'Storage error' };
            global.chrome.storage.sync.set.mockImplementation((data, callback) => {
                callback();
            });

            await expect(initializer.saveApiKey(testApiKey)).rejects.toThrow('Storage error');
        });

        test('should validate API key before saving', async () => {
            const invalidApiKey = 'invalid';

            await expect(initializer.saveApiKey(invalidApiKey)).rejects.toThrow('Invalid API key format');
        });
    });

    describe('Configuration management', () => {
        test('should validate valid configuration', () => {
            initializer.config = mockConfig;

            const isValid = initializer.validateConfiguration();

            expect(isValid).toBe(true);
        });

        test('should reject invalid configuration', () => {
            initializer.config = {
                supportedCryptos: 'invalid',
                supportedFiats: 'invalid'
            };

            const isValid = initializer.validateConfiguration();

            expect(isValid).toBe(false);
        });

        test('should use default configuration when none provided', () => {
            const defaultConfig = initializer.getDefaultConfig();

            expect(defaultConfig).toBeDefined();
            expect(defaultConfig.supportedCryptos).toBeDefined();
            expect(defaultConfig.supportedFiats).toBeDefined();
        });
    });

    describe('UI management', () => {
        test('should show and hide loading UI', () => {
            initializer.showLoadingUI();

            expect(initializer.statusElements.loadingIndicator).toBeDefined();

            initializer.hideLoadingUI();

            expect(initializer.statusElements.loadingIndicator.style.display).toBe('none');
        });

        test('should show error UI with message', () => {
            const errorMessage = 'Test error message';

            initializer.showErrorUI(errorMessage);

            expect(initializer.statusElements.errorMessage).toBeDefined();
            expect(initializer.statusElements.errorMessage.textContent).toBe(errorMessage);
        });

        test('should update status text', () => {
            initializer.createLoadingIndicator();
            const testText = 'Loading test data...';

            initializer.updateStatusText(testText);

            expect(initializer.statusElements.statusText.textContent).toBe(testText);
        });
    });

    describe('Status and state management', () => {
        test('should return correct initialization status', () => {
            const status = initializer.getInitializationStatus();

            expect(status.isInitialized).toBe(false);
            expect(status.isInitializing).toBe(false);
            expect(status.error).toBeNull();
            expect(status.hasApiKey).toBe(false);
            expect(status.hasConfig).toBe(false);
        });

        test('should return cache manager when available', async () => {
            const options = {
                apiKey: 'test-api-key-12345',
                config: mockConfig,
                showUI: false
            };

            await initializer.initialize(options);

            const cacheManager = initializer.getCacheManager();

            expect(cacheManager).toBeInstanceOf(MockRateCacheManager);
        });

        test('should return null cache manager when not initialized', () => {
            const cacheManager = initializer.getCacheManager();

            expect(cacheManager).toBeNull();
        });
    });

    describe('Retry functionality', () => {
        test('should retry initialization after failure', async () => {
            const options = {
                apiKey: 'test-api-key-12345',
                config: mockConfig,
                showUI: false
            };

            // Mock loader to fail first time
            let shouldFail = true;
            const originalStartupLoader = global.StartupCacheLoader;
            global.StartupCacheLoader = class extends MockStartupCacheLoader {
                constructor(apiKey, config) {
                    super(apiKey, config);
                    this.shouldFailLoad = shouldFail;
                }
            };

            // First attempt should fail
            await expect(initializer.initialize(options)).rejects.toThrow();

            // Reset failure flag
            shouldFail = false;

            // Retry should succeed
            const result = await initializer.retryInitialization(options);

            expect(result.success).toBe(true);

            // Restore
            global.StartupCacheLoader = originalStartupLoader;
        });
    });

    describe('Event callbacks', () => {
        test('should set and call event callbacks', async () => {
            const callbacks = {
                onInitStart: jest.fn(),
                onInitProgress: jest.fn(),
                onInitComplete: jest.fn(),
                onInitError: jest.fn()
            };

            initializer.setOnInitStart(callbacks.onInitStart);
            initializer.setOnInitProgress(callbacks.onInitProgress);
            initializer.setOnInitComplete(callbacks.onInitComplete);
            initializer.setOnInitError(callbacks.onInitError);

            const options = {
                apiKey: 'test-api-key-12345',
                config: mockConfig,
                showUI: false
            };

            await initializer.initialize(options);

            expect(callbacks.onInitStart).toHaveBeenCalled();
            expect(callbacks.onInitProgress).toHaveBeenCalled();
            expect(callbacks.onInitComplete).toHaveBeenCalled();
        });
    });

    describe('Cleanup', () => {
        test('should clean up resources and UI elements', async () => {
            const options = {
                apiKey: 'test-api-key-12345',
                config: mockConfig,
                showUI: true
            };

            await initializer.initialize(options);

            // Verify elements exist
            expect(initializer.statusElements.loadingIndicator).toBeDefined();
            expect(initializer.startupLoader).toBeDefined();

            initializer.cleanup();

            // Verify cleanup
            expect(initializer.statusElements.loadingIndicator).toBeNull();
            expect(initializer.startupLoader).toBeNull();
            expect(initializer.isInitialized).toBe(false);
            expect(initializer.isInitializing).toBe(false);
        });
    });

    describe('Error handling', () => {
        test('should handle authentication errors', async () => {
            const options = {
                apiKey: 'test-api-key-12345',
                config: mockConfig,
                showUI: false
            };

            // Mock loader to fail with auth error
            const originalStartupLoader = global.StartupCacheLoader;
            global.StartupCacheLoader = class extends MockStartupCacheLoader {
                constructor(apiKey, config) {
                    super(apiKey, config);
                    this.shouldFailAuth = true;
                }
            };

            await expect(initializer.initialize(options)).rejects.toThrow('Authentication failed');

            // Restore
            global.StartupCacheLoader = originalStartupLoader;
        });

        test('should provide detailed error information', async () => {
            const options = {
                config: mockConfig,
                showUI: false
            };

            try {
                await initializer.initialize(options);
            } catch (error) {
                expect(error.message).toContain('CoinGecko API key not configured');
                expect(initializer.initializationError).toContain('CoinGecko API key not configured');
            }
        });
    });
});