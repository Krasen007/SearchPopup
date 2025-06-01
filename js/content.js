// Content script for handling text selection and popup display
// Copyright 2025 Krasen Ivanov

// --- Global variable to store the currently selected text ---
let currentSelectedText = '';
let isUrlSelected = false;
let convertedValue = null;

// --- Unit conversion definitions ---
const unitConversions = {
    // Weight
    'lb': { to: 'kg', factor: 0.45359237 },
    'kg': { to: 'lb', factor: 2.20462262 },
    'oz': { to: 'g', factor: 28.3495231 },
    'g': { to: 'oz', factor: 0.0352739619 },
    
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

// --- Helper function to detect and convert units ---
function detectAndConvertUnit(text) {
    // Match pattern: number (including fractions) followed by unit with optional space
    const pattern = /(-?\d*\.?\d+(?:\/\d+)?)\s*([a-zA-Z°\/]+(?:\s+[a-zA-Z]+)?)/;
    const match = text.trim().match(pattern);
    
    if (!match) return null;
    
    let value = match[1];
    const unit = match[2].toLowerCase();
    
    // Handle fractions
    if (value.includes('/')) {
        const [numerator, denominator] = value.split('/');
        value = parseFloat(numerator) / parseFloat(denominator);
    } else {
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
        if (key.toLowerCase() === unit) {
            let converted;
            if (conversion.convert) {
                converted = conversion.convert(value);
            } else {
                converted = value * conversion.factor;
            }
            
            // Round to 4 decimal places for display
            converted = Math.round(converted * 10000) / 10000;
            
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
        font-family: Arial, sans-serif; /* Added: Explicit font family for buttons */
        font-size: 12px;               /* Explicit font size for buttons */
        font-weight: normal;           /* Added: Prevent font-weight inheritance */
        font-style: normal;            /* Added: Prevent font-style inheritance */
        line-height: 1.4;              /* Added: Consistent line height for button text */
        text-transform: none;          /* Added: Prevent text-transform inheritance */
        letter-spacing: normal;        /* Added: Prevent letter-spacing inheritance */
        text-align: center;
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
        console.log('Text copied to clipboard via Clipboard API.');
        hidePopup();
    } catch (err) {
        console.warn('Clipboard API failed, trying fallback:', err);
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
            console.log('Text copied to clipboard via fallback method.');
        } catch (err) {
            console.error('All clipboard methods failed:', err);
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
                            console.warn('Blocked non-HTTP/HTTPS URL:', url);
                            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(currentSelectedText)}`;
                            window.open(searchUrl, '_blank');
                        }
                    } catch (e) {
                        console.warn('Invalid URL detected, falling back to search:', e);
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

    if (selectedTextTrimmed) {
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

// --- Initialize ---
initPopupButtons();