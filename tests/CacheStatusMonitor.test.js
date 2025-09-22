/**
 * Unit tests for CacheStatusMonitor class
 * Tests cache staleness monitoring, status reporting, and user feedback indicators
 */

const CacheStatusMonitor = require('../js/cache/CacheStatusMonitor');

// Mock RateCacheManager
class MockRateCacheManager {
    constructor() {
        this.isReady = true;
        this.lastUpdated = Date.now();
        this.error = null;
        this.cryptoCount = 10;
        this.fiatCount = 5;
    }

    getStatus() {
        return {
            isReady: this.isReady,
            lastUpdated: this.lastUpdated,
            isStale: this.getCacheAge() > 3600000, // 1 hour
            cryptoCount: this.cryptoCount,
            fiatCount: this.fiatCount,
            error: this.error,
            cacheAge: this.getCacheAge()
        };
    }

    getCacheAge() {
        return this.lastUpdated ? Date.now() - this.lastUpdated : null;
    }

    // Test helper methods
    setAge(ageMs) {
        this.lastUpdated = Date.now() - ageMs;
    }

    setError(error) {
        this.error = error;
        this.isReady = false;
    }

    setNotReady() {
        this.isReady = false;
        this.lastUpdated = null;
    }

    reset() {
        this.isReady = true;
        this.lastUpdated = Date.now();
        this.error = null;
        this.cryptoCount = 10;
        this.fiatCount = 5;
    }
}

