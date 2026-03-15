/**
 * Basic test runner for the scorer.
 * Run with: node tests/scorer.test.js
 */

// Load scorer in Node context
const fs = require('fs');
const scorerCode = fs.readFileSync('./src/scorer.js', 'utf-8');
const DesoupScorer = new Function(scorerCode + '\nreturn DesoupScorer;')();

const THRESHOLD = 40;
let passed = 0;
let failed = 0;

function assert(name, score, expectedClass) {
  const actual = DesoupScorer.classify(score, THRESHOLD);
  const status = actual === expectedClass ? 'PASS' : 'FAIL';
  const icon = status === 'PASS' ? '+' : 'X';

  console.log(`  [${icon}] ${name.padEnd(25)} score=${String(score).padStart(3)}  expected=${expectedClass.padEnd(7)}  got=${actual}`);

  if (status === 'PASS') passed++;
  else failed++;
}

console.log('\n--- Known soup sellers (should score below threshold) ---\n');

const slop = ['XKJRUIE', 'TUYUUOR', 'BFGQWZ', 'QQPFHD', 'JKDFLMN', 'ZXRTPQW', 'GHBNMK', 'FVRTXPL'];
slop.forEach(name => {
  const s = DesoupScorer.score(name);
  assert(name, s, 'slop');
});

console.log('\n--- Known good sellers (should score above threshold) ---\n');

const good = [
  'Sony Official', 'Anker Direct', 'Bose Store', 'Apple', 'Samsung',
  'iRobot Store', 'JBL Official', 'Logitech', 'Corsair', 'Razer',
  'Kitchen Aid', 'Dyson Official', 'Philips', 'Panasonic'
];
good.forEach(name => {
  const s = DesoupScorer.score(name);
  const expected = s >= 80 ? 'trusted' : 'neutral';
  assert(name, s, expected);
});

console.log('\n--- Known good short/unusual brands (should not be flagged as slop) ---\n');

const edgeCases = ['LG', '3M', 'VIZIO', 'BENGOO', 'MPOW', 'TOZO', 'AUKEY', 'TCL', 'JBL', 'MSI'];
edgeCases.forEach(name => {
  const s = DesoupScorer.score(name);
  const cls = DesoupScorer.classify(s, THRESHOLD);
  const isOk = cls !== 'slop';
  const status = isOk ? 'PASS' : 'FAIL';
  const icon = isOk ? '+' : 'X';

  console.log(`  [${icon}] ${name.padEnd(25)} score=${String(s).padStart(3)}  class=${cls} (should NOT be slop)`);

  if (isOk) passed++;
  else failed++;
});

// --- scoreMulti tests ---

console.log('\n--- scoreMulti: enriched multi-signal scoring ---\n');

function assertMulti(desc, result, expectedClass) {
  const ok = result.classification === expectedClass;
  const icon = ok ? '+' : 'X';
  console.log(`  [${icon}] ${desc.padEnd(50)} score=${String(result.score).padStart(3)}  expected=${expectedClass.padEnd(7)}  got=${result.classification}`);
  if (ok) passed++;
  else failed++;
}

// Legitimate brand + seller + good signals
assertMulti(
  'Anker brand + AnkerDirect seller + Amazon ship',
  DesoupScorer.scoreMulti('Anker Direct', 'AnkerDirect', {
    shipsFromAmazon: true,
    hasBrandStore: true,
    hasBrand: true,
    hasSeller: true
  }),
  'trusted'
);

// Soup brand + soup seller + no signals
assertMulti(
  'XKJRUIE brand + XKJRUIE seller, no signals',
  DesoupScorer.scoreMulti('XKJRUIE', 'XKJRUIE Store', {
    shipsFromAmazon: false,
    hasBrandStore: false,
    hasBrand: true,
    hasSeller: true
  }),
  'slop'
);

// Soup brand but ships from Amazon (still should be slop)
assertMulti(
  'BFGQWZ brand, ships from Amazon',
  DesoupScorer.scoreMulti('BFGQWZ', null, {
    shipsFromAmazon: true,
    hasBrandStore: false,
    hasBrand: true,
    hasSeller: false
  }),
  'slop'
);

// Good brand, no seller info
assertMulti(
  'Sony brand, no seller',
  DesoupScorer.scoreMulti('Sony', null, {
    shipsFromAmazon: false,
    hasBrandStore: true,
    hasBrand: true,
    hasSeller: false
  }),
  'trusted'
);

// No data at all
const noData = DesoupScorer.scoreMulti(null, null, null);
assertMulti(
  'null brand + null seller',
  noData,
  'neutral'
);

// Known good brand with Amazon fulfillment
assertMulti(
  'Samsung brand + Amazon seller',
  DesoupScorer.scoreMulti('Samsung', 'Amazon.com', {
    shipsFromAmazon: true,
    hasBrandStore: true,
    hasBrand: true,
    hasSeller: true
  }),
  'trusted'
);

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
process.exit(failed > 0 ? 1 : 0);
