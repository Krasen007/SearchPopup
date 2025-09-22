/**
 * StartupCacheLoader - Coordinates initial cache population at browser startup
 * Handles loading all cryptocurrency and fiat currency rates using CoinGecko API
 */

// Import dependencies (assuming they're available in the extension context)
// In a browser extension, these would be loaded via script tags or modules

/**
 * StartupCacheLoader class that manages the initial loading of all rates
 */
class StartupCacheLoader {
    constructor(apiKey = null, config = null) {
        // Initialize dependencies - API key is optional for free tier
        this.apiClient = new CoinGeckoAPIClient(apiKey);
        this.cacheManager = new RateCacheManager();
        
        // Load configuration
        this.config = config || (typeof CACHE_CONFIG !== 'undefined' ? CACHE_CONFIG : this.getDefaultConfig());
        
        // State tracking
        this.isLoading = false;
        this.loadAttempts = 0;
        this.maxRetries = this.config.api?.rateLimits?.maxRetries || 3;
        this.retryDelay = this.config.api?.rateLimits?.retryDelay || 5000;
        
        // Event callbacks
        this.onLoadStart = null;
        this.onLoadProgress = null;
        this.onLoadComplete = null;
        this.onLoadError = null;
    }

    /**
     * Load all cryptocurrency and fiat currency rates
     * @returns {Promise<Object>} Load result with status and data
     */
    async loadAllRates() {
        if (this.isLoading) {
            throw new Error('Cache loading is already in progress');
        }

        this.isLoading = true;
        this.loadAttempts++;

        try {
            // Notify loading start
            if (this.onLoadStart) {
                this.onLoadStart({ attempt: this.loadAttempts });
            }

            console.log(`Starting cache load (attempt ${this.loadAttempts}/${this.maxRetries})`);

            // Load crypto and fiat rates concurrently
            const loadResult = await this.loadRatesWithRetry();

            // Populate cache with loaded data
            await this.populateCache(loadResult.cryptoData, loadResult.fiatData);

            // Reset attempt counter on success
            this.loadAttempts = 0;
            this.isLoading = false;

            const result = {
                success: true,
                cryptoCount: Object.keys(loadResult.cryptoData || {}).length,
                fiatCount: Object.keys(loadResult.fiatData || {}).length,
                timestamp: Date.now(),
                cacheStatus: this.cacheManager.getStatus()
            };

            // Notify completion
            if (this.onLoadComplete) {
                this.onLoadComplete(result);
            }

            console.log('Cache loading completed successfully:', result);
            return result;

        } catch (error) {
            this.isLoading = false;
            
            const errorResult = {
                success: false,
                error: error.message,
                attempt: this.loadAttempts,
                maxRetries: this.maxRetries,
                timestamp: Date.now()
            };

            // Notify error
            if (this.onLoadError) {
                this.onLoadError(errorResult);
            }

            console.error('Cache loading failed:', errorResult);

            // Attempt retry if within limits
            if (this.loadAttempts < this.maxRetries) {
                console.log(`Scheduling retry in ${this.retryDelay}ms`);
                setTimeout(() => {
                    this.loadAllRates().catch(retryError => {
                        console.error('Retry failed:', retryError);
                    });
                }, this.retryDelay);
            }

            throw error;
        }
    }

