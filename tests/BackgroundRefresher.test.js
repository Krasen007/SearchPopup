/**
 * Unit tests for BackgroundRefresher class
 * Tests background refresh functionality, retry logic, and timer management
 */

const BackgroundRefresher = require('../js/cache/BackgroundRefresher');

// Mock dependencies
class MockStartupCacheLoader {
    constructor() {
        this.loadAllRatesCallCount = 0;
        this.shouldFail = false;
        this.loadDelay = 0;
        this.cacheManager = new MockRateCacheManager();
    }

    async loadAllRates() {
        this.loadAllRatesCallCount++;
        
        if (this.loadDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.loadDelay));
        }

        if (this.shouldFail) {
            throw new Error('Mock cache load failure');
        }

        return {
            success: true,
            cryptoCount: 10,
            fiatCount: 5,
            timestamp: Date.now()
        };
    }

    getCacheManager() {
        return this.cacheManager;
    }

    reset() {
        this.loadAllRatesCallCount = 0;
        this.shouldFail = false;
        this.loadDelay = 0;
    }
}

class MockRateCacheManager {
    constructor() {
        this.isReady = true;
        this.lastUpdated = Date.now();
    }

    getStatus() {
        return {
            isReady: this.isReady,
            lastUpdated: this.lastUpdated,
            isStale: false,
            cryptoCount: 10,
            fiatCount: 5,
            error: null,
            cacheAge: Date.now() - this.lastUpdated
        };
    }
}

