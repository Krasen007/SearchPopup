# Project: Search Popup
A browser extension that displays a popup when text is selected on a webpage. The popup provides options to search, copy, or convert the selected text.

## Features
- **Search:** Search the selected text on a search engine (Google, DuckDuckGo, etc.).
- **Copy:** Copy the selected text to the clipboard.
- **Unit Conversion:** Automatically detect and convert units of measurement (e.g., kg to lb, °C to °F).
- **Currency Conversion:** Convert amounts between different currencies using real-time exchange rates.
- **Cryptocurrency Conversion:** Convert amounts between different cryptocurrencies.
- **URL Detection:** Detects if the selected text is a URL and provides an option to visit it.
- **Customization:** Users can set their preferred target currency, crypto currency, and search engine via a settings page.
- **Dark Mode:** The popup adapts its theme based on the underlying page's background color.

## Tech Stack
- **Languages:** JavaScript
- **Platform:** Browser Extension (Chrome Manifest V3)
- **APIs:** exchangerate-api.com for currency rates, coingecko.com for crypto rates.

## Structure
- `manifest.json`: The core configuration file for the browser extension.
- `js/content.js`: The main script that runs on web pages, handles text selection, and displays the popup.
- `js/settings.js`: The script for the settings page.
- `settings.html`: The HTML for the extension's settings page.
- `img/`: Contains the extension's icons and other images.

## Architecture
The extension is built around a content script (`js/content.js`) that is injected into every webpage. This script listens for `mouseup` events to detect when the user has selected text. When a selection is made, it creates and displays a popup (`div`) near the selected text. The popup contains buttons for searching and copying. The script also performs unit, currency, and crypto conversions on the selected text and displays the result in the popup. The extension's settings are managed through a dedicated `settings.html` page and its corresponding `js/settings.js` script, which save user preferences to `chrome.storage.sync`.

## Commands
- **Build:** N/A (No build process)
- **Test:** N/A (No testing framework)
- **Lint:** N/A (No linter configured)
- **Dev/Run:** Load the extension in the browser's developer mode.

## Testing
There is no automated testing setup. To test:
1. Load the extension into the browser.
2. Open any webpage.
3. Select text to trigger the popup.
4. Verify that the search, copy, and conversion features work as expected.
5. Open the settings page from the extension's options and verify that changing settings (e.g., preferred currency) is reflected in the popup's behavior.
