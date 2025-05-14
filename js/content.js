// Content script for handling text selection and popup display

// --- Global variable to store the currently selected text ---
let currentSelectedText = '';

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
`;
document.head.appendChild(styleElement);

// --- Create the popup element (once) ---
const popup = document.createElement('div');
popup.id = 'text-selection-popup-extension'; // ID is used by CSS

// --- Create popup content (once) ---
popup.innerHTML = `
    <div style="display: flex; flex-direction: row; gap: 8px; justify-content: space-between;">
        <button id="extensionSearchButton" class="extension-action-button">Search</button>
        <button id="extensionCopyButton" class="extension-action-button">Copy</button>
    </div>
`;
document.body.appendChild(popup);

// --- Helper function to handle clipboard fallback for copying text ---
function handleClipboardFallback(textToCopy) {
    const textArea = document.createElement('textarea');
    textArea.value = textToCopy;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            console.log('Fallback: Text copied to clipboard.');
        } else {
            console.error('Fallback: Unable to copy text.');
        }
    } catch (err) {
        console.error('Fallback: Error copying text.', err);
    }
    document.body.removeChild(textArea);
    hidePopup();
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

// --- Initialize button event listeners (called once on script load) ---
function initPopupButtons() {
    const searchButton = document.getElementById('extensionSearchButton');
    const copyButton = document.getElementById('extensionCopyButton');

    if (searchButton) {
        searchButton.addEventListener('click', () => {
            if (currentSelectedText) {
                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(currentSelectedText)}`;
                window.open(searchUrl, '_blank');
                hidePopup();
            }
        });
    }

    if (copyButton) {
        copyButton.addEventListener('click', () => {
            if (currentSelectedText) {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(currentSelectedText)
                        .then(() => {
                            console.log('Text copied to clipboard via Clipboard API.');
                            hidePopup();
                        })
                        .catch(err => {
                            console.warn('Async clipboard API failed, trying fallback:', err);
                            handleClipboardFallback(currentSelectedText);
                        });
                } else {
                    console.warn('Async clipboard API not available, using fallback.');
                    handleClipboardFallback(currentSelectedText);
                }
            }
        });
    }
}

// --- Function to show and position the popup ---
function showAndPositionPopup(rect, selectionContextElement) {
    popup.style.opacity = '0';
    popup.style.display = 'block';

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
        } else {
            hidePopup();
        }
    } else if (!popup.contains(e.target)) {
        hidePopup();
    }
});

document.addEventListener('mousedown', function (e) {
    if (popup.style.display === 'block' && !popup.contains(e.target)) {
        const selection = window.getSelection();
        if (selection && selection.isCollapsed) {
            hidePopup();
        }
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