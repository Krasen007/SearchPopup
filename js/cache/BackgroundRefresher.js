/**
 * BackgroundRefresher - Manages periodic cache refresh without blocking user interactions
 * Handles automatic cache updates with configurable intervals and retry logic
 */
class BackgroundRefresher {
    constructor(cacheLoader, options = {}) {
        if (!cacheLoader) {
            throw new Error('BackgroundRefresher requires a StartupCacheLoader instance');
        }

        this.cacheLoader = cacheLoader;
        
        // Configuration with defaults
        this.config = {
            refreshIntervalMs: options.refreshIntervalMs || 900000, // 15 minutes default
            retryDelayMs: options.retryDelayMs || 300000, // 5 minutes retry delay
            maxRetries: options.maxRetries || 3,
            enableLogging: options.enableLogging !== false // Default to true
        };

        // State tracking
        this.isRunning = false;
        this.refreshTimer = null;
        this.retryTimer = null;
        this.refreshCount = 0;
        this.lastRefreshTime = null;
        this.lastRefreshSuccess = null;
        this.consecutiveFailures = 0;

        // Event callbacks
        this.onRefreshStart = null;
        this.onRefreshSuccess = null;
        this.onRefreshError = null;
        this.onRetryScheduled = null;

        // Bind methods to preserve context
        this.refreshCache = this.refreshCache.bind(this);
        this.scheduleRetry = this.scheduleRetry.bind(this);
    }

    /**
     * Start the background refresh system
     * @returns {boolean} True if started successfully
     */
    start() {
        if (this.isRunning) {
            this.log('Background refresher is already running');
            return false;
        }

        this.isRunning = true;
        this.consecutiveFailures = 0;
        
        // Schedule the first refresh
        this.scheduleNextRefresh();
        
        this.log(`Background refresher started with ${this.config.refreshIntervalMs}ms interval`);
        return true;
    }

