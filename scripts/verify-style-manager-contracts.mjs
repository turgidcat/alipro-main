import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const targetFile = path.join(repoRoot, 'frontend-react', 'src', 'pages', 'StyleManagerPage.jsx');

const source = fs.readFileSync(targetFile, 'utf8');

const checks = [
  {
    id: 'two-control-imports',
    desc: '样式管理页必须只围绕氛围和明暗两组控制工作。',
    test: () =>
      /STYLE_ATMOSPHERE_OPTIONS/.test(source) &&
      /STYLE_TONE_OPTIONS/.test(source) &&
      !/FIELD_GROUPS/.test(source)
  },
  {
    id: 'legacy-detail-controls-removed',
    desc: '旧的滑杆、细分维度和自定义主题库操作必须移除。',
    test: () =>
      !/type="range"/.test(source) &&
      !/saveCustomStyleTheme/.test(source) &&
      !/deleteCustomStyleTheme/.test(source) &&
      !/getStyleThemeLibrary/.test(source)
  },
  {
    id: 'atmosphere-grid-present',
    desc: '氛围切换必须保留 4 选 1 的预设网格。',
    test: () =>
      /STYLE_ATMOSPHERE_OPTIONS\.map/.test(source) &&
      /4 PRESETS/.test(source)
  },
  {
    id: 'tone-toggle-present',
    desc: '明暗切换必须保留 2 选 1 的独立切换区。',
    test: () =>
      /STYLE_TONE_OPTIONS\.map/.test(source) &&
      /2 MODES/.test(source)
  },
  {
    id: 'workspace-split-layout',
    desc: '样式管理主工作区必须继续保持左右双栏，而不是重新堆回单列控制台。',
    test: () =>
      /xl:grid-cols-\[minmax\(390px,0\.92fr\)_minmax\(0,1\.08fr\)\]/.test(source)
  },
  {
    id: 'preview-scene-tabs',
    desc: '右侧实时预览必须保留多场景切换，而不是只剩静态展示图。',
    test: () =>
      /PREVIEW_SCENES\.map/.test(source) &&
      /LIVE/.test(source)
  }
];

const results = checks.map((check) => ({
  ...check,
  passed: check.test()
}));

const failed = results.filter((item) => !item.passed);

console.log('Style Manager 自检开始');
console.log(`检查文件: ${path.relative(repoRoot, targetFile)}`);
console.log('');

for (const item of results) {
  console.log(`${item.passed ? 'PASS' : 'FAIL'}  ${item.id}`);
  console.log(`      ${item.desc}`);
}

console.log('');

if (failed.length > 0) {
  console.error(`自检未通过，共 ${failed.length} 项失败。`);
  process.exit(1);
}

console.log(`自检通过，共 ${results.length} 项契约检查全部通过。`);
