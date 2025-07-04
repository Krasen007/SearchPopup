// Content script for handling text selection and popup display
// Copyright 2025 Krasen Ivanov

// --- Production mode flag ---
const IS_PRODUCTION = true; // Set to false for debugging

// --- Debug logging utility ---
function debugLog(level, message, ...args) {
    if (!IS_PRODUCTION) {
        switch (level) {
            case 'log':
                console.log(message, ...args);
                break;
            case 'warn':
                console.warn(message, ...args);
                break;
            case 'error':
                console.error(message, ...args);
                break;
        }
    }
}

// --- Global variable to store the currently selected text ---
let currentSelectedText = '';
let isUrlSelected = false;
let convertedValue = null;

// --- Input validation constants ---
const MAX_SELECTION_LENGTH = 10000; // Maximum characters for text selection
const MIN_SELECTION_LENGTH = 1;     // Minimum characters for text selection

// --- Currency exchange rates cache ---
let exchangeRates = {
    // Store as Unix epoch (ms) to survive JSON serialisation
    lastUpdated: 0,
    rates: {
        // Default rates will be populated from API
        EUR: 1.95583, // Default EUR to BGN rate
        USD: 1.8,     // Default USD to BGN rate
        GBP: 2.3      // Default GBP to BGN rate
    }
};

// --- Rate limiting for API calls ---
let apiCallAttempts = 0;
const MAX_API_ATTEMPTS = 3;
const BASE_RETRY_DELAY = 1000; // 1 second

// Currency symbols mapping
const currencySymbols = {
    'EUR': '€',
    'USD': '$',
    'GBP': '£',
    'JPY': '¥',
    'CNY': '¥',
    'INR': '₹',
    'RUB': '₽',
    'KRW': '₩',
    'TRY': '₺',
    'BRL': 'R$',
    'ZAR': 'R',
    'MXN': '$',
    'SGD': 'S$',
    'HKD': 'HK$',
    'NZD': 'NZ$',
    'SEK': 'kr',
    'NOK': 'kr',
    'DKK': 'kr',
    'PLN': 'zł',
    'CHF': 'Fr',
    'CAD': 'C$',
    'AUD': 'A$',
    'ILS': '₪',
    'RON': 'lei',
    'HUF': 'Ft',
    'CZK': 'Kč',
    'PHP': '₱',
    'THB': '฿',
    'IDR': 'Rp',
    'MYR': 'RM',
    'BGN': 'лв'
};

