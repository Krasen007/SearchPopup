/**
 * Unit tests for CoinGeckoAPIClient
 */

const CoinGeckoAPIClient = require('../js/cache/CoinGeckoAPIClient');

// Mock fetch globally
global.fetch = jest.fn();

describe('CoinGeckoAPIClient', () => {
    let client;
    const mockApiKey = 'test-api-key-12345';

    beforeEach(() => {
        client = new CoinGeckoAPIClient(mockApiKey);
        fetch.mockClear();
        jest.clearAllTimers();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Constructor', () => {
        test('should initialize with API key', () => {
            expect(client.apiKey).toBe(mockApiKey);
            expect(client.baseURL).toBe('https://api.coingecko.com/api/v3');
            expect(client.requestCount).toBe(0);
            expect(client.rateLimitDelay).toBe(2000);
        });

        test('should work without API key', () => {
            const clientWithoutKey = new CoinGeckoAPIClient();
            expect(clientWithoutKey.apiKey).toBeUndefined();
        });
    });

    describe('fetchCryptoPrices', () => {
        const mockCryptoResponse = {
            bitcoin: { usd: 50000, eur: 42000 },
            ethereum: { usd: 3000, eur: 2520 }
        };

        beforeEach(() => {
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockCryptoResponse)
            });
        });

        test('should fetch crypto prices with string parameters', async () => {
            const result = await client.fetchCryptoPrices('bitcoin,ethereum', 'usd,eur');
            
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/simple/price'),
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({
                        'Accept': 'application/json'
                    })
                })
            );
            
            const calledUrl = fetch.mock.calls[0][0];
            expect(calledUrl).toContain('ids=bitcoin%2Cethereum');
            expect(calledUrl).toContain('vs_currencies=usd%2Ceur');
            expect(calledUrl).toContain('x_cg_demo_api_key=test-api-key-12345');
            expect(result).toEqual(mockCryptoResponse);
        });

        test('should fetch crypto prices with array parameters', async () => {
            const result = await client.fetchCryptoPrices(['bitcoin', 'ethereum'], ['usd', 'eur']);
            
            const calledUrl = fetch.mock.calls[0][0];
            expect(calledUrl).toContain('ids=bitcoin%2Cethereum');
            expect(calledUrl).toContain('vs_currencies=usd%2Ceur');
            expect(result).toEqual(mockCryptoResponse);
        });

        test('should work without API key', async () => {
            const clientWithoutKey = new CoinGeckoAPIClient();
            await clientWithoutKey.fetchCryptoPrices('bitcoin', 'usd');
            
            const calledUrl = fetch.mock.calls[0][0];
            expect(calledUrl).not.toContain('x_cg_demo_api_key');
        });

        test('should handle fetch errors', async () => {
            fetch.mockRejectedValue(new Error('Network error'));
            
            await expect(client.fetchCryptoPrices('bitcoin', 'usd'))
                .rejects.toThrow('Failed to fetch crypto prices: Network error');
        });

        test('should handle HTTP errors', async () => {
            fetch.mockResolvedValue({
                ok: false,
                status: 401,
                statusText: 'Unauthorized'
            });
            
            await expect(client.fetchCryptoPrices('bitcoin', 'usd'))
                .rejects.toThrow('Authentication failed: Invalid API key');
        });
    });

    describe('fetchExchangeRates', () => {
        const mockExchangeResponse = {
            rates: {
                usd: { name: 'US Dollar', unit: '$', value: 1, type: 'fiat' },
                eur: { name: 'Euro', unit: '€', value: 0.85, type: 'fiat' }
            }
        };

        beforeEach(() => {
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockExchangeResponse)
            });
        });

        test('should fetch exchange rates', async () => {
            const result = await client.fetchExchangeRates();
            
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/exchange_rates'),
                expect.objectContaining({
                    method: 'GET'
                })
            );
            
            const calledUrl = fetch.mock.calls[0][0];
            expect(calledUrl).toContain('x_cg_demo_api_key=test-api-key-12345');
            expect(result).toEqual(mockExchangeResponse);
        });

        test('should work without API key', async () => {
            const clientWithoutKey = new CoinGeckoAPIClient();
            await clientWithoutKey.fetchExchangeRates();
            
            const calledUrl = fetch.mock.calls[0][0];
            expect(calledUrl).not.toContain('x_cg_demo_api_key');
        });

        test('should handle fetch errors', async () => {
            fetch.mockRejectedValue(new Error('Network error'));
            
            await expect(client.fetchExchangeRates())
                .rejects.toThrow('Failed to fetch exchange rates: Network error');
        });
    });

    describe('makeRequest', () => {
        test('should enforce rate limiting', async () => {
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({})
            });

            const startTime = Date.now();
            
            // Make first request
            await client.makeRequest('https://test.com');
            
            // Make second request immediately
            const secondRequestPromise = client.makeRequest('https://test.com');
            
            // Fast-forward time to simulate rate limit delay
            jest.advanceTimersByTime(2000);
            
            await secondRequestPromise;
            
            expect(client.requestCount).toBe(2);
        });

        test('should handle network errors', async () => {
            fetch.mockRejectedValue(new TypeError('Failed to fetch'));
            
            await expect(client.makeRequest('https://test.com'))
                .rejects.toThrow('Network error: Unable to connect to CoinGecko API');
        });

        test('should handle invalid JSON response', async () => {
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(null)
            });
            
            await expect(client.makeRequest('https://test.com'))
                .rejects.toThrow('Invalid response format from CoinGecko API');
        });
    });

    describe('handleHttpError', () => {
        test('should handle 401 authentication error', async () => {
            const mockResponse = {
                status: 401,
                statusText: 'Unauthorized',
                json: () => Promise.resolve({ error: 'Invalid API key' })
            };
            
            await expect(client.handleHttpError(mockResponse))
                .rejects.toThrow('Authentication failed: Invalid API key');
        });

        test('should handle 403 forbidden error', async () => {
            const mockResponse = {
                status: 403,
                statusText: 'Forbidden',
                json: () => Promise.resolve({})
            };
            
            await expect(client.handleHttpError(mockResponse))
                .rejects.toThrow('Access forbidden: API key may not have required permissions');
        });

        test('should handle 429 rate limit error', async () => {
            const mockResponse = {
                status: 429,
                statusText: 'Too Many Requests',
                json: () => Promise.resolve({})
            };
            
            await expect(client.handleHttpError(mockResponse))
                .rejects.toThrow('Rate limit exceeded: Too many requests');
        });

        test('should handle 500 server error', async () => {
            const mockResponse = {
                status: 500,
                statusText: 'Internal Server Error',
                json: () => Promise.resolve({})
            };
            
            await expect(client.handleHttpError(mockResponse))
                .rejects.toThrow('CoinGecko API server error: Please try again later');
        });

        test('should handle generic HTTP errors', async () => {
            const mockResponse = {
                status: 400,
                statusText: 'Bad Request',
                json: () => Promise.resolve({})
            };
            
            await expect(client.handleHttpError(mockResponse))
                .rejects.toThrow('HTTP 400: Bad Request');
        });

        test('should handle JSON parse errors in error response', async () => {
            const mockResponse = {
                status: 400,
                statusText: 'Bad Request',
                json: () => Promise.reject(new Error('Invalid JSON'))
            };
            
            await expect(client.handleHttpError(mockResponse))
                .rejects.toThrow('HTTP 400: Bad Request');
        });
    });

    describe('validateApiKey', () => {
        test('should validate correct API key format', () => {
            expect(CoinGeckoAPIClient.validateApiKey('valid-api-key-123')).toBe(true);
            expect(CoinGeckoAPIClient.validateApiKey('VALID_API_KEY_456')).toBe(true);
            expect(CoinGeckoAPIClient.validateApiKey('validapikey789')).toBe(true);
        });

        test('should reject invalid API key formats', () => {
            expect(CoinGeckoAPIClient.validateApiKey('')).toBe(false);
            expect(CoinGeckoAPIClient.validateApiKey(null)).toBe(false);
            expect(CoinGeckoAPIClient.validateApiKey(undefined)).toBe(false);
            expect(CoinGeckoAPIClient.validateApiKey('short')).toBe(false);
            expect(CoinGeckoAPIClient.validateApiKey('invalid@key!')).toBe(false);
            expect(CoinGeckoAPIClient.validateApiKey(123)).toBe(false);
        });
    });

    describe('getStats and resetStats', () => {
        test('should track and return API statistics', async () => {
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({})
            });

            await client.makeRequest('https://test.com');
            
            const stats = client.getStats();
            expect(stats.requestCount).toBe(1);
            expect(stats.lastRequestTime).toBeGreaterThan(0);
            expect(stats.hasApiKey).toBe(true);
            expect(stats.rateLimitDelay).toBe(2000);
        });

        test('should reset statistics', async () => {
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({})
            });

            await client.makeRequest('https://test.com');
            client.resetStats();
            
            const stats = client.getStats();
            expect(stats.requestCount).toBe(0);
            expect(stats.lastRequestTime).toBe(0);
        });

        test('should show hasApiKey as false when no key provided', () => {
            const clientWithoutKey = new CoinGeckoAPIClient();
            const stats = clientWithoutKey.getStats();
            expect(stats.hasApiKey).toBe(false);
        });
    });

    describe('fetchAllCryptoPricesBulk', () => {
        const mockBulkResponse = {
            bitcoin: { usd: 50000, eur: 42000 },
            ethereum: { usd: 3000, eur: 2520 },
            ripple: { usd: 0.5, eur: 0.42 }
        };

        beforeEach(() => {
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockBulkResponse)
            });
        });

        test('should fetch all crypto prices in bulk', async () => {
            const coinIds = ['bitcoin', 'ethereum', 'ripple'];
            const currencies = ['usd', 'eur'];
            
            const result = await client.fetchAllCryptoPricesBulk(coinIds, currencies);
            
            expect(result.data).toEqual(mockBulkResponse);
            expect(result.metadata.requestedCoins).toBe(3);
            expect(result.metadata.requestedCurrencies).toBe(2);
            expect(result.metadata.receivedCoins).toBe(3);
        });

        test('should handle duplicate coin IDs and currencies', async () => {
            const coinIds = ['bitcoin', 'ethereum', 'bitcoin']; // duplicate
            const currencies = ['usd', 'eur', 'usd']; // duplicate
            
            const result = await client.fetchAllCryptoPricesBulk(coinIds, currencies);
            
            // Should still work with deduplicated parameters
            expect(result.data.bitcoin).toEqual({ usd: 50000, eur: 42000 });
            expect(result.data.ethereum).toEqual({ usd: 3000, eur: 2520 });
            expect(result.metadata.requestedCoins).toBe(3); // Original count
            expect(result.metadata.receivedCoins).toBe(2); // Deduplicated count
        });

        test('should validate input parameters', async () => {
            await expect(client.fetchAllCryptoPricesBulk([], ['usd']))
                .rejects.toThrow('coinIds must be a non-empty array');
            
            await expect(client.fetchAllCryptoPricesBulk(['bitcoin'], []))
                .rejects.toThrow('vsCurrencies must be a non-empty array');
            
            await expect(client.fetchAllCryptoPricesBulk(null, ['usd']))
                .rejects.toThrow('coinIds must be a non-empty array');
        });

        test('should handle API errors in bulk request', async () => {
            fetch.mockRejectedValue(new Error('API Error'));
            
            await expect(client.fetchAllCryptoPricesBulk(['bitcoin'], ['usd']))
                .rejects.toThrow('Bulk crypto prices fetch failed: Failed to fetch crypto prices: API Error');
        });
    });

    describe('optimizeRequestParameters', () => {
        test('should remove duplicates and normalize case', () => {
            const coinIds = ['Bitcoin', 'ETHEREUM', 'bitcoin', 'ripple'];
            const currencies = ['USD', 'eur', 'USD', 'gbp'];
            
            const result = client.optimizeRequestParameters(coinIds, currencies);
            
            expect(result.coinIds).toEqual(['bitcoin', 'ethereum', 'ripple']);
            expect(result.vsCurrencies).toEqual(['eur', 'gbp', 'usd']);
            expect(result.originalCoinCount).toBe(4);
            expect(result.optimizedCoinCount).toBe(3);
        });

        test('should filter invalid coin IDs', () => {
            const coinIds = ['bitcoin', 'invalid@coin', '', 'ethereum'];
            const currencies = ['usd', 'eur'];
            
            const result = client.optimizeRequestParameters(coinIds, currencies);
            
            expect(result.coinIds).toEqual(['bitcoin', 'ethereum']);
            expect(result.optimizedCoinCount).toBe(2);
        });

        test('should filter invalid currencies', () => {
            const coinIds = ['bitcoin'];
            const currencies = ['usd', 'invalid@curr', 'x', 'toolongcurrency', 'eur'];
            
            const result = client.optimizeRequestParameters(coinIds, currencies);
            
            expect(result.vsCurrencies).toEqual(['eur', 'usd']);
            expect(result.optimizedCurrencyCount).toBe(2);
        });

        test('should throw error for no valid inputs', () => {
            expect(() => client.optimizeRequestParameters(['invalid@'], ['usd']))
                .toThrow('No valid coin IDs provided');
            
            expect(() => client.optimizeRequestParameters(['bitcoin'], ['invalid@']))
                .toThrow('No valid currencies provided');
        });
    });

    describe('parseBulkCryptoResponse', () => {
        test('should parse valid bulk response', () => {
            const response = {
                bitcoin: { usd: 50000, eur: 42000 },
                ethereum: { usd: 3000, eur: 2520 }
            };
            const requestedCoins = ['bitcoin', 'ethereum'];
            const requestedCurrencies = ['usd', 'eur'];
            
            const result = client.parseBulkCryptoResponse(response, requestedCoins, requestedCurrencies);
            
            expect(result.data).toEqual(response);
            expect(result.metadata.requestedCoins).toBe(2);
            expect(result.metadata.receivedCoins).toBe(2);
            expect(result.metadata.missingCoins).toEqual([]);
        });

        test('should handle missing coins', () => {
            const response = {
                bitcoin: { usd: 50000, eur: 42000 }
                // ethereum missing
            };
            const requestedCoins = ['bitcoin', 'ethereum'];
            const requestedCurrencies = ['usd', 'eur'];
            
            const result = client.parseBulkCryptoResponse(response, requestedCoins, requestedCurrencies);
            
            expect(result.data.bitcoin).toEqual({ usd: 50000, eur: 42000 });
            expect(result.metadata.missingCoins).toEqual(['ethereum']);
        });

        test('should handle missing prices', () => {
            const response = {
                bitcoin: { usd: 50000 } // eur missing
            };
            const requestedCoins = ['bitcoin'];
            const requestedCurrencies = ['usd', 'eur'];
            
            const result = client.parseBulkCryptoResponse(response, requestedCoins, requestedCurrencies);
            
            expect(result.data.bitcoin).toEqual({ usd: 50000 });
            expect(result.metadata.missingPrices).toEqual(['bitcoin/eur']);
        });

        test('should handle invalid price values', () => {
            const response = {
                bitcoin: { usd: 'invalid', eur: -100, gbp: NaN, jpy: null }
            };
            const requestedCoins = ['bitcoin'];
            const requestedCurrencies = ['usd', 'eur', 'gbp', 'jpy'];
            
            const result = client.parseBulkCryptoResponse(response, requestedCoins, requestedCurrencies);
            
            expect(result.data.bitcoin).toEqual({});
            expect(result.metadata.missingPrices).toEqual([
                'bitcoin/usd', 'bitcoin/eur', 'bitcoin/gbp', 'bitcoin/jpy'
            ]);
        });

        test('should throw error for invalid response format', () => {
            expect(() => client.parseBulkCryptoResponse(null, ['bitcoin'], ['usd']))
                .toThrow('Invalid bulk crypto response format');
            
            expect(() => client.parseBulkCryptoResponse('invalid', ['bitcoin'], ['usd']))
                .toThrow('Invalid bulk crypto response format');
        });
    });

    describe('parseExchangeRatesResponse', () => {
        test('should parse valid exchange rates response', () => {
            const response = {
                rates: {
                    usd: { name: 'US Dollar', unit: '$', value: 1, type: 'fiat' },
                    eur: { name: 'Euro', unit: '€', value: 0.85, type: 'fiat' }
                }
            };
            
            const result = client.parseExchangeRatesResponse(response);
            
            expect(result.rates.USD).toEqual({
                value: 1,
                name: 'US Dollar',
                unit: '$',
                type: 'fiat'
            });
            expect(result.rates.EUR).toEqual({
                value: 0.85,
                name: 'Euro',
                unit: '€',
                type: 'fiat'
            });
            expect(result.metadata.validRates).toBe(2);
        });

        test('should handle missing rate data', () => {
            const response = {
                rates: {
                    usd: { name: 'US Dollar', unit: '$', value: 1 },
                    invalid: null,
                    eur: { name: 'Euro', value: 'invalid' }
                }
            };
            
            const result = client.parseExchangeRatesResponse(response);
            
            expect(result.rates.USD).toBeDefined();
            expect(result.rates.INVALID).toBeUndefined();
            expect(result.rates.EUR).toBeUndefined();
            expect(result.metadata.invalidRates).toEqual(['invalid', 'eur']);
        });

        test('should throw error for invalid response format', () => {
            expect(() => client.parseExchangeRatesResponse(null))
                .toThrow('Invalid exchange rates response format');
            
            expect(() => client.parseExchangeRatesResponse({}))
                .toThrow('Missing rates data in exchange rates response');
        });
    });

    describe('validateResponseData', () => {
        test('should validate crypto response data', () => {
            const validCrypto = {
                bitcoin: { usd: 50000, eur: 42000 },
                ethereum: { usd: 3000, eur: 2520 }
            };
            
            expect(client.validateResponseData(validCrypto, 'crypto')).toBe(true);
            
            const invalidCrypto = {
                bitcoin: { usd: 'invalid' }
            };
            
            expect(client.validateResponseData(invalidCrypto, 'crypto')).toBe(false);
        });

        test('should validate fiat response data', () => {
            const validFiat = {
                rates: {
                    usd: { value: 1 },
                    eur: { value: 0.85 }
                }
            };
            
            expect(client.validateResponseData(validFiat, 'fiat')).toBe(true);
            
            const invalidFiat = {
                rates: {
                    usd: { value: 'invalid' }
                }
            };
            
            expect(client.validateResponseData(invalidFiat, 'fiat')).toBe(false);
        });

        test('should handle invalid input', () => {
            expect(client.validateResponseData(null, 'crypto')).toBe(false);
            expect(client.validateResponseData('invalid', 'crypto')).toBe(false);
            expect(client.validateResponseData({}, 'fiat')).toBe(false);
        });
    });
});