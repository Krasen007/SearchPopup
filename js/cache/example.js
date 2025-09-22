/**
 * Example usage of the RateCacheManager and configuration
 * This demonstrates how the cache system will be integrated
 */

// Example: Initialize cache manager with configuration
function initializeCacheSystem(RateCacheManagerClass) {
    // Create cache manager instance
    const cacheManager = new RateCacheManagerClass();
    
    // Example crypto data from CoinGecko API
    const sampleCryptoData = {
        bitcoin: { usd: 50000, eur: 42000, bgn: 82000 },
        ethereum: { usd: 3000, eur: 2520, bgn: 4920 },
        ripple: { usd: 0.75, eur: 0.63, bgn: 1.23 }
    };
    
    // Example fiat data from CoinGecko exchange rates
    const sampleFiatData = {
        USD: 1.8,      // 1 USD = 1.8 BGN
        EUR: 1.95583,  // 1 EUR = 1.95583 BGN
        GBP: 2.3       // 1 GBP = 2.3 BGN
    };
    
    // Populate cache
    cacheManager.populateCache(sampleCryptoData, sampleFiatData);
    
    return cacheManager;
}

// Example: Using the cache for instant conversions
function demonstrateConversions(RateCacheManagerClass) {
    const cache = initializeCacheSystem(RateCacheManagerClass);
    
    console.log('=== Cache Status ===');
    console.log(cache.getStatus());
    
    console.log('\n=== Crypto Conversions ===');
    // Convert 1 BTC to USD
    const btcPrice = cache.getCryptoRate('bitcoin', 'usd');
    console.log(`1 BTC = ${btcPrice} USD`);
    
    // Convert 5 ETH to EUR
    const ethPrice = cache.getCryptoRate('ethereum', 'eur');
    console.log(`5 ETH = ${5 * ethPrice} EUR`);
    
    console.log('\n=== Fiat Conversions ===');
    // Convert 100 USD to BGN
    const usdRate = cache.getFiatRate('USD');
    console.log(`100 USD = ${100 * usdRate} BGN`);
    
    // Convert 50 EUR to BGN
    const eurRate = cache.getFiatRate('EUR');
    console.log(`50 EUR = ${50 * eurRate} BGN`);
    
    console.log('\n=== Available Data ===');
    console.log('Available crypto IDs:', cache.getAvailableCryptoIds());
    console.log('Available fiat currencies:', cache.getAvailableFiatCurrencies());
}

// Example: Configuration usage
function demonstrateConfiguration(configFunctions) {
    console.log('\n=== Configuration Demo ===');
    
    if (!configFunctions) return;
    
    const { getSupportedCoinIds, getSupportedFiatCurrencies, getCoinIdFromSymbol, getSymbolFromCoinId, isSupportedFiatCurrency } = configFunctions;
    
    // Get supported coin IDs for API request
    const coinIds = getSupportedCoinIds();
    console.log('Coin IDs for API:', coinIds.substring(0, 50) + '...');
    
    // Get supported fiat currencies for API request
    const fiats = getSupportedFiatCurrencies();
    console.log('Fiat currencies for API:', fiats);
    
    // Convert symbols to coin IDs
    console.log('BTC coin ID:', getCoinIdFromSymbol('BTC'));
    console.log('ETH coin ID:', getCoinIdFromSymbol('ETH'));
    
    // Convert coin IDs to symbols
    console.log('bitcoin symbol:', getSymbolFromCoinId('bitcoin'));
    console.log('ethereum symbol:', getSymbolFromCoinId('ethereum'));
    
    // Check fiat currency support
    console.log('USD supported:', isSupportedFiatCurrency('USD'));
    console.log('XYZ supported:', isSupportedFiatCurrency('XYZ'));
}

// Example: Cache staleness and status monitoring
function demonstrateCacheMonitoring(RateCacheManagerClass) {
    const cache = initializeCacheSystem(RateCacheManagerClass);
    
    console.log('\n=== Cache Monitoring ===');
    console.log('Initial status:', cache.getStatus());
    
    // Simulate cache aging
    setTimeout(() => {
        console.log('Cache age after 1 second:', cache.getCacheAge(), 'ms');
        console.log('Is stale (1 hour threshold):', cache.isStale());
        console.log('Is stale (500ms threshold):', cache.isStale(500));
    }, 1000);
}

// Run examples if this file is executed directly
if (typeof window !== 'undefined') {
    // Browser environment
    console.log('RateCacheManager Example Usage');
    demonstrateConversions(RateCacheManager);
    demonstrateConfiguration(window.cacheConfig);
    demonstrateCacheMonitoring(RateCacheManager);
} else if (typeof module !== 'undefined' && require.main === module) {
    // Node.js environment
    const RateCacheManager = require('./RateCacheManager.js');
    const config = require('./config.js');
    
    console.log('RateCacheManager Example Usage');
    demonstrateConversions(RateCacheManager);
    demonstrateConfiguration(config);
    demonstrateCacheMonitoring(RateCacheManager);
}