// --- Unit conversion definitions ---
const unitConversions = {
    // Weight
    'lb': { to: 'kg', factor: 0.45359237 },
    'lbs': { to: 'kg', factor: 0.45359237 },
    'kg': { to: 'lb', factor: 2.20462262 },
    'oz': { to: 'g', factor: 28.3495231 },
    'g': { to: 'oz', factor: 0.0352739619 },

    //Currency - will be populated dynamically
    'EUR': { to: 'BGN', convert: (val) => val * exchangeRates.rates.EUR },
    '€': { to: 'BGN', convert: (val) => val * exchangeRates.rates.EUR },
    'USD': { to: 'BGN', convert: (val) => val * exchangeRates.rates.USD },
    '$': { to: 'BGN', convert: (val) => val * exchangeRates.rates.USD },
    'GBP': { to: 'BGN', convert: (val) => val * exchangeRates.rates.GBP },
    '£': { to: 'BGN', convert: (val) => val * exchangeRates.rates.GBP },

    // Temperature
    '°F': { to: '°C', convert: (val) => (val - 32) * 5/9 },
    '°C': { to: '°F', convert: (val) => (val * 9/5) + 32 },
    
    // Cooking Measurements
    'cup': { to: 'ml', factor: 236.588 },
    'cups': { to: 'ml', factor: 236.588 },
    'tbsp': { to: 'ml', factor: 14.7868 },
    'tbsp.': { to: 'ml', factor: 14.7868 },
    'tbsps': { to: 'ml', factor: 14.7868 },
    'tsp': { to: 'ml', factor: 4.92892 },
    'tsp.': { to: 'ml', factor: 4.92892 },
    'tsps': { to: 'ml', factor: 4.92892 },
    'fl oz': { to: 'ml', factor: 29.5735 },
    'pint': { to: 'ml', factor: 473.176 },
    'pints': { to: 'ml', factor: 473.176 },
    'quart': { to: 'ml', factor: 946.353 },
    'quarts': { to: 'ml', factor: 946.353 },
    'gallon': { to: 'ml', factor: 3785.41 },
    'gallons': { to: 'ml', factor: 3785.41 },
    
    // Speed
    'mph': { to: 'km/h', factor: 1.609344 },
    'km/h': { to: 'mph', factor: 0.621371192 },
    'mpg': { to: 'l/100km', convert: (val) => 235.214583 / val },
    'l/100km': { to: 'mpg', convert: (val) => 235.214583 / val },
    
    // Volume
    'gal': { to: 'l', factor: 3.78541178 },
    'l': { to: 'gal', factor: 0.264172052 },
    'qt': { to: 'l', factor: 0.946352946 },
    'fl': { to: 'ml', factor: 29.5735295625 },
    'ml': { to: 'fl', factor: 0.0338140227 },
    
    // Distance
    'mi': { to: 'km', factor: 1.609344 },
    'km': { to: 'mi', factor: 0.621371192 },
    'yd': { to: 'm', factor: 0.9144 },
    'm': { to: 'yd', factor: 1.0936133 },
    'ft': { to: 'm', factor: 0.3048 },
    'in': { to: 'cm', factor: 2.54 },
    'cm': { to: 'in', factor: 0.393700787 },
    'mm': { to: 'in', factor: 0.0393700787 },
    
    // Power
    'kW': { to: 'hp', factor: 1.34102209 },
    'hp': { to: 'kW', factor: 0.745699872 },
    
    // Torque
    'lb ft': { to: 'Nm', factor: 1.35581795 },
    'Nm': { to: 'lb ft', factor: 0.737562149 }
};

