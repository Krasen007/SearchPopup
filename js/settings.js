const currencies = [
    "USD", "AED", "ARS", "AUD", "BDT", "BHD", "BMD", "BRL", "CAD", "CHF", "CLP", "CNY", "CZK", "DKK", "EUR", "GBP", "GEL", "HKD", "HUF", "IDR", "ILS", "INR", "JPY", "KRW", "KWD", "LKR", "MMK", "MXN", "MYR", "NGN", "NOK", "NZD", "PHP", "PKR", "PLN", "RUB", "SAR", "SEK", "SGD", "THB", "TRY", "TWD", "UAH", "VEF", "VND", "ZAR", "BGN"
];

// settings.js - for future settings logic

document.addEventListener('DOMContentLoaded', () => {
    const currencySelect = document.getElementById('currency-select');
    const cryptoCurrencySelect = document.getElementById('crypto-currency-select');
    const searchEngineSelect = document.getElementById('search-engine-select');
    const apiKeyInput = document.getElementById('api-key-input');
    const apiStatus = document.getElementById('api-status');
    const saveButton = document.getElementById('save-settings');
    const reloadMessage = document.querySelector('.reload-message');
    const versionValue = document.getElementById('version-value');

    // Cache dashboard elements
    const refreshCacheBtn = document.getElementById('refresh-cache-btn');
    const refreshBtnText = document.getElementById('refresh-btn-text');
    const cacheStatusValue = document.getElementById('cache-status-value');
    const cacheAgeValue = document.getElementById('cache-age-value');
    const cryptoCountValue = document.getElementById('crypto-count-value');
    const fiatCountValue = document.getElementById('fiat-count-value');
    const cacheRecommendations = document.getElementById('cache-recommendations');
    const recommendationsList = document.getElementById('recommendations-list');
    const viewDetailedStatusBtn = document.getElementById('view-detailed-status');
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    const autoRefreshCheckbox = document.getElementById('auto-refresh-checkbox');

    // Function to populate a dropdown with a list of currencies
    function populateCurrencyDropdown(selectElement, currencyList) {
        currencyList.forEach(currency => {
            const option = document.createElement('option');
            option.value = currency;
            option.textContent = currency;
            selectElement.appendChild(option);
        });
    }

    // Populate the currency and crypto-currency dropdowns
    populateCurrencyDropdown(currencySelect, currencies);
    populateCurrencyDropdown(cryptoCurrencySelect, currencies);

    // Set version from manifest
    if (versionValue && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
        const manifest = chrome.runtime.getManifest();
        if (manifest && manifest.version) {
            versionValue.textContent = manifest.version;
        }
    }

    // Hide reload message and API status by default
    if (reloadMessage) reloadMessage.style.display = 'none';
    if (apiStatus) apiStatus.style.display = 'none';

    // Function to validate API key format
    function validateApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }
        // CoinGecko API keys are typically alphanumeric strings with minimum length
        return /^[a-zA-Z0-9_-]+$/.test(apiKey) && apiKey.length >= 10;
    }

    // Function to show API status message
    function showApiStatus(message, isError = false) {
        if (apiStatus) {
            apiStatus.style.display = 'block';
            apiStatus.textContent = message;
            apiStatus.style.background = isError ? '#fed7d7' : '#c6f6d5';
            apiStatus.style.color = isError ? '#c53030' : '#2f855a';
            apiStatus.style.border = isError ? '1px solid #feb2b2' : '1px solid #9ae6b4';
        }
    }

    // Function to hide API status message
    function hideApiStatus() {
        if (apiStatus) {
            apiStatus.style.display = 'none';
        }
    }

    // Load saved preferences including API key
    chrome.storage.sync.get([
        'preferredCurrency', 
        'preferredCryptoCurrency', 
        'preferredSearchEngine', 
        'coinGeckoApiKey'
    ], (result) => {
        if (result.preferredCurrency) {
            currencySelect.value = result.preferredCurrency;
        }
        if (cryptoCurrencySelect && result.preferredCryptoCurrency) {
            cryptoCurrencySelect.value = result.preferredCryptoCurrency;
        }
        if (searchEngineSelect && result.preferredSearchEngine) {
            searchEngineSelect.value = result.preferredSearchEngine;
        }
        if (apiKeyInput && result.coinGeckoApiKey) {
            apiKeyInput.value = result.coinGeckoApiKey;
            showApiStatus('✓ API key configured', false);
        }
    });

    // API key input validation
    if (apiKeyInput) {
        apiKeyInput.addEventListener('input', () => {
            const apiKey = apiKeyInput.value.trim();
            
            if (apiKey === '') {
                hideApiStatus();
            } else if (validateApiKey(apiKey)) {
                showApiStatus('✓ API key format is valid', false);
            } else {
                showApiStatus('⚠ Invalid API key format', true);
            }
        });

        // Show/hide API key
        apiKeyInput.addEventListener('focus', () => {
            apiKeyInput.type = 'text';
        });

        apiKeyInput.addEventListener('blur', () => {
            apiKeyInput.type = 'password';
        });
    }

    // Save all settings including API key
    saveButton.addEventListener('click', async () => {
        const selectedCurrency = currencySelect.value;
        const selectedCryptoCurrency = cryptoCurrencySelect ? cryptoCurrencySelect.value : 'USD';
        const selectedSearchEngine = searchEngineSelect ? searchEngineSelect.value : 'google';
        const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';

        // Validate API key if provided
        if (apiKey && !validateApiKey(apiKey)) {
            showApiStatus('⚠ Please enter a valid API key or leave empty to use free tier', true);
            return;
        }

        // Prepare settings object
        const settings = {
            preferredCurrency: selectedCurrency,
            preferredCryptoCurrency: selectedCryptoCurrency,
            preferredSearchEngine: selectedSearchEngine
        };

        // Add API key if provided
        if (apiKey) {
            settings.coinGeckoApiKey = apiKey;
        } else {
            // Remove API key if empty (user wants to use free tier)
            chrome.storage.sync.remove(['coinGeckoApiKey']);
        }

        // Save settings
        chrome.storage.sync.set(settings, () => {
            if (chrome.runtime.lastError) {
                showApiStatus('Error saving settings: ' + chrome.runtime.lastError.message, true);
                return;
            }

            // Show success message
            saveButton.textContent = 'Saved!';
            if (reloadMessage) reloadMessage.style.display = 'block';
            
            if (apiKey) {
                showApiStatus('✓ Settings and API key saved successfully', false);
            } else {
                showApiStatus('✓ Settings saved (using free tier)', false);
            }

            // Reset button text after 3 seconds
            setTimeout(() => { 
                saveButton.textContent = 'Save Settings'; 
            }, 3000);
        });
    });

    // Test API key functionality
    function createTestApiKeyButton() {
        const testButton = document.createElement('button');
        testButton.textContent = 'Test API Key';
        testButton.className = 'btn';
        testButton.style.marginLeft = '10px';
        testButton.style.background = '#4299e1';
        
        testButton.addEventListener('click', async () => {
            const apiKey = apiKeyInput.value.trim();
            
            if (!apiKey) {
                showApiStatus('⚠ Please enter an API key to test', true);
                return;
            }

            if (!validateApiKey(apiKey)) {
                showApiStatus('⚠ Invalid API key format', true);
                return;
            }

            testButton.textContent = 'Testing...';
            testButton.disabled = true;

            try {
                // Test API key by making a simple request
                const testUrl = `https://api.coingecko.com/api/v3/ping?x_cg_demo_api_key=${encodeURIComponent(apiKey)}`;
                const response = await fetch(testUrl);
                
                if (response.ok) {
                    showApiStatus('✓ API key is working correctly!', false);
                } else if (response.status === 401) {
                    showApiStatus('⚠ API key authentication failed', true);
                } else if (response.status === 429) {
                    showApiStatus('⚠ Rate limit exceeded, but API key format is correct', false);
                } else {
                    showApiStatus('⚠ API test failed, but key may still work', true);
                }
            } catch (error) {
                showApiStatus('⚠ Unable to test API key (network error)', true);
            }

            testButton.textContent = 'Test API Key';
            testButton.disabled = false;
        });

        return testButton;
    }

    // Add test button next to save button
    if (apiKeyInput && saveButton) {
        const testButton = createTestApiKeyButton();
        saveButton.parentNode.insertBefore(testButton, saveButton.nextSibling);
    }

    // Cache Dashboard Functionality
    let cacheStatusUpdateInterval = null;

    // Function to get cache status from content scripts
    async function getCacheStatus() {
        try {
            // Query active tab to get cache status
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                throw new Error('No active tab found');
            }

            // Execute script to get cache status
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    // Try to get cache status from the extension
                    if (typeof window.getCacheStatus === 'function') {
                        return window.getCacheStatus();
                    } else if (typeof window.extensionInitializer !== 'undefined' && window.extensionInitializer) {
                        return window.extensionInitializer.getInitializationStatus();
                    } else {
                        return { error: 'Cache system not initialized' };
                    }
                }
            });

            return results && results[0] && results[0].result ? results[0].result : { error: 'No cache status available' };
        } catch (error) {
            console.warn('Failed to get cache status:', error);
            return { error: error.message };
        }
    }

    // Function to get detailed cache status
    async function getDetailedCacheStatus() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                throw new Error('No active tab found');
            }

            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    if (typeof window.cacheStatusDisplay !== 'undefined' && window.cacheStatusDisplay) {
                        return window.cacheStatusDisplay.statusMonitor.getDetailedStatus();
                    } else if (typeof window.extensionInitializer !== 'undefined' && window.extensionInitializer) {
                        const statusMonitor = window.extensionInitializer.getStatusMonitor();
                        return statusMonitor ? statusMonitor.getDetailedStatus() : null;
                    }
                    return null;
                }
            });

            return results && results[0] && results[0].result ? results[0].result : null;
        } catch (error) {
            console.warn('Failed to get detailed cache status:', error);
            return null;
        }
    }

    // Function to update cache dashboard
    async function updateCacheDashboard() {
        const status = await getCacheStatus();
        
        if (status.error) {
            cacheStatusValue.textContent = 'Error';
            cacheStatusValue.style.color = '#dc3545';
            cacheAgeValue.textContent = 'Unknown';
            cryptoCountValue.textContent = '0';
            fiatCountValue.textContent = '0';
            
            showCacheRecommendations([
                'Extension may not be loaded on current page',
                'Try refreshing the page or opening a different website',
                'Check if the extension is enabled'
            ]);
            return;
        }

        // Update status
        if (status.isInitialized && status.cacheStatus && status.cacheStatus.isReady) {
            cacheStatusValue.textContent = '✅ Ready';
            cacheStatusValue.style.color = '#28a745';
        } else if (status.isInitializing) {
            cacheStatusValue.textContent = '⏳ Loading';
            cacheStatusValue.style.color = '#ffc107';
        } else {
            cacheStatusValue.textContent = '❌ Not Ready';
            cacheStatusValue.style.color = '#dc3545';
        }

        // Update cache age
        if (status.cacheStatus && status.cacheStatus.lastUpdated) {
            const age = Date.now() - status.cacheStatus.lastUpdated;
            cacheAgeValue.textContent = formatCacheAge(age);
            
            // Color code based on age
            if (age < 3600000) { // < 1 hour
                cacheAgeValue.style.color = '#28a745';
            } else if (age < 7200000) { // < 2 hours
                cacheAgeValue.style.color = '#ffc107';
            } else {
                cacheAgeValue.style.color = '#dc3545';
            }
        } else {
            cacheAgeValue.textContent = 'Never';
            cacheAgeValue.style.color = '#6c757d';
        }

        // Update counts
        if (status.cacheStatus) {
            cryptoCountValue.textContent = status.cacheStatus.cryptoCount || '0';
            fiatCountValue.textContent = status.cacheStatus.fiatCount || '0';
        }

        // Show recommendations if needed
        const recommendations = [];
        if (status.error) {
            recommendations.push('Check API key configuration');
        }
        if (!status.hasApiKey) {
            recommendations.push('Configure API key for better reliability');
        }
        if (status.cacheStatus && status.cacheStatus.isStale) {
            recommendations.push('Cache data is outdated, consider refreshing');
        }

        if (recommendations.length > 0) {
            showCacheRecommendations(recommendations);
        } else {
            hideCacheRecommendations();
        }
    }

    // Function to format cache age
    function formatCacheAge(ageMs) {
        const seconds = Math.floor(ageMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''} ago`;
        } else if (hours > 0) {
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (minutes > 0) {
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else {
            return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
        }
    }

    // Function to show cache recommendations
    function showCacheRecommendations(recommendations) {
        if (recommendations && recommendations.length > 0) {
            recommendationsList.innerHTML = '';
            recommendations.forEach(rec => {
                const li = document.createElement('li');
                li.textContent = rec;
                recommendationsList.appendChild(li);
            });
            cacheRecommendations.style.display = 'block';
        }
    }

    // Function to hide cache recommendations
    function hideCacheRecommendations() {
        cacheRecommendations.style.display = 'none';
    }

    // Function to refresh cache
    async function refreshCache() {
        refreshBtnText.textContent = 'Refreshing...';
        refreshCacheBtn.disabled = true;

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                throw new Error('No active tab found');
            }

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    if (typeof window.extensionInitializer !== 'undefined' && window.extensionInitializer) {
                        return window.extensionInitializer.retryInitialization();
                    } else {
                        throw new Error('Extension initializer not available');
                    }
                }
            });

            // Wait a moment for the refresh to complete
            setTimeout(async () => {
                await updateCacheDashboard();
                refreshBtnText.textContent = 'Refresh Cache';
                refreshCacheBtn.disabled = false;
                
                // Show success message
                showApiStatus('✓ Cache refreshed successfully', false);
                setTimeout(() => hideApiStatus(), 3000);
            }, 2000);

        } catch (error) {
            console.error('Cache refresh failed:', error);
            refreshBtnText.textContent = 'Refresh Cache';
            refreshCacheBtn.disabled = false;
            showApiStatus('⚠ Cache refresh failed: ' + error.message, true);
            setTimeout(() => hideApiStatus(), 5000);
        }
    }

    // Function to clear cache
    async function clearCache() {
        if (!confirm('Are you sure you want to clear the cache? This will remove all cached exchange rates.')) {
            return;
        }

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                throw new Error('No active tab found');
            }

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    if (typeof window.extensionInitializer !== 'undefined' && window.extensionInitializer) {
                        const cacheManager = window.extensionInitializer.getCacheManager();
                        if (cacheManager) {
                            cacheManager.clear();
                            return true;
                        }
                    }
                    return false;
                }
            });

            await updateCacheDashboard();
            showApiStatus('✓ Cache cleared successfully', false);
            setTimeout(() => hideApiStatus(), 3000);

        } catch (error) {
            console.error('Cache clear failed:', error);
            showApiStatus('⚠ Cache clear failed: ' + error.message, true);
            setTimeout(() => hideApiStatus(), 5000);
        }
    }

    // Function to show detailed status modal
    async function showDetailedStatus() {
        const detailedStatus = await getDetailedCacheStatus();
        
        if (!detailedStatus) {
            alert('Detailed status not available. Make sure the extension is loaded on the current page.');
            return;
        }

        // Create modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 24px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const ageInfo = detailedStatus.ageInfo || {};
        const staleness = detailedStatus.staleness || {};

        content.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #2f855a;">Detailed Cache Status</h2>
                <button id="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6c757d;">×</button>
            </div>
            
            <div style="margin-bottom: 16px;">
                <strong>Status:</strong> ${detailedStatus.isReady ? '✅ Ready' : '⏳ Loading'}
            </div>
            
            ${detailedStatus.error ? `
                <div style="margin-bottom: 16px; color: #dc3545;">
                    <strong>Error:</strong> ${detailedStatus.error}
                </div>
            ` : ''}
            
            <div style="margin-bottom: 16px;">
                <strong>Last Updated:</strong> ${ageInfo.humanReadable || 'Never'}
            </div>
            
            <div style="margin-bottom: 16px;">
                <strong>Staleness:</strong> 
                <span style="color: ${staleness.isStale ? '#dc3545' : '#28a745'};">
                    ${staleness.description || 'Fresh'}
                </span>
            </div>
            
            <div style="margin-bottom: 16px;">
                <strong>Crypto Rates:</strong> ${detailedStatus.cryptoCount || 0} currencies
            </div>
            
            <div style="margin-bottom: 20px;">
                <strong>Fiat Rates:</strong> ${detailedStatus.fiatCount || 0} currencies
            </div>
            
            ${detailedStatus.recommendations && detailedStatus.recommendations.length > 0 ? `
                <div style="margin-bottom: 20px;">
                    <strong>Recommendations:</strong>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                        ${detailedStatus.recommendations.map(rec => `
                            <li style="margin-bottom: 4px;">${rec.message}</li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
            
            <div style="text-align: right;">
                <button id="close-modal-btn" style="
                    background: #2f855a;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Close</button>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Close modal handlers
        const closeModal = () => modal.remove();
        content.querySelector('#close-modal').addEventListener('click', closeModal);
        content.querySelector('#close-modal-btn').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    // Event listeners for cache dashboard
    if (refreshCacheBtn) {
        refreshCacheBtn.addEventListener('click', refreshCache);
    }

    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', clearCache);
    }

    if (viewDetailedStatusBtn) {
        viewDetailedStatusBtn.addEventListener('click', showDetailedStatus);
    }

    if (autoRefreshCheckbox) {
        // Load saved auto-refresh preference
        chrome.storage.sync.get(['autoRefreshEnabled'], (result) => {
            autoRefreshCheckbox.checked = result.autoRefreshEnabled !== false; // Default to true
        });

        autoRefreshCheckbox.addEventListener('change', () => {
            chrome.storage.sync.set({ autoRefreshEnabled: autoRefreshCheckbox.checked });
        });
    }

    // Initialize cache dashboard
    updateCacheDashboard();

    // Set up periodic updates
    cacheStatusUpdateInterval = setInterval(updateCacheDashboard, 30000); // Update every 30 seconds

    // Clean up interval when page unloads
    window.addEventListener('beforeunload', () => {
        if (cacheStatusUpdateInterval) {
            clearInterval(cacheStatusUpdateInterval);
        }
    });
}); 