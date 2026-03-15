/**
 * Content script - runs on Amazon and Walmart search result pages.
 * Two-phase pipeline:
 *   Phase 1 (instant): quick brand estimate from title, show pending state
 *   Phase 2 (async):   fetch product detail page via background script,
 *                      re-score with enriched brand/seller data
 */
(() => {
  const PROCESSED_ATTR = 'data-ds-processed';
  const ENRICHED_ATTR = 'data-ds-enriched';
  const DS_BADGE_CLASS = 'ds-badge';

  let settings = {
    filterMode: 'dim',
    sensitivity: 'medium',
    enabled: true,
    whitelist: [],
    blocklist: []
  };

  const THRESHOLDS = { low: 25, medium: 40, high: 60 };

  let filteredCount = 0;
  let site = null;

  async function loadSettings() {
    try {
      const stored = await chrome.storage.local.get('desouperSettings');
      if (stored.desouperSettings) {
        settings = { ...settings, ...stored.desouperSettings };
      }
    } catch (e) {
      console.warn('[Desouper] Could not load settings, using defaults.');
    }
  }

  // --- Visual state management ---

  function clearVisualState(listing) {
    listing.classList.remove('ds-hidden', 'ds-dimmed', 'ds-badged', 'ds-pending');
    listing.removeAttribute('data-ds-status');
    const existingBadge = listing.querySelector(`.${DS_BADGE_CLASS}`);
    if (existingBadge) existingBadge.remove();
  }

  function applyFilter(listing, displayName, classification, reason) {
    if (classification === 'slop') {
      listing.setAttribute('data-ds-status', 'soup');
      listing.classList.remove('ds-pending');

      switch (settings.filterMode) {
        case 'hide':
          listing.classList.add('ds-hidden');
          break;
        case 'dim':
          listing.classList.add('ds-dimmed');
          break;
        case 'badge':
        default:
          listing.classList.add('ds-badged');
          break;
      }

      injectBadge(listing, displayName, reason);
      filteredCount++;
    } else {
      listing.classList.remove('ds-pending');
      listing.removeAttribute('data-ds-status');
    }
  }

  function applyPendingState(listing) {
    listing.classList.add('ds-pending');
    listing.setAttribute('data-ds-status', 'pending');
  }

  function injectBadge(listing, displayName, reason) {
    const existing = listing.querySelector(`.${DS_BADGE_CLASS}`);
    if (existing) existing.remove();

    const badge = document.createElement('span');
    badge.className = `${DS_BADGE_CLASS} ds-badge-slop`;

    badge.textContent = 'Soup Seller';
    badge.title = reason
      ? `"${displayName}" flagged by Desouper: ${reason}`
      : `"${displayName}" flagged as an alphabet soup seller by Desouper`;

    const anchor = listing.querySelector(site.badgeAnchor);
    if (anchor) {
      anchor.prepend(badge);
    } else {
      listing.prepend(badge);
    }
  }

  // --- Phase 1: Quick scan ---

  function quickProcessListing(listing) {
    if (listing.getAttribute(PROCESSED_ATTR)) return;
    listing.setAttribute(PROCESSED_ATTR, '1');

    const asin = site.extractAsin(listing);
    const quickBrand = site.extractQuickBrand(listing);

    if (quickBrand) {
      const nameLower = quickBrand.toLowerCase();

      if (settings.whitelist.some(w => w.toLowerCase() === nameLower)) {
        return;
      }

      if (settings.blocklist.some(b => b.toLowerCase() === nameLower)) {
        applyFilter(listing, quickBrand, 'slop', 'blocklisted');
        return;
      }

      const quickScore = DesoupScorer.score(quickBrand);
      const threshold = THRESHOLDS[settings.sensitivity] || THRESHOLDS.medium;
      const quickClass = DesoupScorer.classify(quickScore, threshold);

      if (quickClass === 'slop') {
        applyFilter(listing, quickBrand, 'slop', `quick: "${quickBrand}" (${quickScore})`);
      }
    }

    if (asin) {
      listing.setAttribute('data-ds-asin', asin);
      if (!listing.getAttribute('data-ds-status')) {
        applyPendingState(listing);
      }
    }
  }

  // --- Phase 2: Enrichment via background fetch ---

  async function enrichListing(listing) {
    if (listing.getAttribute(ENRICHED_ATTR)) return;

    const asin = listing.getAttribute('data-ds-asin');
    if (!asin) return;

    listing.setAttribute(ENRICHED_ATTR, '1');

    let response;
    try {
      response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'enrichListing', asin },
          (resp) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(resp);
            }
          }
        );
      });
    } catch (e) {
      console.warn('[Desouper] enrichListing message failed for', asin, e);
      clearVisualState(listing);
      return;
    }

    if (!response) {
      clearVisualState(listing);
      return;
    }

    let enriched = null;

    if (response.data) {
      enriched = response.data;
    } else if (response.html) {
      enriched = DesoupEnricher.parse(response.html);
      if (enriched) {
        try {
          chrome.runtime.sendMessage({
            type: 'cacheEnrichment',
            asin,
            data: enriched
          });
        } catch (e) {
          // Best-effort caching
        }
      }
    }

    if (!enriched) {
      const quickBrand = site.extractQuickBrand(listing);
      if (quickBrand) {
        const threshold = THRESHOLDS[settings.sensitivity] || THRESHOLDS.medium;
        const quickScore = DesoupScorer.score(quickBrand);
        const quickClass = DesoupScorer.classify(quickScore, threshold);
        clearVisualState(listing);
        applyFilter(listing, quickBrand, quickClass, `title: "${quickBrand}" (${quickScore})`);
      } else {
        clearVisualState(listing);
      }
      updateBadgeCount();
      return;
    }

    const { brand, seller, signals } = enriched;
    const threshold = THRESHOLDS[settings.sensitivity] || THRESHOLDS.medium;

    const names = [brand, seller].filter(Boolean);
    for (const name of names) {
      const lower = name.toLowerCase();
      if (settings.whitelist.some(w => w.toLowerCase() === lower)) {
        clearVisualState(listing);
        return;
      }
      if (settings.blocklist.some(b => b.toLowerCase() === lower)) {
        clearVisualState(listing);
        applyFilter(listing, name, 'slop', 'blocklisted');
        updateBadgeCount();
        return;
      }
    }

    const result = DesoupScorer.scoreMulti(brand, seller, signals, threshold);
    const displayName = brand || seller || 'Unknown';

    const wasCounted = listing.getAttribute('data-ds-status') === 'soup';
    if (wasCounted) filteredCount--;

    clearVisualState(listing);
    applyFilter(listing, displayName, result.classification, result.reason);
    updateBadgeCount();
  }

  /**
   * Find all listings that need enrichment (have ASIN but not yet enriched).
   */
  function getUnenrichedListings() {
    return document.querySelectorAll('[data-ds-asin]:not([data-ds-enriched])');
  }

  // --- Scanning and observation ---

  function scanListings() {
    if (!site || !site.isSearchPage()) return;

    const listings = document.querySelectorAll(site.listingContainer);
    listings.forEach(quickProcessListing);
    updateBadgeCount();
  }

  function updateBadgeCount() {
    try {
      chrome.runtime.sendMessage({
        type: 'updateBadge',
        count: filteredCount
      });
    } catch (e) {
      // Extension context may be invalidated
    }
  }

  // --- Enrichment: IntersectionObserver + fallback sweep ---

  let enrichObserver = null;

  function setupEnrichmentObserver() {
    enrichObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          enrichListing(entry.target);
          enrichObserver.unobserve(entry.target);
        }
      }
    }, {
      rootMargin: '400px',
    });

    observeNewListings();

    // Fallback: after a short delay, enrich anything the observer missed
    // (e.g. listings already visible when observer was set up)
    setTimeout(enrichFallbackSweep, 500);
  }

  function observeNewListings() {
    const unenriched = getUnenrichedListings();
    unenriched.forEach(listing => enrichObserver.observe(listing));
  }

  /**
   * Sweep for any listings the IntersectionObserver missed.
   * Directly triggers enrichment for all unenriched listings.
   */
  function enrichFallbackSweep() {
    const unenriched = getUnenrichedListings();
    unenriched.forEach(listing => enrichListing(listing));
  }

  // --- MutationObserver: handle dynamically loaded listings ---

  let scanTimer = null;

  function observeDOMChanges() {
    const observer = new MutationObserver((mutations) => {
      let hasNewNodes = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          hasNewNodes = true;
          break;
        }
      }
      if (hasNewNodes) {
        if (scanTimer) clearTimeout(scanTimer);
        scanTimer = setTimeout(() => {
          scanListings();
          observeNewListings();
          // Sweep again after new content settles
          setTimeout(enrichFallbackSweep, 300);
        }, 150);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // --- Entry point ---

  async function init() {
    site = DesoupSelectors.forCurrentSite();
    if (!site) return;
    if (!site.isSearchPage()) return;

    await loadSettings();
    if (!settings.enabled) return;

    console.log('[Desouper] active on', window.location.hostname);

    scanListings();
    setupEnrichmentObserver();
    observeDOMChanges();
  }

  init();
})();