// --- Helper function to fetch exchange rates ---
async function fetchExchangeRates() {
    // Check if we need to update rates (once per day)
    const now = Date.now();
    if (exchangeRates.lastUpdated && 
        now - exchangeRates.lastUpdated < 24 * 60 * 60 * 1000) {
        return; // Use cached rates if less than 24 hours old
    }

    // Rate limiting check
    if (apiCallAttempts >= MAX_API_ATTEMPTS) {
        debugLog('warn', 'Maximum API attempts reached, using cached data');
        return;
    }

    try {
        apiCallAttempts++;
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Validate the response data structure
        if (!data || !data.rates || typeof data.rates !== 'object') {
            throw new Error('Invalid response format from exchange rate API');
        }
        
        // Reset API attempts on success
        apiCallAttempts = 0;
        
        // Update rates (converting to BGN)
        exchangeRates.rates = {};
        for (const [currency, rate] of Object.entries(data.rates)) {
            if (typeof rate !== 'number' || isNaN(rate)) {
                debugLog('warn', `Skipping invalid rate for ${currency}:`, rate);
                continue;
            }
            
            if (currency !== 'EUR') {
                exchangeRates.rates[currency] = data.rates.BGN / rate;
            } else {
                exchangeRates.rates[currency] = data.rates.BGN;
            }
            
            // Add currency conversion to unitConversions
            if (currency !== 'BGN') {
                unitConversions[currency] = {
                    to: 'BGN',
                    convert: (val) => val * exchangeRates.rates[currency]
                };
                
                // Add symbol conversion if available
                if (currencySymbols[currency]) {
                    unitConversions[currencySymbols[currency]] = {
                        to: 'BGN',
                        convert: (val) => val * exchangeRates.rates[currency]
                    };
                }
            }
        }
        
        exchangeRates.lastUpdated = now;   // store epoch ms
        
        // Save to localStorage
        try {
            localStorage.setItem('exchangeRates', JSON.stringify(exchangeRates));
        } catch (storageError) {
            debugLog('warn', 'Failed to save exchange rates to localStorage:', storageError);
        }
    } catch (error) {
        debugLog('warn', 'Failed to fetch exchange rates:', error);
        
        // Exponential backoff for retries
        if (apiCallAttempts < MAX_API_ATTEMPTS) {
            const retryDelay = BASE_RETRY_DELAY * Math.pow(2, apiCallAttempts - 1);
            debugLog('warn', `Retrying in ${retryDelay}ms (attempt ${apiCallAttempts}/${MAX_API_ATTEMPTS})`);
            setTimeout(() => fetchExchangeRates(), retryDelay);
            return; // Exit early to prevent fallback execution during retry attempts
        }
        
        // Load from localStorage if available (only when max retries reached)
        try {
            const cached = localStorage.getItem('exchangeRates');
            if (cached) {
                const parsed = JSON.parse(cached);
                
                // Validate cached data structure
                if (parsed && typeof parsed === 'object' && 
                    parsed.rates && typeof parsed.rates === 'object' &&
                    parsed.lastUpdated && typeof parsed.lastUpdated === 'number') {
                    
                    // Validate that the cached data is not too old (more than 7 days)
                    const now = Date.now();
                    const cacheAge = now - parsed.lastUpdated;
                    const maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
                    
                    if (cacheAge < maxCacheAge) {
                        exchangeRates = parsed;
                        debugLog('log', 'Loaded exchange rates from cache');
                    } else {
                        debugLog('warn', 'Cached exchange rates are too old, using defaults');
                        // Reset to default rates
                        exchangeRates = {
                            lastUpdated: 0, // Force refresh on next call
                            rates: {
                                EUR: 1.95583,
                                USD: 1.8,
                                GBP: 2.3
                            }
                        };
                    }
                } else {
                    debugLog('warn', 'Invalid cached exchange rates format, using defaults');
                    // Reset to default rates
                    exchangeRates = {
                        lastUpdated: 0, // Force refresh on next call
                        rates: {
                            EUR: 1.95583,
                            USD: 1.8,
                            GBP: 2.3
                        }
                    };
                }
            }
        } catch (parseError) {
            debugLog('warn', 'Failed to parse cached exchange rates:', parseError);
            // Reset to default rates
            exchangeRates = {
                lastUpdated: 0, // Force refresh on next call
                rates: {
                    EUR: 1.95583,
                    USD: 1.8,
                    GBP: 2.3
                }
            };
        }
    }
}

// --- Helper function to detect and convert units ---
function detectAndConvertUnit(text) {
    // Match pattern: number (including fractions) followed by unit with optional space
    // Updated pattern to handle currency symbols before or after the number
    // Allow both comma and period as decimal separators
    // Allow trailing punctuation like periods, commas, etc.
    const valueUnitPattern = /^(-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+\/\d+)\s*([a-zA-Z°\/€$£]+(?:\s+[a-zA-Z]+)?)[.,;:!?]*$/i;
    const unitValuePattern = /^([a-zA-Z°\/€$£]+(?:\s+[a-zA-Z]+)?)\s*(-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+\/\d+)[.,;:!?]*$/i;
    
    const valueUnitMatch = text.trim().match(valueUnitPattern);
    const unitValueMatch = text.trim().match(unitValuePattern);
    
    if (!valueUnitMatch && !unitValueMatch) return null;
    
    let value, unit;
    
    // Check if currency symbol is before or after the number
    if (valueUnitMatch) {
        value = valueUnitMatch[1];
        unit = valueUnitMatch[2];
    } else if (unitValueMatch) {
        value = unitValueMatch[2];
        unit = unitValueMatch[1];
    } else {
        return null;
    }
    
    // Handle fractions
    if (value.includes('/')) {
        const [numerator, denominator] = value.split('/');
        value = parseFloat(numerator.replace(',', '.')) / parseFloat(denominator.replace(',', '.'));
    } else {
        // Normalize value: remove thousands separators, replace comma with period for decimal
        value = value.replace(/\.(?=\d{3}(\D|$))/g, ''); // Remove thousands sep (dot)
        value = value.replace(/,(?=\d{3}(\D|$))/g, '');   // Remove thousands sep (comma)
        value = value.replace(',', '.'); // Replace decimal comma with period
        value = parseFloat(value);
    }
    
    // Special case for temperature without F suffix
    if (unit === '°') {
        return {
            original: `${value}°`,
            converted: `${((value - 32) * 5/9).toFixed(1)}°C`,
            value: (value - 32) * 5/9
        };
    }
    
    // Find matching unit conversion
    for (const [key, conversion] of Object.entries(unitConversions)) {
        if (key.toLowerCase() === unit.toLowerCase()) {
            let converted;
            if (conversion.convert) {
                converted = conversion.convert(value);
            } else {
                converted = value * conversion.factor;
            }
            
            // Round to 2 decimal places for currency, 4 for other units
            const decimals = key.match(/[€$£]/) ? 2 : 4;
            converted = Math.round(converted * Math.pow(10, decimals)) / Math.pow(10, decimals);
            
            return {
                original: `${value} ${key}`,
                converted: `${converted} ${conversion.to}`,
                value: converted
            };
        }
    }
    
    return null;
}

