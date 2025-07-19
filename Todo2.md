# Extension Improvement Plan (TODO.md)

This file outlines a series of incremental improvements for the Search Popup extension, based on the project roadmap. Each step is designed to be a small, non-breaking change and includes a ready-to-use prompt for a Gemini AI assistant to implement.

---

## 1. User Experience & Customization

This section focuses on giving users more control over how the extension looks and behaves.

### Step 1.1: Display Original and Converted Values

**Goal:** Modify the popup to show both the original selected value and the converted result for better context (e.g., "**10 kg** -> **22.05 lbs**").

**Prompt for Gemini:**
"Update the `js/content.js` file to change how conversions are displayed. In the `showAndPositionPopup` function, modify the logic so that the `.converted-value` span shows the original selected text along with the converted value. The format should be: `[Original Text] -> [Converted Value]`. For example, if the user selects '10 kg', the popup should display '10 kg -> 22.0462 lb'."

### Step 1.2: Show Exchange Rate Used

**Goal:** When a currency is converted, display the exchange rate that was used for the calculation.

**Prompt for Gemini:**
"Update the popup's UI in `js/content.js`. When a currency conversion is displayed, add a new line below the result showing the exchange rate used. For example: '10 USD -> 8.95 EUR' on the first line, and 'Rate: 1 USD = 0.895 EUR' on a smaller, second line. This information should only appear for currency conversions."

<!-- ### Step 1.3: Create the Basic Settings Page

**Goal:** Create the `settings.html` and `js/settings.js` files that will be the foundation for user-configurable options.

**Prompt for Gemini:**
"Create two new files:
1.  `settings.html`: This file should be a basic HTML page with a title 'Search Popup Settings' and a heading. Include a placeholder `<div id="settings-container"></div>`.
2.  `js/settings.js`: This file can be empty for now.

Then, update `manifest.json` to include an `options_page` entry pointing to `settings.html`."

### Step 1.4: Add and Implement Target Currency Setting

**Goal:** Add a dropdown in `settings.html` for users to select their target currency and make the extension use it.

**Prompt for Gemini:**
"First, in `settings.html`, add a dropdown menu (`<select>`) for choosing a preferred target currency. Options should include `USD`, `EUR`, `GBP`, `JPY`, `CAD`, `AUD`, and `BGN`. Add a 'Save' button. In `js/settings.js`, save the selection to `chrome.storage.sync` and load the saved value when the page opens.

Second, modify `js/content.js` to fetch this preferred currency from `chrome.storage.sync`. Use it as the target for all fiat currency conversions instead of the hardcoded 'BGN'. Default to 'BGN' if no preference is set." -->

<!-- ### Step 1.5: Add Search Engine Selection

**Goal:** Allow users to choose their default search engine in the settings.

**Prompt for Gemini:**
"In `settings.html`, add a dropdown menu (`<select>`)  to allow users to select a search engine (Google, DuckDuckGo, Bing). In `js/settings.js`, save this choice to `chrome.storage.sync`. In `js/content.js`, retrieve the saved choice and use it to construct the search URL when the user clicks the search button. Default to Google if no setting is saved." -->

### Step 1.6: Add Modifier Key for Activation

**Goal:** Add an option to only trigger the popup when a modifier key (e.g., Alt) is held down during text selection.

**Prompt for Gemini:**
"First, add a checkbox to `settings.html` with the label 'Only show popup when holding Alt key while selecting text'. Save its state to `chrome.storage.sync` using `js/settings.js`.

Second, in `js/content.js`, check for this setting. If it's enabled, modify the 'mouseup' event listener to only trigger the popup logic if the `altKey` property of the event is `true`."

### Step 1.7: Enable/Disable Conversion Categories

**Goal:** Allow users to turn off conversion categories they don't need (e.g., cooking measurements).

