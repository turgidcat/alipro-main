import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  countPlatformEffectiveWords,
  formatExactWordCount,
  formatWordCountProgress
} from '../src/lib/textMetrics.js';
import {
  WORD_COUNT_POLICY,
  DEFAULT_WORD_COUNT,
  MIN_WORD_COUNT,
  MAX_WORD_COUNT,
  WORD_COUNT_TOLERANCE,
  getWordCountBounds
} from '../src/lib/wordCountPolicy.js';
import {
  extractReadableOutlineText,
  normalizeNarrativeOutlineText
} from '../src/lib/chapterPlan.js';
import {
  buildCharacterRosterPrompt,
  inspectFullOutlineCharacterAlignment,
  normalizeCharacterRoleRoster
} from '../src/lib/roleTiers.js';

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
assert.equal(WORD_COUNT_POLICY.version, '1.0.0');
assert.equal(DEFAULT_WORD_COUNT, 3000);
assert.equal(MIN_WORD_COUNT, 500);
assert.equal(MAX_WORD_COUNT, 10000);
assert.equal(WORD_COUNT_TOLERANCE, 0.15);
assert.deepEqual(getWordCountBounds(DEFAULT_WORD_COUNT), { target: 3000, min: 2550, max: 3450 });
assert.equal(
  normalizeNarrativeOutlineText('```json\n{"outline_text":"主角追查线索，发现旧案。","usage":{"tokens":10}}\n```'),
  '主角追查线索，发现旧案。'
);
assert.equal(
  extractReadableOutlineText({
    main_outline: {
      opening: '危机出现。',
      ending: '主角作出选择。'
    },
    status: 'draft'
  }),
  '危机出现。\n\n主角作出选择。'
);
assert.equal(
  normalizeNarrativeOutlineText('**本章目标：** 主角进入仓库。\n- 找到证据\n- 躲开追兵'),
  '主角进入仓库，找到证据，躲开追兵。'
);
assert.equal(
  extractReadableOutlineText([
    { type: 'output_text', text: '主角拿到真正的账本。' },
    { type: 'image_url', image_url: { url: 'https://example.com/outline.png' } },
    { type: 'tool_call', name: 'save_outline', arguments: '{}' }
  ]),
  '主角拿到真正的账本。'
);

const characterRoster = normalizeCharacterRoleRoster([
  { name: '沈遥', role_tier: 'supporting_major', personality: '冷静' },
  { name: '林烬', role_tier: 'protagonist', personality: '执着' }
]);
assert.deepEqual(characterRoster.map((item) => item.name), ['林烬', '沈遥']);
assert.match(buildCharacterRosterPrompt(characterRoster), /唯一主角：林烬/);
assert.equal(
  inspectFullOutlineCharacterAlignment('主角林烬与主要配角沈遥共同追查旧案。', characterRoster).ok,
  true
);
assert.deepEqual(
  inspectFullOutlineCharacterAlignment('主角是沈遥，林烬作为本书配角。', characterRoster).issues,
  ['大纲把主角“林烬”写成了配角或反派', '大纲把主要配角“沈遥”写成了主角']
);

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
assert.match(booksPage, /mobileLibraryPage === 'outline' && outlineError/);
assert.match(booksPage, /mobileLibraryPage === 'chapters' && chapterPlanError/);
assert.match(booksPage, /点击“保存细纲”后会同步到资料库的“章节与正文”/);
assert.match(booksPage, /requestJson\(`\/books\/\$\{bookId\}\/characters`\)/);
assert.match(booksPage, /inspectFullOutlineCharacterAlignment/);

const appSource = readFileSync(join(srcRoot, 'App.jsx'), 'utf8');
assert.match(appSource, /formatExactWordCount\(currentBook\?\.totalWordCount/);
assert.match(appSource, /hasSavedOutlineAnchor && !hasUnsavedOutlineChanges/);
assert.match(appSource, /保存后资料库才会显示/);

const mobileLibrarySource = readFileSync(join(srcRoot, 'components', 'library', 'MobileLibrarySurface.jsx'), 'utf8');
assert.match(mobileLibrarySource, /章节细纲在“章节与正文”/);

const workbenchApiSource = readFileSync(join(srcRoot, 'workbenchApi.js'), 'utf8');
assert.match(workbenchApiSource, /outlineData\.volume_outline \?\? current\?\.volume_outline/);
assert.match(workbenchApiSource, /outlineData\.detailed_outline \?\? current\?\.detailed_outline/);
assert.match(workbenchApiSource, /buildCharacterRosterSummary\(visibleCharacters\) \|\| legacyRoleSummary/);
assert.match(workbenchApiSource, /bookId: payload\.bookId \|\| ''/);

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

console.log('Frontend contracts verified: word counts, outline cleanup, character-role alignment, reader layout, and preview scrolling.');
