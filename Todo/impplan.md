# Implementation Plan: Context-Aware Popup Extension

**Date:** 2026-03-24
**Status:** Planning Phase

---

## Executive Summary

This plan addresses all concerns identified in `CONCERNS.md` with a phased approach prioritizing high-impact, low-risk fixes first. Total estimated effort: **4-6 weeks** for a full implementation.

---

## Phase 1: Immediate High-Priority Fixes (Week 1)

### 1.1 Add Unit Tests - Critical Path
**Goal:** Establish testing infrastructure and cover core conversion logic

**Tasks:**
- [ ] Initialize Jest/Vitest with TypeScript support
- [ ] Create test utilities for mocking browser APIs
- [ ] Write tests for `parseValueAndUnit()` - all edge cases (decimals, scientific notation, currency symbols, negative numbers)
- [ ] Write tests for `detectAndConvertUnit()` - unit detection logic
- [ ] Write tests for `applyUnitConversion()` - conversion accuracy
- [ ] Write tests for `convertTimeZone()` - time zone conversion
- [ ] Write tests for `fetchExchangeRates()` error handling and fallback
- [ ] Write tests for `fetchCryptoRates()` error handling and fallback
- [ ] Write tests for `calculatePopupPosition()` edge cases (viewport boundaries)

**Deliverables:**
- `tests/` directory with test files
- CI integration (GitHub Actions)
- Minimum 70% test coverage on core logic

### 1.2 Add TypeScript - Safety Net
**Goal:** Add type safety for refactoring confidence

**Tasks:**
- [ ] Initialize TypeScript configuration
- [ ] Add type definitions for browser APIs (chrome.storage, clipboard, etc.)
- [ ] Add types for config objects (UNIT_CONVERSIONS, CURRENCY_SYMBOLS)
- [ ] Add types for API response objects
- [ ] Add types for all functions and classes
- [ ] Run tsc checks and fix all errors
- [ ] Add @ts-expect-error where needed for API inconsistencies

**Deliverables:**
- `tsconfig.json`
- `tests/tsconfig.json`
- Zero TypeScript errors
- Improved IDE autocomplete

---

## Phase 2: API Reliability & Performance (Week 2)

### 2.1 Secondary API Fallbacks
**Goal:** Eliminate dependency on single API providers

**Tasks:**
- [ ] Replace Exchange Rate API with open.er-api
  - Configure multiple endpoints for redundancy
  - Implement automatic failover
  - Add cache invalidation strategy
- [ ] Replace CoinGecko with Binance/CoinCap API
  - Implement multiple API key configurations
  - Add request rotation for rate limit compliance
  - Handle different API response formats
- [ ] Add exponential backoff retry logic (max 3 retries, 2s exponential backoff)
- [ ] Implement cache eviction for IndexedDB (LRU policy)
- [ ] Add network status detection (offline detection)

**Deliverables:**
- Updated API service layer with fallback chain
- 99.9% uptime for conversion features
- Reduced rate limit dependency

### 2.2 Performance Optimizations
**Goal:** Reduce load time and improve responsiveness

**Tasks:**
- [ ] Pre-compile static regex patterns (EUR, USD, GBP, etc.)
- [ ] Implement lazy DOM cache initialization
- [ ] Add debounce for repeated conversions (500ms)
- [ ] Add request deduplication (same URL = skip)
- [ ] Optimize popup positioning algorithm
- [ ] Profile and fix DOM operation bottlenecks

**Deliverables:**
- 30% reduction in initial load time
- Sub-millisecond conversion latency
- No popup off-screen rendering

---

## Phase 3: Architecture Refactoring (Weeks 3-4)

### 3.1 Module Split
**Goal:** Reduce monolithic file from 2588 lines to manageable chunks

**Tasks:**
- [ ] Create `js/services/` directory
  - `currencyService.ts` - Exchange rate logic
  - `cryptoService.ts` - Crypto rate logic
  - `conversionService.ts` - Unit/currency/timezone conversion
- [ ] Create `js/utils/` directory
  - `validators.ts` - Input validation utilities
  - `caching.ts` - Cache management utilities
  - `api.ts` - Network request utilities
  - `index.ts` - Index all utils
- [ ] Create `js/constants/` directory
  - `config.ts` - Extension configuration
  - `symbols.ts` - Currency symbols and unit conversions
  - `patterns.ts` - Regex patterns
  - `index.ts` - Index all constants
- [ ] Create `js/ui/` directory
  - `popupManager.ts` - Popup lifecycle
  - `popupStyles.ts` - Shadow DOM styles
  - `popupHTML.ts` - Popup template (separate file)
  - `buttonHandlers.ts` - Event handlers