**Prompt for Gemini:**
"In `settings.html`, add a section with checkboxes for each major conversion category (e.g., 'Currency', 'Measurements', 'Data Units', 'Time Zones'). In `js/settings.js`, save the state of these checkboxes to `chrome.storage.sync`. In `js/content.js`, before attempting a conversion, check the saved settings. If a category is disabled, skip the detection logic for that category."

---

## 2. New Features & Functionality

This section focuses on expanding the core capabilities of the extension.

<!-- ### Step 2.1: Add New Conversion Types

**Goal:** Add support for converting time zones.

**Prompt for Gemini:**
"Update `js/content.js` to include new detection and conversion logic for the following types:
1.  **Time Zones:** Recognize patterns like '5 PM PST' or '14:00 EST' and convert them to the user's local time. -->


### Step 2.2: Implement Multi-Currency View

**Goal:** Show the equivalent of a selected currency in several major currencies simultaneously.

**Prompt for Gemini:**
"Modify the conversion logic in `js/content.js`. When a currency is detected (e.g., '10 USD'), instead of converting to a single target, display its equivalent in a list of 3-4 major currencies (e.g., EUR, GBP, JPY) in the popup."

### Step 2.3: Add Conversion History

**Goal:** Add a small tab or button in the popup to show a list of recent conversions.

**Prompt for Gemini:**
"Modify the popup UI logic in `js/content.js`. Each time a successful conversion is made, store it in `chrome.storage.local` (as an array of the last 5 conversions). Add a small 'History' button to the popup. When clicked, it should show a list of these recent conversions, with a button next to each to copy the result to the clipboard."

---

## 3. Performance & Reliability

This section focuses on making the extension faster and more resilient.

### Step 3.1: Implement Smarter Caching

**Goal:** Pre-load exchange rates and show stale data while fetching updates to make conversions feel instant.

**Prompt for Gemini:**
"Update the currency conversion logic in `js/content.js` (or `api.js`) to implement a smarter caching strategy:
1.  **Pre-fetching:** Use the `chrome.alarms` API to fetch exchange rates periodically (e.g., every 4 hours) in the background so they are ready for the first use.
2.  **Stale-While-Revalidate:** When a conversion is requested, if the cached rates are old, immediately perform the conversion with the old (stale) data and show it. Simultaneously, fetch the new rates in the background. Once the new rates arrive, silently update the value in the popup."

### Step 3.2: Add User-Friendly Error Handling

**Goal:** If an API call fails, display a helpful error message instead of failing silently.

**Prompt for Gemini:**
"In `js/content.js` (or `api.js`), add error handling to the `fetch` calls for exchange rates. In the `.catch` block, if an API call fails, instead of just logging to the console, update the popup's UI to display a user-friendly error like 'Could not fetch latest rates. Please try again later.'."

---

## 4. Code & Maintainability

This section is for improving the codebase to make it easier to maintain and build upon.

### Step 4.1: Refactor `content.js` into Modules

**Goal:** Split the large `js/content.js` file into smaller, more manageable modules.

**Prompt for Gemini:**
"Refactor the `js/content.js` file by splitting its logic into three separate modules:
1.  `ui.js`: Should contain all functions related to creating, positioning, and managing the popup's HTML.
2.  `api.js`: Should contain all `fetch` calls to external services.
3.  `conversions.js`: Should contain all unit definitions and conversion logic.

Update `js/content.js` to import and orchestrate these modules. Modify `manifest.json` to declare these new scripts as content scripts so they are loaded correctly."

### Step 4.2: Introduce a Build Process

**Goal:** Add a simple build tool like Vite or Webpack to minify production code and enable modern JavaScript features.

**Prompt for Gemini:**
"Set up a basic build process for this Chrome extension using Vite. The goal is to:
1.  Allow the use of ES6 `import`/`export` syntax across the `js/` files.
2.  Automatically bundle and minify the JavaScript files (`content.js`, `settings.js`, etc.) into a `dist/` directory.
3.  Generate a `manifest.json` in the `dist/` directory that points to the bundled scripts.
Provide the necessary `package.json` and `vite.config.js` files and explain the updated development workflow."