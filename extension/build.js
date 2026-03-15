const fs = require('fs');
const path = require('path');

const TARGETS = ['chrome', 'firefox'];
const DIST = path.join(__dirname, 'dist');

const SHARED_FILES = [
  'src/scorer.js',
  'src/enricher.js',
  'src/selectors.js',
  'src/content.js',
  'src/content.css',
  'src/background.js',
  'src/popup/popup.html',
  'src/popup/popup.css',
  'src/popup/popup.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

function copyFileSync(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function clean() {
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true, force: true });
  }
}

function build(target) {
  const outDir = path.join(DIST, target);

  const manifestSrc = target === 'firefox'
    ? 'manifest.firefox.json'
    : 'manifest.json';

  copyFileSync(
    path.join(__dirname, manifestSrc),
    path.join(outDir, 'manifest.json')
  );

  for (const file of SHARED_FILES) {
    copyFileSync(
      path.join(__dirname, file),
      path.join(outDir, file)
    );
  }

  console.log(`  Built: dist/${target}/`);
}

console.log('Building Desouper...\n');
clean();

for (const target of TARGETS) {
  build(target);
}

console.log('\nDone. Load the appropriate dist/ folder in your browser:');
console.log('  Chrome:  chrome://extensions -> Load unpacked -> dist/chrome/');
console.log('  Firefox: about:debugging -> Load Temporary Add-on -> dist/firefox/manifest.json');
