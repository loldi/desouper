# Desouper — MVP Launch Plan

Last updated: 2026-03-10

---

## Overview

Browser extension (Chrome + Firefox) that detects and filters low-quality "alphabet soup sellers" — third-party marketplace sellers with gibberish names, fake reviews, and cheap knock-off products — from Amazon and Walmart search results.

---

## Phase 1: Extension Scaffold

**Goal:** Prove we can inject code into Amazon/Walmart search pages and identify seller elements.

- [ ] Create Manifest V3 extension structure
  - `manifest.json` with permissions for `amazon.com` and `walmart.com`
  - Content script that runs on search result pages
  - Basic popup (empty shell for now)
  - Extension icon / badge
- [ ] Research and document Amazon's search result DOM structure
  - Identify the HTML elements that contain seller/brand names
  - Identify listing container elements for show/hide/dim operations
  - Note: Amazon's DOM structure changes periodically — keep all selectors in a single config file so they're easy to update
- [ ] Research and document Walmart's search result DOM structure
  - Same as above
- [ ] Verify content script injection works on both sites
  - Console log seller names extracted from page
  - Confirm the extension loads without errors

**Output:** Extension that loads on Amazon/Walmart and logs seller names to the console.

---

## Phase 2: Gibberish Name Detection

**Goal:** Build a scoring function that reliably distinguishes gibberish seller names from legitimate ones.

### Scoring signals (name analysis)

| Signal | Description | Weight |
|--------|-------------|--------|
| Character entropy | Randomness of character distribution (Shannon entropy) | High |
| Vowel/consonant ratio | Real words have predictable ratios; gibberish doesn't | Medium |
| Dictionary word match | Does the name contain recognizable English words? | High |
| All-caps no spaces | `XKJRUIE` vs `Sony Official` | Medium |
| Name length | Unusually short or long single-token names | Low |
| Repeated characters | `TUYUUOR` has unusual repetition patterns | Low |

### Implementation

- [ ] Write `scoreSellerName(name: string): number` function
  - Returns 0–100 (0 = definitely slop, 100 = definitely legitimate)
  - Configurable threshold (default: 40)
- [ ] Build a test suite with known examples
  - Known slop: `XKJRUIE`, `TUYUUOR`, `BFGQWZ`, `QQPFHD`, `JKDFLMN`, `ZXRTPQW`
  - Known good: `Sony Official`, `Anker Direct`, `Bose Store`, `Apple`, `Samsung`, `iRobot Store`, `JBL Official`
  - Edge cases: `LG`, `3M`, `VIZIO` (short but legitimate), `BENGOO` (real brand, looks gibberish)
- [ ] Tune weights and threshold against the test suite
- [ ] Consider future expansion: account age, review pattern analysis, listing quality — these require additional data sources and are Phase 5+ concerns

**Output:** A tested, standalone scoring function that can be imported by the content script.

---

## Phase 3: DOM Manipulation (Core Filtering)

**Goal:** Use the scoring function to actually filter listings on Amazon and Walmart search pages.

- [ ] Content script finds all listing elements on the page
- [ ] For each listing, extract the seller/brand name
- [ ] Run seller name through the scorer
- [ ] Apply filter action based on user's chosen mode:
  - **Badge:** Inject a small warning label next to the seller name
  - **Dim:** Reduce opacity of the listing container
  - **Hide:** Set `display: none` on the listing container
- [ ] Handle dynamic content loading (Amazon uses lazy loading / infinite scroll)
  - Use `MutationObserver` to watch for new listings appended to the DOM
- [ ] Keep all CSS selectors for each marketplace in a dedicated config object
  - `selectors.amazon.js`, `selectors.walmart.js`
  - Makes it easy to update when marketplace DOM changes

**Output:** Extension that visibly filters alphabet soup sellers on Amazon search results in real time.

---

## Phase 4: Extension Popup + Settings

**Goal:** Let users configure filter behavior and manage personal lists.

### Settings (stored in `chrome.storage.local`)

- [ ] **Filter mode:** Badge / Dim / Hide (default: Dim)
- [ ] **Sensitivity:** Low / Medium / High (maps to score thresholds: 25 / 40 / 60)
- [ ] **Marketplace toggles:** Amazon on/off, Walmart on/off
- [ ] **Personal whitelist:** Array of seller names that bypass filtering
- [ ] **Personal blocklist:** Array of seller names that are always filtered regardless of score

### Popup UI

- [ ] Simple, functional UI — not trying to win design awards here
- [ ] Toggle controls for mode and sensitivity
- [ ] List management for whitelist/blocklist (add/remove)
- [ ] Current page stats: "X sellers filtered on this page"
- [ ] Link to settings page for more detailed configuration if needed

### Badge counter

