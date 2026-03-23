# Codebase Concerns

**Analysis Date:** 2026-03-23

## Tech Debt

**Large Monolithic File:**
- Issue: Single `js/content.js` file at 2588 lines contains all functionality
- Files: `js/content.js`
- Impact: Difficult to maintain, test, and navigate
- Fix approach: Split into separate modules (services, ui, constants, utils)

**No Test Coverage:**
- Issue: No test files or testing framework present
- Files: Entire codebase
- Impact: No automated regression prevention, fear of refactoring
- Fix approach: Add Jest/Vitest with unit tests for utility functions and conversion logic

**Hardcoded Default Rates:**
- Issue: Exchange rate defaults are hardcoded and may become stale
- Files: `js/content.js` (lines 1219-1222, 1403-1448)
- Impact: Incorrect conversions when API fails and cache expires
- Fix approach: Periodic update mechanism or secondary fallback API

## Known Bugs

**No Known Bugs:**
- No bug reports detected in code comments

## Security Considerations

**CSP Configuration:**
- Risk: Content Security Policy restricts scripts to self only
- Files: `manifest.json`
- Current mitigation: `script-src 'self'; object-src 'self'`
- Recommendations: Consider tightening further for settings page

**API CORS:**
- Risk: API calls rely on CORS-enabled endpoints
- Files: `js/content.js` (fetchExchangeRates, fetchCryptoRates)
- Current mitigation: Fallback to cached data
- Recommendations: Consider proxy or alternative API if CORS blocks

## Performance Bottlenecks

**Regex Compilation:**
- Issue: Dynamic regex patterns constructed at init time
- Files: `js/content.js` (REGEX_PATTERNS.initDynamicPatterns)
- Cause: Patterns rebuilt from currency symbols on every page load
- Improvement path: Pre-compile more patterns statically

**DOM Cache Initialization:**
- Issue: DOMCache.init() runs at module load time
- Files: `js/content.js` (line 2586)
- Cause: Creates DOM references before popup is needed
- Improvement path: Lazy initialization on first selection

## Fragile Areas

**API Rate Limiting:**
- Files: `js/content.js` (fetchExchangeRates, fetchCryptoRates)
- Why fragile: Free APIs have strict rate limits (CoinGecko: 10-30 calls/min)
- Safe modification: Add more aggressive caching, exponential backoff
- Test coverage: None

**Cross-Origin Iframes:**
- Files: `js/content.js` (PopupManager.handleMouseUp)
- Why fragile: Selection API throws errors in cross-origin contexts
- Safe modification: Error handler already catches these silently
- Test coverage: None

## Scaling Limits

**LocalStorage Caching:**
- Current capacity: ~5MB typical
- Limit: Cached rates stored as JSON strings
- Scaling path: Implement cache eviction, use IndexedDB for larger data

## Dependencies at Risk

**Exchange Rate API:**
- Risk: Free tier may be deprecated or rate-limited heavily
- Impact: Currency conversion stops working
- Migration plan: Alternative: `https://open.er-api.com/v6/latest/EUR` (free, no key)

**CoinGecko API:**
- Risk: Free tier has low rate limits (10-30/min), may change without notice
- Impact: Crypto conversion fails frequently
- Migration plan: Alternative: Binance API, CoinCap API

## Missing Critical Features

**Unit Tests:**
- Problem: No automated testing
- Blocks: Safe refactoring, feature development confidence

**Type Safety:**
- Problem: Plain JavaScript with no type checking
- Blocks: Refactoring safety, IDE support

**Build System:**
- Problem: No bundler/minifier
- Blocks: Code splitting, tree shaking, optimization

## Test Coverage Gaps

**Conversion Functions:**
- What's not tested: All unit conversion logic
- Files: `js/content.js` (detectAndConvertUnit, applyUnitConversion, parseValueAndUnit)
- Risk: Edge cases in parsing (fractions, different number formats) could silently fail
- Priority: High

**API Error Handling:**
- What's not tested: Error paths, fallback mechanisms
- Files: `js/content.js` (fetchExchangeRates, fetchCryptoRates)
- Risk: API failures not handled gracefully in all scenarios
- Priority: High

**Popup Positioning:**
- What's not tested: Edge cases in popup positioning near viewport edges
- Files: `js/content.js` (calculatePopupPosition)
- Risk: Popup may render off-screen on unusual screen configurations
- Priority: Medium

---

*Concerns audit: 2026-03-23*
