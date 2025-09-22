/**
 * Configuration Manager for the browser extension
 * Handles API key management, refresh intervals, and supported currencies
 */
class ConfigManager {
    constructor() {
        this.config = null;
        this.isInitialized = false;
        this.validationErrors = [];
    }

    /**
     * Initialize configuration from storage and validate
     * @returns {Promise<boolean>} True if initialization successful
     */
    async initialize() {
        try {
            await this.loadConfiguration();
            this.validateConfiguration();
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('ConfigManager initialization failed:', error);
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * Load configuration from Chrome storage and merge with defaults
     * @returns {Promise<void>}
     */
    async loadConfiguration() {
        return new Promise((resolve, reject) => {
            if (typeof chrome === 'undefined' || !chrome.storage) {
                // Fallback for testing environment
                this.config = this.getDefaultConfiguration();
                resolve();
                return;
            }

            chrome.storage.sync.get([
                'coinGeckoApiKey',
                'refreshIntervalMs',
                'staleThresholdMs',
                'preferredCurrency',
                'preferredCryptoCurrency'
            ], (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(`Storage error: ${chrome.runtime.lastError.message}`));
                    return;
                }

                // Merge with defaults
                this.config = {
                    ...this.getDefaultConfiguration(),
                    ...result
                };

                resolve();
            });
        });
    }

    /**
     * Get default configuration values
     * @returns {Object} Default configuration object
     */
    getDefaultConfiguration() {
        return {
            coinGeckoApiKey: '',
            refreshIntervalMs: CACHE_CONFIG.cache.refreshIntervalMs,
            staleThresholdMs: CACHE_CONFIG.cache.staleThresholdMs,
            retryIntervalMs: CACHE_CONFIG.cache.retryIntervalMs,
            preferredCurrency: CACHE_CONFIG.defaults.preferredCurrency,
            preferredCryptoCurrency: CACHE_CONFIG.defaults.preferredCryptoCurrency,
            supportedCryptos: CACHE_CONFIG.supportedCryptos,
            supportedFiats: CACHE_CONFIG.supportedFiats,
            cryptoVsCurrencies: CACHE_CONFIG.cryptoVsCurrencies,
            api: CACHE_CONFIG.api
        };
    }

    /**
     * Validate current configuration and populate validation errors
     */
    validateConfiguration() {
        this.validationErrors = [];

        if (!this.config) {
            this.validationErrors.push('Configuration not loaded');
            return;
        }

        // Validate API key format if provided
        if (this.config.coinGeckoApiKey && !this.isValidApiKey(this.config.coinGeckoApiKey)) {
            this.validationErrors.push('Invalid CoinGecko API key format');
        }

        // Validate refresh interval
        if (!this.isValidInterval(this.config.refreshIntervalMs, 60000, 3600000)) {
            this.validationErrors.push('Refresh interval must be between 1 minute and 1 hour');
        }

        // Validate stale threshold
        if (!this.isValidInterval(this.config.staleThresholdMs, 300000, 86400000)) {
            this.validationErrors.push('Stale threshold must be between 5 minutes and 24 hours');
        }

        // Validate retry interval
        if (!this.isValidInterval(this.config.retryIntervalMs, 30000, 1800000)) {
            this.validationErrors.push('Retry interval must be between 30 seconds and 30 minutes');
        }

        // Validate preferred currencies
        if (!isSupportedFiatCurrency(this.config.preferredCurrency)) {
            this.validationErrors.push(`Unsupported preferred currency: ${this.config.preferredCurrency}`);
        }

        if (!isSupportedFiatCurrency(this.config.preferredCryptoCurrency)) {
            this.validationErrors.push(`Unsupported crypto vs currency: ${this.config.preferredCryptoCurrency}`);
        }
    }