    /**
     * Stop the background refresh system
     * @returns {boolean} True if stopped successfully
     */
    stop() {
        if (!this.isRunning) {
            this.log('Background refresher is not running');
            return false;
        }

        this.isRunning = false;

        // Clear any active timers
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }

        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }

        this.log('Background refresher stopped');
        return true;
    }

    /**
     * Schedule the next refresh cycle
     */
    scheduleNextRefresh() {
        if (!this.isRunning) {
            return;
        }

        // Clear any existing timer
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        // Schedule next refresh
        this.refreshTimer = setTimeout(() => {
            this.refreshCache();
        }, this.config.refreshIntervalMs);

        this.log(`Next refresh scheduled in ${this.config.refreshIntervalMs}ms`);
    }

    /**
     * Perform cache refresh without blocking user interactions
     */
    async refreshCache() {
        // Allow refresh even when not running for manual/forced refreshes
        // Only skip if explicitly stopped during a running refresh cycle

        const refreshStartTime = Date.now();
        this.refreshCount++;

        try {
            this.log(`Starting background cache refresh (attempt ${this.refreshCount})`);

            // Notify refresh start
            if (this.onRefreshStart) {
                this.onRefreshStart({
                    refreshCount: this.refreshCount,
                    timestamp: refreshStartTime,
                    consecutiveFailures: this.consecutiveFailures
                });
            }

            // Perform the cache refresh using the existing loader
            const result = await this.cacheLoader.loadAllRates();

            // Update success tracking
            this.lastRefreshTime = Date.now();
            this.lastRefreshSuccess = true;
            this.consecutiveFailures = 0;

            const refreshDuration = this.lastRefreshTime - refreshStartTime;

            this.log(`Background cache refresh completed successfully in ${refreshDuration}ms`);

            // Notify refresh success
            if (this.onRefreshSuccess) {
                this.onRefreshSuccess({
                    refreshCount: this.refreshCount,
                    duration: refreshDuration,
                    result: result,
                    timestamp: this.lastRefreshTime
                });
            }

            // Schedule next regular refresh
            this.scheduleNextRefresh();

        } catch (error) {
            // Update failure tracking
            this.lastRefreshTime = Date.now();
            this.lastRefreshSuccess = false;
            this.consecutiveFailures++;

            const refreshDuration = this.lastRefreshTime - refreshStartTime;

            this.log(`Background cache refresh failed after ${refreshDuration}ms: ${error.message}`);

            // Notify refresh error
            if (this.onRefreshError) {
                this.onRefreshError({
                    refreshCount: this.refreshCount,
                    error: error.message,
                    duration: refreshDuration,
                    consecutiveFailures: this.consecutiveFailures,
                    timestamp: this.lastRefreshTime
                });
            }

            // Handle retry logic
            this.handleRefreshFailure(error);
        }
    }

    /**
     * Handle refresh failure with retry logic
     * @param {Error} error - The error that caused the failure
     */
    handleRefreshFailure(error) {
        if (!this.isRunning) {
            return;
        }

        // Check if we should retry or wait for next regular cycle
        if (this.consecutiveFailures < this.config.maxRetries) {
            // Schedule retry with shorter delay
            this.scheduleRetry();
        } else {
            // Too many consecutive failures, wait for next regular cycle
            this.log(`Maximum retries (${this.config.maxRetries}) reached, waiting for next regular refresh`);
            this.scheduleNextRefresh();
        }
    }

    /**
     * Schedule a retry attempt after a failure
     */
    scheduleRetry() {
        if (!this.isRunning) {
            return;
        }

        // Clear any existing retry timer
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
        }

        this.log(`Scheduling retry in ${this.config.retryDelayMs}ms (failure ${this.consecutiveFailures}/${this.config.maxRetries})`);

        // Notify retry scheduled
        if (this.onRetryScheduled) {
            this.onRetryScheduled({
                retryDelayMs: this.config.retryDelayMs,
                consecutiveFailures: this.consecutiveFailures,
                maxRetries: this.config.maxRetries,
                timestamp: Date.now()
            });
        }

        // Schedule retry
        this.retryTimer = setTimeout(() => {
            this.refreshCache();
        }, this.config.retryDelayMs);
    }

    /**
     * Force an immediate refresh (useful for manual refresh requests)
     * @returns {Promise<Object>} Refresh result
     */
    async forceRefresh() {
        if (!this.isRunning) {
            throw new Error('Background refresher is not running');
        }

        this.log('Forcing immediate cache refresh');

        // Cancel any scheduled refresh to avoid conflicts
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }

        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }

        // Perform immediate refresh
        await this.refreshCache();

        return this.getStatus();
    }

    /**
     * Get current background refresher status
     * @returns {Object} Status information
     */
    getStatus() {
        const cacheStatus = this.cacheLoader.getCacheManager().getStatus();

        return {
            isRunning: this.isRunning,
            refreshCount: this.refreshCount,
            lastRefreshTime: this.lastRefreshTime,
            lastRefreshSuccess: this.lastRefreshSuccess,
            consecutiveFailures: this.consecutiveFailures,
            nextRefreshIn: this.getTimeUntilNextRefresh(),
            config: { ...this.config },
            cacheStatus: cacheStatus
        };
    }

    /**
     * Get time until next scheduled refresh in milliseconds
     * @returns {number|null} Milliseconds until next refresh, or null if not scheduled
     */
    getTimeUntilNextRefresh() {
        if (!this.isRunning || !this.refreshTimer) {
            return null;
        }

        // Calculate remaining time based on when the timer was set
        const now = Date.now();
        const lastScheduleTime = this.lastRefreshTime || now;
        const nextRefreshTime = lastScheduleTime + this.config.refreshIntervalMs;
        
        return Math.max(0, nextRefreshTime - now);
    }

    /**
     * Update configuration settings
     * @param {Object} newConfig - New configuration options
     * @returns {boolean} True if configuration was updated successfully
     */
    updateConfig(newConfig) {
        if (!newConfig || typeof newConfig !== 'object') {
            return false;
        }

        let configChanged = false;

        // Update refresh interval
        if (typeof newConfig.refreshIntervalMs === 'number' && newConfig.refreshIntervalMs > 0) {
            if (newConfig.refreshIntervalMs !== this.config.refreshIntervalMs) {
                this.config.refreshIntervalMs = newConfig.refreshIntervalMs;
                configChanged = true;
            }
        }

        // Update retry delay
        if (typeof newConfig.retryDelayMs === 'number' && newConfig.retryDelayMs > 0) {
            this.config.retryDelayMs = newConfig.retryDelayMs;
            configChanged = true;
        }

        // Update max retries
        if (typeof newConfig.maxRetries === 'number' && newConfig.maxRetries >= 0) {
            this.config.maxRetries = newConfig.maxRetries;
            configChanged = true;
        }

        // Update logging setting
        if (typeof newConfig.enableLogging === 'boolean') {
            this.config.enableLogging = newConfig.enableLogging;
            configChanged = true;
        }

        if (configChanged) {
            this.log('Configuration updated:', this.config);

            // Reschedule next refresh if running and interval changed
            if (this.isRunning && newConfig.refreshIntervalMs) {
                this.scheduleNextRefresh();
            }
        }

        return configChanged;
    }

    /**
     * Set event callback for refresh start
     * @param {Function} callback - Callback function
     */
    setOnRefreshStart(callback) {
        this.onRefreshStart = callback;
    }

    /**
     * Set event callback for refresh success
     * @param {Function} callback - Callback function
     */
    setOnRefreshSuccess(callback) {
        this.onRefreshSuccess = callback;
    }

    /**
     * Set event callback for refresh error
     * @param {Function} callback - Callback function
     */
    setOnRefreshError(callback) {
        this.onRefreshError = callback;
    }

    /**
     * Set event callback for retry scheduled
     * @param {Function} callback - Callback function
     */
    setOnRetryScheduled(callback) {
        this.onRetryScheduled = callback;
    }

    /**
     * Reset refresher state (useful for testing)
     */
    reset() {
        this.stop();
        this.refreshCount = 0;
        this.lastRefreshTime = null;
        this.lastRefreshSuccess = null;
        this.consecutiveFailures = 0;
    }

    /**
     * Log message if logging is enabled
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments to log
     */
    log(message, ...args) {
        if (this.config.enableLogging) {
            console.log(`[BackgroundRefresher] ${message}`, ...args);
        }
    }

    /**
     * Get refresh statistics
     * @returns {Object} Statistics about refresh operations
     */
    getStats() {
        const uptime = this.lastRefreshTime ? Date.now() - this.lastRefreshTime : 0;
        
        return {
            refreshCount: this.refreshCount,
            consecutiveFailures: this.consecutiveFailures,
            lastRefreshTime: this.lastRefreshTime,
            lastRefreshSuccess: this.lastRefreshSuccess,
            uptime: uptime,
            isRunning: this.isRunning,
            config: { ...this.config }
        };
    }

    /**
     * Validate configuration object
     * @param {Object} config - Configuration to validate
     * @returns {boolean} True if configuration is valid
     */
    static validateConfig(config) {
        if (!config || typeof config !== 'object' || Array.isArray(config)) {
            return false;
        }

        // Validate refresh interval
        if (config.refreshIntervalMs !== undefined) {
            if (typeof config.refreshIntervalMs !== 'number' || config.refreshIntervalMs <= 0) {
                return false;
            }
        }

        // Validate retry delay
        if (config.retryDelayMs !== undefined) {
            if (typeof config.retryDelayMs !== 'number' || config.retryDelayMs <= 0) {
                return false;
            }
        }

        // Validate max retries
        if (config.maxRetries !== undefined) {
            if (typeof config.maxRetries !== 'number' || config.maxRetries < 0) {
                return false;
            }
        }

        // Validate logging setting
        if (config.enableLogging !== undefined) {
            if (typeof config.enableLogging !== 'boolean') {
                return false;
            }
        }

        return true;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BackgroundRefresher;
}