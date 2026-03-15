/**
 * Seller name scoring engine.
 * Assigns a trust score from 0 (definitely soup) to 100 (definitely legitimate).
 * Exposed as window.DesoupScorer for use by the content script.
 */
const DesoupScorer = (() => {

  // Common English words used in legitimate seller names
  const COMMON_WORDS = new Set([
    'official', 'store', 'shop', 'direct', 'global', 'home', 'tech',
    'electronics', 'supplies', 'solutions', 'group', 'market', 'world',
    'digital', 'online', 'deals', 'basics', 'essentials', 'trading',
    'inc', 'llc', 'ltd', 'co', 'usa', 'us', 'international', 'brands',
    'wholesale', 'retail', 'goods', 'depot', 'outlet', 'express',
    'audio', 'video', 'gear', 'tools', 'parts', 'accessories',
    'pro', 'plus', 'max', 'mini', 'ultra', 'super', 'best', 'top',
    'new', 'smart', 'power', 'auto', 'life', 'health', 'sport',
    'fitness', 'beauty', 'kitchen', 'garden', 'pets', 'baby', 'kids',
    'games', 'gaming', 'music', 'book', 'books', 'office', 'craft',
    'design', 'creative', 'lab', 'labs', 'works', 'systems', 'company'
  ]);

  // Known legitimate short/unusual brand names that might otherwise score low
  const KNOWN_GOOD = new Set([
    'lg', '3m', 'tcl', 'jbl', 'akg', 'aoc', 'bic', 'ge', 'hp',
    'msi', 'nec', 'onn', 'rca', 'tdk', 'ugg', 'ups', 'zte',
    'vizio', 'bengoo', 'mpow', 'tozo', 'aukey', 'iniu', 'ugreen'
  ]);

  /**
   * Shannon entropy of a string. Higher = more random.
   * Typical English words: 2.5-3.5, gibberish: 3.5-4.5+
   */
  function entropy(str) {
    const len = str.length;
    if (len === 0) return 0;
    const freq = {};
    for (const ch of str) {
      freq[ch] = (freq[ch] || 0) + 1;
    }
    let ent = 0;
    for (const ch in freq) {
      const p = freq[ch] / len;
      ent -= p * Math.log2(p);
    }
    return ent;
  }

  /**
   * Ratio of vowels to total alphabetic characters.
   * English typically falls in 0.35-0.45 range.
   */
  function vowelRatio(str) {
    const alpha = str.replace(/[^a-zA-Z]/g, '');
    if (alpha.length === 0) return 0;
    const vowels = alpha.replace(/[^aeiouAEIOU]/g, '').length;
    return vowels / alpha.length;
  }

  /**
   * Check if the name contains any recognizable common words.
   */
  function containsCommonWord(name) {
    const lower = name.toLowerCase();
    const tokens = lower.split(/[\s\-_.,&]+/);
    return tokens.some(t => t.length > 1 && COMMON_WORDS.has(t));
  }

  /**
   * Check for consecutive consonant clusters that don't appear in English.
   * "XKJR" is suspicious, "str" is not.
   */
  function maxConsonantRun(str) {
    const consonantRuns = str.toLowerCase().match(/[^aeiou\s\d\W]+/g) || [];
    return Math.max(0, ...consonantRuns.map(r => r.length));
  }

  /**
   * Score a seller name.
   * Returns 0-100. Lower = more likely slop.
   */
  function score(name) {
    if (!name || typeof name !== 'string') return 0;

    const trimmed = name.trim();
    if (trimmed.length === 0) return 0;

    // Known good override
    if (KNOWN_GOOD.has(trimmed.toLowerCase())) return 95;

    let total = 0;
    const alpha = trimmed.replace(/[^a-zA-Z]/g, '');

    // -- Signal 1: Entropy (max 25 points) --
    // Low entropy = predictable/real, high entropy = random
    const ent = entropy(trimmed.toLowerCase());
    if (ent < 2.8) total += 25;
    else if (ent < 3.2) total += 20;
    else if (ent < 3.6) total += 10;
    else if (ent < 4.0) total += 3;
    // else 0

    // -- Signal 2: Vowel ratio (max 20 points) --
    const vr = vowelRatio(trimmed);
    if (vr >= 0.25 && vr <= 0.55) total += 20;
    else if (vr >= 0.15 && vr <= 0.65) total += 10;
    else if (vr > 0) total += 3;
    // vr === 0 (no vowels at all) = 0 points

    // -- Signal 3: Contains common English words (max 20 points) --
    if (containsCommonWord(trimmed)) total += 20;

    // -- Signal 4: Has spaces or mixed case indicating real name (max 10 points) --
    const hasSpaces = /\s/.test(trimmed);
    const hasMixedCase = /[a-z]/.test(trimmed) && /[A-Z]/.test(trimmed);
    if (hasSpaces) total += 7;
    if (hasMixedCase) total += 3;

    // -- Signal 5: Not all-caps single token (max 15 points) --
    const isAllCapsSingleToken = trimmed === trimmed.toUpperCase() && !hasSpaces && alpha.length > 3;
    if (!isAllCapsSingleToken) total += 15;

    // -- Signal 6: Consonant clusters (max 10 points) --
    const maxCluster = maxConsonantRun(trimmed);
    if (maxCluster <= 2) total += 10;
    else if (maxCluster <= 3) total += 6;
    else if (maxCluster <= 4) total += 2;
    // 5+ consecutive consonants = 0

    // -- Signal 7: Name length reasonableness (max 5 points) --
    if (trimmed.length >= 3 && trimmed.length <= 40) total += 5;
    else if (trimmed.length >= 2) total += 2;

    // -- Penalty: all-caps single token with no recognizable words is inherently suspicious --
    if (isAllCapsSingleToken && !containsCommonWord(trimmed)) {
      total = Math.max(0, total - 15);
    }

    // -- Penalty: repeated adjacent characters typical of random generation --
    const repeats = (alpha.match(/(.)\1/gi) || []).length;
    if (isAllCapsSingleToken && repeats >= 1 && !containsCommonWord(trimmed)) {
      total = Math.max(0, total - (repeats * 8));
    }

    return Math.min(100, total);
  }

  /**
   * Classify a score into a category.
   */
  function classify(score, threshold = 40) {
    if (score >= 80) return 'trusted';
    if (score >= threshold) return 'neutral';
    return 'slop';
  }

  /**
   * Multi-signal scoring using enriched data from a product detail page.
   * Scores brand and seller independently, applies signal bonuses/penalties.
   * Returns { score, classification, brand, seller, reason }.
   */
  function scoreMulti(brand, seller, signals, threshold = 40) {
    const result = {
      score: 0,
      classification: 'neutral',
      brand: brand || null,
      seller: seller || null,
      reason: ''
    };

    const brandScore = brand ? score(brand) : null;
    const sellerScore = seller ? score(seller) : null;

    // Use the lowest available score as base
    let base;
    if (brandScore !== null && sellerScore !== null) {
      base = Math.min(brandScore, sellerScore);
    } else if (brandScore !== null) {
      base = brandScore;
    } else if (sellerScore !== null) {
      base = sellerScore;
    } else {
      result.reason = 'no brand or seller data';
      return result;
    }

    let adjusted = base;

    if (signals) {
      // Bonus: ships from Amazon is a trust indicator
      if (signals.shipsFromAmazon) {
        adjusted += 10;
      }

      // Bonus: has a brand storefront on Amazon
      if (signals.hasBrandStore) {
        adjusted += 8;
      }

      // Penalty: no seller info found at all
      if (!signals.hasSeller) {
        adjusted -= 5;
      }

      // Penalty: brand and seller names are both present but very different
      // AND both individually score low. Legitimate sellers often
      // have a different seller name from the brand.
      if (brand && seller && brandScore < threshold && sellerScore < threshold) {
        adjusted -= 10;
      }
    }

    adjusted = Math.max(0, Math.min(100, adjusted));
    result.score = adjusted;
    result.classification = classify(adjusted, threshold);

    // Build a human-readable reason
    const parts = [];
    if (brand) parts.push(`brand "${brand}" (${brandScore})`);
    if (seller) parts.push(`seller "${seller}" (${sellerScore})`);
    if (signals && signals.shipsFromAmazon) parts.push('+ships from Amazon');
    if (signals && signals.hasBrandStore) parts.push('+brand store');
    result.reason = parts.join(', ');

    return result;
  }

  return { score, classify, scoreMulti, entropy, vowelRatio };
})();

