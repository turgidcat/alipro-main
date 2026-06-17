import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const targetFile = path.join(repoRoot, 'frontend-react', 'src', 'pages', 'StyleManagerPage.jsx');

const source = fs.readFileSync(targetFile, 'utf8');

const checks = [
  {
    id: 'option-pill-single-line',
    desc: '选项按钮必须是单行紧凑结构，不能再带说明副文案。',
    test: () =>
      /function OptionPill\(\{\s*active,\s*label,\s*onClick\s*\}\)/.test(source) &&
      !/<span>\{note\}<\/span>/.test(source) &&
      !/OPTION_NOTES/.test(source)
  },
  {
    id: 'option-pill-density',
    desc: '选项按钮必须保持紧凑高度，避免重新变回大卡片。',
    test: () =>
      /\.style-option-grid\s*\{[\s\S]*minmax\(108px,\s*1fr\)[\s\S]*?\}/.test(source) &&
      /\.style-option-pill\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;[\s\S]*min-height:\s*36px;[\s\S]*\}/.test(source)
  },
  {
    id: 'range-grid-layout',
    desc: '细节微调必须使用双列滑杆布局，避免该分组单独出现内滚动。',
    test: () =>
      /group\.key === 'fine' \? ' is-range-grid' : ''/.test(source) &&
      /\.style-group-fields\.is-range-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*\}/.test(source)
  },
  {
    id: 'record-strip-layout',
    desc: '主题统计区必须保持横条信息带，避免重新长回三张大卡。',
    test: () =>
      /className="style-theme-record-strip"/.test(source) &&
      /\.style-theme-record-card\s*\{[\s\S]*display:\s*flex;[\s\S]*justify-content:\s*space-between;[\s\S]*\}/.test(source)
  },
  {
    id: 'badge-no-collapse',
    desc: '摘要区和列表区的右侧角标必须禁止收缩，避免被正文挤成竖排。',
    test: () =>
      /\.style-scene-list-item em\s*\{[\s\S]*justify-content:\s*center;[\s\S]*flex-shrink:\s*0;[\s\S]*white-space:\s*nowrap;[\s\S]*\}/.test(source)
  },
  {
    id: 'workspace-height-budget',
    desc: '样式管理主工作区必须预留足够的纵向空间，否则左栏容易重新出现长滚动。',
    test: () =>
      /\.style-manager-workspace\s*\{[\s\S]*height:\s*clamp\(620px,\s*calc\(100vh - 150px\),\s*760px\);[\s\S]*\}/.test(source)
  },
  {
    id: 'control-body-scroll-container',
    desc: '控制区本体必须是独立滚动容器，避免页面结构被改散后失去可控性。',
    test: () =>
      /\.style-manager-control-body,[\s\S]*\.style-manager-scene-scroll\s*\{[\s\S]*overflow:\s*auto;[\s\S]*\}/.test(source)
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
