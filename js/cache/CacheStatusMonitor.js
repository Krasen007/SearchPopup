/**
 * CacheStatusMonitor - Comprehensive cache staleness monitoring and status reporting
 * Provides detailed cache status information and staleness indicators for user feedback
 */
class CacheStatusMonitor {
    constructor(cacheManager, options = {}) {
        if (!cacheManager) {
            throw new Error('CacheStatusMonitor requires a RateCacheManager instance');
        }

        this.cacheManager = cacheManager;
        
        // Configuration with defaults
        this.config = {
            staleThresholdMs: options.staleThresholdMs || 3600000, // 1 hour default
            veryStaleThresholdMs: options.veryStaleThresholdMs || 7200000, // 2 hours
            criticalStaleThresholdMs: options.criticalStaleThresholdMs || 21600000, // 6 hours
            enableLogging: options.enableLogging !== false, // Default to true
            statusUpdateIntervalMs: options.statusUpdateIntervalMs || 60000 // 1 minute
        };

        // Status tracking
        this.lastStatusUpdate = null;
        this.statusHistory = [];
        this.maxHistorySize = options.maxHistorySize || 100;

        // Event callbacks
        this.onStatusChange = null;
        this.onStalenessChange = null;
        this.onCriticalStaleness = null;

        // Current status cache
        this.currentStatus = null;
        this.lastStalenessLevel = null;

        // Bind methods (none needed for this class)
    }

    /**
     * Get comprehensive cache status with staleness information
     * @returns {Object} Detailed cache status object
     */
    getDetailedStatus() {
        const baseStatus = this.cacheManager.getStatus();
        const cacheAge = this.cacheManager.getCacheAge();
        const staleness = this.calculateStalenessLevel(cacheAge);
        
        const detailedStatus = {
            ...baseStatus,
            staleness: staleness,
            ageInfo: this.getAgeInfo(cacheAge),
            statusMessage: this.getStatusMessage(baseStatus, staleness),
            indicators: this.getStalenessIndicators(staleness),
            recommendations: this.getRecommendations(baseStatus, staleness),
            timestamp: Date.now()
        };

        // Update current status cache
        this.currentStatus = detailedStatus;
        this.lastStatusUpdate = Date.now();

        // Check for staleness level changes
        this.checkStalenessLevelChange(staleness);

        return detailedStatus;
    }

    /**
     * Calculate staleness level based on cache age
     * @param {number|null} cacheAge - Cache age in milliseconds
     * @returns {Object} Staleness level information
     */
    calculateStalenessLevel(cacheAge) {
        if (cacheAge === null) {
            return {
                level: 'no_data',
                severity: 'critical',
                description: 'No cache data available',
                isStale: true,
                isCritical: true
            };
        }

        if (cacheAge <= this.config.staleThresholdMs) {
            return {
                level: 'fresh',
                severity: 'none',
                description: 'Cache data is fresh',
                isStale: false,
                isCritical: false
            };
        }

        if (cacheAge <= this.config.veryStaleThresholdMs) {
            return {
                level: 'stale',
                severity: 'warning',
                description: 'Cache data is stale but usable',
                isStale: true,
                isCritical: false
            };
        }

        if (cacheAge <= this.config.criticalStaleThresholdMs) {
            return {
                level: 'very_stale',
                severity: 'error',
                description: 'Cache data is very stale',
                isStale: true,
                isCritical: false
            };
        }

        return {
            level: 'critical_stale',
            severity: 'critical',
            description: 'Cache data is critically stale',
            isStale: true,
            isCritical: true
        };
    }

