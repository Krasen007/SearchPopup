/**
 * Tests for CacheStatusDisplay - User interface components for cache status indicators
 */

// Set up TextEncoder/TextDecoder before importing JSDOM
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock DOM environment for testing
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;

// Mock chrome API
global.chrome = {
    storage: {
        sync: {
            get: jest.fn(),
            set: jest.fn()
        }
    }
};

// Import the classes we need to test
const RateCacheManager = require('../js/cache/RateCacheManager');
const CacheStatusMonitor = require('../js/cache/CacheStatusMonitor');
const CacheStatusDisplay = require('../js/cache/CacheStatusDisplay');

describe('CacheStatusDisplay', () => {
    let cacheManager;
    let statusMonitor;
    let statusDisplay;

    beforeEach(() => {
        // Clear DOM
        document.body.innerHTML = '';
        
        // Create fresh instances
        cacheManager = new RateCacheManager();
        statusMonitor = new CacheStatusMonitor(cacheManager);
        statusDisplay = new CacheStatusDisplay(cacheManager, statusMonitor, {
            enableLogging: false // Disable logging for tests
        });
    });

    afterEach(() => {
        if (statusDisplay) {
            statusDisplay.destroy();
        }
    });

    describe('Constructor', () => {
        test('should create instance with required dependencies', () => {
            expect(statusDisplay).toBeInstanceOf(CacheStatusDisplay);
            expect(statusDisplay.cacheManager).toBe(cacheManager);
            expect(statusDisplay.statusMonitor).toBe(statusMonitor);
        });

        test('should throw error without cache manager', () => {
            expect(() => {
                new CacheStatusDisplay(null, statusMonitor);
            }).toThrow('CacheStatusDisplay requires a RateCacheManager instance');
        });

        test('should throw error without status monitor', () => {
            expect(() => {
                new CacheStatusDisplay(cacheManager, null);
            }).toThrow('CacheStatusDisplay requires a CacheStatusMonitor instance');
        });

        test('should use default configuration', () => {
            expect(statusDisplay.config.showLoadingIndicator).toBe(true);
            expect(statusDisplay.config.showTimestamps).toBe(true);
            expect(statusDisplay.config.showStalenessWarnings).toBe(true);
            expect(statusDisplay.config.showErrorMessages).toBe(true);
            expect(statusDisplay.config.position).toBe('top-right');
        });

        test('should accept custom configuration', () => {
            const customDisplay = new CacheStatusDisplay(cacheManager, statusMonitor, {
                position: 'bottom-left',
                autoHideDelay: 10000,
                compactMode: true,
                theme: 'dark'
            });

            expect(customDisplay.config.position).toBe('bottom-left');
            expect(customDisplay.config.autoHideDelay).toBe(10000);
            expect(customDisplay.config.compactMode).toBe(true);
            expect(customDisplay.config.theme).toBe('dark');

            customDisplay.destroy();
        });
    });

    describe('Loading Indicator', () => {
        test('should show loading indicator when cache is not ready', () => {
            // Cache is not ready by default
            statusDisplay.showLoadingIndicator();

            const indicator = document.querySelector('.cache-loading-indicator');
            expect(indicator).toBeTruthy();
            expect(indicator.textContent).toContain('Loading exchange rates');
        });

        test('should hide loading indicator', () => {
            statusDisplay.showLoadingIndicator();
            expect(document.querySelector('.cache-loading-indicator')).toBeTruthy();

            statusDisplay.hideLoadingIndicator();
            expect(document.querySelector('.cache-loading-indicator')).toBeFalsy();
        });

        test('should not show multiple loading indicators', () => {
            statusDisplay.showLoadingIndicator();
            statusDisplay.showLoadingIndicator();

            const indicators = document.querySelectorAll('.cache-loading-indicator');
            expect(indicators.length).toBe(1);
        });

        test('should update loading indicator based on cache status', () => {
            const mockStatus = {
                isReady: false,
                error: null,
                staleness: { level: 'no_data', isStale: false },
                ageInfo: null,
                indicators: {}
            };

            statusDisplay.updateLoadingIndicator(mockStatus);
            expect(document.querySelector('.cache-loading-indicator')).toBeTruthy();

            mockStatus.isReady = true;
            statusDisplay.updateLoadingIndicator(mockStatus);
            expect(document.querySelector('.cache-loading-indicator')).toBeFalsy();
        });
    });

    describe('Status Badge', () => {
        test('should create status badge for error state', () => {
            const mockStatus = {
                isReady: false,
                error: 'API key invalid',
                staleness: { level: 'no_data', isStale: true },
                ageInfo: null,
                indicators: { color: '#dc3545' }
            };

            statusDisplay.updateStatusBadge(mockStatus);

            const badge = document.querySelector('.cache-status-badge');
            expect(badge).toBeTruthy();
            expect(badge.textContent).toContain('Error');
        });

        test('should create status badge for stale cache', () => {
            const mockStatus = {
                isReady: true,
                error: null,
                staleness: { level: 'stale', isStale: true },
                ageInfo: { relativeTime: '2h ago' },
                indicators: { badge: 'Stale', color: '#ffc107' }
            };

            statusDisplay.updateStatusBadge(mockStatus);

            const badge = document.querySelector('.cache-status-badge');
            expect(badge).toBeTruthy();
            expect(badge.textContent).toContain('Stale');
        });

        test('should not show badge for normal operation', () => {
            const mockStatus = {
                isReady: true,
                error: null,
                staleness: { level: 'fresh', isStale: false },
                ageInfo: { relativeTime: '5m ago' },
                indicators: {}
            };

            statusDisplay.updateStatusBadge(mockStatus);

            const badge = document.querySelector('.cache-status-badge');
            expect(badge).toBeFalsy();
        });

        test('should handle badge click to show detailed status', () => {
            const mockStatus = {
                isReady: false,
                error: 'Test error',
                staleness: { level: 'no_data', isStale: true },
                ageInfo: null,
                indicators: { color: '#dc3545' }
            };

            statusDisplay.updateStatusBadge(mockStatus);

            const badge = document.querySelector('.cache-status-badge');
            expect(badge).toBeTruthy();

            // Mock the showDetailedStatus method
            statusDisplay.showDetailedStatus = jest.fn();

            badge.click();
            expect(statusDisplay.showDetailedStatus).toHaveBeenCalledWith(mockStatus);
        });
    });

    describe('Conversion Timestamps', () => {
        test('should add timestamps to conversion elements', () => {
            // Create mock conversion elements
            const conversionElement = document.createElement('div');
            conversionElement.className = 'conversion-result';
            conversionElement.textContent = '100 USD = 180 BGN';
            document.body.appendChild(conversionElement);

            const mockStatus = {
                isReady: true,
                error: null,
                staleness: { level: 'fresh', isStale: false },
                ageInfo: { relativeTime: '5m ago' }
            };

            statusDisplay.updateConversionTimestamps(mockStatus);

            const timestamp = conversionElement.querySelector('.conversion-timestamp');
            expect(timestamp).toBeTruthy();
            expect(timestamp.textContent).toContain('Updated 5m ago');
        });

        test('should show stale indicator in timestamps', () => {
            const conversionElement = document.createElement('div');
            conversionElement.className = 'crypto-conversion';
            document.body.appendChild(conversionElement);

            const mockStatus = {
                isReady: true,
                error: null,
                staleness: { level: 'stale', isStale: true },
                ageInfo: { relativeTime: '2h ago' }
            };

            statusDisplay.updateConversionTimestamps(mockStatus);

            const timestamp = conversionElement.querySelector('.conversion-timestamp');
            expect(timestamp).toBeTruthy();
            expect(timestamp.textContent).toContain('Updated 2h ago (stale)');
        });

        test('should replace existing timestamps', () => {
            const conversionElement = document.createElement('div');
            conversionElement.className = 'fiat-conversion';
            document.body.appendChild(conversionElement);

            // Add initial timestamp
            const initialTimestamp = document.createElement('span');
            initialTimestamp.className = 'conversion-timestamp';
            initialTimestamp.textContent = 'Old timestamp';
            conversionElement.appendChild(initialTimestamp);

            const mockStatus = {
                isReady: true,
                error: null,
                staleness: { level: 'fresh', isStale: false },
                ageInfo: { relativeTime: '1m ago' }
            };

            statusDisplay.updateConversionTimestamps(mockStatus);

            const timestamps = conversionElement.querySelectorAll('.conversion-timestamp');
            expect(timestamps.length).toBe(1);
            expect(timestamps[0].textContent).toContain('Updated 1m ago');
            expect(timestamps[0].textContent).not.toContain('Old timestamp');
        });
    });

    describe('Error Messages', () => {
        test('should show error message', () => {
            statusDisplay.showErrorMessage('Test error message', {
                title: 'Test Error',
                autoHide: false
            });

            const notification = document.querySelector('.cache-notification-error');
            expect(notification).toBeTruthy();
            expect(notification.textContent).toContain('Test Error');
            expect(notification.textContent).toContain('Test error message');
        });

        test('should not show error message when disabled', () => {
            // Clear any existing notifications
            document.body.innerHTML = '';
            
            const customDisplay = new CacheStatusDisplay(cacheManager, statusMonitor, {
                showErrorMessages: false,
                enableLogging: false
            });

            customDisplay.showErrorMessage('Test error');

            const notification = document.querySelector('.cache-notification-error');
            expect(notification).toBeFalsy();

            customDisplay.destroy();
        });

        test('should show critical staleness alert', () => {
            const mockEvent = {
                staleness: {
                    level: 'critical_stale',
                    description: 'Cache data is critically stale'
                }
            };

            statusDisplay.handleCriticalStaleness(mockEvent);

            const notification = document.querySelector('.cache-notification-error');
            expect(notification).toBeTruthy();
            expect(notification.textContent).toContain('Exchange Rates Critically Outdated');
        });
    });

    describe('Notifications', () => {
        test('should show staleness notification', () => {
            const mockEvent = {
                staleness: {
                    level: 'stale',
                    description: 'Cache data is stale but usable'
                }
            };

            statusDisplay.handleStalenessChange(mockEvent);

            const notification = document.querySelector('.cache-notification-warning');
            expect(notification).toBeTruthy();
            expect(notification.textContent).toContain('Exchange Rates Outdated');
        });

        test('should hide current notification when showing new one', () => {
            statusDisplay.showErrorMessage('First error');
            expect(document.querySelector('.cache-notification-error')).toBeTruthy();

            statusDisplay.showErrorMessage('Second error');
            const notifications = document.querySelectorAll('.cache-notification-error');
            expect(notifications.length).toBe(1);
            expect(notifications[0].textContent).toContain('Second error');
        });

        test('should create notification with actions', () => {
            const mockAction = jest.fn();
            const notification = statusDisplay.createNotification({
                type: 'error',
                title: 'Test Error',
                message: 'Test message',
                actions: [
                    { text: 'Test Action', action: mockAction }
                ]
            });

            document.body.appendChild(notification);

            const actionButton = notification.querySelector('button');
            expect(actionButton).toBeTruthy();
            expect(actionButton.textContent).toBe('Test Action');

            actionButton.click();
            expect(mockAction).toHaveBeenCalled();
        });
    });

    describe('Detailed Status Modal', () => {
        test('should create detailed status modal', () => {
            const mockStatus = {
                isReady: true,
                error: null,
                staleness: { level: 'fresh', description: 'Cache data is fresh', isStale: false },
                ageInfo: { humanReadable: '5 minutes ago' },
                cryptoCount: 10,
                fiatCount: 5,
                recommendations: [
                    { message: 'Cache is working properly' }
                ]
            };

            statusDisplay.showDetailedStatus(mockStatus);

            const modal = document.querySelector('.cache-status-modal');
            expect(modal).toBeTruthy();
            expect(modal.textContent).toContain('Cache Status');
            expect(modal.textContent).toContain('✅ Ready');
            expect(modal.textContent).toContain('5 minutes ago');
            expect(modal.textContent).toContain('10 currencies');
            expect(modal.textContent).toContain('5 currencies');
        });

        test('should close modal when clicking outside', () => {
            const mockStatus = {
                isReady: true,
                staleness: { description: 'Fresh' },
                ageInfo: { humanReadable: '1 minute ago' },
                cryptoCount: 5,
                fiatCount: 3
            };

            statusDisplay.showDetailedStatus(mockStatus);

            const modal = document.querySelector('.cache-status-modal');
            expect(modal).toBeTruthy();

            // Simulate click on modal background
            modal.click();

            // Modal should be removed
            expect(document.querySelector('.cache-status-modal')).toBeFalsy();
        });
    });

    describe('Configuration and Themes', () => {
        test('should get correct position styles', () => {
            const positions = [
                { config: 'top-right', expected: 'top: 16px; right: 16px;' },
                { config: 'top-left', expected: 'top: 16px; left: 16px;' },
                { config: 'bottom-right', expected: 'bottom: 16px; right: 16px;' },
                { config: 'bottom-left', expected: 'bottom: 16px; left: 16px;' }
            ];

            positions.forEach(({ config, expected }) => {
                const display = new CacheStatusDisplay(cacheManager, statusMonitor, {
                    position: config
                });
                expect(display.getPositionStyles()).toBe(expected);
                display.destroy();
            });
        });

        test('should get correct theme styles', () => {
            const lightDisplay = new CacheStatusDisplay(cacheManager, statusMonitor, {
                theme: 'light'
            });
            const lightTheme = lightDisplay.getThemeStyles();
            expect(lightTheme.background).toBe('#ffffff');
            expect(lightTheme.text).toBe('#333333');
            lightDisplay.destroy();

            const darkDisplay = new CacheStatusDisplay(cacheManager, statusMonitor, {
                theme: 'dark'
            });
            const darkTheme = darkDisplay.getThemeStyles();
            expect(darkTheme.background).toBe('#2d2d2d');
            expect(darkTheme.text).toBe('#ffffff');
            darkDisplay.destroy();
        });

        test('should update configuration', () => {
            statusDisplay.updateConfig({
                position: 'bottom-left',
                autoHideDelay: 8000
            });

            expect(statusDisplay.config.position).toBe('bottom-left');
            expect(statusDisplay.config.autoHideDelay).toBe(8000);
            expect(statusDisplay.config.showTimestamps).toBe(true); // Should preserve existing config
        });
    });

    describe('Manual Refresh', () => {
        test('should trigger manual refresh', async () => {
            // Mock window.extensionInitializer
            const mockInitializer = {
                retryInitialization: jest.fn().mockResolvedValue()
            };
            global.window.extensionInitializer = mockInitializer;

            await statusDisplay.triggerManualRefresh();

            expect(mockInitializer.retryInitialization).toHaveBeenCalled();

            // Should show success notification
            const notification = document.querySelector('.cache-notification-success');
            expect(notification).toBeTruthy();
            expect(notification.textContent).toContain('Cache Refreshed');
        });

        test('should handle refresh failure', async () => {
            const mockInitializer = {
                retryInitialization: jest.fn().mockRejectedValue(new Error('Refresh failed'))
            };
            global.window.extensionInitializer = mockInitializer;

            await statusDisplay.triggerManualRefresh();

            // Should show error notification
            const notification = document.querySelector('.cache-notification-error');
            expect(notification).toBeTruthy();
            expect(notification.textContent).toContain('Failed to refresh cache');
        });
    });

    describe('Event Handling', () => {
        test('should handle status change events', () => {
            const mockStatus = {
                isReady: true,
                staleness: { level: 'fresh', isStale: false },
                ageInfo: { relativeTime: '1m ago' }
            };

            // Mock updateStatusDisplay method
            statusDisplay.updateStatusDisplay = jest.fn();

            statusDisplay.handleStatusChange(mockStatus);

            expect(statusDisplay.updateStatusDisplay).toHaveBeenCalledWith(mockStatus);
        });

        test('should handle staleness change events', () => {
            const mockEvent = {
                staleness: {
                    level: 'stale',
                    description: 'cache data is stale but usable'
                }
            };

            // Mock showStalenessNotification method
            statusDisplay.showStalenessNotification = jest.fn();

            statusDisplay.handleStalenessChange(mockEvent);

            expect(statusDisplay.showStalenessNotification).toHaveBeenCalledWith(mockEvent);
        });
    });

    describe('Cleanup', () => {
        test('should destroy and clean up properly', () => {
            statusDisplay.showLoadingIndicator();
            statusDisplay.showErrorMessage('Test error');

            expect(document.querySelector('.cache-loading-indicator')).toBeTruthy();
            expect(document.querySelector('.cache-notification-error')).toBeTruthy();

            statusDisplay.destroy();

            expect(document.querySelector('.cache-loading-indicator')).toBeFalsy();
            expect(document.querySelector('.cache-notification-error')).toBeFalsy();
        });
    });

    describe('Utility Methods', () => {
        test('should get correct staleness icons', () => {
            expect(statusDisplay.getStalenessIcon('fresh')).toBe('✓');
            expect(statusDisplay.getStalenessIcon('stale')).toBe('⚠️');
            expect(statusDisplay.getStalenessIcon('very_stale')).toBe('🔶');
            expect(statusDisplay.getStalenessIcon('critical_stale')).toBe('🔴');
            expect(statusDisplay.getStalenessIcon('no_data')).toBe('❌');
            expect(statusDisplay.getStalenessIcon('unknown')).toBe('❓');
        });

        test('should get correct timestamp text', () => {
            const freshStatus = {
                isReady: true,
                error: null,
                staleness: { isStale: false },
                ageInfo: { relativeTime: '5m ago' }
            };
            expect(statusDisplay.getTimestampText(freshStatus)).toBe('Updated 5m ago');

            const staleStatus = {
                isReady: true,
                error: null,
                staleness: { isStale: true },
                ageInfo: { relativeTime: '2h ago' }
            };
            expect(statusDisplay.getTimestampText(staleStatus)).toBe('Updated 2h ago (stale)');

            const loadingStatus = {
                isReady: false,
                error: null
            };
            expect(statusDisplay.getTimestampText(loadingStatus)).toBe('Loading rates...');

            const errorStatus = {
                isReady: true,
                error: 'API error'
            };
            expect(statusDisplay.getTimestampText(errorStatus)).toBe('Rate error');
        });
    });
});