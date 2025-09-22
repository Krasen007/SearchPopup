/**
 * Comprehensive error handling system for the cache system
 * Provides user-friendly error messages, recovery suggestions, and logging
 */
class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogEntries = 100;
        this.isOfflineMode = false;
        this.lastNetworkCheck = null;
        this.networkCheckInterval = 30000; // 30 seconds
    }

    /**
     * Handle API authentication errors
     * @param {Error} error - The authentication error
     * @param {string} apiKey - The API key that failed (masked for logging)
     * @returns {Object} Error response with user message and recovery suggestions
     */
    handleAuthenticationError(error, apiKey = '') {
        const maskedKey = this.maskApiKey(apiKey);
        
        this.logError('AUTHENTICATION_ERROR', {
            message: error.message,
            apiKey: maskedKey,
            timestamp: Date.now()
        });

        return {
            type: 'AUTHENTICATION_ERROR',
            userMessage: 'API authentication failed. Please check your CoinGecko API key.',
            technicalMessage: error.message,
            recoverySuggestions: [
                'Verify your CoinGecko API key is correct',
                'Check if your API key has expired',
                'Ensure you have sufficient API quota remaining',
                'Visit CoinGecko to generate a new API key if needed'
            ],
            actionRequired: 'UPDATE_API_KEY',
            severity: 'HIGH',
            canRetry: false
        };
    }

    /**
     * Handle network connectivity errors
     * @param {Error} error - The network error
     * @param {boolean} hasCache - Whether cached data is available
     * @returns {Object} Error response with offline mode handling
     */
    handleNetworkError(error, hasCache = false) {
        this.isOfflineMode = true;
        this.lastNetworkCheck = Date.now();

        this.logError('NETWORK_ERROR', {
            message: error.message,
            hasCache: hasCache,
            timestamp: Date.now()
        });

        const baseMessage = hasCache 
            ? 'Network connection lost. Using cached exchange rates.'
            : 'Network connection lost. Unable to fetch current exchange rates.';

        return {
            type: 'NETWORK_ERROR',
            userMessage: baseMessage,
            technicalMessage: error.message,
            recoverySuggestions: hasCache ? [
                'Check your internet connection',
                'Cached rates will be used until connection is restored',
                'Rate information may become outdated over time'
            ] : [
                'Check your internet connection',
                'Try refreshing the page once connected',
                'Ensure no firewall is blocking the extension'
            ],
            actionRequired: hasCache ? 'MONITOR_CONNECTION' : 'RESTORE_CONNECTION',
            severity: hasCache ? 'MEDIUM' : 'HIGH',
            canRetry: true,
            retryDelay: 30000 // 30 seconds
        };
    }

    /**
     * Handle API rate limiting errors
     * @param {Error} error - The rate limit error
     * @param {number} retryAfter - Seconds to wait before retry
     * @returns {Object} Error response with retry timing
     */
    handleRateLimitError(error, retryAfter = 60) {
        this.logError('RATE_LIMIT_ERROR', {
            message: error.message,
            retryAfter: retryAfter,
            timestamp: Date.now()
        });

        return {
            type: 'RATE_LIMIT_ERROR',
            userMessage: `API rate limit exceeded. Retrying in ${retryAfter} seconds.`,
            technicalMessage: error.message,
            recoverySuggestions: [
                'Wait for the rate limit to reset',
                'Consider upgrading to a paid CoinGecko API plan for higher limits',
                'Reduce the frequency of cache refreshes if possible'
            ],
            actionRequired: 'WAIT_AND_RETRY',
            severity: 'MEDIUM',
            canRetry: true,
            retryDelay: retryAfter * 1000
        };
    }

    /**
     * Handle cache loading errors
     * @param {Error} error - The cache loading error
     * @param {string} phase - Which phase failed (startup, refresh, etc.)
     * @returns {Object} Error response with phase-specific handling
     */
    handleCacheLoadError(error, phase = 'unknown') {
        this.logError('CACHE_LOAD_ERROR', {
            message: error.message,
            phase: phase,
            timestamp: Date.now()
        });

        const phaseMessages = {
            startup: 'Failed to load exchange rates at startup.',
            refresh: 'Failed to refresh exchange rates in background.',
            manual: 'Manual cache refresh failed.',
            unknown: 'Cache operation failed.'
        };

        const phaseSuggestions = {
            startup: [
                'Check your internet connection',
                'Verify your API key configuration',
                'Try reloading the page',
                'Check browser console for detailed errors'
            ],
            refresh: [
                'Background refresh will retry automatically',
                'Current cached rates will continue to be used',
                'Check your internet connection if issues persist'
            ],
            manual: [
                'Try again in a few moments',
                'Check your internet connection',
                'Verify your API key is still valid'
            ],
            unknown: [
                'Try reloading the page',
                'Check your internet connection',
                'Verify extension configuration'
            ]
        };

        return {
            type: 'CACHE_LOAD_ERROR',
            userMessage: phaseMessages[phase] || phaseMessages.unknown,
            technicalMessage: error.message,
            recoverySuggestions: phaseSuggestions[phase] || phaseSuggestions.unknown,
            actionRequired: phase === 'startup' ? 'RELOAD_REQUIRED' : 'AUTO_RETRY',
            severity: phase === 'startup' ? 'HIGH' : 'MEDIUM',
            canRetry: true,
            retryDelay: phase === 'startup' ? 5000 : 300000 // 5s for startup, 5min for others
        };
    }

    /**
     * Handle configuration validation errors
     * @param {Array<string>} validationErrors - Array of validation error messages
     * @returns {Object} Error response with configuration guidance
     */
    handleConfigurationError(validationErrors) {
        this.logError('CONFIGURATION_ERROR', {
            validationErrors: validationErrors,
            timestamp: Date.now()
        });

        return {
            type: 'CONFIGURATION_ERROR',
            userMessage: 'Extension configuration has errors that need to be fixed.',
            technicalMessage: validationErrors.join('; '),
            recoverySuggestions: [
                'Open extension settings to review configuration',
                'Check API key format and validity',
                'Verify all settings are within acceptable ranges',
                'Reset to default settings if needed'
            ],
            actionRequired: 'FIX_CONFIGURATION',
            severity: 'HIGH',
            canRetry: false,
            validationErrors: validationErrors
        };
    }

    /**
     * Handle generic API errors
     * @param {Error} error - The API error
     * @param {number} statusCode - HTTP status code if available
     * @returns {Object} Error response with generic handling
     */
    handleApiError(error, statusCode = null) {
        this.logError('API_ERROR', {
            message: error.message,
            statusCode: statusCode,
            timestamp: Date.now()
        });

        let userMessage = 'API request failed.';
        let severity = 'MEDIUM';
        let suggestions = [
            'Try again in a few moments',
            'Check your internet connection'
        ];

        if (statusCode) {
            switch (statusCode) {
                case 400:
                    userMessage = 'Invalid API request format.';
                    severity = 'HIGH';
                    suggestions = [
                        'This appears to be a configuration issue',
                        'Please report this error if it persists'
                    ];
                    break;
                case 401:
                    return this.handleAuthenticationError(error);
                case 403:
                    userMessage = 'API access forbidden. Check your API key permissions.';
                    severity = 'HIGH';
                    break;
                case 429:
                    return this.handleRateLimitError(error);
                case 500:
                case 502:
                case 503:
                    userMessage = 'CoinGecko API is temporarily unavailable.';
                    suggestions = [
                        'The issue is on CoinGecko\'s side',
                        'Try again in a few minutes',
                        'Cached rates will be used if available'
                    ];
                    break;
            }
        }

        return {
            type: 'API_ERROR',
            userMessage: userMessage,
            technicalMessage: error.message,
            recoverySuggestions: suggestions,
            actionRequired: 'RETRY_LATER',
            severity: severity,
            canRetry: true,
            retryDelay: 60000, // 1 minute
            statusCode: statusCode
        };
    }

    /**
     * Check network connectivity
     * @returns {Promise<boolean>} True if online
     */
    async checkNetworkConnectivity() {
        // Don't check too frequently
        if (this.lastNetworkCheck && Date.now() - this.lastNetworkCheck < this.networkCheckInterval) {
            return !this.isOfflineMode;
        }

        try {
            // Simple connectivity check
            const response = await fetch('https://api.coingecko.com/api/v3/ping', {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-cache'
            });
            
            this.isOfflineMode = false;
            this.lastNetworkCheck = Date.now();
            return true;
        } catch (error) {
            this.isOfflineMode = true;
            this.lastNetworkCheck = Date.now();
            return false;
        }
    }

    /**
     * Get user-friendly error message for display
     * @param {Object} errorResponse - Error response from handler methods
     * @param {boolean} includeRecovery - Whether to include recovery suggestions
     * @returns {string} Formatted error message
     */
    formatUserMessage(errorResponse, includeRecovery = true) {
        let message = errorResponse.userMessage;

        if (includeRecovery && errorResponse.recoverySuggestions.length > 0) {
            message += '\n\nSuggestions:\n';
            message += errorResponse.recoverySuggestions
                .map(suggestion => `• ${suggestion}`)
                .join('\n');
        }

        return message;
    }

    /**
     * Log error for debugging purposes
     * @param {string} type - Error type
     * @param {Object} details - Error details
     */
    logError(type, details) {
        const logEntry = {
            type: type,
            details: details,
            timestamp: Date.now(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
        };

        this.errorLog.push(logEntry);

        // Keep log size manageable
        if (this.errorLog.length > this.maxLogEntries) {
            this.errorLog = this.errorLog.slice(-this.maxLogEntries);
        }

        // Console logging for development
        console.error(`[CacheSystem] ${type}:`, details);
    }

    /**
     * Get error log for debugging
     * @param {number} limit - Maximum number of entries to return
     * @returns {Array} Recent error log entries
     */
    getErrorLog(limit = 20) {
        return this.errorLog.slice(-limit);
    }

    /**
     * Clear error log
     */
    clearErrorLog() {
        this.errorLog = [];
    }

    /**
     * Mask API key for logging (show first 4 and last 4 characters)
     * @param {string} apiKey - API key to mask
     * @returns {string} Masked API key
     */
    maskApiKey(apiKey) {
        if (!apiKey || apiKey.length < 8) {
            return '***';
        }
        return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
    }

    /**
     * Get current offline status
     * @returns {boolean} True if in offline mode
     */
    isOffline() {
        return this.isOfflineMode;
    }

    /**
     * Set offline mode manually (for testing)
     * @param {boolean} offline - Offline status
     */
    setOfflineMode(offline) {
        this.isOfflineMode = offline;
        this.lastNetworkCheck = Date.now();
    }

    /**
     * Get error statistics for monitoring
     * @returns {Object} Error statistics
     */
    getErrorStatistics() {
        const stats = {
            totalErrors: this.errorLog.length,
            errorsByType: {},
            recentErrors: 0,
            isOffline: this.isOfflineMode
        };

        const oneHourAgo = Date.now() - 3600000;

        this.errorLog.forEach(entry => {
            // Count by type
            stats.errorsByType[entry.type] = (stats.errorsByType[entry.type] || 0) + 1;
            
            // Count recent errors
            if (entry.timestamp > oneHourAgo) {
                stats.recentErrors++;
            }
        });

        return stats;
    }

    /**
     * Export error log for support/debugging
     * @returns {Object} Exportable error information
     */
    exportErrorLog() {
        return {
            errorLog: this.errorLog,
            statistics: this.getErrorStatistics(),
            systemInfo: {
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
                timestamp: Date.now(),
                isOffline: this.isOfflineMode
            }
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
}