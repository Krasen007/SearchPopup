## Project

A browser extension that shows a context-aware popup when users select text on any webpage. The popup provides smart actions: search, copy, URL detection, unit/currency conversion, and time zone conversion.

**Core Value:** Zero-friction text interaction — select text and instantly perform actions without leaving the page.

## Technology Stack

## Languages
- JavaScript (ES6+) - Extension content scripts and settings logic
- HTML/CSS - Settings page UI (`settings.html`)
## Runtime
- Browser Extension (Chrome/Firefox)
- Manifest Version: 3
- Not applicable (no npm/dependency management)
## Frameworks
- None (Vanilla JavaScript)
- Uses Browser Extension APIs (chrome.storage, clipboard)
- Not detected
- No build system (direct deployment to browser stores)
## Key Dependencies
- None (no external JavaScript dependencies)
- Uses native browser APIs only
- `chrome.storage.sync` - User preferences persistence
- `localStorage` - Exchange rate and crypto price caching
- `navigator.clipboard` - Clipboard operations with fallback
## Configuration
- No environment variables needed
- Preferences stored in `chrome.storage.sync`
- `manifest.json` - Extension manifest (MV3)
- No build configuration files
## Platform Requirements
- Chrome extension developer mode OR Firefox extension debugging
- Chrome Web Store
- Firefox Add-ons

## Conventions

## Naming Patterns
- kebab-case: `content.js`, `settings.js`, `settings.html`
- camelCase: `handleSearchClick()`, `fetchExchangeRates()`, `detectAndConvertUnit()`
- camelCase: `currentSelectedText`, `exchangeRates`, `preferredCurrency`
- Prefix with context: `isUrlSelected`, `isVisible`, `isPageDark`
- UPPER_CASE with grouping: `CONFIG.MAX_SELECTION_LENGTH`, `REGEX_PATTERNS.url`
- Grouped in namespace objects: `CURRENCY_SYMBOLS`, `UNIT_CONVERSIONS`, `CRYPTO_CURRENCIES`
- PascalCase: `PopupManager`, `EventManager`, `ErrorHandler`, `PerformanceValidator`
## Code Style
- 2-space indentation
- Opening brace on same line
- Space after keywords: `if ()`, `for ()`, `function ()`
- No semicolons at end of block (common in this codebase)
- Not detected (no ESLint/Prettier config)
## Import Organization
- Not applicable (no module system, all globals in single file)
- None used
## Error Handling
- Try-catch blocks for async operations
- `ErrorHandler` module for centralized error logging
- Fallback mechanisms for API failures (cache → default)
- Silent handling for cross-origin errors
## Logging
- Context-tagged: `[timestamp] [LEVEL] [context] message`
- Performance tracking: `PerformanceValidator.startTimer()`, `endTimer()`
- User action tracking: `ErrorHandler.logUserAction()`
## Comments
- JSDoc headers for modules and functions
- Section comments for code organization (e.g., `// ===== CONFIGURATION AND CONSTANTS =====`)
- Inline comments for complex logic
- Used in content.js with `@param`, `@returns`, `@namespace`, `@readonly`
- File header documentation describing features and architecture
## Function Design
- Named parameters in logical order
- Destructuring used where appropriate
- Explicit returns
- null for "not found" / "not applicable" cases
## Module Design

## Architecture

## Pattern Overview
- Centralized managers for different concerns (PopupManager, EventManager, ErrorHandler)
- Shadow DOM encapsulation for popup isolation
- Performance-optimized DOM operations with caching and batching
- Async API services with caching and fallback handling
- Clean separation between data services and UI components
## Layers
- Purpose: Centralized state and orchestration
- Location: `js/content.js`
- Contains: `PopupManager`, `EventManager`, `ErrorHandler`, `PerformanceValidator`, `DOMCache`, `PerformanceUtils`
- Depends on: Native browser APIs
- Used by: Event handlers and initialization
- Purpose: External API integration and caching
- Location: `js/content.js`
- Contains: `fetchExchangeRates()`, `fetchCryptoRates()`, conversion functions
- Depends on: Exchange Rate API, CoinGecko API, localStorage
- Used by: Conversion detection engine
- Purpose: Parse and convert units, currencies, time zones
- Location: `js/content.js`
- Contains: `detectAndConvertUnit()`, `convertTimeZone()`, `applyUnitConversion()`, `parseValueAndUnit()`
- Depends on: Data services, UNIT_CONVERSIONS config
- Used by: Popup content display
- Purpose: Popup rendering and user interaction
- Location: `js/content.js`
- Contains: `CSSOptimizer`, `DOMOptimizer`, shadow DOM creation, button handlers
- Depends on: Core managers
- Used by: `showAndPositionPopup()`, `hidePopup()`
- Purpose: User preference management
- Location: `js/settings.js`, `settings.html`
- Contains: Currency/crypto/search engine dropdowns, save functionality
- Depends on: chrome.storage.sync
- Used by: User configuration
## Data Flow
## Key Abstractions
- Purpose: Centralized error management with statistics
- Examples: `js/content.js` (ErrorHandler object)
- Pattern: Module with methods for logging, stats, wrapping functions
- Purpose: Track and validate performance metrics
- Examples: `js/content.js` (PerformanceValidator object)
- Pattern: Metrics collection with percentile calculations
- Purpose: Batch DOM operations for performance
- Examples: `js/content.js` (DOMOptimizer object)
- Pattern: Factory methods returning DocumentFragments
## Entry Points
- Location: `js/content.js`
- Triggers: Page load (automatic via manifest)
- Responsibilities: Initialize all managers, create popup DOM, bind events
- Location: `js/settings.js`
- Triggers: User opens settings.html
- Responsibilities: Populate dropdowns, load/save preferences
## Error Handling
- API errors: Show cached data with notification
- DOM errors: Silently handle cross-origin errors
- Clipboard errors: Fallback to execCommand approach
## Cross-Cutting Concerns