- [ ] Refactor `js/content.js` to use new modules
  - Remove all functionality
  - Add imports
  - Initialize modules
- [ ] Update `js/settings.js` to use TypeScript

**Deliverables:**
- `js/` directory with organized modules
- `js/content.ts` (reduced to ~150 lines)
- Improved code readability and maintainability

---

## Phase 4: Security & Edge Cases (Week 5)

### 4.1 Security Hardening
**Goal:** Tighten security posture

**Tasks:**
- [ ] Update CSP for settings page (add trusted sources)
- [ ] Add Content Security Policy header to all API requests
- [ ] Validate all user inputs (sanitize currency amounts, units)
- [ ] Add request signature for API calls (optional)
- [ ] Implement secure storage for API keys (encrypted)

**Deliverables:**
- Hardened CSP configuration
- Input validation layer
- Improved security audit score

### 4.2 Edge Case Handling
**Goal:** Handle all possible error and edge conditions

**Tasks:**
- [ ] Handle cross-origin iframe selection errors more gracefully
- [ ] Add fallback for blocked popups (user gesture required)
- [ ] Handle popup blocked by browser settings
- [ ] Add graceful degradation for missing popup button
- [ ] Handle keyboard navigation (Tab, Escape)
- [ ] Add accessibility features (ARIA labels, keyboard shortcuts)
- [ ] Test with screen readers

**Deliverables:**
- Improved error recovery
- Better accessibility score
- User-friendly error messages

---

## Phase 5: Build System & Deployment (Week 6)

### 5.1 Build System Setup
**Goal:** Enable code optimization and deployment

**Tasks:**
- [ ] Set up esbuild/babel for bundling
- [ ] Add minification (terser)
- [ ] Add code splitting (lazy load popup)
- [ ] Add tree shaking (remove unused code)
- [ ] Add sourcemap generation
- [ ] Create release workflow (GitHub Actions)

**Deliverables:**
- Optimized production bundle
- Source maps for debugging
- Automated deployment workflow

---

## Phase 6: Documentation & Release (Week 7)

### 6.1 Documentation
**Goal:** Complete project documentation

**Tasks:**
- [ ] Update `README.md` with new features and improvements
- [ ] Create `docs/` directory for API reference
- [ ] Add code comments to TypeScript files
- [ ] Write user guide for settings page
- [ ] Create changelog (CHANGELOG.md)

### 6.2 Release Preparation
**Goal:** Ready for production release

**Tasks:**
- [ ] Update `manifest.json` with new version
- [ ] Generate new icon (PNG, ICO, WebP)
- [ ] Update `MARKETING_COPY.md` with improvements
- [ ] Prepare Chrome/Firefox store listings
- [ ] Security scan (dependency scanning)
- [ ] Final testing across browsers

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| API key changes during migration | Medium | High | Test both APIs side-by-side |
| Browser extension store rejection | Medium | High | Follow store policies, test thoroughly |
| Breaking changes in browser APIs | Low | High | Test in multiple browsers |
| TypeScript compatibility issues | Low | Medium | Use permissive config initially |
| Build system conflicts | Low | Medium | Test with existing dependencies |

---

## Success Metrics

After Phase 1:
- [ ] 70%+ test coverage on core logic
- [ ] Zero TypeScript errors
- [ ] All edge cases documented

After Phase 2:
- [ ] 99.9% API uptime
- [ ] <100ms conversion latency
- [ ] No popup off-screen rendering

After Phase 3:
- [ ] `js/content.ts` <200 lines
- [ ] All functionality modularized
- [ ] Code review-friendly structure

After Phase 4:
- [ ] Security audit passes
- [ ] Accessibility score >90
- [ ] All error paths handled

After Phase 5:
- [ ] Production bundle <50KB gzipped
- [ ] Automated deployment working
- [ ] Source maps available

After Phase 6:
- [ ] All documentation complete
- [ ] Ready for production release
- [ ] Changelog updated

---

## Timeline

| Phase | Weeks | Key Deliverables |
|-------|-------|------------------|
| Phase 1 | 1 | Tests, TypeScript |
| Phase 2 | 1 | API fallbacks, performance |
| Phase 3 | 2 | Module split |
| Phase 4 | 1 | Security, edge cases |
| Phase 5 | 1 | Build system |
| Phase 6 | 1 | Documentation, release |

---

## Next Steps

1. **Approve plan** - Review and sign off
2. **Set up development environment** - Install dependencies
3. **Begin Phase 1** - Write tests first, they drive architecture
4. **Daily standups** - 15min sync to track progress

---

**Note:** This plan assumes 20-30 hours/week development time. Adjust timeline based on actual capacity.

**Status:** Awaiting approval to begin implementation.
