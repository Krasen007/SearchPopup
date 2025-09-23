/**
 * ExtensionInitializer - Manages extension startup and cache loading lifecycle
 * Integrates StartupCacheLoader with extension initialization and user feedback
 */

/**
 * ExtensionInitializer class that manages the complete extension startup process
 */
class ExtensionInitializer {
    constructor() {
        this.startupLoader = null;
        this.isInitialized = false;
        this.isInitializing = false;
        this.initializationError = null;
        this.config = null;
        this.apiKey = null;
        
        // UI elements for status display
        this.statusElements = {
            loadingIndicator: null,
            errorMessage: null,
            statusText: null
        };
        
        // Event callbacks
        this.onInitStart = null;
        this.onInitProgress = null;
        this.onInitComplete = null;
        this.onInitError = null;
        
        // Bind methods to preserve context
        this.handleLoadStart = this.handleLoadStart.bind(this);
        this.handleLoadProgress = this.handleLoadProgress.bind(this);
        this.handleLoadComplete = this.handleLoadComplete.bind(this);
        this.handleLoadError = this.handleLoadError.bind(this);
    }

    /**
     * Initialize the extension with cache loading
     * @param {Object} options - Initialization options
     * @param {string} options.apiKey - CoinGecko API key
     * @param {Object} options.config - Cache configuration
     * @param {boolean} options.showUI - Whether to show loading UI
     * @returns {Promise<Object>} Initialization result
     */
    async initialize(options = {}) {
        if (this.isInitializing) {
            throw new Error('Extension initialization already in progress');
        }

        if (this.isInitialized) {
            console.log('Extension already initialized');
            return this.getInitializationStatus();
        }

        this.isInitializing = true;
        this.initializationError = null;

        try {
            console.log('Starting extension initialization...');

            // Validate and load configuration
            await this.loadConfiguration(options);

            // Validate API key
            this.validateApiKey();

            // Create and configure startup loader
            this.createStartupLoader();

            // Show loading UI if requested (disabled by default to prevent popup)
            if (options.showUI === true) {
                this.showLoadingUI();
            }

            // Start cache loading
            const loadResult = await this.startupLoader.loadAllRates();

            // Mark as initialized
            this.isInitialized = true;
            this.isInitializing = false;

            // Hide loading UI
            this.hideLoadingUI();

            const result = {
                success: true,
                initialized: true,
                cacheLoaded: true,
                cryptoCount: loadResult.cryptoCount,
                fiatCount: loadResult.fiatCount,
                timestamp: Date.now(),
                cacheStatus: this.startupLoader.getCacheManager().getStatus()
            };

            // Notify completion
            if (this.onInitComplete) {
                this.onInitComplete(result);
            }

            console.log('Extension initialization completed successfully:', result);
            return result;

        } catch (error) {
            this.isInitializing = false;
            this.initializationError = error.message;

            // Show error UI
            this.showErrorUI(error.message);

            const errorResult = {
                success: false,
                initialized: false,
                error: error.message,
                timestamp: Date.now()
            };

            // Notify error
            if (this.onInitError) {
                this.onInitError(errorResult);
            }

            console.error('Extension initialization failed:', errorResult);
            throw error;
        }
    }

    /**
     * Load and validate configuration
     * @param {Object} options - Initialization options
     */
    async loadConfiguration(options) {
        try {
            // Load configuration from options or use default
            this.config = options.config || this.getDefaultConfig();

            // Load API key from options, storage, or prompt user
            this.apiKey = options.apiKey || await this.loadApiKey();

            // Validate configuration
            if (!this.validateConfiguration()) {
                throw new Error('Invalid extension configuration');
            }

            console.log('Configuration loaded successfully');

        } catch (error) {
            console.error('Configuration loading failed:', error);
            throw new Error(`Configuration error: ${error.message}`);
        }
    }

