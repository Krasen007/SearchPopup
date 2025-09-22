# Cache Infrastructure

This directory contains the core cache infrastructure for cryptocurrency and fiat currency rates, implementing the requirements from the API reliability fix specification.

## Components

### RateCacheManager.js
The main cache manager class that provides:
- In-memory storage for crypto and fiat rates
- Cache status tracking (isReady, lastUpdated, staleness detection)
- Instant rate lookups without API calls
- Cache age monitoring and staleness detection

**Key Methods:**
- `populateCache(cryptoData, fiatData)` - Populate cache with rate data
- `getCryptoRate(coinId, vsCurrency)` - Get crypto rate for coin/currency pair
- `getFiatRate(currency)` - Get fiat exchange rate
- `getStatus()` - Get comprehensive cache status
- `isStale(maxAgeMs)` - Check if cache is stale (default: 1 hour)

### config.js
Configuration object containing:
- Supported cryptocurrencies with CoinGecko IDs
- Supported fiat currencies
- API settings and rate limits
- Cache refresh intervals and thresholds
- Helper functions for currency validation and conversion

**Key Functions:**
- `getSupportedCoinIds()` - Get comma-separated coin IDs for API requests
- `getSupportedFiatCurrencies()` - Get comma-separated fiat currencies
- `getCoinIdFromSymbol(symbol)` - Convert crypto symbol to CoinGecko ID
- `getSymbolFromCoinId(coinId)` - Convert CoinGecko ID to crypto symbol
- `isSupportedFiatCurrency(currency)` - Validate fiat currency support

## Usage Example

```javascript
// Initialize cache manager
const cacheManager = new RateCacheManager();

// Populate with data from CoinGecko API
const cryptoData = {
    bitcoin: { usd: 50000, eur: 42000 },
    ethereum: { usd: 3000, eur: 2520 }
};
const fiatData = { USD: 1.8, EUR: 1.95583 };
cacheManager.populateCache(cryptoData, fiatData);

// Instant rate lookups
const btcPrice = cacheManager.getCryptoRate('bitcoin', 'usd'); // 50000
const usdRate = cacheManager.getFiatRate('USD'); // 1.8

// Check cache status
const status = cacheManager.getStatus();
console.log('Cache ready:', status.isReady);
console.log('Cache age:', status.cacheAge, 'ms');
console.log('Is stale:', status.isStale);
```

## Configuration

The cache system supports 33 cryptocurrencies and 21 fiat currencies by default. Configuration can be modified in `config.js`:

- **Refresh Interval**: 15 minutes (900,000ms)
- **Stale Threshold**: 1 hour (3,600,000ms)
- **Retry Interval**: 5 minutes (300,000ms) for failed refreshes

## Testing

Unit tests are provided in the `/tests` directory:
- `RateCacheManager.test.js` - Tests for cache operations
- `config.test.js` - Tests for configuration functions

Run tests with:
```bash
npm test
```

## Requirements Satisfied

This implementation satisfies the following requirements:

- **Requirement 1.1**: Instant conversions from cached data without API calls
- **Requirement 1.3**: In-memory storage for immediate access
- **Requirement 5.1**: Simple configuration object for supported currencies

The cache infrastructure provides the foundation for the startup-based caching system that will eliminate API reliability issues in the browser extension.