// --- Add styles to document head (once) ---
const styleElement = document.createElement('style');
styleElement.textContent = `
    #text-selection-popup-extension {
        position: fixed;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 4px;
        display: none;
        opacity: 0;
        width: 160px; /* Explicit width */
        font-family: Arial, sans-serif; /* Explicit font family */
        font-size: 14px;               /* Explicit font size for popup container text */
        font-weight: normal;           /* Added: Prevent font-weight inheritance */
        font-style: normal;            /* Added: Prevent font-style inheritance */
        line-height: 1.4;              /* Added: Consistent line height */
        text-transform: none;          /* Added: Prevent text-transform inheritance */
        letter-spacing: normal;        /* Added: Prevent letter-spacing inheritance */
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 2147483647;
        transition: opacity 0.2s ease-in-out, background-color 0.2s ease-in-out, border-color 0.2s ease-in-out;
        box-sizing: border-box; /* Ensures padding/border don't expand width */
    }

    /* Arrow Base Styling */
    #text-selection-popup-extension::before, /* Top arrow */
    #text-selection-popup-extension::after { /* Bottom arrow */
        content: '';
        position: absolute;
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        display: none; 
        transition: border-top-color 0.2s ease-in-out, border-bottom-color 0.2s ease-in-out;
    }

    /* Bottom Arrow (when popup is ABOVE selection, arrow points down from popup) */
    #text-selection-popup-extension.arrow-bottom::after {
        display: block;
        bottom: -8px; 
        left: 50%;
        transform: translateX(-50%);
        border-top: 8px solid white; 
    }

    /* Top Arrow (when popup is BELOW selection, arrow points up from popup) */
    #text-selection-popup-extension.arrow-top::before {
        display: block;
        top: -8px; 
        left: 50%;
        transform: translateX(-50%);
        border-bottom: 8px solid white; 
    }

    /* Dark Mode Base */
    #text-selection-popup-extension.dark-mode {
        background: #333333;
        border-color: #555555;
        color: #FFFFFF; 
    }

    /* Dark Mode Arrow Adjustments */
    #text-selection-popup-extension.dark-mode.arrow-bottom::after {
        border-top-color: #333333; 
    }

    #text-selection-popup-extension.dark-mode.arrow-top::before {
        border-bottom-color: #333333; 
    }

    /* Button Base Styles */
    .extension-action-button {
        flex: 1;
        padding: 3px 10px;
        border: none;
        border-radius: 5px;
        background-color: #AAAAAA; 
        color: white;
        cursor: pointer;
        transition: background-color 0.2s;
        font-family: Arial, sans-serif;
        font-size: 12px;
        font-weight: normal;
        font-style: normal;
        line-height: 1.4;
        text-transform: none;
        letter-spacing: normal;
        text-align: center;
        white-space: nowrap; /* Prevent text wrapping */        
    }

    .extension-action-button:hover {
        background-color: #AAAAAA; 
    }

    /* Dark Mode Button Styles */
    #text-selection-popup-extension.dark-mode .extension-action-button {
        background-color: #555555; 
        color: #FFFFFF;
    }

    #text-selection-popup-extension.dark-mode .extension-action-button:hover {
        background-color: #6E6E6E; 
    }

    .conversion-result {
        padding: 4px 8px;
        margin: 4px 0;
        background: #f5f5f5;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .conversion-result:hover {
        background: #e5e5e5;
    }

    .conversion-result .copy-button {
        display: none;
        float: right;
        padding: 2px 6px;
        font-size: 12px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
    }

    .conversion-result:hover .copy-button {
        display: inline-block;
    }

    /* Dark mode styles for conversion */
    #text-selection-popup-extension.dark-mode .conversion-result {
        background: #444;
        color: #fff;
    }

    #text-selection-popup-extension.dark-mode .conversion-result:hover {
        background: #555;
    }
`;
document.head.appendChild(styleElement);

