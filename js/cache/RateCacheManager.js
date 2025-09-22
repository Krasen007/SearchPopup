/**
 * RateCacheManager - Core cache infrastructure for cryptocurrency and fiat currency rates
 * Provides in-memory storage with status tracking and staleness detection
 */
class RateCacheManager {
    constructor() {
        this.cryptoRates = new Map();
        this.fiatRates = new Map();
        this.lastUpdated = null;
        this.isReady = false;
        this.error = null;
    }

    /**
     * Populate cache with crypto and fiat rate data
     * @param {Object} cryptoData - Crypto rates from CoinGecko API
     * @param {Object} fiatData - Fiat exchange rates
     */
    populateCache(cryptoData, fiatData) {
        try {
            this.cryptoRates.clear();
            this.fiatRates.clear();
            
            // Populate crypto rates
            if (cryptoData && typeof cryptoData === 'object') {
                for (const [coinId, prices] of Object.entries(cryptoData)) {
                    if (prices && typeof prices === 'object') {
                        for (const [currency, price] of Object.entries(prices)) {
                            const key = `${coinId}_${currency}`;
                            this.cryptoRates.set(key, {
                                value: price,
                                timestamp: Date.now(),
                                source: 'coingecko'
                            });
                        }
                    }
                }
            }
            
            // Populate fiat rates
            if (fiatData && typeof fiatData === 'object') {
                for (const [fromCurrency, rate] of Object.entries(fiatData)) {
                    if (typeof rate === 'number' && !isNaN(rate)) {
                        // Store rate for conversion to base currency
                        this.fiatRates.set(fromCurrency, {
                            value: rate,
                            timestamp: Date.now(),
                            source: 'coingecko'
                        });
                    }
                }
            }
            
            this.lastUpdated = Date.now();
            this.isReady = true;
            this.error = null;
            
            console.log(`Cache populated: ${this.cryptoRates.size} crypto rates, ${this.fiatRates.size} fiat rates`);
        } catch (error) {
            console.error('Error populating cache:', error);
            this.error = error.message;
            this.isReady = false;
        }
    }

    /**
     * Get cryptocurrency rate for a specific coin and currency pair
     * @param {string} coinId - CoinGecko coin ID (e.g., 'bitcoin')
     * @param {string} vsCurrency - Target currency (e.g., 'usd')
     * @returns {number|null} Rate value or null if not found
     */
    getCryptoRate(coinId, vsCurrency) {
        const key = `${coinId}_${vsCurrency.toLowerCase()}`;
        const entry = this.cryptoRates.get(key);
        return entry ? entry.value : null;
    }

    /**
     * Get fiat exchange rate for a currency
     * @param {string} currency - Currency code (e.g., 'USD')
     * @returns {number|null} Exchange rate or null if not found
     */
    getFiatRate(currency) {
        const entry = this.fiatRates.get(currency);
        return entry ? entry.value : null;
    }

    /**
     * Get cache age in milliseconds
     * @returns {number|null} Age in milliseconds or null if never updated
     */
    getCacheAge() {
        return this.lastUpdated ? Date.now() - this.lastUpdated : null;
    }

    /**
     * Check if cache is stale based on maximum age threshold
     * @param {number} maxAgeMs - Maximum age in milliseconds (default: 1 hour)
     * @returns {boolean} True if cache is stale
     */
    isStale(maxAgeMs = 3600000) { // 1 hour default
        const age = this.getCacheAge();
        return age === null || age > maxAgeMs;
    }

    /**
     * Get cache status information
     * @returns {Object} Cache status object
     */
    getStatus() {
        return {
            isReady: this.isReady,
            lastUpdated: this.lastUpdated,
            isStale: this.isStale(),
            cryptoCount: this.cryptoRates.size,
            fiatCount: this.fiatRates.size,
            error: this.error,
            cacheAge: this.getCacheAge()
        };
    }

    /**
     * Clear all cached data
     */
    clear() {
        this.cryptoRates.clear();
        this.fiatRates.clear();
        this.lastUpdated = null;
        this.isReady = false;
        this.error = null;
    }

    /**
     * Get all available crypto coin IDs
     * @returns {Array<string>} Array of coin IDs
     */
    getAvailableCryptoIds() {
        const coinIds = new Set();
        for (const key of this.cryptoRates.keys()) {
            const coinId = key.split('_')[0];
            coinIds.add(coinId);
        }
        return Array.from(coinIds);
    }

    /**
     * Get all available fiat currencies
     * @returns {Array<string>} Array of currency codes
     */
    getAvailableFiatCurrencies() {
        return Array.from(this.fiatRates.keys());
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RateCacheManager;
}