# Desouper

**Desouper** is a browser extension that hides alphabet-soup sellers on Amazon and Walmart.

Many marketplace search results are dominated by third-party sellers with randomly generated names like **XKJRUIE**, **TUYUUOR**, or **BFGQWZ**. These sellers often list low-quality products with misleading photos and manufactured reviews, making it harder to find legitimate products. Desouper detects them using signals such as name entropy (gibberish detection), account age, and review patterns, then lets you hide, dim, or badge them so you can focus on trusted sellers.

## Features

- **Smart detection** — Scoring based on multiple signals; suspicious sellers are flagged, trusted ones get a verified badge.
- **Your choice** — Filter mode: badge only, dim, or hide. Adjustable sensitivity, plus personal whitelist and blocklist.
- **Privacy-first** — Detection runs in the browser. No browsing or purchase data collected; only optional anonymous blocklist sync and user-initiated reports.
- **Transparency** — Verified sellers show why they passed (account age, review patterns, brand registration, etc.). User reports go through manual review before affecting the shared blocklist.

Coming soon for Chrome and Firefox. No account required.

## Repo

- **Landing page:** `index.html`, `styles.css`, `script.js` (hosted on GitHub Pages).
- **Extension:** `extension/` — run `node build.js` from that folder to build for Chrome and Firefox.