    /**
     * Get human-readable age information
     * @param {number|null} cacheAge - Cache age in milliseconds
     * @returns {Object} Age information object
     */
    getAgeInfo(cacheAge) {
        if (cacheAge === null) {
            return {
                ageMs: null,
                ageSeconds: null,
                ageMinutes: null,
                ageHours: null,
                humanReadable: 'Never updated',
                shortFormat: 'Never',
                relativeTime: 'No data'
            };
        }

        const ageSeconds = Math.floor(cacheAge / 1000);
        const ageMinutes = Math.floor(ageSeconds / 60);
        const ageHours = Math.floor(ageMinutes / 60);

        let humanReadable, shortFormat, relativeTime;

        if (ageHours > 0) {
            const remainingMinutes = ageMinutes % 60;
            humanReadable = `${ageHours} hour${ageHours > 1 ? 's' : ''}${remainingMinutes > 0 ? ` ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}` : ''} ago`;
            shortFormat = `${ageHours}h${remainingMinutes > 0 ? ` ${remainingMinutes}m` : ''}`;
            relativeTime = `${ageHours}h ago`;
        } else if (ageMinutes > 0) {
            const remainingSeconds = ageSeconds % 60;
            humanReadable = `${ageMinutes} minute${ageMinutes > 1 ? 's' : ''}${remainingSeconds > 0 ? ` ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''}` : ''} ago`;
            shortFormat = `${ageMinutes}m${remainingSeconds > 0 ? ` ${remainingSeconds}s` : ''}`;
            relativeTime = `${ageMinutes}m ago`;
        } else {
            humanReadable = `${ageSeconds} second${ageSeconds !== 1 ? 's' : ''} ago`;
            shortFormat = `${ageSeconds}s`;
            relativeTime = 'Just now';
        }

        return {
            ageMs: cacheAge,
            ageSeconds,
            ageMinutes,
            ageHours,
            humanReadable,
            shortFormat,
            relativeTime
        };
    }

    /**
     * Get status message based on cache state and staleness
     * @param {Object} baseStatus - Base cache status
     * @param {Object} staleness - Staleness information
     * @returns {Object} Status message object
     */
    getStatusMessage(baseStatus, staleness) {
        if (!baseStatus.isReady) {
            if (baseStatus.error) {
                return {
                    type: 'error',
                    title: 'Cache Error',
                    message: `Cache failed to load: ${baseStatus.error}`,
                    action: 'Check configuration and retry'
                };
            }
            return {
                type: 'loading',
                title: 'Loading Cache',
                message: 'Loading exchange rates...',
                action: 'Please wait'
            };
        }

        const ageInfo = this.getAgeInfo(baseStatus.cacheAge);

        switch (staleness.level) {
            case 'fresh':
                return {
                    type: 'success',
                    title: 'Rates Current',
                    message: `Exchange rates updated ${ageInfo.relativeTime}`,
                    action: null
                };

            case 'stale':
                return {
                    type: 'warning',
                    title: 'Rates Slightly Outdated',
                    message: `Exchange rates from ${ageInfo.relativeTime}`,
                    action: 'Refreshing in background'
                };

            case 'very_stale':
                return {
                    type: 'error',
                    title: 'Rates Outdated',
                    message: `Exchange rates from ${ageInfo.relativeTime}`,
                    action: 'Manual refresh recommended'
                };

            case 'critical_stale':
                return {
                    type: 'critical',
                    title: 'Rates Very Outdated',
                    message: `Exchange rates from ${ageInfo.relativeTime}`,
                    action: 'Immediate refresh required'
                };

            case 'no_data':
            default:
                return {
                    type: 'error',
                    title: 'No Rate Data',
                    message: 'No exchange rate data available',
                    action: 'Check connection and API key'
                };
        }
    }

    /**
     * Get staleness indicators for UI display
     * @param {Object} staleness - Staleness information
     * @returns {Object} UI indicators object
     */
    getStalenessIndicators(staleness) {
        const indicators = {
            showWarning: staleness.isStale,
            showError: staleness.severity === 'error',
            showCritical: staleness.isCritical,
            color: this.getStalenessColor(staleness.level),
            icon: this.getStalenessIcon(staleness.level),
            badge: this.getStalenessBadge(staleness.level),
            cssClass: `cache-status-${staleness.level}`,
            priority: this.getStalenessPriority(staleness.level)
        };

        return indicators;
    }

    /**
     * Get color code for staleness level
     * @param {string} level - Staleness level
     * @returns {string} Color code
     */
    getStalenessColor(level) {
        const colors = {
            fresh: '#28a745',        // Green
            stale: '#ffc107',        // Yellow
            very_stale: '#fd7e14',   // Orange
            critical_stale: '#dc3545', // Red
            no_data: '#6c757d'       // Gray
        };
        return colors[level] || colors.no_data;
    }

    /**
     * Get icon for staleness level
     * @param {string} level - Staleness level
     * @returns {string} Icon identifier
     */
    getStalenessIcon(level) {
        const icons = {
            fresh: 'check-circle',
            stale: 'exclamation-triangle',
            very_stale: 'exclamation-circle',
            critical_stale: 'times-circle',
            no_data: 'question-circle'
        };
        return icons[level] || icons.no_data;
    }

    /**
     * Get badge text for staleness level
     * @param {string} level - Staleness level
     * @returns {string} Badge text
     */
    getStalenessBadge(level) {
        const badges = {
            fresh: 'Current',
            stale: 'Stale',
            very_stale: 'Outdated',
            critical_stale: 'Critical',
            no_data: 'No Data'
        };
        return badges[level] || badges.no_data;
    }

    /**
     * Get priority level for staleness (higher number = higher priority)
     * @param {string} level - Staleness level
     * @returns {number} Priority level
     */
    getStalenessPriority(level) {
        const priorities = {
            fresh: 1,
            stale: 2,
            very_stale: 3,
            critical_stale: 4,
            no_data: 5
        };
        return priorities[level] || 0;
    }

    /**
     * Get recommendations based on cache status and staleness
     * @param {Object} baseStatus - Base cache status
     * @param {Object} staleness - Staleness information
     * @returns {Array} Array of recommendation objects
     */
    getRecommendations(baseStatus, staleness) {
        const recommendations = [];

        if (!baseStatus.isReady) {
            if (baseStatus.error) {
                recommendations.push({
                    type: 'error',
                    priority: 'high',
                    message: 'Check API key configuration',
                    action: 'verify_api_key'
                });
                recommendations.push({
                    type: 'error',
                    priority: 'medium',
                    message: 'Verify internet connection',
                    action: 'check_connection'
                });
            }
            return recommendations;
        }

        switch (staleness.level) {
            case 'stale':
                recommendations.push({
                    type: 'info',
                    priority: 'low',
                    message: 'Cache will refresh automatically',
                    action: 'wait_for_refresh'
                });
                break;

            case 'very_stale':
                recommendations.push({
                    type: 'warning',
                    priority: 'medium',
                    message: 'Consider manual refresh for latest rates',
                    action: 'manual_refresh'
                });
                break;

            case 'critical_stale':
                recommendations.push({
                    type: 'error',
                    priority: 'high',
                    message: 'Immediate refresh strongly recommended',
                    action: 'force_refresh'
                });
                recommendations.push({
                    type: 'warning',
                    priority: 'medium',
                    message: 'Check background refresh system',
                    action: 'check_refresh_system'
                });
                break;

            case 'no_data':
                recommendations.push({
                    type: 'error',
                    priority: 'critical',
                    message: 'Initialize cache system',
                    action: 'initialize_cache'
                });
                break;
        }

        return recommendations;
    }

    /**
     * Check for staleness level changes and trigger events
     * @param {Object} staleness - Current staleness information
     */
    checkStalenessLevelChange(staleness) {
        const currentLevel = staleness.level;
        
        if (this.lastStalenessLevel !== currentLevel) {
            this.log(`Staleness level changed: ${this.lastStalenessLevel} -> ${currentLevel}`);

            // Trigger staleness change event
            if (this.onStalenessChange) {
                this.onStalenessChange({
                    previousLevel: this.lastStalenessLevel,
                    currentLevel: currentLevel,
                    staleness: staleness,
                    timestamp: Date.now()
                });
            }

            // Trigger critical staleness event if needed
            if (staleness.isCritical && this.onCriticalStaleness) {
                this.onCriticalStaleness({
                    level: currentLevel,
                    staleness: staleness,
                    timestamp: Date.now()
                });
            }

            this.lastStalenessLevel = currentLevel;
        }
    }

    /**
     * Add status to history for tracking
     * @param {Object} status - Status object to add to history
     */
    addToHistory(status) {
        this.statusHistory.push({
            ...status,
            recordedAt: Date.now()
        });

        // Trim history if it exceeds max size
        if (this.statusHistory.length > this.maxHistorySize) {
            this.statusHistory = this.statusHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Get status history
     * @param {number} limit - Maximum number of entries to return
     * @returns {Array} Array of historical status entries
     */
    getStatusHistory(limit = 10) {
        return this.statusHistory.slice(-limit);
    }

    /**
     * Get staleness statistics from history
     * @returns {Object} Staleness statistics
     */
    getStalenessStats() {
        if (this.statusHistory.length === 0) {
            return {
                totalEntries: 0,
                levelCounts: {},
                averageAge: null,
                longestStaleTime: null,
                stalenessPercentage: 0
            };
        }

        const levelCounts = {};
        let totalAge = 0;
        let staleCount = 0;
        let longestStaleTime = 0;

        for (const entry of this.statusHistory) {
            const level = entry.staleness?.level || 'unknown';
            levelCounts[level] = (levelCounts[level] || 0) + 1;

            if (entry.ageInfo?.ageMs) {
                totalAge += entry.ageInfo.ageMs;
                
                if (entry.staleness?.isStale) {
                    staleCount++;
                    longestStaleTime = Math.max(longestStaleTime, entry.ageInfo.ageMs);
                }
            }
        }

        return {
            totalEntries: this.statusHistory.length,
            levelCounts,
            averageAge: totalAge / this.statusHistory.length,
            longestStaleTime,
            stalenessPercentage: (staleCount / this.statusHistory.length) * 100
        };
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration options
     * @returns {boolean} True if configuration was updated
     */
    updateConfig(newConfig) {
        if (!newConfig || typeof newConfig !== 'object') {
            return false;
        }

        let configChanged = false;

        // Update thresholds
        if (typeof newConfig.staleThresholdMs === 'number' && newConfig.staleThresholdMs > 0) {
            this.config.staleThresholdMs = newConfig.staleThresholdMs;
            configChanged = true;
        }

        if (typeof newConfig.veryStaleThresholdMs === 'number' && newConfig.veryStaleThresholdMs > 0) {
            this.config.veryStaleThresholdMs = newConfig.veryStaleThresholdMs;
            configChanged = true;
        }

        if (typeof newConfig.criticalStaleThresholdMs === 'number' && newConfig.criticalStaleThresholdMs > 0) {
            this.config.criticalStaleThresholdMs = newConfig.criticalStaleThresholdMs;
            configChanged = true;
        }

        if (typeof newConfig.enableLogging === 'boolean') {
            this.config.enableLogging = newConfig.enableLogging;
            configChanged = true;
        }

        if (configChanged) {
            this.log('Configuration updated:', this.config);
        }

        return configChanged;
    }

    /**
     * Set event callback for status changes
     * @param {Function} callback - Callback function
     */
    setOnStatusChange(callback) {
        this.onStatusChange = callback;
    }

    /**
     * Set event callback for staleness level changes
     * @param {Function} callback - Callback function
     */
    setOnStalenessChange(callback) {
        this.onStalenessChange = callback;
    }

    /**
     * Set event callback for critical staleness
     * @param {Function} callback - Callback function
     */
    setOnCriticalStaleness(callback) {
        this.onCriticalStaleness = callback;
    }

    /**
     * Reset monitor state
     */
    reset() {
        this.lastStatusUpdate = null;
        this.statusHistory = [];
        this.currentStatus = null;
        this.lastStalenessLevel = null;
    }

    /**
     * Log message if logging is enabled
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    log(message, ...args) {
        if (this.config.enableLogging) {
            console.log(`[CacheStatusMonitor] ${message}`, ...args);
        }
    }

    /**
     * Get current cached status (without recalculating)
     * @returns {Object|null} Last calculated status or null
     */
    getCachedStatus() {
        return this.currentStatus;
    }

    /**
     * Force status update and return new status
     * @returns {Object} Updated status
     */
    forceStatusUpdate() {
        const status = this.getDetailedStatus();
        this.addToHistory(status);
        
        if (this.onStatusChange) {
            this.onStatusChange(status);
        }
        
        return status;
    }

    /**
     * Validate configuration object
     * @param {Object} config - Configuration to validate
     * @returns {boolean} True if valid
     */
    static validateConfig(config) {
        if (!config || typeof config !== 'object' || Array.isArray(config)) {
            return false;
        }

        const numericFields = [
            'staleThresholdMs',
            'veryStaleThresholdMs', 
            'criticalStaleThresholdMs',
            'statusUpdateIntervalMs',
            'maxHistorySize'
        ];

        for (const field of numericFields) {
            if (config[field] !== undefined) {
                if (typeof config[field] !== 'number' || config[field] <= 0) {
                    return false;
                }
            }
        }

        if (config.enableLogging !== undefined && typeof config.enableLogging !== 'boolean') {
            return false;
        }

        return true;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CacheStatusMonitor;
}