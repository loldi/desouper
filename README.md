# Desouper

A browser extension that hides alphabet-soup sellers on Amazon and Walmart. This repo includes the landing page (served via GitHub Pages) and the extension source.

## Landing page (GitHub Pages)

The site is the root `index.html` plus `styles.css` and `script.js`.

**To enable GitHub Pages:**

1. Open **Settings** → **Pages** in the repo.
2. Under **Build and deployment** → **Source**, choose **Deploy from a branch**.
3. Set **Branch** to `main`, folder to **/ (root)**.
4. Save. The site will be at `https://loldi.github.io/desouper/`.

## Extension

- **Source:** `extension/`
- **Build:** From `extension/`, run `node build.js` (see `extension/package.json`).
- Supports Chrome and Firefox (see `manifest.json` and `manifest.firefox.json`).

## License

All rights reserved.
