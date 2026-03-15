/**
 * DOM selectors for each supported marketplace.
 * Isolated here so they're easy to update when sites change their markup.
 * Exposed as window.DesoupSelectors for use by the content script.
 */
const DesoupSelectors = (() => {

  // Words that signal "this is a product description, not a brand"
  const GENERIC_STARTS = new Set([
    'usb', 'cable', 'charger', 'adapter', 'wire', 'cord', 'hub', 'dock',
    'case', 'cover', 'screen', 'protector', 'tempered', 'glass', 'film',
    'phone', 'tablet', 'laptop', 'computer', 'pc', 'desktop', 'monitor',
    'keyboard', 'mouse', 'headphone', 'headset', 'earphone', 'earbuds',
    'speaker', 'bluetooth', 'wireless', 'wired', 'portable', 'mini',
    'led', 'light', 'lamp', 'bulb', 'strip', 'solar', 'battery',
    'mount', 'stand', 'holder', 'bracket', 'rack', 'shelf', 'hook',
    'bag', 'pouch', 'sleeve', 'wallet', 'organizer', 'storage',
    'pack', 'set', 'kit', 'pair', 'replacement', 'universal', 'generic',
    'waterproof', 'shockproof', 'heavy', 'duty', 'premium', 'original',
    'new', 'upgraded', 'latest', 'compatible', 'fits', 'designed',
    'stainless', 'steel', 'silicone', 'leather', 'nylon', 'plastic',
    'magnetic', 'fast', 'quick', 'rapid', 'super', 'ultra', 'slim',
    'thin', 'clear', 'transparent', 'black', 'white', 'red', 'blue',
    'green', 'pink', 'gold', 'silver', 'gray', 'grey', 'purple',
    'car', 'wall', 'travel', 'outdoor', 'indoor', 'home', 'office',
    'type', 'micro', 'lightning', 'hdmi', 'aux', 'ethernet',
    '2-pack', '3-pack', '4-pack', '5-pack', '6-pack', '10-pack',
    'anti', 'full', 'body', 'military', 'grade', 'protective', 'dual',
    'for', 'with', 'and', 'the', 'a', 'an', 'in', 'on', 'to'
  ]);

  const BRAND_DELIMITERS = /\s+(?:for|compatible|magnetic|case|phone|screen|cover|protective|slim|ultra|military|anti|full|with|fits|designed|premium|original|\[|\(|\d+[\s-]?(?:pack|pcs|ft|inch|in\b|mm|"|'))/i;

  function looksGeneric(text) {
    const words = text.toLowerCase().split(/[\s\-\/]+/);
    if (words.every(w => GENERIC_STARTS.has(w))) return true;
    const genericCount = words.filter(w => GENERIC_STARTS.has(w)).length;
    if (words.length >= 3 && genericCount / words.length > 0.6) return true;
    return false;
  }

  const amazon = {
    // Two DOM patterns: classic s-search-result and declarative card (data-csa-c-item-id)
    listingContainer: '[data-component-type="s-search-result"], [data-csa-c-item-id^="amzn1.asin."]',

    badgeAnchor: 'h2, .a-section .a-spacing-small, .a-section .a-spacing-micro',

    listingId: 'data-asin',

    isSearchPage: () => /\/s[?/]/.test(window.location.pathname + window.location.search),

    /**
     * Extract the ASIN from a listing element.
     * Handles both data-asin and data-csa-c-item-id="amzn1.asin.XXXXX" (declarative cards).
     */
    extractAsin(listing) {
      const direct = listing.getAttribute('data-asin');
      if (direct && direct.trim()) return direct.trim();

      const csa = listing.getAttribute('data-csa-c-item-id');
      if (csa && csa.startsWith('amzn1.asin.')) {
        return csa.replace(/^amzn1\.asin\./, '');
      }

      const nested = listing.querySelector('[data-asin]');
      if (nested) {
        const val = nested.getAttribute('data-asin');
        if (val && val.trim()) return val.trim();
      }
      return null;
    },

    /**
     * Quick brand extraction from the search card DOM.
     * Used as a fast fallback while the detail page fetch is in flight.
     * Not reliable, may return null or an incorrect value.
     */
    extractQuickBrand(listing) {
      const h2 = listing.querySelector('h2');
      if (!h2) return null;

      const title = h2.textContent.trim();
      if (!title) return null;

      const match = title.match(BRAND_DELIMITERS);
      if (match) {
        const brand = title.slice(0, match.index).trim();
        if (brand.length >= 2 && brand.length <= 40 && !looksGeneric(brand)) {
          return brand;
        }
      }

      const firstToken = title.split(/\s+/)[0];
      if (firstToken && firstToken.length >= 2 && firstToken.length <= 20 && !looksGeneric(firstToken)) {
        return firstToken;
      }

      return null;
    }
  };

  const walmart = {
    listingContainer: '[data-testid="list-view"] [data-item-id], [data-testid="grid-view"] [data-item-id]',

    sellerName: [
      '[data-automation-id="product-brand"]',
      '.lh-title .w_DP',
      'span[data-automation-id="name"] + span'
    ],

    badgeAnchor: '[data-automation-id="product-price"]',

    listingId: 'data-item-id',

    isSearchPage: () => /\/search/.test(window.location.pathname),

    extractAsin() {
      return null; // Walmart uses item-id, not ASIN
    },

    extractQuickBrand(listing) {
      for (const selector of this.sellerName) {
        try {
          const el = listing.querySelector(selector);
          if (el) {
            const text = el.textContent.trim();
            if (text && text.length > 0 && text.length < 100) {
              return text;
            }
          }
        } catch (e) {
          // Selector might be invalid
        }
      }
      return null;
    }
  };

  function forCurrentSite() {
    const host = window.location.hostname;
    if (host.includes('amazon')) return amazon;
    if (host.includes('walmart')) return walmart;
    return null;
  }

  return { amazon, walmart, forCurrentSite, _looksGeneric: looksGeneric };
})();
