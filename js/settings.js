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
}); 