    /**
     * Load API key from storage (optional for free tier)
     * @returns {Promise<string|null>} API key or null for free tier
     */
    async loadApiKey() {
        try {
            // Try to load from chrome storage
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                const result = await new Promise((resolve) => {
                    chrome.storage.sync.get(['coinGeckoApiKey'], resolve);
                });

                if (result.coinGeckoApiKey) {
                    console.log('Using configured CoinGecko API key');
                    return result.coinGeckoApiKey;
                }
            }

            // Try to load from localStorage as fallback
            const storedKey = localStorage.getItem('coinGeckoApiKey');
            if (storedKey) {
                console.log('Using CoinGecko API key from localStorage');
                return storedKey;
            }

            // No API key found - use free tier
            console.log('No API key configured, using CoinGecko free tier');
            return null;

        } catch (error) {
            console.warn('API key loading failed, using free tier:', error);
            return null;
        }
    }

    /**
     * Validate API key format if provided
     */
    validateApiKey() {
        if (!this.apiKey) {
            console.log('No API key provided, using free tier');
            return;
        }

        // Use CoinGeckoAPIClient validation if available
        if (typeof CoinGeckoAPIClient !== 'undefined' && CoinGeckoAPIClient.validateApiKey) {
            if (!CoinGeckoAPIClient.validateApiKey(this.apiKey)) {
                throw new Error('Invalid API key format. Please check your CoinGecko API key in extension settings.');
            }
        }

        console.log('API key validation passed');
    }

    /**
     * Validate configuration object
     * @returns {boolean} True if configuration is valid
     */
    validateConfiguration() {
        if (!this.config || typeof this.config !== 'object') {
            return false;
        }

        // Check required configuration properties
        if (!this.config.supportedCryptos || typeof this.config.supportedCryptos !== 'object') {
            return false;
        }

        if (!this.config.supportedFiats || !Array.isArray(this.config.supportedFiats)) {
            return false;
        }

        return true;
    }

    /**
     * Create and configure the startup cache loader
     */
    createStartupLoader() {
        try {
            // Create startup loader with API key and configuration
            this.startupLoader = new StartupCacheLoader(this.apiKey, this.config);

            // Set up event callbacks
            this.startupLoader.setOnLoadStart(this.handleLoadStart);
            this.startupLoader.setOnLoadProgress(this.handleLoadProgress);
            this.startupLoader.setOnLoadComplete(this.handleLoadComplete);
            this.startupLoader.setOnLoadError(this.handleLoadError);

            console.log('Startup cache loader created successfully');

        } catch (error) {
            console.error('Failed to create startup loader:', error);
            throw new Error(`Startup loader creation failed: ${error.message}`);
        }
    }

    /**
     * Handle cache loading start event
     * @param {Object} event - Load start event data
     */
    handleLoadStart(event) {
        console.log('Cache loading started:', event);
        
        this.updateStatusText('Loading exchange rates...');
        
        if (this.onInitStart) {
            this.onInitStart(event);
        }
    }

    /**
     * Handle cache loading progress event
     * @param {Object} event - Load progress event data
     */
    handleLoadProgress(event) {
        console.log('Cache loading progress:', event);
        
        let statusText = 'Loading exchange rates...';
        
        if (event.stage === 'crypto') {
            if (event.status === 'loading') {
                statusText = 'Loading cryptocurrency rates...';
            } else if (event.status === 'complete') {
                statusText = `Loaded ${event.count} cryptocurrency rates`;
            } else if (event.status === 'error') {
                statusText = 'Cryptocurrency rates failed, continuing...';
            }
        } else if (event.stage === 'fiat') {
            if (event.status === 'loading') {
                statusText = 'Loading fiat exchange rates...';
            } else if (event.status === 'complete') {
                statusText = `Loaded ${event.count} fiat exchange rates`;
            } else if (event.status === 'error') {
                statusText = 'Fiat rates failed, continuing...';
            }
        }
        
        this.updateStatusText(statusText);
        
        if (this.onInitProgress) {
            this.onInitProgress(event);
        }
    }

    /**
     * Handle cache loading complete event
     * @param {Object} event - Load complete event data
     */
    handleLoadComplete(event) {
        console.log('Cache loading completed:', event);
        
        this.updateStatusText(`Rates loaded successfully (${event.cryptoCount} crypto, ${event.fiatCount} fiat)`);
        
        if (this.onInitComplete) {
            this.onInitComplete(event);
        }
    }

    /**
     * Handle cache loading error event
     * @param {Object} event - Load error event data
     */
    handleLoadError(event) {
        console.error('Cache loading error:', event);
        
        this.updateStatusText(`Loading failed: ${event.error}`);
        
        if (this.onInitError) {
            this.onInitError(event);
        }
    }

    /**
     * Show loading UI elements
     */
    showLoadingUI() {
        try {
            // Create or show loading indicator
            this.createLoadingIndicator();
            
            // Hide any existing error messages
            this.hideErrorUI();
            
            console.log('Loading UI displayed');
            
        } catch (error) {
            console.warn('Failed to show loading UI:', error);
        }
    }

    /**
     * Hide loading UI elements
     */
    hideLoadingUI() {
        try {
            if (this.statusElements.loadingIndicator) {
                this.statusElements.loadingIndicator.style.display = 'none';
            }
            
            console.log('Loading UI hidden');
            
        } catch (error) {
            console.warn('Failed to hide loading UI:', error);
        }
    }

    /**
     * Show error UI with message
     * @param {string} errorMessage - Error message to display
     */
    showErrorUI(errorMessage) {
        try {
            // Hide loading UI
            this.hideLoadingUI();
            
            // Create or show error message
            this.createErrorMessage(errorMessage);
            
            console.log('Error UI displayed:', errorMessage);
            
        } catch (error) {
            console.warn('Failed to show error UI:', error);
        }
    }

    /**
     * Hide error UI elements
     */
    hideErrorUI() {
        try {
            if (this.statusElements.errorMessage) {
                this.statusElements.errorMessage.style.display = 'none';
            }
            
        } catch (error) {
            console.warn('Failed to hide error UI:', error);
        }
    }

    /**
     * Create loading indicator UI element
     */
    createLoadingIndicator() {
        if (!this.statusElements.loadingIndicator) {
            const indicator = document.createElement('div');
            indicator.id = 'cache-loading-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: #007cba;
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-family: Arial, sans-serif;
                z-index: 10000;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            `;
            
            indicator.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 12px; height: 12px; border: 2px solid #ffffff40; border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <span id="cache-status-text">Initializing...</span>
                </div>
            `;
            
            // Add CSS animation
            if (!document.getElementById('cache-loading-styles')) {
                const style = document.createElement('style');
                style.id = 'cache-loading-styles';
                style.textContent = `
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            document.body.appendChild(indicator);
            this.statusElements.loadingIndicator = indicator;
            this.statusElements.statusText = indicator.querySelector('#cache-status-text');
        }
        
        this.statusElements.loadingIndicator.style.display = 'block';
    }

    /**
     * Create error message UI element
     * @param {string} errorMessage - Error message to display
     */
    createErrorMessage(errorMessage) {
        if (!this.statusElements.errorMessage) {
            const errorDiv = document.createElement('div');
            errorDiv.id = 'cache-error-message';
            errorDiv.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: #d32f2f;
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-family: Arial, sans-serif;
                z-index: 10000;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                max-width: 300px;
            `;
            
            document.body.appendChild(errorDiv);
            this.statusElements.errorMessage = errorDiv;
        }
        
        this.statusElements.errorMessage.textContent = errorMessage;
        this.statusElements.errorMessage.style.display = 'block';
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            this.hideErrorUI();
        }, 10000);
    }

    /**
     * Update status text in loading indicator
     * @param {string} text - Status text to display
     */
    updateStatusText(text) {
        if (this.statusElements.statusText) {
            this.statusElements.statusText.textContent = text;
        }
    }

    /**
     * Retry initialization after failure
     * @param {Object} options - Retry options
     * @returns {Promise<Object>} Retry result
     */
    async retryInitialization(options = {}) {
        console.log('Retrying extension initialization...');
        
        // Reset state
        this.isInitialized = false;
        this.isInitializing = false;
        this.initializationError = null;
        
        // Reset startup loader if it exists
        if (this.startupLoader) {
            this.startupLoader.reset();
        }
        
        // Retry initialization
        return await this.initialize(options);
    }

    /**
     * Get current initialization status
     * @returns {Object} Status object
     */
    getInitializationStatus() {
        const status = {
            isInitialized: this.isInitialized,
            isInitializing: this.isInitializing,
            error: this.initializationError,
            hasApiKey: !!this.apiKey,
            hasConfig: !!this.config
        };
        
        if (this.startupLoader) {
            status.cacheStatus = this.startupLoader.getCacheManager().getStatus();
            status.loadingStatus = this.startupLoader.getLoadingStatus();
        }
        
        return status;
    }

    /**
     * Get the cache manager instance
     * @returns {RateCacheManager|null} Cache manager or null if not initialized
     */
    getCacheManager() {
        return this.startupLoader ? this.startupLoader.getCacheManager() : null;
    }

    /**
     * Get the status monitor instance
     * @returns {CacheStatusMonitor|null} Status monitor or null if not initialized
     */
    getStatusMonitor() {
        return this.startupLoader ? this.startupLoader.getStatusMonitor() : null;
    }

    /**
     * Save API key to storage
     * @param {string} apiKey - API key to save
     * @returns {Promise<void>}
     */
    async saveApiKey(apiKey) {
        try {
            // Validate API key format
            if (typeof CoinGeckoAPIClient !== 'undefined' && CoinGeckoAPIClient.validateApiKey) {
                if (!CoinGeckoAPIClient.validateApiKey(apiKey)) {
                    throw new Error('Invalid API key format');
                }
            }
            
            // Save to chrome storage if available
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                await new Promise((resolve, reject) => {
                    chrome.storage.sync.set({ coinGeckoApiKey: apiKey }, () => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve();
                        }
                    });
                });
            }
            
            // Also save to localStorage as fallback
            localStorage.setItem('coinGeckoApiKey', apiKey);
            
            this.apiKey = apiKey;
            console.log('API key saved successfully');
            
        } catch (error) {
            console.error('Failed to save API key:', error);
            throw error;
        }
    }

    /**
     * Get default configuration
     * @returns {Object} Default configuration object
     */
    getDefaultConfig() {
        // Use global CACHE_CONFIG if available, otherwise use fallback
        if (typeof CACHE_CONFIG !== 'undefined') {
            return CACHE_CONFIG;
        }
        
        return {
            supportedCryptos: {
                'BTC': 'bitcoin',
                'ETH': 'ethereum',
                'XRP': 'ripple',
                'LTC': 'litecoin',
                'BCH': 'bitcoin-cash',
                'ADA': 'cardano',
                'DOT': 'polkadot',
                'LINK': 'chainlink',
                'XLM': 'stellar',
                'DOGE': 'dogecoin'
            },
            supportedFiats: ['USD', 'EUR', 'GBP', 'BGN', 'JPY', 'AUD', 'CAD', 'CHF'],
            api: {
                rateLimits: {
                    maxRetries: 3,
                    retryDelay: 5000
                }
            },
            cache: {
                refreshIntervalMs: 900000, // 15 minutes
                staleThresholdMs: 3600000, // 1 hour
                retryIntervalMs: 300000 // 5 minutes
            }
        };
    }

    /**
     * Set event callback for initialization start
     * @param {Function} callback - Callback function
     */
    setOnInitStart(callback) {
        this.onInitStart = callback;
    }

    /**
     * Set event callback for initialization progress
     * @param {Function} callback - Callback function
     */
    setOnInitProgress(callback) {
        this.onInitProgress = callback;
    }

    /**
     * Set event callback for initialization complete
     * @param {Function} callback - Callback function
     */
    setOnInitComplete(callback) {
        this.onInitComplete = callback;
    }

    /**
     * Set event callback for initialization error
     * @param {Function} callback - Callback function
     */
    setOnInitError(callback) {
        this.onInitError = callback;
    }

    /**
     * Clean up resources and UI elements
     */
    cleanup() {
        // Remove UI elements
        if (this.statusElements.loadingIndicator) {
            this.statusElements.loadingIndicator.remove();
            this.statusElements.loadingIndicator = null;
        }
        
        if (this.statusElements.errorMessage) {
            this.statusElements.errorMessage.remove();
            this.statusElements.errorMessage = null;
        }
        
        // Remove styles
        const styles = document.getElementById('cache-loading-styles');
        if (styles) {
            styles.remove();
        }
        
        // Reset startup loader
        if (this.startupLoader) {
            this.startupLoader.reset();
            this.startupLoader = null;
        }
        
        // Reset state
        this.isInitialized = false;
        this.isInitializing = false;
        this.initializationError = null;
        
        console.log('Extension initializer cleaned up');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExtensionInitializer;
}