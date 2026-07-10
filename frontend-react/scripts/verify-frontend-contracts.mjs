import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  countPlatformEffectiveWords,
  formatExactWordCount,
  formatWordCountProgress
} from '../src/lib/textMetrics.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = join(root, 'src');

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

assert.equal(countPlatformEffectiveWords('你好，世界！\nA-1'), 6);
assert.equal(countPlatformEffectiveWords('  林烬\n推门。  '), 4);
assert.equal(formatExactWordCount(11516), '11,516字');
assert.equal(formatWordCountProgress(2110, 3000), '有效字数 2,110字 / 目标 3,000字');

const sourceFiles = listFiles(srcRoot).filter((path) => /\.(js|jsx)$/.test(path));
const duplicateCounters = sourceFiles
  .filter((path) => !path.endsWith(join('lib', 'textMetrics.js')))
  .filter((path) => /function\s+countPlatformEffectiveWords\s*\(/.test(readFileSync(path, 'utf8')))
  .map((path) => relative(root, path));
assert.deepEqual(duplicateCounters, [], `发现重复有效字数实现: ${duplicateCounters.join(', ')}`);

const rawLengthDisplays = sourceFiles
  .filter((path) => /\.length\s*}\s*字/.test(readFileSync(path, 'utf8')))
  .map((path) => relative(root, path));
assert.deepEqual(rawLengthDisplays, [], `发现使用 .length 的字数展示: ${rawLengthDisplays.join(', ')}`);

const revisionEditor = readFileSync(join(srcRoot, 'components', 'workbench', 'RevisionEditor.jsx'), 'utf8');
assert.doesNotMatch(revisionEditor, /revision(?:Original|Draft)\.length\s*}\s*字/);

const booksPage = readFileSync(join(srcRoot, 'pages', 'BooksPage.jsx'), 'utf8');
assert.match(booksPage, /from '\.\.\/lib\/textMetrics\.js'/);
assert.doesNotMatch(booksPage, /function\s+formatWords\s*\(/);

const appSource = readFileSync(join(srcRoot, 'App.jsx'), 'utf8');
assert.match(appSource, /formatExactWordCount\(currentBook\?\.totalWordCount/);

const revisionDiff = readFileSync(join(srcRoot, 'lib', 'revisionDiff.js'), 'utf8');
assert.match(revisionDiff, /countPlatformEffectiveWords\(original\)/);
assert.match(revisionDiff, /countPlatformEffectiveWords\(draft\)/);

const productCss = readFileSync(join(srcRoot, 'product-ui.css'), 'utf8');
assert.match(
  productCss,
  /body \.workbench-generation-preview,\s*body \.workbench-prose-paper\s*\{[^}]*overflow-y:\s*auto;/s
);
assert.match(
  productCss,
  /@media \(max-width: 720px\)[\s\S]*body \.workbench-generation-preview,\s*body \.workbench-prose-paper\s*\{[^}]*overflow:\s*visible;/
);
assert.match(
  productCss,
  /body \.books-admin-page\.library-app-shell\.is-chapter-reader-page\s*\{[^}]*display:\s*block;/s
);

const mainSource = readFileSync(join(srcRoot, 'main.jsx'), 'utf8');
assert.match(mainSource, /import '\.\/product-ui\.css';/);

console.log('Frontend contracts verified: word counts, reader layout, and preview scrolling.');
