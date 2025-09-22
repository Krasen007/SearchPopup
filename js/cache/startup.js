/**
 * Extension startup script - Integrates cache loading with extension lifecycle
 * This script initializes the cache system when the extension loads
 */

// Global extension initializer instance
let extensionInitializer = null;

/**
 * Initialize the extension with cache loading
 * This function should be called when the extension starts up
 */
async function initializeExtension() {
    try {
        console.log('Starting extension initialization...');

        // Create extension initializer if not already created
        if (!extensionInitializer) {
            extensionInitializer = new ExtensionInitializer();
            
            // Set up event callbacks for logging and debugging
            extensionInitializer.setOnInitStart((event) => {
                console.log('Extension initialization started:', event);
            });
            
            extensionInitializer.setOnInitProgress((event) => {
                console.log('Extension initialization progress:', event);
            });
            
            extensionInitializer.setOnInitComplete((event) => {
                console.log('Extension initialization completed:', event);
                
                // Update global variables for backward compatibility
                updateLegacyGlobals(event);
                
                // Show API key status briefly
                showApiKeyStatus();
            });
            
            extensionInitializer.setOnInitError((event) => {
                console.error('Extension initialization failed:', event);
                
                // Show user-friendly error message
                showInitializationError(event.error);
            });
        }

        // Check if already initialized
        const status = extensionInitializer.getInitializationStatus();
        if (status.isInitialized) {
            console.log('Extension already initialized');
            return status;
        }

        // Initialize with configuration
        const result = await extensionInitializer.initialize({
            showUI: true // Show loading UI by default
        });

        console.log('Extension initialization successful:', result);
        return result;

    } catch (error) {
        console.error('Extension initialization failed:', error);
        
        // Handle specific error cases
        if (error.message.includes('Invalid API key format')) {
            showApiKeyConfigurationHelp();
        } else {
            showGenericError(error.message);
        }
        
        throw error;
    }
}

/**
 * Update legacy global variables for backward compatibility
 * This ensures existing code continues to work while using the new cache system
 */
function updateLegacyGlobals(initResult) {
    try {
        const cacheManager = extensionInitializer.getCacheManager();
        if (!cacheManager) {
            console.warn('Cache manager not available for legacy update');
            return;
        }

        const cacheStatus = cacheManager.getStatus();
        
        // Update exchange rates global variable
        if (typeof exchangeRates !== 'undefined') {
            exchangeRates.lastUpdated = cacheStatus.lastUpdated || Date.now();
            
            // Populate rates from cache for supported fiat currencies
            const supportedFiats = ['EUR', 'USD', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'];
            exchangeRates.rates = {};
            
            for (const currency of supportedFiats) {
                const rate = cacheManager.getFiatRate(currency);
                if (rate !== null) {
                    exchangeRates.rates[currency] = rate;
                }
            }
            
            console.log('Updated legacy exchangeRates:', exchangeRates);
        }

        // Update crypto rates global variable
        if (typeof cryptoRates !== 'undefined') {
            cryptoRates.lastUpdated = cacheStatus.lastUpdated || Date.now();
            cryptoRates.prices = {};
            
            // Populate crypto prices from cache
            const supportedCryptos = ['bitcoin', 'ethereum', 'ripple', 'litecoin'];
            const vsCurrencies = ['usd', 'eur', 'bgn'];
            
            for (const coinId of supportedCryptos) {
                cryptoRates.prices[coinId] = {};
                for (const currency of vsCurrencies) {
                    const rate = cacheManager.getCryptoRate(coinId, currency);
                    if (rate !== null) {
                        cryptoRates.prices[coinId][currency] = rate;
                    }
                }
            }
            
            console.log('Updated legacy cryptoRates:', cryptoRates);
        }

        // Update unit conversions for currency
        if (typeof unitConversions !== 'undefined') {
            updateCurrencyConversions(cacheManager);
        }

        console.log('Legacy globals updated successfully');

    } catch (error) {
        console.error('Failed to update legacy globals:', error);
    }
}

/**
 * Update currency conversions in the unitConversions global
 */
function updateCurrencyConversions(cacheManager) {
    try {
        const preferredCurrency = (typeof preferredCurrency !== 'undefined') ? preferredCurrency : 'BGN';
        
        // Update fiat currency conversions
        const fiatCurrencies = ['EUR', 'USD', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'];
        for (const currency of fiatCurrencies) {
            const rate = cacheManager.getFiatRate(currency);
            if (rate !== null && currency !== preferredCurrency) {
                unitConversions[currency] = {
                    to: preferredCurrency,
                    convert: (val) => val * rate
                };
                
                // Add currency symbol conversion if available
                if (typeof currencySymbols !== 'undefined' && currencySymbols[currency]) {
                    unitConversions[currencySymbols[currency]] = {
                        to: preferredCurrency,
                        convert: (val) => val * rate
                    };
                }
            }
        }

        // Update crypto currency conversions
        if (typeof cryptoCurrencies !== 'undefined') {
            const preferredCryptoCurrency = (typeof preferredCryptoCurrency !== 'undefined') ? preferredCryptoCurrency : 'USD';
            
            for (const [symbol, coinId] of Object.entries(cryptoCurrencies)) {
                const rate = cacheManager.getCryptoRate(coinId, preferredCryptoCurrency.toLowerCase());
                if (rate !== null) {
                    unitConversions[symbol] = {
                        to: preferredCryptoCurrency,
                        convert: (val) => val * rate
                    };
                }
            }
        }

        console.log('Currency conversions updated');

    } catch (error) {
        console.error('Failed to update currency conversions:', error);
    }
}

/**
 * Show API key configuration help to the user
 */
function showApiKeyConfigurationHelp() {
    const helpMessage = `
        <div style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 2px solid #007cba;
            border-radius: 8px;
            padding: 20px;
            max-width: 450px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10001;
            font-family: Arial, sans-serif;
            font-size: 14px;
            line-height: 1.4;
        ">
            <h3 style="margin: 0 0 15px 0; color: #007cba;">Invalid API Key</h3>
            <p style="margin: 0 0 15px 0;">
                The CoinGecko API key you configured appears to be invalid. The extension is currently using the free tier with limited reliability.
            </p>
            <p style="margin: 0 0 15px 0;">
                <strong>To fix this:</strong><br>
                1. Visit <a href="https://www.coingecko.com/en/api" target="_blank" style="color: #007cba;">coingecko.com/en/api</a><br>
                2. Sign up for a free account<br>
                3. Copy your API key<br>
                4. Open extension settings and update your API key
            </p>
            <div style="text-align: right;">
                <button onclick="chrome.runtime.openOptionsPage(); this.parentElement.parentElement.remove();" style="
                    background: #2f855a;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-right: 8px;
                ">Open Settings</button>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: #007cba;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">OK</button>
            </div>
        </div>
    `;
    
    const helpDiv = document.createElement('div');
    helpDiv.innerHTML = helpMessage;
    document.body.appendChild(helpDiv);
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
        if (helpDiv.parentElement) {
            helpDiv.remove();
        }
    }, 30000);
}

