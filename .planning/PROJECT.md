# PROJECT.md

**Project Name:** SearchPopup Extension  
**Type:** Browser Extension (Chrome/Firefox/Edge)  
**Mode:** Interactive  

## What This Is

A browser extension that shows a context-aware popup when users select text on any webpage. The popup provides smart actions: search, copy, URL detection, unit/currency conversion, and time zone conversion.

## Core Value

Zero-friction text interaction — select text and instantly perform actions without leaving the page.

## Context

- **Existing codebase:** Yes (Manifest V3 browser extension)
- **Technology:** Vanilla JavaScript, Shadow DOM, Chrome Storage API
- **Current state:** Working extension with multiple features
- **Goal:** Identify and fix bugs/issues

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Focus on bug fixing | User wants to find and fix issues in existing codebase | — Pending |

## Requirements

### Validated

- ✓ Text selection detection and popup display
- ✓ Search action (Google, DuckDuckGo, Bing)
- ✓ Copy to clipboard with fallback
- ✓ URL detection and visit action
- ✓ Unit conversion (weight, temperature, speed, volume, distance, power, torque)
- ✓ Currency conversion (100+ currencies via Exchange Rate API)
- ✓ Cryptocurrency conversion (via CoinGecko API)
- ✓ Time zone conversion
- ✓ Adaptive light/dark theme
- ✓ Settings page with preferences
- ✓ Performance monitoring and caching

### Active

- [ ] Identify and document current bugs/issues in the codebase

### Out of Scope

- New feature development (until bugs are addressed)
- Architecture refactoring (unless required for bug fixes)

---

*Last updated: 2026-03-23 after initialization*