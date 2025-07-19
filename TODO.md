# Extension Improvement Plan (TODO.md)

This file outlines a series of incremental improvements for the Search Popup extension. Each step is designed to be a small, non-breaking change and includes a ready-to-use prompt for a Gemini AI assistant to implement.

---

## 1. UI Enhancements

### Step 1.1: Display Original and Converted Values

**Goal:** Modify the popup to show both the original selected value and the converted result for better context (e.g., "**10 kg** -> **22.05 lbs**").

**Prompt for Gemini:**
"Update the `js/content.js` file to change how conversions are displayed. In the `showAndPositionPopup` function, modify the logic so that the `.converted-value` span shows the original selected text along with the converted value. The format should be: `[Original Text] -> [Converted Value]`. For example, if the user selects '10 kg', the popup should display '10 kg -> 22.0462 lb'."

---

## 2. User Customization (Settings Page)

### Step 2.1: Create the Basic Settings Page HTML

**Goal:** Create a new `settings.html` file and a `js/settings.js` file. This will be the foundation for user-configurable options.

**Prompt for Gemini:**
"Create two new files:
1.  `settings.html`: This file should be a basic HTML page with a title 'Search Popup Settings' and a heading. Include a placeholder `<div>` with an id `settings-container`.
2.  `js/settings.js`: This file can be empty for now.

Then, update `manifest.json` to include an `options_page` entry pointing to `settings.html`."

### Step 2.2: Add Target Currency Setting

**Goal:** Add a dropdown menu in `settings.html` to allow users to select their preferred target currency for conversions.

**Prompt for Gemini:**
"In `settings.html`, add a dropdown menu (a `<select>` element) that allows users to choose their preferred target currency for conversions. The options should include at least: `USD`, `EUR`, `GBP`, `JPY`, and `BGN`. Add a 'Save' button.

In `js/settings.js`, add logic to:
1.  Save the selected currency to `chrome.storage.sync` when the 'Save' button is clicked.
2.  Load and display the currently saved currency preference when the settings page is opened."

### Step 2.3: Implement Target Currency in Content Script

**Goal:** Update the content script to use the user's selected target currency.

**Prompt for Gemini:**
"Modify `js/content.js`. In the `fetchExchangeRates` and `detectAndConvertUnit` functions, update the logic to:
1.  Fetch the user's preferred target currency from `chrome.storage.sync`.
2.  If a preference is set, use it as the target for all fiat currency conversions instead of the hardcoded 'BGN'.
3.  If no preference is set, default to 'BGN' to maintain existing behavior."

---

## 3. Code & Maintainability

### Step 3.1: Refactor `content.js` into Modules

**Goal:** Split the large `js/content.js` file into smaller, more manageable modules to improve organization and maintainability.

**Prompt for Gemini:**
"Refactor the `js/content.js` file by splitting its logic into three separate modules:
1.  `ui.js`: Should contain all functions related to creating, positioning, and styling the popup (`showAndPositionPopup`, `hidePopup`, `applyThemeAndArrow`, etc.).
2.  `api.js`: Should contain all `fetch` calls to external services (`fetchExchangeRates`, `fetchCryptoRates`).
3.  `conversions.js`: Should contain the unit definitions (`unitConversions`, `cryptoCurrencies`) and the conversion logic (`detectAndConvertUnit`).

Update `js/content.js` to import these modules and orchestrate their functionality. **Note:** Since this is a browser extension, you may need to adjust the `manifest.json` to load these scripts correctly or use a bundler like Webpack if you want to use ES6 modules."
