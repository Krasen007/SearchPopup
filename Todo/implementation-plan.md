# Implementation Plan — SearchPopup

**Status:** executing — Phase 0 settled; Phases 1–2 merged to `main` (`78c7610`); Phases 3–4 executed (2026-09-13)
**Anchoring:** current `js/content.js` on `main`, tag `1.79.0`, plus `ai-slop-report.md`
**Anchoring (2026-09-13 update):** taste audit against `Todo/tasteful-software-guide.md` — adds feature-selection and instrumentation findings on top of the hygiene report
**Goal:** keep the product’s core interaction and defaults, then remove or fix the parts that currently reduce coherence and taste.

---

## What we are optimizing for

Two reviews feed this plan, and they have different natures:

1. **AI slop report — hygiene.** It mixes items already reflected in the codebase, items described as fixed but not yet reflected in `js/content.js`, items pending author decision, and items that are false positives or intentional. Every item must be re-verified against the live code, not applied blindly.
2. **Taste audit — selection and instrumentation.** Verdict: the core interaction (select text → two-button popup → act) is tasteful and passes the guide. What drifts is the surface and the system:
   - features added because they *could* be added: the crypto conversion system, full-zone time-zone depth, cooking units, 8 search engines, and two identical 48-code dropdowns;
   - a performance/observability layer that partially performs for an audience of zero: write-only metric arrays, “optimization theater,” and user-action logging on a no-tracking product;
   - failure copy and loading behavior that add clutter to a 3-second popup instead of staying quiet.

So the focus is taste-forward:
- resolve the report/code mismatch first,
- settle feature cuts and instrumentation cuts as *author decisions* (Phase 0), not code momentum,
- reduce hidden failure that still pollutes the default path silently,
- make the cache behavior coherent and honest,
- trim inert plumbing without touching the user-facing core interaction.

---

## Non-goals

- Do not broaden the feature set.
- Do not add settings just because they can be added — and do not turn removals into new settings.
- Do not split the file unless there is a strong coherence reason.
- Do not over-instrument the extension in a way that conflicts with its privacy story.
- Do not treat the AI slop report as a to-do list without re-verifying each item against current code.
- Do not perform feature cuts or instrumentation removals without explicit author sign-off (Phase 0).

---

## Phase 0 — taste decisions (author sign-off required, mandatory before cuts)

The taste audit’s highest-value findings are **selection** decisions, not code fixes. The guide’s rule: if a feature cannot clearly pass necessity, externalities, coherence, calibration, and omission, it does not get built (or kept). Each decision below carries the audit position and needs an explicit author answer before any corresponding cut is executed.

| # | Decision | Options | Audit position | Author |
|---|---|---|---|---|
| D1 | Crypto conversion system (`CRYPTO_CURRENCIES`, `fetchCryptoRates`, SATS/BITS, CoinGecko API, the BGN-via-EUR path) | keep whole / keep a one-line lean version / remove | remove or reduce; it is the largest non-core system in the file | **Keep as-is** (2026-09-13) |
| D2 | Time-zone conversion depth (full zone names and date strings, e.g. `6.30pm BST`) | keep full / abbreviations only / remove | keep the compact `5 PM PST` / `6.30pm BST` case only | **Keep full** (2026-09-13) |
| D3 | Search engine list in settings (8 engines) | keep / curate to 2–3 | curate; one opinionated default plus one alternate is the tasteful shape | **Keep all 8** (2026-09-13) |
| D4 | Crypto target-currency dropdown (identical 48-code fiat list incl. obsolete `VEF`) | keep / curate to supported quote currencies | curate; duplicated full lists are a catalog, not a choice | **Curate crypto dropdown** (2026-09-13) |
| D5 | `HIDE_DELAY` 3-second auto-hide | keep / drop / extend on hover | decide deliberately; a popup that vanishes mid-mouse-move is the most *felt* default | **Keep + extend on hover** (2026-09-13) |
| D6 | Machine error copy inside the 160px popup (`errorContainer`) | keep / one calm “offline” state / remove | remove, or collapse to one short honest offline state | **One calm state** (2026-09-13) |
| D7 | `handleCurrencyLoading` await-before-popup + “Loading exchange rates…” | keep / next-selection fallback / non-blocking | the popup must never wait on the network to appear | **Non-blocking** (2026-09-13) |
| D8 | Performance system (`PerformanceValidator` metrics, `CSSOptimizer`/`DOMOptimizer` theater, `logUserAction` accounting) | keep all / keep `DOMCache` + show-debounce only | keep `DOMCache` and the 80ms show debounce; remove the write-only recorders | **Keep DOMCache + debounce only** (2026-09-13) |

