/**
 * Tests for the enricher HTML parser.
 * Uses inline HTML fixtures simulating Amazon product page snippets.
 * Run with: node tests/enricher.test.js
 */

const fs = require('fs');
const { JSDOM } = require('jsdom');

// Provide DOMParser globally so enricher.js can use it
const { DOMParser } = new JSDOM('').window;
global.DOMParser = DOMParser;

const enricherCode = fs.readFileSync('./src/enricher.js', 'utf-8');
const DesoupEnricher = new Function(enricherCode + '\nreturn DesoupEnricher;')();

let passed = 0;
let failed = 0;

function assert(description, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  const icon = ok ? '+' : 'X';
  console.log(`  [${icon}] ${description}`);
  if (!ok) {
    console.log(`       expected: ${JSON.stringify(expected)}`);
    console.log(`       got:      ${JSON.stringify(actual)}`);
  }
  if (ok) passed++;
  else failed++;
}

// --- HTML Fixtures ---

const FIXTURE_ANKER = `
<html><body>
  <a id="bylineInfo" class="a-link-normal" href="/stores/Anker">Visit the Anker Store</a>
  <div id="merchant-info">
    Ships from and sold by <a id="sellerProfileTriggerId" href="/seller/ABC">AnkerDirect</a>
    and Fulfilled by Amazon.
  </div>
  <div id="tabular-buybox">
    <div class="tabular-buybox-text" tabular-attribute-name="Ships from">
      <span class="a-truncate-full">Amazon</span>
    </div>
  </div>
</body></html>
`;

const FIXTURE_SOUP_SELLER = `
<html><body>
  <a id="bylineInfo" class="a-link-normal" href="/s?k=XKJRUIE">Brand: XKJRUIE</a>
  <div id="merchant-info">
    Sold by <a id="sellerProfileTriggerId" href="/seller/XYZ">XKJRUIE Store</a>
  </div>
</body></html>
`;

const FIXTURE_LDJSON = `
<html><body>
  <script type="application/ld+json">
  {
    "brand": { "name": "Sony" },
    "@type": "Product"
  }
  </script>
  <div id="merchant-info">
    Ships from and sold by <a id="sellerProfileTriggerId">Amazon.com</a>.
  </div>
</body></html>
`;

const FIXTURE_NO_DATA = `
<html><body>
  <h1>Product Title</h1>
  <p>Some description</p>
</body></html>
`;

const FIXTURE_BRAND_ONLY = `
<html><body>
  <a id="brand" href="/brand/Logitech">Logitech</a>
</body></html>
`;

const FIXTURE_PO_BRAND = `
<html><body>
  <table><tbody>
    <tr class="po-brand">
      <td class="a-span9">
        <span class="po-break-word">Samsung</span>
      </td>
    </tr>
  </tbody></table>
  <a id="sellerProfileTriggerId" href="/seller/123">Samsung Electronics</a>
</body></html>
`;

// --- Tests ---

console.log('\n--- Enricher: Anker product page ---\n');

const anker = DesoupEnricher.parse(FIXTURE_ANKER);
assert('brand is "Anker"', anker.brand, 'Anker');
assert('seller is "AnkerDirect"', anker.seller, 'AnkerDirect');
assert('signals.shipsFromAmazon is true', anker.signals.shipsFromAmazon, true);
assert('signals.hasBrandStore is true', anker.signals.hasBrandStore, true);
assert('signals.hasBrand is true', anker.signals.hasBrand, true);
assert('signals.hasSeller is true', anker.signals.hasSeller, true);

console.log('\n--- Enricher: Soup seller page ---\n');

const soup = DesoupEnricher.parse(FIXTURE_SOUP_SELLER);
assert('brand is "XKJRUIE"', soup.brand, 'XKJRUIE');
assert('seller is "XKJRUIE Store"', soup.seller, 'XKJRUIE Store');
assert('signals.shipsFromAmazon is false', soup.signals.shipsFromAmazon, false);

console.log('\n--- Enricher: LD+JSON brand ---\n');

const ldjson = DesoupEnricher.parse(FIXTURE_LDJSON);
assert('brand is "Sony"', ldjson.brand, 'Sony');
assert('seller is "Amazon.com"', ldjson.seller, 'Amazon.com');

console.log('\n--- Enricher: No data ---\n');

const noData = DesoupEnricher.parse(FIXTURE_NO_DATA);
assert('returns null when no brand or seller', noData, null);

console.log('\n--- Enricher: Brand only (no seller) ---\n');

const brandOnly = DesoupEnricher.parse(FIXTURE_BRAND_ONLY);
assert('brand is "Logitech"', brandOnly.brand, 'Logitech');
assert('seller is null', brandOnly.seller, null);
assert('signals.hasSeller is false', brandOnly.signals.hasSeller, false);

console.log('\n--- Enricher: Product overview brand ---\n');

const poBrand = DesoupEnricher.parse(FIXTURE_PO_BRAND);
assert('brand is "Samsung"', poBrand.brand, 'Samsung');
assert('seller is "Samsung Electronics"', poBrand.seller, 'Samsung Electronics');

console.log('\n--- Enricher: cleanBrand ---\n');

assert('strips "Brand: "', DesoupEnricher.cleanBrand('Brand: Anker'), 'Anker');
assert('strips "Visit the ... Store"', DesoupEnricher.cleanBrand('Visit the Sony Store'), 'Sony');
assert('strips "by "', DesoupEnricher.cleanBrand('by Samsung'), 'Samsung');
assert('returns null for empty', DesoupEnricher.cleanBrand(''), null);

console.log('\n--- Enricher: cleanSeller ---\n');

assert('strips "Sold by "', DesoupEnricher.cleanSeller('Sold by AnkerDirect'), 'AnkerDirect');
assert('strips fulfillment suffix', DesoupEnricher.cleanSeller('AnkerDirect and Fulfilled by Amazon'), 'AnkerDirect');
assert('returns null for empty', DesoupEnricher.cleanSeller(''), null);

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
process.exit(failed > 0 ? 1 : 0);