// --- Create the popup element (once) ---
const popup = document.createElement('div');
popup.id = 'text-selection-popup-extension'; // ID is used by CSS

// --- Create popup content (once) ---
popup.innerHTML = `
    <div id="conversionContainer" style="display: none;">
        <div class="conversion-result">
            <span class="converted-value"></span>
            <button class="copy-button">Copy</button>
        </div>
    </div>
    <div style="display: flex; flex-direction: row; gap: 8px; justify-content: space-between;">
        <button id="extensionSearchButton" class="extension-action-button">Search</button>
        <button id="extensionCopyButton" class="extension-action-button">Copy</button>
    </div>
`;
document.body.appendChild(popup);

// --- Helper function to handle clipboard fallback for copying text ---
async function handleClipboardFallback(textToCopy) {
    try {
        // Try using the modern Clipboard API first
        await navigator.clipboard.writeText(textToCopy);
        debugLog('log', 'Text copied to clipboard via Clipboard API.');
        hidePopup();
    } catch (err) {
        debugLog('warn', 'Clipboard API failed, trying fallback:', err);
        // Fallback to a more modern approach using a temporary input
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            // Try using the modern Clipboard API with the selected text
            await navigator.clipboard.writeText(textArea.value);
            debugLog('log', 'Text copied to clipboard via fallback method.');
        } catch (err) {
            debugLog('error', 'All clipboard methods failed:', err);
        } finally {
            document.body.removeChild(textArea);
            hidePopup();
        }
    }
}

// --- Theme and Background Detection Helpers (from previous robust version) ---
function isEffectivelyTransparent(colorString) {
    if (!colorString) return true;
    const lowerColorString = colorString.toLowerCase();
    if (lowerColorString === 'transparent') return true;
    const match = lowerColorString.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (match) {
        const alpha = parseFloat(match[4]);
        return alpha <= 0.05;
    }
    return false;
}

function getEffectiveBackgroundColor(element) {
    let currentElement = element;
    if (currentElement && currentElement.nodeType === Node.TEXT_NODE) {
        currentElement = currentElement.parentElement;
    }
    while (currentElement) {
        if (!(currentElement instanceof Element)) {
            currentElement = currentElement.parentElement;
            continue;
        }
        const computedStyle = window.getComputedStyle(currentElement);
        const bgColor = computedStyle.backgroundColor;
        if (!isEffectivelyTransparent(bgColor)) {
            return bgColor;
        }
        if (currentElement === document.body || currentElement === document.documentElement) {
            break;
        }
        currentElement = currentElement.parentElement;
    }
    let finalBgColor = window.getComputedStyle(document.body).backgroundColor;
    if (!isEffectivelyTransparent(finalBgColor)) return finalBgColor;
    finalBgColor = window.getComputedStyle(document.documentElement).backgroundColor;
    if (!isEffectivelyTransparent(finalBgColor)) return finalBgColor;
    return 'rgb(255, 255, 255)'; // Absolute fallback
}