**Rule of the phase:** for each item, a “no clear affirmative answer” to *is it essential / what does it cost / is it coherent / is it the right amount / what are we not building* means the item is cut, not kept.

**Status (2026-09-13):** all decisions settled — D1–D8 and cooking units answered; see the Author column.

---

## Phase 1 — correctness/coherence repair on the cache path

This is a high-value taste issue. The product promises quiet, offline-resilient, correct conversions, and the cache path is not fully coherent with that promise. **Scope:** D1 settled as *keep whole*, so the crypto-cache items below apply in full alongside the exchange-rate items.

**1.1** Fix the stale-cache-vs-quote-currency coherence gap.
- Current behavior under audit:
  - `validateAndLoadCryptoCache(fetchVs)` rejects caches whose `vsCurrency` does not match the requested `fetchVsLocal`.
  - After a successful fetch, `cryptoRates.vsCurrency = fetchVs` is stored.
  - Crypto fetch is short-circuited when `cryptoRates.lastUpdated` is fresh enough.
- Remaining coherence worry:
  - if the user changes preferred crypto quote currency, the short-circuit can reuse a recent but quote-currency-mismatched cache.
- What coherent should mean:
  - cache is only used if it is both fresh enough and matches the current requested quote currency,
  - a quote-currency preference change explicitly invalidates the crypto cache,
  - the refresh path is honest about whether it used a cache or a live fetch.

**1.2** Make freshness and backoff rules explicit and consistent.
- Current code has `CONFIG.CRYPTO_CACHE_DURATION`, `CONFIG.CRYPTO_ERROR_BACKOFF_MS`, and a fresh-cache short-circuit.
- What is not fully clear:
  - how error backoff interacts with cached data,
  - when a failed fetch should reuse the previous cache,
  - whether stale-cache reuse is gated by more than `lastUpdated`.
- Target state:
  - one clear rule for “can we use cache”,
  - one clear rule for “did the fetch fail and should we back off”,
  - no overlapping freshness checks that read as retrofitted.

**1.3** Keep the crypto storage failure path visible and contained.
- The current `localStorage.setItem("cryptoRates", ...)` path already has a storage catch with `ErrorHandler.log(storageError, "crypto-rates-storage", "warn")`.
- That should stay.
- Taste discipline still needed:
  - storage failure must not masquerade as a successful response in error reporting,
  - refresh retry budget must not be consumed by storage failures,
  - exchange-rate storage path should stay symmetric.

**1.4** Apply the exchange-rate refresh re-render policy (decision D7 settled: non-blocking).
- The popup appears immediately using whatever is cached — a selection never waits on `handleCurrencyLoading` / `fetchExchangeRates`.
- The visible “Loading exchange rates...” state is removed; when rates arrive, the popup re-renders the conversion if it is still visible (guarded by `PopupManager.isVisible` and unchanged `currentSelectedText`).
- The existing `isRefreshingExchangeRates` guard stays so the background refresh cannot trigger nested re-conversion.

---

## Phase 2 — error-signal discipline for the important internal paths

Global error suppression may be the right choice for cross-origin noise. Taste is about which silences are deliberate.

**2.1** Keep the privacy-friendly global silence, but make important internal failures observable.
- Current code already has:
  - `handleCurrencyLoading` logging under `"exchange-rates-refresh"`,
  - `handleClipboardFallback` using `ErrorHandler.handleDomError(..., true)`,
  - two timezone catch paths that should log.
- The taste question is not whether to log everything. It is whether the failures that affect the default conversion/response behavior leave enough signal to understand them later without making the product noisy.

**2.2** Normalize the silent-catch set.
- If a catch is a deliberate graceful fallback or near-unreachable, it should still leave a trace if it ever fires in production.
- “Silent unless something is already wrong” can become a coherence problem over time.

