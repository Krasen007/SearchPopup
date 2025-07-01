# Search Popup Extension for Text Selection

A modern browser extension that displays a smart popup menu when you select text on any webpage. Instantly search, copy, or convert selected text—including units and currencies—right from the popup. The extension adapts its theme to match the page (light/dark) and works on all websites.

## Features

- **Contextual Popup:** Appears when you select text on any webpage.
- **Quick Actions:**
  - **Search:** Instantly search Google for the selected text or visit a detected website.
  - **Copy:** Copy the selected text to your clipboard with robust fallback handling.
- **Unit & Currency Conversion:**
  - Detects and converts common units (kg, lb, mph, km, etc.) and currencies (USD, EUR, GBP, etc.)
  - Supports both period and comma as decimal separators (e.g., `569,00€` or `569.00€`)
- **URL Detection:** Recognizes website addresses in your selection and offers to visit them directly.
- **Adaptive Theming:** Popup automatically switches between light and dark mode based on the underlying page background for optimal readability.
- **Dynamic Positioning:** Popup appears above or below the selection with an arrow, always within the viewport.
- **Auto-hide on Scroll/Resize:** Disappears smoothly to avoid obstructing content.
- **Lightweight & Efficient:** Minimal impact on page performance.

![Light mode popup](img/light.png)
![Dark mode popup](img/dark.png)

## Installation

1. **Download the Extension Files:**
   - Clone or download and extract the repo.
2. **Open Chrome Extensions Page:**
   - Go to `chrome://extensions` in your browser.
3. **Enable Developer Mode:**
   - Toggle "Developer mode" on (top right).
4. **Load Unpacked Extension:**
   - Click "Load unpacked" and select the folder containing `manifest.json`.
5. **Done!**
   - The extension is now active and ready to use.

Works on all Chromium-based browsers (Chrome, Vivaldi, Edge, Brave, etc.).

---

## Advanced Features
- **Clipboard Fallback:** Uses modern Clipboard API with fallback for maximum compatibility.
- **Exchange Rate Caching:** Currency rates are cached and updated daily for fast, offline-friendly conversion.
- **Locale-aware Number Parsing:** Handles both `1,234.56` and `1.234,56` formats.

## Roadmap / TODO
- Option to pick default search engine or add a settings page
- Option to select favorite or local currency
- Time zone conversion

---

*Portions of this app were created using various AI tools!*

## Tested Browsers
- Vivaldi 7.4