    /**
     * Load rates with built-in retry logic for individual API calls
     * @returns {Promise<Object>} Object containing crypto and fiat data
     */
    async loadRatesWithRetry() {
        const results = {
            cryptoData: null,
            fiatData: null,
            errors: []
        };

        // Load cryptocurrency rates
        try {
            if (this.onLoadProgress) {
                this.onLoadProgress({ stage: 'crypto', status: 'loading' });
            }

            results.cryptoData = await this.loadCryptoRates();
            
            if (this.onLoadProgress) {
                this.onLoadProgress({ 
                    stage: 'crypto', 
                    status: 'complete',
                    count: Object.keys(results.cryptoData || {}).length
                });
            }

        } catch (error) {
            const cryptoError = `Failed to load crypto rates: ${error.message}`;
            results.errors.push(cryptoError);
            console.error(cryptoError);

            if (this.onLoadProgress) {
                this.onLoadProgress({ stage: 'crypto', status: 'error', error: cryptoError });
            }
        }

        // Load fiat exchange rates
        try {
            if (this.onLoadProgress) {
                this.onLoadProgress({ stage: 'fiat', status: 'loading' });
            }

            results.fiatData = await this.loadFiatRates();
            
            if (this.onLoadProgress) {
                this.onLoadProgress({ 
                    stage: 'fiat', 
                    status: 'complete',
                    count: Object.keys(results.fiatData || {}).length
                });
            }

        } catch (error) {
            const fiatError = `Failed to load fiat rates: ${error.message}`;
            results.errors.push(fiatError);
            console.error(fiatError);

            if (this.onLoadProgress) {
                this.onLoadProgress({ stage: 'fiat', status: 'error', error: fiatError });
            }
        }

        // Check if we have any data
        if (!results.cryptoData && !results.fiatData) {
            throw new Error(`All rate loading failed: ${results.errors.join('; ')}`);
        }

        // Log warnings for partial failures
        if (results.errors.length > 0) {
            console.warn('Partial loading success with errors:', results.errors);
        }

        return results;
    }

    /**
     * Load cryptocurrency rates for all supported coins
     * @returns {Promise<Object>} Crypto rates data
     */
    async loadCryptoRates() {
        try {
            // Get supported coin IDs and currencies from config
            const coinIds = this.getSupportedCoinIds();
            const vsCurrencies = this.getSupportedCryptoVsCurrencies();

            if (coinIds.length === 0) {
                throw new Error('No supported cryptocurrencies configured');
            }
            if (vsCurrencies.length === 0) {
                throw new Error('No supported fiat currencies configured');
            }

            console.log(`Loading crypto rates for ${coinIds.length} coins in ${vsCurrencies.length} currencies`);

            // Use bulk API call for efficiency
            const response = await this.apiClient.fetchAllCryptoPricesBulk(coinIds, vsCurrencies);

            if (!response || !response.data) {
                throw new Error('Invalid crypto rates response from API');
            }

            // Validate response data
            const cryptoCount = Object.keys(response.data).length;
            if (cryptoCount === 0) {
                throw new Error('No crypto rates received from API');
            }

            console.log(`Successfully loaded ${cryptoCount} crypto rates`);
            return response.data;

        } catch (error) {
            console.error('Error loading crypto rates:', error);
            throw new Error(`Crypto rates loading failed: ${error.message}`);
        }
    }

    /**
     * Load fiat exchange rates from CoinGecko
     * @returns {Promise<Object>} Fiat rates data
     */
    async loadFiatRates() {
        try {
            console.log('Loading fiat exchange rates');

            const response = await this.apiClient.fetchExchangeRates();

            if (!response || !response.rates) {
                throw new Error('Invalid fiat rates response from API');
            }

            // Parse the exchange rates response
            const parsedResponse = this.apiClient.parseExchangeRatesResponse(response);

            if (!parsedResponse || !parsedResponse.rates) {
                throw new Error('Failed to parse fiat rates response');
            }

            // Filter to only supported currencies
            const supportedFiats = this.config.supportedFiats || [];
            const filteredRates = {};

            for (const currency of supportedFiats) {
                const upperCurrency = currency.toUpperCase();
                if (parsedResponse.rates[upperCurrency]) {
                    filteredRates[upperCurrency] = parsedResponse.rates[upperCurrency].value;
                }
            }

            const fiatCount = Object.keys(filteredRates).length;
            if (fiatCount === 0) {
                throw new Error('No supported fiat rates found in API response');
            }

            console.log(`Successfully loaded ${fiatCount} fiat exchange rates`);
            return filteredRates;

        } catch (error) {
            console.error('Error loading fiat rates:', error);
            throw new Error(`Fiat rates loading failed: ${error.message}`);
        }
    }

    /**
     * Populate the cache manager with loaded rate data
     * @param {Object} cryptoData - Cryptocurrency rates
     * @param {Object} fiatData - Fiat exchange rates
     */
    async populateCache(cryptoData, fiatData) {
        try {
            if (!cryptoData && !fiatData) {
                throw new Error('No data available to populate cache');
            }

            // Populate cache using the cache manager
            this.cacheManager.populateCache(cryptoData || {}, fiatData || {});

            // Verify cache was populated successfully
            const status = this.cacheManager.getStatus();
            if (!status.isReady) {
                throw new Error(`Cache population failed: ${status.error || 'Unknown error'}`);
            }

            console.log(`Cache populated successfully: ${status.cryptoCount} crypto rates, ${status.fiatCount} fiat rates`);

        } catch (error) {
            console.error('Error populating cache:', error);
            throw new Error(`Cache population failed: ${error.message}`);
        }
    }