describe('CacheStatusMonitor', () => {
    let mockCacheManager;
    let monitor;

    beforeEach(() => {
        mockCacheManager = new MockRateCacheManager();
        monitor = new CacheStatusMonitor(mockCacheManager, {
            staleThresholdMs: 3600000,      // 1 hour
            veryStaleThresholdMs: 7200000,  // 2 hours
            criticalStaleThresholdMs: 21600000, // 6 hours
            enableLogging: false
        });
    });

    afterEach(() => {
        mockCacheManager.reset();
    });

    describe('Constructor', () => {
        test('should create CacheStatusMonitor with default configuration', () => {
            const defaultMonitor = new CacheStatusMonitor(mockCacheManager);
            
            expect(defaultMonitor.config.staleThresholdMs).toBe(3600000);
            expect(defaultMonitor.config.veryStaleThresholdMs).toBe(7200000);
            expect(defaultMonitor.config.criticalStaleThresholdMs).toBe(21600000);
            expect(defaultMonitor.config.enableLogging).toBe(true);
        });

        test('should create CacheStatusMonitor with custom configuration', () => {
            const customConfig = {
                staleThresholdMs: 1800000,      // 30 minutes
                veryStaleThresholdMs: 3600000,  // 1 hour
                criticalStaleThresholdMs: 10800000, // 3 hours
                enableLogging: false
            };

            const customMonitor = new CacheStatusMonitor(mockCacheManager, customConfig);
            
            expect(customMonitor.config.staleThresholdMs).toBe(1800000);
            expect(customMonitor.config.veryStaleThresholdMs).toBe(3600000);
            expect(customMonitor.config.criticalStaleThresholdMs).toBe(10800000);
            expect(customMonitor.config.enableLogging).toBe(false);
        });

        test('should throw error if no cache manager provided', () => {
            expect(() => {
                new CacheStatusMonitor(null);
            }).toThrow('CacheStatusMonitor requires a RateCacheManager instance');
        });

        test('should initialize with correct default state', () => {
            expect(monitor.lastStatusUpdate).toBe(null);
            expect(monitor.statusHistory).toEqual([]);
            expect(monitor.currentStatus).toBe(null);
            expect(monitor.lastStalenessLevel).toBe(null);
        });
    });

    describe('Staleness Level Calculation', () => {
        test('should calculate fresh level for recent cache', () => {
            mockCacheManager.setAge(1800000); // 30 minutes
            
            const staleness = monitor.calculateStalenessLevel(mockCacheManager.getCacheAge());
            
            expect(staleness.level).toBe('fresh');
            expect(staleness.severity).toBe('none');
            expect(staleness.isStale).toBe(false);
            expect(staleness.isCritical).toBe(false);
        });

        test('should calculate stale level for moderately old cache', () => {
            mockCacheManager.setAge(5400000); // 1.5 hours
            
            const staleness = monitor.calculateStalenessLevel(mockCacheManager.getCacheAge());
            
            expect(staleness.level).toBe('stale');
            expect(staleness.severity).toBe('warning');
            expect(staleness.isStale).toBe(true);
            expect(staleness.isCritical).toBe(false);
        });

        test('should calculate very_stale level for old cache', () => {
            mockCacheManager.setAge(10800000); // 3 hours
            
            const staleness = monitor.calculateStalenessLevel(mockCacheManager.getCacheAge());
            
            expect(staleness.level).toBe('very_stale');
            expect(staleness.severity).toBe('error');
            expect(staleness.isStale).toBe(true);
            expect(staleness.isCritical).toBe(false);
        });

        test('should calculate critical_stale level for very old cache', () => {
            mockCacheManager.setAge(25200000); // 7 hours
            
            const staleness = monitor.calculateStalenessLevel(mockCacheManager.getCacheAge());
            
            expect(staleness.level).toBe('critical_stale');
            expect(staleness.severity).toBe('critical');
            expect(staleness.isStale).toBe(true);
            expect(staleness.isCritical).toBe(true);
        });

        test('should calculate no_data level for null cache age', () => {
            const staleness = monitor.calculateStalenessLevel(null);
            
            expect(staleness.level).toBe('no_data');
            expect(staleness.severity).toBe('critical');
            expect(staleness.isStale).toBe(true);
            expect(staleness.isCritical).toBe(true);
        });
    });

    describe('Age Information', () => {
        test('should format age information for seconds', () => {
            const ageMs = 45000; // 45 seconds
            const ageInfo = monitor.getAgeInfo(ageMs);
            
            expect(ageInfo.ageSeconds).toBe(45);
            expect(ageInfo.ageMinutes).toBe(0);
            expect(ageInfo.ageHours).toBe(0);
            expect(ageInfo.humanReadable).toBe('45 seconds ago');
            expect(ageInfo.shortFormat).toBe('45s');
            expect(ageInfo.relativeTime).toBe('Just now');
        });

        test('should format age information for minutes', () => {
            const ageMs = 150000; // 2.5 minutes
            const ageInfo = monitor.getAgeInfo(ageMs);
            
            expect(ageInfo.ageSeconds).toBe(150);
            expect(ageInfo.ageMinutes).toBe(2);
            expect(ageInfo.ageHours).toBe(0);
            expect(ageInfo.humanReadable).toBe('2 minutes 30 seconds ago');
            expect(ageInfo.shortFormat).toBe('2m 30s');
            expect(ageInfo.relativeTime).toBe('2m ago');
        });

        test('should format age information for hours', () => {
            const ageMs = 5400000; // 1.5 hours
            const ageInfo = monitor.getAgeInfo(ageMs);
            
            expect(ageInfo.ageHours).toBe(1);
            expect(ageInfo.ageMinutes).toBe(90);
            expect(ageInfo.humanReadable).toBe('1 hour 30 minutes ago');
            expect(ageInfo.shortFormat).toBe('1h 30m');
            expect(ageInfo.relativeTime).toBe('1h ago');
        });

        test('should handle null age', () => {
            const ageInfo = monitor.getAgeInfo(null);
            
            expect(ageInfo.ageMs).toBe(null);
            expect(ageInfo.humanReadable).toBe('Never updated');
            expect(ageInfo.shortFormat).toBe('Never');
            expect(ageInfo.relativeTime).toBe('No data');
        });
    });

    describe('Status Messages', () => {
        test('should generate success message for fresh cache', () => {
            mockCacheManager.setAge(1800000); // 30 minutes
            const baseStatus = mockCacheManager.getStatus();
            const staleness = monitor.calculateStalenessLevel(baseStatus.cacheAge);
            
            const message = monitor.getStatusMessage(baseStatus, staleness);
            
            expect(message.type).toBe('success');
            expect(message.title).toBe('Rates Current');
            expect(message.message).toContain('30m ago');
            expect(message.action).toBe(null);
        });

        test('should generate warning message for stale cache', () => {
            mockCacheManager.setAge(5400000); // 1.5 hours
            const baseStatus = mockCacheManager.getStatus();
            const staleness = monitor.calculateStalenessLevel(baseStatus.cacheAge);
            
            const message = monitor.getStatusMessage(baseStatus, staleness);
            
            expect(message.type).toBe('warning');
            expect(message.title).toBe('Rates Slightly Outdated');
            expect(message.action).toBe('Refreshing in background');
        });

        test('should generate error message for very stale cache', () => {
            mockCacheManager.setAge(10800000); // 3 hours
            const baseStatus = mockCacheManager.getStatus();
            const staleness = monitor.calculateStalenessLevel(baseStatus.cacheAge);
            
            const message = monitor.getStatusMessage(baseStatus, staleness);
            
            expect(message.type).toBe('error');
            expect(message.title).toBe('Rates Outdated');
            expect(message.action).toBe('Manual refresh recommended');
        });

        test('should generate critical message for critical stale cache', () => {
            mockCacheManager.setAge(25200000); // 7 hours
            const baseStatus = mockCacheManager.getStatus();
            const staleness = monitor.calculateStalenessLevel(baseStatus.cacheAge);
            
            const message = monitor.getStatusMessage(baseStatus, staleness);
            
            expect(message.type).toBe('critical');
            expect(message.title).toBe('Rates Very Outdated');
            expect(message.action).toBe('Immediate refresh required');
        });

        test('should generate error message for cache error', () => {
            mockCacheManager.setError('API key invalid');
            const baseStatus = mockCacheManager.getStatus();
            const staleness = monitor.calculateStalenessLevel(baseStatus.cacheAge);
            
            const message = monitor.getStatusMessage(baseStatus, staleness);
            
            expect(message.type).toBe('error');
            expect(message.title).toBe('Cache Error');
            expect(message.message).toContain('API key invalid');
            expect(message.action).toBe('Check configuration and retry');
        });

        test('should generate loading message for not ready cache', () => {
            mockCacheManager.setNotReady();
            const baseStatus = mockCacheManager.getStatus();
            const staleness = monitor.calculateStalenessLevel(baseStatus.cacheAge);
            
            const message = monitor.getStatusMessage(baseStatus, staleness);
            
            expect(message.type).toBe('loading');
            expect(message.title).toBe('Loading Cache');
            expect(message.message).toBe('Loading exchange rates...');
            expect(message.action).toBe('Please wait');
        });
    });

    describe('Staleness Indicators', () => {
        test('should generate correct indicators for fresh cache', () => {
            const staleness = { level: 'fresh', isStale: false, isCritical: false };
            const indicators = monitor.getStalenessIndicators(staleness);
            
            expect(indicators.showWarning).toBe(false);
            expect(indicators.showError).toBe(false);
            expect(indicators.showCritical).toBe(false);
            expect(indicators.color).toBe('#28a745');
            expect(indicators.icon).toBe('check-circle');
            expect(indicators.badge).toBe('Current');
            expect(indicators.cssClass).toBe('cache-status-fresh');
            expect(indicators.priority).toBe(1);
        });

        test('should generate correct indicators for stale cache', () => {
            const staleness = { level: 'stale', isStale: true, isCritical: false, severity: 'warning' };
            const indicators = monitor.getStalenessIndicators(staleness);
            
            expect(indicators.showWarning).toBe(true);
            expect(indicators.showError).toBe(false);
            expect(indicators.showCritical).toBe(false);
            expect(indicators.color).toBe('#ffc107');
            expect(indicators.icon).toBe('exclamation-triangle');
            expect(indicators.badge).toBe('Stale');
            expect(indicators.cssClass).toBe('cache-status-stale');
            expect(indicators.priority).toBe(2);
        });

        test('should generate correct indicators for critical stale cache', () => {
            const staleness = { level: 'critical_stale', isStale: true, isCritical: true, severity: 'critical' };
            const indicators = monitor.getStalenessIndicators(staleness);
            
            expect(indicators.showWarning).toBe(true);
            expect(indicators.showError).toBe(false);
            expect(indicators.showCritical).toBe(true);
            expect(indicators.color).toBe('#dc3545');
            expect(indicators.icon).toBe('times-circle');
            expect(indicators.badge).toBe('Critical');
            expect(indicators.cssClass).toBe('cache-status-critical_stale');
            expect(indicators.priority).toBe(4);
        });
    });

    describe('Recommendations', () => {
        test('should provide recommendations for cache error', () => {
            mockCacheManager.setError('API authentication failed');
            const baseStatus = mockCacheManager.getStatus();
            const staleness = monitor.calculateStalenessLevel(baseStatus.cacheAge);
            
            const recommendations = monitor.getRecommendations(baseStatus, staleness);
            
            expect(recommendations).toHaveLength(2);
            expect(recommendations[0].message).toBe('Check API key configuration');
            expect(recommendations[0].action).toBe('verify_api_key');
            expect(recommendations[1].message).toBe('Verify internet connection');
            expect(recommendations[1].action).toBe('check_connection');
        });

        test('should provide recommendations for stale cache', () => {
            mockCacheManager.setAge(5400000); // 1.5 hours
            const baseStatus = mockCacheManager.getStatus();
            const staleness = monitor.calculateStalenessLevel(baseStatus.cacheAge);
            
            const recommendations = monitor.getRecommendations(baseStatus, staleness);
            
            expect(recommendations).toHaveLength(1);
            expect(recommendations[0].message).toBe('Cache will refresh automatically');
            expect(recommendations[0].action).toBe('wait_for_refresh');
        });

        test('should provide recommendations for very stale cache', () => {
            mockCacheManager.setAge(10800000); // 3 hours
            const baseStatus = mockCacheManager.getStatus();
            const staleness = monitor.calculateStalenessLevel(baseStatus.cacheAge);
            
            const recommendations = monitor.getRecommendations(baseStatus, staleness);
            
            expect(recommendations).toHaveLength(1);
            expect(recommendations[0].message).toBe('Consider manual refresh for latest rates');
            expect(recommendations[0].action).toBe('manual_refresh');
        });

        test('should provide recommendations for critical stale cache', () => {
            mockCacheManager.setAge(25200000); // 7 hours
            const baseStatus = mockCacheManager.getStatus();
            const staleness = monitor.calculateStalenessLevel(baseStatus.cacheAge);
            
            const recommendations = monitor.getRecommendations(baseStatus, staleness);
            
            expect(recommendations).toHaveLength(2);
            expect(recommendations[0].message).toBe('Immediate refresh strongly recommended');
            expect(recommendations[0].action).toBe('force_refresh');
            expect(recommendations[1].message).toBe('Check background refresh system');
            expect(recommendations[1].action).toBe('check_refresh_system');
        });
    });

    describe('Detailed Status', () => {
        test('should return comprehensive status for fresh cache', () => {
            mockCacheManager.setAge(1800000); // 30 minutes
            
            const status = monitor.getDetailedStatus();
            
            expect(status.isReady).toBe(true);
            expect(status.staleness.level).toBe('fresh');
            expect(status.ageInfo.ageMinutes).toBe(30);
            expect(status.statusMessage.type).toBe('success');
            expect(status.indicators.showWarning).toBe(false);
            expect(status.recommendations).toHaveLength(0);
            expect(status.timestamp).toBeDefined();
        });

        test('should return comprehensive status for stale cache', () => {
            mockCacheManager.setAge(5400000); // 1.5 hours
            
            const status = monitor.getDetailedStatus();
            
            expect(status.isReady).toBe(true);
            expect(status.staleness.level).toBe('stale');
            expect(status.ageInfo.ageHours).toBe(1);
            expect(status.statusMessage.type).toBe('warning');
            expect(status.indicators.showWarning).toBe(true);
            expect(status.recommendations).toHaveLength(1);
        });

        test('should cache current status', () => {
            const status = monitor.getDetailedStatus();
            
            expect(monitor.currentStatus).toEqual(status);
            expect(monitor.lastStatusUpdate).toBeDefined();
        });
    });

    describe('Event Handling', () => {
        test('should trigger staleness change event', () => {
            let changeEvent = null;
            monitor.setOnStalenessChange((event) => {
                changeEvent = event;
            });

            // Start with fresh cache
            mockCacheManager.setAge(1800000); // 30 minutes
            monitor.getDetailedStatus();

            // Change to stale
            mockCacheManager.setAge(5400000); // 1.5 hours
            monitor.getDetailedStatus();

            expect(changeEvent).not.toBe(null);
            expect(changeEvent.previousLevel).toBe('fresh');
            expect(changeEvent.currentLevel).toBe('stale');
        });

        test('should trigger critical staleness event', () => {
            let criticalEvent = null;
            monitor.setOnCriticalStaleness((event) => {
                criticalEvent = event;
            });

            // Set critical stale cache
            mockCacheManager.setAge(25200000); // 7 hours
            monitor.getDetailedStatus();

            expect(criticalEvent).not.toBe(null);
            expect(criticalEvent.level).toBe('critical_stale');
            expect(criticalEvent.staleness.isCritical).toBe(true);
        });

        test('should trigger status change event on force update', () => {
            let statusEvent = null;
            monitor.setOnStatusChange((event) => {
                statusEvent = event;
            });

            const status = monitor.forceStatusUpdate();

            expect(statusEvent).toEqual(status);
        });
    });

    describe('Status History', () => {
        test('should add status to history', () => {
            const status = monitor.getDetailedStatus();
            monitor.addToHistory(status);

            const history = monitor.getStatusHistory();
            expect(history).toHaveLength(1);
            expect(history[0].recordedAt).toBeDefined();
        });

        test('should limit history size', () => {
            const smallMonitor = new CacheStatusMonitor(mockCacheManager, { maxHistorySize: 3 });

            // Add more entries than max size
            for (let i = 0; i < 5; i++) {
                const status = smallMonitor.getDetailedStatus();
                smallMonitor.addToHistory(status);
            }

            const history = smallMonitor.getStatusHistory();
            expect(history).toHaveLength(3);
        });

        test('should calculate staleness statistics', () => {
            // Add mixed status entries
            mockCacheManager.setAge(1800000); // Fresh
            let status = monitor.getDetailedStatus();
            monitor.addToHistory(status);

            mockCacheManager.setAge(5400000); // Stale
            status = monitor.getDetailedStatus();
            monitor.addToHistory(status);

            mockCacheManager.setAge(10800000); // Very stale
            status = monitor.getDetailedStatus();
            monitor.addToHistory(status);

            const stats = monitor.getStalenessStats();
            
            expect(stats.totalEntries).toBe(3);
            expect(stats.levelCounts.fresh).toBe(1);
            expect(stats.levelCounts.stale).toBe(1);
            expect(stats.levelCounts.very_stale).toBe(1);
            expect(stats.stalenessPercentage).toBeCloseTo(66.67, 1); // 2 out of 3 are stale
        });
    });

    describe('Configuration', () => {
        test('should update configuration successfully', () => {
            const newConfig = {
                staleThresholdMs: 1800000,      // 30 minutes
                veryStaleThresholdMs: 3600000,  // 1 hour
                criticalStaleThresholdMs: 7200000, // 2 hours
                enableLogging: true
            };

            const result = monitor.updateConfig(newConfig);

            expect(result).toBe(true);
            expect(monitor.config.staleThresholdMs).toBe(1800000);
            expect(monitor.config.veryStaleThresholdMs).toBe(3600000);
            expect(monitor.config.criticalStaleThresholdMs).toBe(7200000);
            expect(monitor.config.enableLogging).toBe(true);
        });

        test('should reject invalid configuration', () => {
            const invalidConfigs = [
                null,
                undefined,
                'string',
                { staleThresholdMs: -1 },
                { enableLogging: 'true' }
            ];

            invalidConfigs.forEach(config => {
                const result = monitor.updateConfig(config);
                expect(result).toBe(false);
            });
        });
    });

    describe('Reset and Cleanup', () => {
        test('should reset monitor state', () => {
            // Set some state
            monitor.getDetailedStatus();
            monitor.addToHistory(monitor.currentStatus);

            monitor.reset();

            expect(monitor.lastStatusUpdate).toBe(null);
            expect(monitor.statusHistory).toEqual([]);
            expect(monitor.currentStatus).toBe(null);
            expect(monitor.lastStalenessLevel).toBe(null);
        });
    });

    describe('Configuration Validation', () => {
        test('should validate valid configuration', () => {
            const validConfigs = [
                { staleThresholdMs: 1000 },
                { veryStaleThresholdMs: 2000 },
                { criticalStaleThresholdMs: 3000 },
                { enableLogging: false },
                {
                    staleThresholdMs: 3600000,
                    veryStaleThresholdMs: 7200000,
                    criticalStaleThresholdMs: 21600000,
                    enableLogging: true,
                    maxHistorySize: 50
                }
            ];

            validConfigs.forEach(config => {
                expect(CacheStatusMonitor.validateConfig(config)).toBe(true);
            });
        });

        test('should reject invalid configuration', () => {
            const invalidConfigs = [
                null,
                undefined,
                'string',
                123,
                [],
                { staleThresholdMs: 0 },
                { staleThresholdMs: -1 },
                { enableLogging: 'true' },
                { maxHistorySize: -1 }
            ];

            invalidConfigs.forEach(config => {
                expect(CacheStatusMonitor.validateConfig(config)).toBe(false);
            });
        });
    });

    describe('Cached Status', () => {
        test('should return cached status without recalculating', () => {
            const status = monitor.getDetailedStatus();
            const cachedStatus = monitor.getCachedStatus();

            expect(cachedStatus).toEqual(status);
        });

        test('should return null for cached status if never calculated', () => {
            const cachedStatus = monitor.getCachedStatus();
            expect(cachedStatus).toBe(null);
        });
    });
});