function isColorDark(colorString) {
    if (isEffectivelyTransparent(colorString)) return false;
    let r, g, b;
    const lowerColorString = colorString.toLowerCase();
    if (lowerColorString.startsWith('rgb')) {
        const match = lowerColorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
        if (!match) return false;
        [r, g, b] = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    } else if (lowerColorString.startsWith('#')) {
        let hex = lowerColorString.slice(1);
        if (hex.length === 3) hex = hex.split('').map(char => char + char).join('');
        if (hex.length !== 6) return false;
        [r, g, b] = [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
    } else {
        const tempElem = document.createElement('div');
        tempElem.style.color = lowerColorString;
        document.body.appendChild(tempElem);
        const computedColor = window.getComputedStyle(tempElem).color;
        document.body.removeChild(tempElem);
        if (!computedColor.startsWith('rgb')) return false;
        const match = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!match) return false;
        [r, g, b] = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    }
    const luminance = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
    return luminance < 0.5;
}

/**
 * Applies theme and arrow classes to the popup.
 * @param {boolean} isPageDark - True if the page background is dark.
 * @param {boolean} isPopupBelowSelection - True if the popup is positioned below the selection.
 */
function applyThemeAndArrow(isPageDark, isPopupBelowSelection) {
    popup.classList.toggle('dark-mode', isPageDark);
    if (isPopupBelowSelection) {
        popup.classList.add('arrow-top');
        popup.classList.remove('arrow-bottom');
    } else {
        popup.classList.add('arrow-bottom');
        popup.classList.remove('arrow-top');
    }
}

