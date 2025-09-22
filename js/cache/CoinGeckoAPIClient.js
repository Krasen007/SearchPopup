/**
 * CoinGeckoAPIClient - Authenticated API client for reliable data fetching
 * Handles direct API calls to CoinGecko with proper authentication and error handling
 */
class CoinGeckoAPIClient {
    constructor(apiKey = null) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.coingecko.com/api/v3';
        this.requestCount = 0;
        this.lastRequestTime = 0;
        // Adjust rate limiting based on API key availability
        this.rateLimitDelay = apiKey ? 1000 : 3000; // 1s with API key, 3s without (free tier)
    }

    /**
     * Fetch cryptocurrency prices for multiple coins and currencies
     * @param {string|Array} coinIds - Comma-separated string or array of CoinGecko coin IDs
     * @param {string|Array} vsCurrencies - Comma-separated string or array of target currencies
     * @returns {Promise<Object>} API response with price data
     */
    async fetchCryptoPrices(coinIds, vsCurrencies) {
        const coinIdsStr = Array.isArray(coinIds) ? coinIds.join(',') : coinIds;
        const vsCurrenciesStr = Array.isArray(vsCurrencies) ? vsCurrencies.join(',') : vsCurrencies;

        const url = `${this.baseURL}/simple/price`;
        const params = {
            ids: coinIdsStr,
            vs_currencies: vsCurrenciesStr,
            include_24hr_change: 'false',
            include_market_cap: 'false',
            include_24hr_vol: 'false'
        };

        // Add API key if provided
        if (this.apiKey) {
            params.x_cg_demo_api_key = this.apiKey;
        }

        try {
            const response = await this.makeRequest(url, params);
            console.log(`Fetched crypto prices for ${coinIdsStr.split(',').length} coins`);
            return response;
        } catch (error) {
            console.error('Error fetching crypto prices:', error);
            throw new Error(`Failed to fetch crypto prices: ${error.message}`);
        }
    }

    /**
     * Fetch fiat exchange rates using Bitcoin as a reference point
     * @returns {Promise<Object>} API response with exchange rate data
     */
    async fetchExchangeRates() {
        // Get Bitcoin price in multiple fiat currencies to calculate cross-rates
        const url = `${this.baseURL}/simple/price`;
        const params = {
            ids: 'bitcoin',
            vs_currencies: 'usd,eur,gbp,jpy,aud,cad,chf,cny,sek,nzd,mxn,sgd,hkd,nok,krw,try,rub,inr,brl,zar,bgn'
        };

        // Add API key if provided
        if (this.apiKey) {
            params.x_cg_demo_api_key = this.apiKey;
        }

        try {
            const response = await this.makeRequest(url, params);
            console.log('Fetched Bitcoin prices for fiat rate calculation');
            
            // Convert Bitcoin prices to cross-exchange rates
            if (response && response.bitcoin) {
                const btcPrices = response.bitcoin;
                
                // Create exchange rates response using USD as base
                const exchangeRatesResponse = {
                    rates: {}
                };
                
                const usdPrice = btcPrices.usd;
                if (!usdPrice || usdPrice <= 0) {
                    throw new Error('Invalid USD price for Bitcoin');
                }
                
                // Calculate exchange rates relative to USD
                for (const [currency, btcPrice] of Object.entries(btcPrices)) {
                    if (typeof btcPrice === 'number' && !isNaN(btcPrice) && btcPrice > 0) {
                        // Rate = how many units of this currency equal 1 USD
                        const rate = btcPrice / usdPrice;
                        
                        exchangeRatesResponse.rates[currency.toUpperCase()] = {
                            value: rate,
                            name: currency.toUpperCase(),
                            unit: currency.toUpperCase(),
                            type: 'fiat'
                        };
                    }
                }
                
                console.log('Calculated fiat exchange rates:', exchangeRatesResponse.rates);
                return exchangeRatesResponse;
            }
            
            throw new Error('Invalid response format from CoinGecko Bitcoin price API');
        } catch (error) {
            console.error('Error fetching exchange rates:', error);
            throw new Error(`Failed to fetch exchange rates: ${error.message}`);
        }
    }

    /**
     * Make authenticated HTTP request to CoinGecko API
     * @param {string} url - API endpoint URL
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Parsed JSON response
     */
    async makeRequest(url, params = {}) {
        // Rate limiting: ensure minimum delay between requests
        await this.enforceRateLimit();

        // Build query string
        const queryParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                queryParams.append(key, value);
            }
        }

        const fullUrl = queryParams.toString() ? `${url}?${queryParams.toString()}` : url;

        try {
            console.log(`Making API request to: ${url}`);

            const response = await fetch(fullUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'SearchPopupExtension/1.0'
                }
            });

            // Update request tracking
            this.requestCount++;
            this.lastRequestTime = Date.now();

            // Handle HTTP errors
            if (!response.ok) {
                await this.handleHttpError(response);
            }

            // Parse JSON response
            const data = await response.json();

            // Validate response structure
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid response format from CoinGecko API');
            }

            return data;

        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Network error: Unable to connect to CoinGecko API. Please check your internet connection.');
            }
            throw error;
        }
    }

    /**
     * Handle HTTP error responses with appropriate error messages
     * @param {Response} response - Fetch response object
     */
    async handleHttpError(response) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
            const errorData = await response.json();
            if (errorData.error) {
                errorMessage = errorData.error;
            }
        } catch (parseError) {
            // If we can't parse the error response, use the status text
        }

        // Handle specific error codes
        switch (response.status) {
            case 401:
                throw new Error('Authentication failed: Invalid API key. Please check your CoinGecko API key configuration.');
            case 403:
                throw new Error('Access forbidden: API key may not have required permissions or rate limit exceeded.');
            case 429:
                throw new Error('Rate limit exceeded: Too many requests. Please wait before making more requests.');
            case 500:
            case 502:
            case 503:
            case 504:
                throw new Error('CoinGecko API server error: Please try again later.');
            default:
                throw new Error(errorMessage);
        }
    }

    /**
     * Enforce rate limiting between API requests
     */
    async enforceRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.rateLimitDelay) {
            const waitTime = this.rateLimitDelay - timeSinceLastRequest;
            console.log(`Rate limiting: waiting ${waitTime}ms before next request`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }

    /**
     * Validate API key format
     * @param {string} apiKey - API key to validate
     * @returns {boolean} True if API key format is valid
     */
    static validateApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }

        // CoinGecko API keys are typically alphanumeric strings
        // This is a basic format check, not authentication validation
        return /^[a-zA-Z0-9_-]+$/.test(apiKey) && apiKey.length >= 10;
    }

    /**
     * Get API client statistics
     * @returns {Object} Statistics about API usage
     */
    getStats() {
        return {
            requestCount: this.requestCount,
            lastRequestTime: this.lastRequestTime,
            hasApiKey: !!this.apiKey,
            rateLimitDelay: this.rateLimitDelay
        };
    }

    /**
     * Reset API client statistics
     */
    resetStats() {
        this.requestCount = 0;
        this.lastRequestTime = 0;
    }

    /**
     * Fetch all supported cryptocurrencies in a single bulk request
     * @param {Array<string>} coinIds - Array of CoinGecko coin IDs
     * @param {Array<string>} vsCurrencies - Array of target currencies
     * @returns {Promise<Object>} Optimized bulk response with all crypto prices
     */
    async fetchAllCryptoPricesBulk(coinIds, vsCurrencies) {
        if (!Array.isArray(coinIds) || coinIds.length === 0) {
            throw new Error('coinIds must be a non-empty array');
        }
        if (!Array.isArray(vsCurrencies) || vsCurrencies.length === 0) {
            throw new Error('vsCurrencies must be a non-empty array');
        }

        // Optimize request parameters for CoinGecko API
        const optimizedParams = this.optimizeRequestParameters(coinIds, vsCurrencies);

        try {
            const response = await this.fetchCryptoPrices(
                optimizedParams.coinIds,
                optimizedParams.vsCurrencies
            );

            // Parse and validate the bulk response
            const parsedResponse = this.parseBulkCryptoResponse(response, coinIds, vsCurrencies);

            console.log(`Bulk crypto request: ${coinIds.length} coins, ${vsCurrencies.length} currencies`);
            return parsedResponse;

        } catch (error) {
            console.error('Bulk crypto prices fetch failed:', error);
            throw new Error(`Bulk crypto prices fetch failed: ${error.message}`);
        }
    }

    /**
     * Optimize request parameters for maximum efficiency
     * @param {Array<string>} coinIds - Array of coin IDs
     * @param {Array<string>} vsCurrencies - Array of currencies
     * @returns {Object} Optimized parameters object
     */
    optimizeRequestParameters(coinIds, vsCurrencies) {
        // Remove duplicates and normalize case
        const uniqueCoinIds = [...new Set(coinIds.map(id => id.toLowerCase()))];
        const uniqueCurrencies = [...new Set(vsCurrencies.map(curr => curr.toLowerCase()))];

        // Sort for consistent caching and debugging
        uniqueCoinIds.sort();
        uniqueCurrencies.sort();

        // Validate coin IDs format (basic validation)
        const validCoinIds = uniqueCoinIds.filter(id =>
            typeof id === 'string' &&
            id.length > 0 &&
            /^[a-z0-9-]+$/.test(id)
        );

        // Validate currency codes format
        const validCurrencies = uniqueCurrencies.filter(curr =>
            typeof curr === 'string' &&
            curr.length >= 2 &&
            curr.length <= 5 &&
            /^[a-z]+$/.test(curr)
        );

        if (validCoinIds.length === 0) {
            throw new Error('No valid coin IDs provided');
        }
        if (validCurrencies.length === 0) {
            throw new Error('No valid currencies provided');
        }

        return {
            coinIds: validCoinIds,
            vsCurrencies: validCurrencies,
            originalCoinCount: coinIds.length,
            originalCurrencyCount: vsCurrencies.length,
            optimizedCoinCount: validCoinIds.length,
            optimizedCurrencyCount: validCurrencies.length
        };
    }

    /**
     * Parse and validate bulk crypto response from CoinGecko API
     * @param {Object} response - Raw API response
     * @param {Array<string>} requestedCoins - Originally requested coin IDs
     * @param {Array<string>} requestedCurrencies - Originally requested currencies
     * @returns {Object} Parsed and validated response
     */
    parseBulkCryptoResponse(response, requestedCoins, requestedCurrencies) {
        if (!response || typeof response !== 'object') {
            throw new Error('Invalid bulk crypto response format');
        }

        const parsedData = {};
        const missingCoins = [];
        const missingPrices = [];

        // Process each requested coin
        for (const coinId of requestedCoins) {
            const normalizedCoinId = coinId.toLowerCase();

            if (response[normalizedCoinId]) {
                const coinPrices = response[normalizedCoinId];

                if (typeof coinPrices === 'object' && coinPrices !== null) {
                    parsedData[normalizedCoinId] = {};

                    // Validate each currency price
                    for (const currency of requestedCurrencies) {
                        const normalizedCurrency = currency.toLowerCase();

                        if (coinPrices[normalizedCurrency] !== undefined) {
                            const price = coinPrices[normalizedCurrency];

                            if (typeof price === 'number' && !isNaN(price) && price >= 0) {
                                parsedData[normalizedCoinId][normalizedCurrency] = price;
                            } else {
                                missingPrices.push(`${normalizedCoinId}/${normalizedCurrency}`);
                            }
                        } else {
                            missingPrices.push(`${normalizedCoinId}/${normalizedCurrency}`);
                        }
                    }
                } else {
                    missingCoins.push(normalizedCoinId);
                }
            } else {
                missingCoins.push(normalizedCoinId);
            }
        }

        // Log warnings for missing data
        if (missingCoins.length > 0) {
            console.warn('Missing coins in API response:', missingCoins);
        }
        if (missingPrices.length > 0) {
            console.warn('Missing prices in API response:', missingPrices);
        }

        return {
            data: parsedData,
            metadata: {
                requestedCoins: requestedCoins.length,
                requestedCurrencies: requestedCurrencies.length,
                receivedCoins: Object.keys(parsedData).length,
                missingCoins: missingCoins,
                missingPrices: missingPrices,
                timestamp: Date.now()
            }
        };
    }

    /**
     * Parse and validate exchange rates response from CoinGecko API
     * @param {Object} response - Raw API response from exchange_rates endpoint
     * @returns {Object} Parsed and validated exchange rates
     */
    parseExchangeRatesResponse(response) {
        if (!response || typeof response !== 'object') {
            throw new Error('Invalid exchange rates response format');
        }

        if (!response.rates || typeof response.rates !== 'object') {
            throw new Error('Missing rates data in exchange rates response');
        }

        const parsedRates = {};
        const invalidRates = [];

        // Process each currency rate
        for (const [currency, rateData] of Object.entries(response.rates)) {
            if (rateData && typeof rateData === 'object') {
                const rate = rateData.value;

                if (typeof rate === 'number' && !isNaN(rate) && rate > 0) {
                    // Store normalized currency code and rate
                    parsedRates[currency.toUpperCase()] = {
                        value: rate,
                        name: rateData.name || currency,
                        unit: rateData.unit || '',
                        type: rateData.type || 'unknown'
                    };
                } else {
                    invalidRates.push(currency);
                }
            } else {
                invalidRates.push(currency);
            }
        }

        // Log warnings for invalid rates
        if (invalidRates.length > 0) {
            console.warn('Invalid rates in API response:', invalidRates);
        }

        return {
            rates: parsedRates,
            metadata: {
                totalRates: Object.keys(response.rates).length,
                validRates: Object.keys(parsedRates).length,
                invalidRates: invalidRates,
                timestamp: Date.now()
            }
        };
    }

    /**
     * Validate response data structure and content
     * @param {Object} data - Response data to validate
     * @param {string} type - Type of data ('crypto' or 'fiat')
     * @returns {boolean} True if data is valid
     */
    validateResponseData(data, type) {
        if (!data || typeof data !== 'object') {
            return false;
        }

        if (type === 'crypto') {
            // Validate crypto response structure
            for (const [coinId, prices] of Object.entries(data)) {
                if (!prices || typeof prices !== 'object') {
                    return false;
                }

                for (const [currency, price] of Object.entries(prices)) {
                    if (typeof price !== 'number' || isNaN(price) || price < 0) {
                        return false;
                    }
                }
            }
        } else if (type === 'fiat') {
            // Validate fiat rates structure
            if (!data.rates) {
                return false;
            }

            for (const [currency, rateData] of Object.entries(data.rates)) {
                if (!rateData || typeof rateData.value !== 'number' || isNaN(rateData.value)) {
                    return false;
                }
            }
        }

        return true;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CoinGeckoAPIClient;
}