    /**
     * Check if API key format is valid
     * @param {string} apiKey - API key to validate
     * @returns {boolean} True if valid format
     */
    isValidApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }
        // CoinGecko API keys are typically alphanumeric with underscores/hyphens
        return /^[a-zA-Z0-9_-]+$/.test(apiKey) && apiKey.length >= 10 && apiKey.length <= 100;
    }

    /**
     * Check if interval value is valid
     * @param {number} value - Interval value in milliseconds
     * @param {number} min - Minimum allowed value
     * @param {number} max - Maximum allowed value
     * @returns {boolean} True if valid
     */
    isValidInterval(value, min, max) {
        return typeof value === 'number' && value >= min && value <= max;
    }

    /**
     * Update configuration with new values
     * @param {Object} updates - Configuration updates
     * @returns {Promise<boolean>} True if update successful
     */
    async updateConfiguration(updates) {
        try {
            // Validate updates before applying
            const tempConfig = { ...this.config, ...updates };
            const originalConfig = this.config;
            
            this.config = tempConfig;
            this.validateConfiguration();

            if (this.validationErrors.length > 0) {
                // Restore original config if validation fails
                this.config = originalConfig;
                return false;
            }

            // Save to storage
            await this.saveConfiguration(updates);
            return true;
        } catch (error) {
            console.error('Configuration update failed:', error);
            return false;
        }
    }

    /**
     * Save configuration updates to Chrome storage
     * @param {Object} updates - Configuration updates to save
     * @returns {Promise<void>}
     */
    async saveConfiguration(updates) {
        return new Promise((resolve, reject) => {
            if (typeof chrome === 'undefined' || !chrome.storage) {
                // Fallback for testing environment
                resolve();
                return;
            }

            // Only save user-configurable settings
            const saveableUpdates = {};
            const saveableKeys = [
                'coinGeckoApiKey',
                'refreshIntervalMs', 
                'staleThresholdMs',
                'preferredCurrency',
                'preferredCryptoCurrency'
            ];

            for (const key of saveableKeys) {
                if (updates.hasOwnProperty(key)) {
                    saveableUpdates[key] = updates[key];
                }
            }

            chrome.storage.sync.set(saveableUpdates, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(`Storage save error: ${chrome.runtime.lastError.message}`));
                    return;
                }
                resolve();
            });
        });
    }

    /**
     * Get current configuration
     * @returns {Object|null} Current configuration or null if not initialized
     */
    getConfiguration() {
        return this.isInitialized ? { ...this.config } : null;
    }

    /**
     * Get specific configuration value
     * @param {string} key - Configuration key
     * @param {*} defaultValue - Default value if key not found
     * @returns {*} Configuration value or default
     */
    get(key, defaultValue = null) {
        if (!this.isInitialized || !this.config) {
            return defaultValue;
        }
        return this.config.hasOwnProperty(key) ? this.config[key] : defaultValue;
    }

    /**
     * Check if configuration is valid
     * @returns {boolean} True if configuration is valid
     */
    isValid() {
        return this.isInitialized && this.validationErrors.length === 0;
    }

    /**
     * Get validation errors
     * @returns {Array<string>} Array of validation error messages
     */
    getValidationErrors() {
        return [...this.validationErrors];
    }

    /**
     * Check if API key is configured
     * @returns {boolean} True if API key is set and valid
     */
    hasValidApiKey() {
        return this.isInitialized && 
               this.config.coinGeckoApiKey && 
               this.isValidApiKey(this.config.coinGeckoApiKey);
    }

    /**
     * Get API configuration for requests
     * @returns {Object} API configuration object
     */
    getApiConfig() {
        if (!this.isInitialized) {
            return null;
        }

        return {
            baseUrl: this.config.api.baseUrl,
            endpoints: this.config.api.endpoints,
            apiKey: this.config.coinGeckoApiKey,
            rateLimits: this.config.api.rateLimits,
            hasApiKey: this.hasValidApiKey()
        };
    }

    /**
     * Get cache configuration
     * @returns {Object} Cache configuration object
     */
    getCacheConfig() {
        if (!this.isInitialized) {
            return null;
        }

        return {
            refreshIntervalMs: this.config.refreshIntervalMs,
            staleThresholdMs: this.config.staleThresholdMs,
            retryIntervalMs: this.config.retryIntervalMs
        };
    }

    /**
     * Get supported currencies configuration
     * @returns {Object} Supported currencies configuration
     */
    getCurrencyConfig() {
        if (!this.isInitialized) {
            return null;
        }

        return {
            supportedCryptos: this.config.supportedCryptos,
            supportedFiats: this.config.supportedFiats,
            cryptoVsCurrencies: this.config.cryptoVsCurrencies,
            preferredCurrency: this.config.preferredCurrency,
            preferredCryptoCurrency: this.config.preferredCryptoCurrency
        };
    }

    /**
     * Reset configuration to defaults
     * @returns {Promise<boolean>} True if reset successful
     */
    async resetToDefaults() {
        try {
            const defaultConfig = this.getDefaultConfiguration();
            await this.updateConfiguration(defaultConfig);
            return true;
        } catch (error) {
            console.error('Configuration reset failed:', error);
            return false;
        }
    }

    /**
     * Export configuration for debugging
     * @returns {Object} Configuration export (without sensitive data)
     */
    exportConfiguration() {
        if (!this.isInitialized) {
            return null;
        }

        const exportConfig = { ...this.config };
        
        // Mask API key for security
        if (exportConfig.coinGeckoApiKey) {
            const key = exportConfig.coinGeckoApiKey;
            exportConfig.coinGeckoApiKey = key.substring(0, 4) + '*'.repeat(key.length - 8) + key.substring(key.length - 4);
        }

        return {
            config: exportConfig,
            isValid: this.isValid(),
            validationErrors: this.getValidationErrors(),
            hasApiKey: this.hasValidApiKey()
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigManager;
}