// --- Helper function to detect URLs in text ---
function detectUrl(text) {
    // More comprehensive URL pattern
    const urlPattern = /^(https?:\/\/)?(([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)(\/[^\s]*)?$/;
    
    return urlPattern.test(text);
}

// --- Helper function to format URL ---
function formatUrl(text) {
    if (!text.startsWith('http://') && !text.startsWith('https://')) {
        return 'https://' + text;
    }
    return text;
}

// --- Initialize button event listeners (called once on script load) ---
function initPopupButtons() {
    const searchButton = document.getElementById('extensionSearchButton');
    const copyButton = document.getElementById('extensionCopyButton');
    const conversionContainer = document.getElementById('conversionContainer');
    const convertedValueSpan = conversionContainer.querySelector('.converted-value');
    const copyConvertedButton = conversionContainer.querySelector('.copy-button');

    if (searchButton) {
        searchButton.addEventListener('click', () => {
            if (currentSelectedText) {
                if (isUrlSelected) {
                    const url = formatUrl(currentSelectedText);
                    try {
                        const urlObj = new URL(url);
                        if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
                            window.open(url, '_blank');
                        } else {
                            debugLog('warn', 'Blocked non-HTTP/HTTPS URL:', url);
                            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(currentSelectedText)}`;
                            window.open(searchUrl, '_blank');
                        }
                    } catch (e) {
                        debugLog('warn', 'Invalid URL detected, falling back to search:', e);
                        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(currentSelectedText)}`;
                        window.open(searchUrl, '_blank');
                    }
                } else {
                    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(currentSelectedText)}`;
                    window.open(searchUrl, '_blank');
                }
                hidePopup();
            }
        });
    }

    if (copyButton) {
        copyButton.addEventListener('click', () => {
            if (currentSelectedText) {
                handleClipboardFallback(currentSelectedText);
            }
        });
    }

    if (copyConvertedButton) {
        copyConvertedButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (convertedValue) {
                handleClipboardFallback(convertedValue.converted);
            }
        });
    }
}

// --- Function to show and position the popup ---
function showAndPositionPopup(rect, selectionContextElement) {
    popup.style.opacity = '0';
    popup.style.display = 'block';

    // Check for unit conversion
    const conversionContainer = document.getElementById('conversionContainer');
    const convertedValueSpan = conversionContainer.querySelector('.converted-value');
    convertedValue = detectAndConvertUnit(currentSelectedText);

    if (convertedValue) {
        conversionContainer.style.display = 'block';
        convertedValueSpan.textContent = convertedValue.converted;
    } else {
        conversionContainer.style.display = 'none';
    }

    // Update button text based on URL detection
    const searchButton = document.getElementById('extensionSearchButton');
    isUrlSelected = detectUrl(currentSelectedText);
    if (searchButton) {
        searchButton.textContent = isUrlSelected ? 'Visit website' : 'Search';
    }

    const popupHeight = popup.offsetHeight;
    const popupWidth = popup.offsetWidth;
    const margin = 10; // Margin from viewport edges
    const arrowGap = 10; // Gap between selection and popup (includes arrow height)

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const selectionCenterX = rect.left + (rect.width / 2);

    let top, left;
    let isPopupBelow = false; // Flag to track popup position relative to selection

    // Try to position popup above the selection
    top = rect.top - popupHeight - arrowGap;
    left = selectionCenterX - (popupWidth / 2);

    // If positioning above makes it go off-screen (or not enough margin), position below
    if (top < margin) {
        top = rect.bottom + arrowGap;
        isPopupBelow = true;
    }

    // Adjust horizontal position to keep popup within viewport
    left = Math.max(margin, Math.min(left, viewportWidth - popupWidth - margin));

    // Final check to ensure popup stays within viewport vertically
    top = Math.max(margin, Math.min(top, viewportHeight - popupHeight - margin));

    // If clamping 'top' changed its relation to selection, re-evaluate isPopupBelow
    if (!isPopupBelow && top > rect.bottom) isPopupBelow = true;
    if (isPopupBelow && top < rect.top - popupHeight) isPopupBelow = false;


    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;

    // Determine background and apply theme/arrow
    const pageBackgroundColor = getEffectiveBackgroundColor(selectionContextElement);
    const isPageDark = isColorDark(pageBackgroundColor);
    applyThemeAndArrow(isPageDark, isPopupBelow);

    requestAnimationFrame(() => {
        popup.style.opacity = '1'; // Fade in
    });
}

// --- Function to hide the popup with fade-out ---
let hidePopupTimeout;
const HIDE_DELAY = 3000; // 3 seconds delay before hiding popup
function hidePopup() {
    popup.style.opacity = '0';
    clearTimeout(hidePopupTimeout);
    hidePopupTimeout = setTimeout(() => {
        popup.style.display = 'none';
        popup.classList.remove('arrow-top', 'arrow-bottom');
    }, 200);
}

// --- Global Event Listeners ---
document.addEventListener('mouseup', function (e) {
    if (popup.contains(e.target)) {
        return;
    }
    const selection = window.getSelection();
    const selectedTextTrimmed = selection.toString().trim();

    // Validate selection length
    if (selectedTextTrimmed && 
        selectedTextTrimmed.length >= MIN_SELECTION_LENGTH && 
        selectedTextTrimmed.length <= MAX_SELECTION_LENGTH) {
        
        currentSelectedText = selectedTextTrimmed;
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
            showAndPositionPopup(rect, range.commonAncestorContainer);
            // Set selection complete flag after a short delay to allow for mouse movement
            setTimeout(() => {
                isSelectionComplete = true;
                // Start the hide timer
                hidePopupTimeout = setTimeout(() => {
                    hidePopup();
                }, HIDE_DELAY);
            }, 100);
        } else {
            hidePopup();
        }
    } else if (!popup.contains(e.target)) {
        hidePopup();
    }
});

// Reset selection complete flag when selection changes
document.addEventListener('mousedown', function (e) {
    isSelectionComplete = false;
    clearTimeout(hidePopupTimeout); // Clear any existing timer
    if (popup.style.display === 'block' && !popup.contains(e.target)) {
        hidePopup();
    }
});

window.addEventListener('scroll', () => {
    if (popup.style.opacity === '1') {
        hidePopup();
    }
}, true);

window.addEventListener('resize', () => {
    if (popup.style.opacity === '1') {
        hidePopup();
    }
});

// --- Global error handler ---
window.addEventListener('error', function(event) {
    debugLog('error', 'Global error caught:', event.error);
    // Prevent error from bubbling up
    event.preventDefault();
    return false;
});

window.addEventListener('unhandledrejection', function(event) {
    debugLog('error', 'Unhandled promise rejection:', event.reason);
    // Prevent error from bubbling up
    event.preventDefault();
    return false;
});

// --- Initialize ---
initPopupButtons();
fetchExchangeRates(); // Fetch exchange rates on startup