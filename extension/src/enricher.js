/**
 * Amazon product page HTML parser.
 * Extracts brand name, seller name, and trust signals from
 * a fetched product detail page. Pure functions only.
 * Exposed as window.DesoupEnricher (content script) or
 * importable in background via importScripts.
 */
const DesoupEnricher = (() => {

  // Multiple fallback selectors for each field.
  // Amazon changes their DOM frequently, so we try many paths.

  const BRAND_SELECTORS = [
    '#bylineInfo',
    'a#brand',
    '#brand',
    '.po-brand .po-break-word',
    '.po-brand .a-span9 span',
    'tr.po-brand td.a-span9 span',
    '#productOverview_feature_div .po-brand .po-break-word',
    '.a-spacing-small #bylineInfo',
  ];

  const SELLER_SELECTORS = [
    '#sellerProfileTriggerId',
    '#merchant-info a:first-of-type',
    '#merchant-info',
    '#tabular-buybox .tabular-buybox-text a',
    '#tabular-buybox-truncate-1 .a-truncate-full',
    '#tabular-buybox .tabular-buybox-text[tabular-attribute-name="Sold by"] a',
    '#tabular-buybox .tabular-buybox-text[tabular-attribute-name="Sold by"] span',
  ];

  const SHIPS_FROM_SELECTORS = [
    '#tabular-buybox .tabular-buybox-text[tabular-attribute-name="Ships from"] .a-truncate-full',
    '#tabular-buybox .tabular-buybox-text[tabular-attribute-name="Ships from"] a',
    '#tabular-buybox .tabular-buybox-text[tabular-attribute-name="Ships from"] span',
    '#merchant-info',
  ];

  /**
   * Clean a brand string extracted from the DOM.
   * Removes prefixes like "Brand: ", "Visit the ", " Store", etc.
   */
  function cleanBrand(raw) {
    if (!raw) return null;
    let s = raw.trim();
    s = s.replace(/^Brand:\s*/i, '');
    s = s.replace(/^Visit the\s+/i, '');
    s = s.replace(/\s+Store$/i, '');
    s = s.replace(/^by\s+/i, '');
    s = s.trim();
    return (s.length >= 1 && s.length <= 80) ? s : null;
  }

  /**
   * Clean a seller name extracted from the DOM.
   */
  function cleanSeller(raw) {
    if (!raw) return null;
    let s = raw.trim();
    s = s.replace(/^Sold by\s*/i, '');
    s = s.replace(/^Ships from and sold by\s*/i, '');
    s = s.replace(/\s+and\s+Fulfilled by Amazon\.?\s*$/i, '');
    s = s.trim();
    return (s.length >= 1 && s.length <= 100) ? s : null;
  }

  /**
   * Try to extract text from a document using an ordered list of selectors.
   * Returns the first non-empty match.
   */
  function extractFirst(doc, selectors) {
    for (const sel of selectors) {
      try {
        const el = doc.querySelector(sel);
        if (el) {
          const text = el.textContent.trim();
          if (text && text.length > 0 && text.length < 200) {
            return text;
          }
        }
      } catch (e) {
        // Invalid selector for this parser
      }
    }
    return null;
  }

  /**
   * Try to extract brand from LD+JSON structured data.
   */
  function extractBrandFromLDJSON(doc) {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        if (data.brand) {
          const name = typeof data.brand === 'string' ? data.brand : data.brand.name;
          if (name && name.length > 0) return name;
        }
      } catch (e) {
        // Malformed JSON
      }
    }
    return null;
  }

  /**
   * Check if the product ships from Amazon.
   */
  function checkShipsFromAmazon(doc) {
    const raw = extractFirst(doc, SHIPS_FROM_SELECTORS);
    if (!raw) return false;
    return /amazon/i.test(raw);
  }

  /**
   * Check if a "Visit the X Store" link exists (indicates a brand storefront).
   */
  function checkHasBrandStore(doc) {
    const byline = doc.querySelector('#bylineInfo');
    if (byline) {
      const text = byline.textContent || '';
      if (/visit the/i.test(text)) return true;
    }
    const storeLink = doc.querySelector('a[href*="/stores/"]');
    return !!storeLink;
  }

  /**
   * Parse a fetched Amazon product page HTML string.
   * Returns { brand, seller, signals } or null on failure.
   */
  function parse(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const rawBrand = extractFirst(doc, BRAND_SELECTORS) || extractBrandFromLDJSON(doc);
    const rawSeller = extractFirst(doc, SELLER_SELECTORS);
    const shipsFromAmazon = checkShipsFromAmazon(doc);
    const hasBrandStore = checkHasBrandStore(doc);

    const brand = cleanBrand(rawBrand);
    const seller = cleanSeller(rawSeller);

    if (!brand && !seller) return null;

    return {
      brand,
      seller,
      signals: {
        shipsFromAmazon,
        hasBrandStore,
        hasBrand: !!brand,
        hasSeller: !!seller,
      }
    };
  }

  return { parse, cleanBrand, cleanSeller };
})();
