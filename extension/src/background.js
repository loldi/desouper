/**
 * Service worker (background script).
 * Handles badge count updates, storage initialization,
 * and product detail page fetching for enrichment.
 */

// Set default settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('desouperSettings', (result) => {
    if (!result.desouperSettings) {
      chrome.storage.local.set({
        desouperSettings: {
          filterMode: 'dim',
          sensitivity: 'medium',
          enabled: true,
          whitelist: [],
          blocklist: []
        }
      });
    }
  });
});

// --- Enrichment: fetch + parse Amazon product pages ---

const MAX_CONCURRENT = 3;
const FETCH_DELAY_MS = 200;
const CACHE_MAX_ENTRIES = 5000;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_KEY = 'desouperCache';

let inFlight = 0;
const queue = [];

/**
 * Read the enrichment cache from storage.
 */
async function getCache() {
  try {
    const result = await chrome.storage.local.get(CACHE_KEY);
    return result[CACHE_KEY] || {};
  } catch (e) {
    return {};
  }
}

/**
 * Write a single entry to the enrichment cache.
 * Evicts expired and overflow entries.
 */
async function setCacheEntry(asin, data) {
  const cache = await getCache();
  const now = Date.now();

  cache[asin] = { ...data, timestamp: now };

  // Evict expired entries
  const asins = Object.keys(cache);
  for (const key of asins) {
    if (now - cache[key].timestamp > CACHE_TTL_MS) {
      delete cache[key];
    }
  }

  // Evict oldest if over capacity
  const remaining = Object.keys(cache);
  if (remaining.length > CACHE_MAX_ENTRIES) {
    remaining.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
    const toRemove = remaining.length - CACHE_MAX_ENTRIES;
    for (let i = 0; i < toRemove; i++) {
      delete cache[remaining[i]];
    }
  }

  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}

/**
 * Fetch an Amazon product detail page and return raw HTML.
 * Parsing happens in the content script where DOMParser is available.
 */
async function fetchProductPage(asin) {
  const url = `https://www.amazon.com/dp/${asin}`;
  const response = await fetch(url, {
    credentials: 'omit',
    headers: {
      'Accept': 'text/html',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.text();
}

/**
 * Process the next item in the queue if under concurrency limit.
 */
function processQueue() {
  while (inFlight < MAX_CONCURRENT && queue.length > 0) {
    const { asin, resolve } = queue.shift();
    inFlight++;

    (async () => {
      try {
        const html = await fetchProductPage(asin);
        resolve({ html });
      } catch (e) {
        console.warn(`[Desouper] Failed to fetch ${asin}:`, e.message);
        resolve(null);
      } finally {
        inFlight--;
        // Stagger the next fetch
        setTimeout(processQueue, FETCH_DELAY_MS);
      }
    })();
  }
}

/**
 * Enqueue an enrichment request. Returns a promise that
 * resolves with the parsed result or null.
 */
function enqueueEnrichment(asin) {
  return new Promise((resolve) => {
    queue.push({ asin, resolve });
    processQueue();
  });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'updateBadge' && sender.tab) {
    const count = message.count;
    const text = count > 0 ? String(count) : '';

    chrome.action.setBadgeText({
      text: text,
      tabId: sender.tab.id
    });

    chrome.action.setBadgeBackgroundColor({
      color: '#dc2626',
      tabId: sender.tab.id
    });
    return false;
  }

  if (message.type === 'enrichListing' && message.asin) {
    const asin = message.asin;

    (async () => {
      // Check cache first (stores already-parsed results)
      const cache = await getCache();
      const cached = cache[asin];
      const now = Date.now();

      if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
        sendResponse({ data: cached, source: 'cache' });
        return;
      }

      // Fetch raw HTML (parsing will happen in content script)
      const result = await enqueueEnrichment(asin);
      if (result && result.html) {
        sendResponse({ html: result.html, source: 'fetch' });
      } else {
        sendResponse({ data: null, source: 'fetch' });
      }
    })();

    return true;
  }

  if (message.type === 'cacheEnrichment' && message.asin && message.data) {
    setCacheEntry(message.asin, message.data);
    return false;
  }
});

// Clear badge when navigating to a new page
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '', tabId });
  }
});