**2.3** Do not introduce a new observability surface that breaks the privacy posture.
- Keep logging internal and bounded.
- Do not add user-facing error chatter unless there is a clear reason.

---

## Phase 3 — mechanical cleanup of inert plumbing

Do this after Phase 1 and Phase 2, because some of it depends on knowing which failure paths remain.

**3.1** Remove dead guards, dead branches, and unreachable helpers if they still exist.
- The report describes a Phase 1 cleanup that removed several of these.
- Before doing more, verify what actually remains in the live code today.
- If the Phase 1 items are already gone, do not re-apply them.

**3.2** Deduplicate duplicated regex or data literals if they still exist.
- Report mentions:
  - duplicated currency-like detection regex,
  - duplicated “reset to default rates” object literal.
- If current code already uses `REGEX_PATTERNS.currencyLike` and a shared reset helper, this phase is mostly verification, not new work.

**3.3** Trim comments that restate the code.
- Keep section banners if they help orientation.
- Remove comments that only describe what the next line already says.
- This is taste, not vanity: the file should not read like it is defending itself.

**3.4** Avoid splitting `content.js` right now.
- The report flags file length.
- A monolithic content script is not automatically a smell if the module boundaries are coherent and the file is not carrying unrelated concerns.
- Do not split for its own sake. Split only if there is a clear boundary that reduces cognitive load and improves the default narrative of the code.

**3.5** Remove the duplicated `isPopupTarget` method in `PopupManager`.
- Defined twice in `js/content.js` (around lines 1005 and 1090); the later property wins, so it is harmless but dead. Verify, then delete one copy.

**3.6** Resolve the `l/100km` / `mpg` no-op branches (slop report F7, still open).
- Provably no-op. Either delete the branches or confirm they are intentional and comment why — do not leave an undecided branch in the live file.
- **Outcome (2026-09-13):** resolved by verification — the live file has no no-op branches. The only `mpg`/`l/100km` code is the `UNIT_CONVERSIONS` pair at lines 455–456, which performs real conversions (factor `235.214583 / val`). F7's concern no longer applies to the current revision.

**3.7** Collapse the performance system (decision D8 settled: keep DOMCache + show-debounce only).
- Remove `PerformanceValidator` and its write-only metric recorders (`startTimer` / `endTimer` / `recordMetric`) plus every call site that only feeds them (e.g. in `PopupManager.show`, `detectAndConvertUnit`).
- Replace `CSSOptimizer.generateCSS()`’s array-of-lines CSS with the plain static string it produces — same output, less ceremony.
- Remove `ErrorHandler.logUserAction` and its call sites — a no-tracking product does not log every popup show.
- Keep: `DOMCache`, the 80ms show debounce, throttled scroll, debounced resize, and the batched style updates that genuinely reduce layout thrash in positioning.

---

## Phase 4 — default-and-omission hygiene

This is where taste shows up most directly.

**4.1** Re-check the defaults against the README promise.
- README emphasizes:
  - zero-friction selection,
  - adaptive theming,
  - smart caching,
  - API resilience,
  - no tracking,
  - offline-friendly conversions.
- The product should not accidentally advertise a quiet, resilient experience while hiding a cache-path inconsistency.

**4.2** Make the crypto quote-currency change an explicit cache-invalidation event.
- If the user changes preferred crypto currency, that should be a first-class reason to treat the previous crypto cache as not applicable.
- This avoids a class of “works sometimes, not other times” behavior that is bad for both trust and taste.

**4.3** Decide what the empty state and loading states should be.
- For a popup tool, the empty and loading states are part of the first ten seconds.
- D7 settled the currency loading state (removed — popup is non-blocking, see 1.4). This item covers the remaining states.
- Avoid inventing new states unless they serve the core interaction.
- Prefer calm, short, honest states over clever ones.

**4.4** Settle `HIDE_DELAY` deliberately (decision D5 settled: keep + extend on hover).
- Keep the 3s auto-hide, but the timer must not fire while the mouse is still travelling toward the popup: hovering over the popup cancels/extends the timer, and leaving resets it.
- Implementation note: the shadow host is set to `pointer-events: auto` when shown, so `mouseenter`/`mouseleave` on the popup can drive `PopupManager.cancelAutoHide()` / `scheduleAutoHide()`.
- Escape / click-outside / mouse-down-outside remain the explicit hide paths.