    /**
     * Get supported cryptocurrency coin IDs from configuration
     * @returns {Array<string>} Array of CoinGecko coin IDs
     */
    getSupportedCoinIds() {
        if (this.config.supportedCryptos) {
            return Object.values(this.config.supportedCryptos);
        }
        
        // Fallback to helper function if available
        if (typeof getSupportedCoinIds === 'function') {
            return getSupportedCoinIds().split(',');
        }
        
        // Default minimal set
        return ['bitcoin', 'ethereum', 'ripple', 'litecoin'];
    }

    /**
     * Get supported fiat currencies from configuration
     * @returns {Array<string>} Array of currency codes
     */
    getSupportedFiatCurrencies() {
        if (this.config.supportedFiats) {
            return this.config.supportedFiats.map(c => c.toLowerCase());
        }
        
        // Fallback to helper function if available
        if (typeof getSupportedFiatCurrencies === 'function') {
            return getSupportedFiatCurrencies().split(',');
        }
        
        // Default minimal set
        return ['usd', 'eur', 'gbp', 'bgn'];
    }

    /**
     * Get supported currencies for crypto price fetching (excludes BGN which isn't supported)
     * @returns {Array<string>} Array of currency codes
     */
    getSupportedCryptoVsCurrencies() {
        if (this.config.cryptoVsCurrencies) {
            return this.config.cryptoVsCurrencies.map(c => c.toLowerCase());
        }
        
        // Default set without BGN
        return ['usd', 'eur', 'gbp', 'jpy', 'aud', 'cad', 'chf'];
    }

    /**
     * Get default configuration if none provided
     * @returns {Object} Default configuration object
     */
    getDefaultConfig() {
        return {
            supportedCryptos: {
                'BTC': 'bitcoin',
                'ETH': 'ethereum',
                'XRP': 'ripple',
                'LTC': 'litecoin'
            },
            supportedFiats: ['USD', 'EUR', 'GBP', 'BGN'],
            api: {
                rateLimits: {
                    maxRetries: 3,
                    retryDelay: 5000
                }
            }
        };
    }

    /**
     * Get the cache manager instance
     * @returns {RateCacheManager} Cache manager instance
     */
    getCacheManager() {
        return this.cacheManager;
    }

    /**
     * Get loading status
     * @returns {Object} Current loading status
     */
    getLoadingStatus() {
        return {
            isLoading: this.isLoading,
            loadAttempts: this.loadAttempts,
            maxRetries: this.maxRetries,
            cacheStatus: this.cacheManager.getStatus()
        };
    }

    /**
     * Set event callback for load start
     * @param {Function} callback - Callback function
     */
    setOnLoadStart(callback) {
        this.onLoadStart = callback;
    }

    /**
     * Set event callback for load progress
     * @param {Function} callback - Callback function
     */
    setOnLoadProgress(callback) {
        this.onLoadProgress = callback;
    }

    /**
     * Set event callback for load complete
     * @param {Function} callback - Callback function
     */
    setOnLoadComplete(callback) {
        this.onLoadComplete = callback;
    }

    /**
     * Set event callback for load error
     * @param {Function} callback - Callback function
     */
    setOnLoadError(callback) {
        this.onLoadError = callback;
    }

    /**
     * Reset the loader state (useful for testing)
     */
    reset() {
        this.isLoading = false;
        this.loadAttempts = 0;
        this.cacheManager.clear();
    }

    /**
     * Validate configuration object
     * @param {Object} config - Configuration to validate
     * @returns {boolean} True if configuration is valid
     */
    static validateConfig(config) {
        if (!config || typeof config !== 'object') {
            return false;
        }

        // Check required properties
        if (!config.supportedCryptos || typeof config.supportedCryptos !== 'object') {
            return false;
        }

        if (!config.supportedFiats || !Array.isArray(config.supportedFiats)) {
            return false;
        }

        return true;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StartupCacheLoader;
}