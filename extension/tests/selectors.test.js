const fs = require('fs');

const code = fs.readFileSync('./src/selectors.js', 'utf-8');

// The IIFE wraps looksGeneric inside DesoupSelectors scope.
// Inject a mock window and rewrite the return to also export looksGeneric.
const patched = code.replace(
  'return { amazon, walmart, forCurrentSite };',
  'return { amazon, walmart, forCurrentSite, _looksGeneric: looksGeneric };'
);
const mock = `const window = { location: { hostname: 'amazon.com', pathname: '/s', search: '?k=test' } };`;
const DesoupSelectors = new Function(mock + patched + '\nreturn DesoupSelectors;')();
const looksGeneric = DesoupSelectors._looksGeneric;

let passed = 0;
let failed = 0;

function check(input, expectedGeneric) {
  const result = looksGeneric(input);
  const ok = result === expectedGeneric;
  const icon = ok ? '+' : 'X';
  console.log(`  [${icon}] "${input}" => generic=${result} (expected ${expectedGeneric})`);
  if (ok) passed++;
  else failed++;
}

console.log('\n--- Should be GENERIC (not a brand) ---\n');
check('USB C to USB C Cable', true);
check('Screen Protector', true);
check('Phone Case', true);
check('Wireless Charger', true);
check('Car Mount', true);
check('LED Light Strip', true);
check('Fast Charger', true);
check('Clear Case', true);
check('Type C Cable', true);

console.log('\n--- Should NOT be generic (are brands) ---\n');
check('ESR', false);
check('SUPFINE', false);
check('Miracase', false);
check('GVIEWIN', false);
check('FNTCASE', false);
check('FireNova', false);
check('TAURI', false);
check('Anker', false);
check('Spigen', false);
check('OtterBox', false);
check('JETech', false);
check('TORRAS', false);

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
process.exit(failed > 0 ? 1 : 0);