**4.5** Curate the settings dropdowns (decision D4 settled: curate the crypto dropdown).
- Crypto-currency dropdown: limit to quote currencies the product actually supports — remove obsolete/unsupported codes such as `VEF`. No silent empty conversions.
- Fiat dropdown: stays as-is (not curated under this decision).

**4.6** Right-size the popup error state (decision D6 settled: one calm state).
- The only message the popup may ever show is “Conversions unavailable — using cached data”.
- All machine detail (“Rate limit exceeded…”, “HTTP 403…”, cache-parse failures) stays in the failure-path log (`ErrorHandler`) — never rendered into `errorContainer`.
- `updatePopupContent` maps every failure mode to the single calm string, and still suppresses the error line when the selection is not conversion-like.

**4.7** Make documentation match the product (decision D3 and README/listing claims).
- The README’s “100+ currencies,” “cutting-edge performance,” and “micro-interactions” claims should describe what the product actually is after the Phase 3/4 changes (no feature cuts — D1/D2/5.3 all *keep*).
- Update `README.md` and `STORE_LISTING_CHROME.md` in the same pass as the Phase 3/4 changes, not later.

---

## Phase 5 — feature reduction (executes the Phase 0 decisions)

**Status:** all feature decisions settled as *keep* (D1, D2, cooking units). No feature removals remain; this section records the outcome so Phases 1–4 don’t re-litigate them.

**5.1** Crypto conversion system — **not executed** (D1 settled as *keep whole*).
- No crypto removal. The crypto-cache coherence work in Phase 1 (1.1–1.3) and Phase 4 (4.2) stands in its place.

**5.2** Time-zone conversion depth — **not executed** (D2 settled as *keep full*).
- No removal of full zone names or date-string handling. The time-zone failure-path fixes in Phase 2 and gate V4 remain in scope.

**5.3** Cooking units — **not executed** (author decision 2026-09-13: keep as-is).
- `tbsp`, `tsp`, `cup`, `pint`, `quart`, `gallon`, `fluid ounce`, and similar stay as part of the full unit-conversion story.

---

## Verification gates

**V1 — syntax**
- `node --check js/content.js` passes after every code change.

**V2 — no regressions in the core interaction**
- Select text with a URL → popup offers “Visit website”.
- Select text without a URL → popup offers “Search”.
- Click Copy → text lands on clipboard, popup fades.
- On a dark-themed page, popup appears in dark mode with correct arrow placement.

**V3 — cache coherence (exchange and crypto — D1 = keep whole)**
- After changing preferred crypto quote currency, the crypto conversion path does not silently reuse an incompatible stale cache.
- Fresh-cache short-circuit and error-backoff behavior follow one clear rule set.

**V4 — failure-path observability**
- Storage failures, refresh failures, and the two timezone catch paths leave traceable signal according to the chosen policy.
- Global cross-origin noise remains suppressed according to the chosen policy.

**V5 — comment and dead-code hygiene**
- No reintroduced dead guards or duplicated literals.
- No added comments that only restate the code.

**V6 — feature-cut integrity (guard)**
- If a future cut happens (none is planned — D1/D2/5.3 all *keep*): grep-verified no dangling references to removed symbols, `node --check` green, and the four V2 interactions unchanged.
- `README.md`, `STORE_LISTING_CHROME.md`, and `settings.html` no longer describe removed features.
- If crypto is cut (not applicable while D1 = keep whole), the CoinGecko `connect-src` entry and the `CRYPTO_*` config constants go with it — no orphans.

---

## How to read this plan

- Phase 0 converts the audit findings into author decisions and is mandatory before any removal is executed.
- Phase 1 is mandatory if the goal is taste integrity around caching and defaults (D1 = keep whole, so both the exchange- and crypto-cache items apply).
- Phase 2 is conditional on the chosen observability policy.
- Phase 3 is mechanical and should be applied only to what still exists in the live code.
- Phase 4 is the product-level taste pass that ties the code back to the README and to the guide.
- Phase 5 records the feature-reduction outcome (all decisions: *keep*) and is now closed; the remaining work lives in Phases 1–4.