- [ ] Use `chrome.action.setBadgeText` to show count of filtered sellers on current page
- [ ] Content script sends count to background/service worker via `chrome.runtime.sendMessage`

**Output:** Fully functional popup with user-configurable settings that persist across sessions.

---

## Phase 5: Walmart Support

**Goal:** Extend filtering to Walmart.com using the same pipeline.

- [ ] Write Walmart-specific DOM selectors
- [ ] Map Walmart listing structure to the same data format used for Amazon
- [ ] Verify scoring function works equally well on Walmart seller names
- [ ] Test filtering on Walmart search result pages
- [ ] Handle any Walmart-specific quirks (different page load behavior, etc.)

**Output:** Extension works on both Amazon and Walmart search pages.

---

## Phase 6: Verified Seller Badges

**Goal:** Highlight trustworthy sellers, not just filter bad ones.

- [ ] Define "verified" threshold (e.g., score >= 80)
- [ ] Inject a green verified badge next to seller names that pass
- [ ] On click/hover, show a breakdown card with:
  - Each scoring criterion and its pass/fail status
  - Overall trust score
  - "Report incorrect badge" button
- [ ] Badge styling should be unobtrusive — small green checkmark, not a banner

**Output:** Trusted sellers get visible positive indicators with full transparency.

---

## Phase 7: Backend + Crowdsourced Reports

**Goal:** Allow users to report sellers and share a community blocklist.

### Architecture

- Lightweight API server (options: Node/Express, Cloudflare Workers, or similar)
- Database: Postgres or SQLite to start — doesn't need to be fancy
- No user accounts — reports are anonymous

### API endpoints

```
POST /api/reports
  body: { sellerName, marketplace, reason }
  → Queues report for manual review

GET /api/blocklist
  → Returns current confirmed blocklist (cached, updated periodically)

GET /api/blocklist/version
  → Returns blocklist version hash for diffing
```

### Report review workflow

- Reports land in a simple admin queue
- Manual review before any seller is added to the shared blocklist
- Confirmed sellers get added; false reports get discarded
- No automated blocking from user reports — every action is human-verified

### Extension integration

- [ ] Extension fetches shared blocklist on startup and periodically (every 24h)
- [ ] Stores blocklist locally in `chrome.storage.local`
- [ ] Merges shared blocklist with local scoring results
- [ ] Report submission from listing context menu or popup

**Output:** Working report pipeline and shared blocklist that syncs to all users.

---

## Phase 8: Firefox Support

**Goal:** Port the Chrome extension to Firefox.

- [ ] Manifest V3 is supported in Firefox but with some differences — audit and adapt
- [ ] Test all content script injection on Firefox
- [ ] Test `browser.storage.local` compatibility (Firefox uses `browser.*` namespace)
- [ ] Publish to Firefox Add-ons (AMO)
- [ ] Update landing page with Firefox download link

**Output:** Extension available on both Chrome Web Store and Firefox Add-ons.

---

## Tech Stack (planned)

| Component | Technology |
|-----------|-----------|
| Extension | TypeScript, Manifest V3 |
| Popup UI | Vanilla HTML/CSS or lightweight framework (Preact) |
| Content scripts | TypeScript, DOM manipulation |
| Build tool | Vite or webpack with browser extension plugin |
| Backend API | TBD (Node/Express, Cloudflare Workers, or similar) |
| Database | TBD (Postgres, SQLite, or Turso) |
| Landing page | Static HTML/CSS/JS (already built) |

---

## What's explicitly NOT in the MVP

- Account system / login
- Payment / premium tiers
- Mobile app
- Review text analysis (NLP-level fake review detection)
- Price anomaly detection
- Per-category sensitivity tuning
- Shareable/importable blocklists
- eBay or other marketplace support

These are all reasonable future features but they don't belong in v1. Ship the core, see if people use it, then iterate.

---

## Success criteria for launch

1. Extension installs and runs on Chrome without errors
2. Gibberish seller names on Amazon are correctly detected and filtered
3. False positive rate is low enough that users don't need to whitelist constantly
4. Settings persist and filter modes work as expected
5. Badge counter accurately reflects filtered count
6. At least one other person has tested it and confirmed it works

---

## Open questions

- **Amazon TOS:** Does injecting content on Amazon search pages violate their terms? Research needed. Other extensions (Honey, Keepa, CamelCamelCamel) do this, so precedent exists.
- **Seller name extraction reliability:** Amazon's DOM is complex. Need to determine if seller names are consistently available on search result pages or only on individual product pages.
- **Scoring edge cases:** Short legitimate brand names like `LG`, `3M`, `TCL` could score as gibberish. Need a known-good list or minimum-length threshold.
- **Update mechanism for selectors:** When Amazon changes their DOM, how quickly can we push updated selectors to users? Extension update cycle vs. remote config fetch.