/**
 * Show generic initialization error
 */
function showGenericError(errorMessage) {
    console.error('Extension initialization error:', errorMessage);
    
    // Show a brief error notification
    const errorDiv = document.createElement('div');
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
        max-width: 300px;
    `;
    errorDiv.textContent = `Extension error: ${errorMessage}`;
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 10000);
}

/**
 * Show API key status briefly after successful initialization
 */
function showApiKeyStatus() {
    if (!extensionInitializer) return;
    
    const status = extensionInitializer.getInitializationStatus();
    if (!status.hasApiKey) {
        const statusDiv = document.createElement('div');
        statusDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #e6fffa;
            color: #2c7a7b;
            border: 1px solid #81e6d9;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-family: Arial, sans-serif;
            z-index: 10000;
            max-width: 300px;
        `;
        statusDiv.textContent = 'Using CoinGecko free tier. Configure API key in settings for better reliability.';
        
        document.body.appendChild(statusDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (statusDiv.parentElement) {
                statusDiv.remove();
            }
        }, 5000);
    }
}

/**
 * Show initialization error with retry option
 */
function showInitializationError(errorMessage) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #d32f2f;
        color: white;
        padding: 12px;
        border-radius: 4px;
        font-size: 12px;
        font-family: Arial, sans-serif;
        z-index: 10000;
        max-width: 350px;
    `;
    
    errorDiv.innerHTML = `
        <div style="margin-bottom: 8px;">
            <strong>Cache Loading Failed</strong><br>
            ${errorMessage}
        </div>
        <button onclick="retryInitialization()" style="
            background: rgba(255,255,255,0.2);
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
        ">Retry</button>
        <button onclick="this.parentElement.remove()" style="
            background: rgba(255,255,255,0.2);
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            margin-left: 5px;
        ">Dismiss</button>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 15 seconds
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 15000);
}

/**
 * Retry initialization (called from error UI)
 */
async function retryInitialization() {
    try {
        if (extensionInitializer) {
            await extensionInitializer.retryInitialization();
        } else {
            await initializeExtension();
        }
    } catch (error) {
        console.error('Retry failed:', error);
    }
}

/**
 * Get the current cache status
 * @returns {Object} Cache status information
 */
function getCacheStatus() {
    if (!extensionInitializer) {
        return { initialized: false, error: 'Extension not initialized' };
    }
    
    return extensionInitializer.getInitializationStatus();
}

/**
 * Get the cache manager instance
 * @returns {RateCacheManager|null} Cache manager or null
 */
function getCacheManager() {
    if (!extensionInitializer) {
        return null;
    }
    
    return extensionInitializer.getCacheManager();
}

/**
 * Save API key and reinitialize
 * @param {string} apiKey - CoinGecko API key
 */
async function saveApiKeyAndReinitialize(apiKey) {
    try {
        if (!extensionInitializer) {
            extensionInitializer = new ExtensionInitializer();
        }
        
        await extensionInitializer.saveApiKey(apiKey);
        await extensionInitializer.retryInitialization();
        
        console.log('API key saved and extension reinitialized');
        
    } catch (error) {
        console.error('Failed to save API key and reinitialize:', error);
        throw error;
    }
}

/**
 * Initialize extension when DOM is ready
 */
function initializeWhenReady() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initializeExtension, 100); // Small delay to ensure everything is loaded
        });
    } else {
        // DOM is already ready
        setTimeout(initializeExtension, 100);
    }
}

// Auto-initialize when script loads
initializeWhenReady();

// Export functions for global access
if (typeof window !== 'undefined') {
    window.initializeExtension = initializeExtension;
    window.retryInitialization = retryInitialization;
    window.getCacheStatus = getCacheStatus;
    window.getCacheManager = getCacheManager;
    window.saveApiKeyAndReinitialize = saveApiKeyAndReinitialize;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeExtension,
        retryInitialization,
        getCacheStatus,
        getCacheManager,
        saveApiKeyAndReinitialize
    };
}