describe('BackgroundRefresher', () => {
    let mockCacheLoader;
    let refresher;

    beforeEach(() => {
        mockCacheLoader = new MockStartupCacheLoader();
        refresher = new BackgroundRefresher(mockCacheLoader, {
            refreshIntervalMs: 100, // Short interval for testing
            retryDelayMs: 50,       // Short retry delay for testing
            maxRetries: 2,
            enableLogging: false    // Disable logging for cleaner test output
        });
    });

    afterEach(() => {
        if (refresher) {
            refresher.stop();
        }
        mockCacheLoader.reset();
    });

    describe('Constructor', () => {
        test('should create BackgroundRefresher with default configuration', () => {
            const defaultRefresher = new BackgroundRefresher(mockCacheLoader);
            
            expect(defaultRefresher.config.refreshIntervalMs).toBe(900000); // 15 minutes
            expect(defaultRefresher.config.retryDelayMs).toBe(300000);      // 5 minutes
            expect(defaultRefresher.config.maxRetries).toBe(3);
            expect(defaultRefresher.config.enableLogging).toBe(true);
        });

        test('should create BackgroundRefresher with custom configuration', () => {
            const customConfig = {
                refreshIntervalMs: 600000,
                retryDelayMs: 120000,
                maxRetries: 5,
                enableLogging: false
            };

            const customRefresher = new BackgroundRefresher(mockCacheLoader, customConfig);
            
            expect(customRefresher.config.refreshIntervalMs).toBe(600000);
            expect(customRefresher.config.retryDelayMs).toBe(120000);
            expect(customRefresher.config.maxRetries).toBe(5);
            expect(customRefresher.config.enableLogging).toBe(false);
        });

        test('should throw error if no cache loader provided', () => {
            expect(() => {
                new BackgroundRefresher(null);
            }).toThrow('BackgroundRefresher requires a StartupCacheLoader instance');
        });

        test('should initialize with correct default state', () => {
            expect(refresher.isRunning).toBe(false);
            expect(refresher.refreshTimer).toBe(null);
            expect(refresher.retryTimer).toBe(null);
            expect(refresher.refreshCount).toBe(0);
            expect(refresher.lastRefreshTime).toBe(null);
            expect(refresher.lastRefreshSuccess).toBe(null);
            expect(refresher.consecutiveFailures).toBe(0);
        });
    });

    describe('Start and Stop', () => {
        test('should start background refresher successfully', () => {
            const result = refresher.start();
            
            expect(result).toBe(true);
            expect(refresher.isRunning).toBe(true);
            expect(refresher.refreshTimer).not.toBe(null);
        });

        test('should not start if already running', () => {
            refresher.start();
            const result = refresher.start();
            
            expect(result).toBe(false);
            expect(refresher.isRunning).toBe(true);
        });

        test('should stop background refresher successfully', () => {
            refresher.start();
            const result = refresher.stop();
            
            expect(result).toBe(true);
            expect(refresher.isRunning).toBe(false);
            expect(refresher.refreshTimer).toBe(null);
        });

        test('should not stop if not running', () => {
            const result = refresher.stop();
            
            expect(result).toBe(false);
            expect(refresher.isRunning).toBe(false);
        });

        test('should clear timers when stopping', () => {
            refresher.start();
            
            // Verify timers are set
            expect(refresher.refreshTimer).not.toBe(null);
            
            refresher.stop();
            
            // Verify timers are cleared
            expect(refresher.refreshTimer).toBe(null);
            expect(refresher.retryTimer).toBe(null);
        });
    });

    describe('Cache Refresh', () => {
        test('should perform successful cache refresh', async () => {
            let refreshStartEvent = null;
            let refreshSuccessEvent = null;

            refresher.setOnRefreshStart((event) => {
                refreshStartEvent = event;
            });

            refresher.setOnRefreshSuccess((event) => {
                refreshSuccessEvent = event;
            });

            await refresher.refreshCache();

            expect(mockCacheLoader.loadAllRatesCallCount).toBe(1);
            expect(refresher.refreshCount).toBe(1);
            expect(refresher.lastRefreshSuccess).toBe(true);
            expect(refresher.consecutiveFailures).toBe(0);
            expect(refresher.lastRefreshTime).not.toBe(null);

            // Verify events were fired
            expect(refreshStartEvent).not.toBe(null);
            expect(refreshStartEvent.refreshCount).toBe(1);
            expect(refreshSuccessEvent).not.toBe(null);
            expect(refreshSuccessEvent.refreshCount).toBe(1);
        });

        test('should handle cache refresh failure', async () => {
            mockCacheLoader.shouldFail = true;

            let refreshErrorEvent = null;
            refresher.setOnRefreshError((event) => {
                refreshErrorEvent = event;
            });

            await refresher.refreshCache();

            expect(mockCacheLoader.loadAllRatesCallCount).toBe(1);
            expect(refresher.refreshCount).toBe(1);
            expect(refresher.lastRefreshSuccess).toBe(false);
            expect(refresher.consecutiveFailures).toBe(1);

            // Verify error event was fired
            expect(refreshErrorEvent).not.toBe(null);
            expect(refreshErrorEvent.error).toBe('Mock cache load failure');
            expect(refreshErrorEvent.consecutiveFailures).toBe(1);
        });

        test('should refresh even when not running (for manual calls)', async () => {
            refresher.isRunning = false;
            
            await refresher.refreshCache();
            
            expect(mockCacheLoader.loadAllRatesCallCount).toBe(1);
            expect(refresher.refreshCount).toBe(1);
        });
    });

    describe('Retry Logic', () => {
        test('should schedule retry after failure', (done) => {
            mockCacheLoader.shouldFail = true;
            refresher.start();

            let retryScheduledEvent = null;
            refresher.setOnRetryScheduled((event) => {
                retryScheduledEvent = event;
            });

            // Wait for initial refresh to fail and retry to be scheduled
            setTimeout(() => {
                expect(refresher.consecutiveFailures).toBe(1);
                expect(refresher.retryTimer).not.toBe(null);
                expect(retryScheduledEvent).not.toBe(null);
                expect(retryScheduledEvent.consecutiveFailures).toBe(1);
                done();
            }, 150); // Wait longer than refresh interval
        });

        test('should stop retrying after max retries reached', (done) => {
            mockCacheLoader.shouldFail = true;
            refresher.start();

            // Wait for multiple failures
            setTimeout(() => {
                expect(refresher.consecutiveFailures).toBeGreaterThanOrEqual(refresher.config.maxRetries);
                expect(mockCacheLoader.loadAllRatesCallCount).toBeGreaterThanOrEqual(refresher.config.maxRetries);
                done();
            }, 300); // Wait for multiple retry cycles
        });

        test('should reset consecutive failures on successful refresh', async () => {
            // First, cause some failures
            mockCacheLoader.shouldFail = true;
            await refresher.refreshCache();
            await refresher.refreshCache();
            
            expect(refresher.consecutiveFailures).toBe(2);

            // Then succeed
            mockCacheLoader.shouldFail = false;
            await refresher.refreshCache();

            expect(refresher.consecutiveFailures).toBe(0);
            expect(refresher.lastRefreshSuccess).toBe(true);
        });
    });

    describe('Force Refresh', () => {
        test('should perform immediate refresh when forced', async () => {
            refresher.start();
            
            const status = await refresher.forceRefresh();
            
            expect(mockCacheLoader.loadAllRatesCallCount).toBe(1);
            expect(status.refreshCount).toBe(1);
            expect(status.lastRefreshSuccess).toBe(true);
        });

        test('should throw error if not running when forced', async () => {
            await expect(refresher.forceRefresh()).rejects.toThrow('Background refresher is not running');
        });

        test('should clear existing timers when forced', async () => {
            refresher.start();
            
            // Verify timer is set
            expect(refresher.refreshTimer).not.toBe(null);
            
            await refresher.forceRefresh();
            
            // Timer should be cleared and reset
            expect(refresher.refreshTimer).not.toBe(null);
        });
    });

    describe('Status and Configuration', () => {
        test('should return correct status information', () => {
            refresher.start();
            refresher.refreshCount = 5;
            refresher.lastRefreshTime = Date.now() - 1000;
            refresher.lastRefreshSuccess = true;
            refresher.consecutiveFailures = 0;

            const status = refresher.getStatus();

            expect(status.isRunning).toBe(true);
            expect(status.refreshCount).toBe(5);
            expect(status.lastRefreshTime).not.toBe(null);
            expect(status.lastRefreshSuccess).toBe(true);
            expect(status.consecutiveFailures).toBe(0);
            expect(status.config).toEqual(refresher.config);
            expect(status.cacheStatus).toBeDefined();
        });

        test('should update configuration successfully', () => {
            const newConfig = {
                refreshIntervalMs: 200,
                retryDelayMs: 100,
                maxRetries: 5,
                enableLogging: true
            };

            const result = refresher.updateConfig(newConfig);

            expect(result).toBe(true);
            expect(refresher.config.refreshIntervalMs).toBe(200);
            expect(refresher.config.retryDelayMs).toBe(100);
            expect(refresher.config.maxRetries).toBe(5);
            expect(refresher.config.enableLogging).toBe(true);
        });

        test('should reject invalid configuration', () => {
            const invalidConfigs = [
                null,
                undefined,
                'string',
                { refreshIntervalMs: -1 },
                { retryDelayMs: 0 },
                { maxRetries: -1 },
                { enableLogging: 'true' }
            ];

            invalidConfigs.forEach(config => {
                const result = refresher.updateConfig(config);
                expect(result).toBe(false);
            });
        });

        test('should get refresh statistics', () => {
            refresher.refreshCount = 10;
            refresher.consecutiveFailures = 2;
            refresher.lastRefreshTime = Date.now() - 5000;
            refresher.lastRefreshSuccess = false;
            refresher.isRunning = true;

            const stats = refresher.getStats();

            expect(stats.refreshCount).toBe(10);
            expect(stats.consecutiveFailures).toBe(2);
            expect(stats.lastRefreshTime).not.toBe(null);
            expect(stats.lastRefreshSuccess).toBe(false);
            expect(stats.isRunning).toBe(true);
            expect(stats.uptime).toBeGreaterThan(0);
            expect(stats.config).toEqual(refresher.config);
        });
    });

    describe('Event Callbacks', () => {
        test('should call all event callbacks during refresh cycle', async () => {
            let startCalled = false;
            let successCalled = false;
            let errorCalled = false;
            let retryCalled = false;

            refresher.setOnRefreshStart(() => { startCalled = true; });
            refresher.setOnRefreshSuccess(() => { successCalled = true; });
            refresher.setOnRefreshError(() => { errorCalled = true; });
            refresher.setOnRetryScheduled(() => { retryCalled = true; });

            // Test successful refresh
            await refresher.refreshCache();
            expect(startCalled).toBe(true);
            expect(successCalled).toBe(true);
            expect(errorCalled).toBe(false);

            // Reset and test failed refresh
            startCalled = false;
            successCalled = false;
            mockCacheLoader.shouldFail = true;
            refresher.isRunning = true; // Enable retry scheduling

            await refresher.refreshCache();
            expect(startCalled).toBe(true);
            expect(successCalled).toBe(false);
            expect(errorCalled).toBe(true);
        });
    });

    describe('Reset and Cleanup', () => {
        test('should reset refresher state', () => {
            refresher.start();
            refresher.refreshCount = 5;
            refresher.lastRefreshTime = Date.now();
            refresher.lastRefreshSuccess = true;
            refresher.consecutiveFailures = 2;

            refresher.reset();

            expect(refresher.isRunning).toBe(false);
            expect(refresher.refreshCount).toBe(0);
            expect(refresher.lastRefreshTime).toBe(null);
            expect(refresher.lastRefreshSuccess).toBe(null);
            expect(refresher.consecutiveFailures).toBe(0);
            expect(refresher.refreshTimer).toBe(null);
            expect(refresher.retryTimer).toBe(null);
        });
    });

    describe('Configuration Validation', () => {
        test('should validate valid configuration', () => {
            const validConfigs = [
                { refreshIntervalMs: 1000 },
                { retryDelayMs: 500 },
                { maxRetries: 0 },
                { enableLogging: false },
                {
                    refreshIntervalMs: 900000,
                    retryDelayMs: 300000,
                    maxRetries: 3,
                    enableLogging: true
                }
            ];

            validConfigs.forEach(config => {
                expect(BackgroundRefresher.validateConfig(config)).toBe(true);
            });
        });

        test('should reject invalid configuration', () => {
            const invalidConfigs = [
                null,
                undefined,
                'string',
                123,
                [],
                { refreshIntervalMs: 0 },
                { refreshIntervalMs: -1 },
                { retryDelayMs: 0 },
                { retryDelayMs: -1 },
                { maxRetries: -1 },
                { enableLogging: 'true' }
            ];

            invalidConfigs.forEach(config => {
                expect(BackgroundRefresher.validateConfig(config)).toBe(false);
            });
        });
    });

    describe('Timer Management', () => {
        test('should calculate time until next refresh correctly', () => {
            refresher.start();
            refresher.lastRefreshTime = Date.now();

            const timeUntilNext = refresher.getTimeUntilNextRefresh();
            
            expect(timeUntilNext).toBeGreaterThan(0);
            expect(timeUntilNext).toBeLessThanOrEqual(refresher.config.refreshIntervalMs);
        });

        test('should return null for time until next refresh when not running', () => {
            const timeUntilNext = refresher.getTimeUntilNextRefresh();
            expect(timeUntilNext).toBe(null);
        });

        test('should reschedule refresh when configuration changes', () => {
            refresher.start();
            const originalTimer = refresher.refreshTimer;

            refresher.updateConfig({ refreshIntervalMs: 200 });

            // Timer should be rescheduled
            expect(refresher.refreshTimer).not.toBe(originalTimer);
            expect(refresher.config.refreshIntervalMs).toBe(200);
        });
    });
});