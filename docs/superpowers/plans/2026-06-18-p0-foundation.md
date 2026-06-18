# P0 地基阶段 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变任何视觉和功能的前提下,启用 react-router-dom、引入 Tailwind、拆分 App.jsx(2732 行 → 多个职责单一文件),为后续 P1/P2/P3 改造建立干净地基。

**Architecture:** 按三层拆分 App.jsx:纯函数(零依赖,先搬,零风险)→ hook(状态+逻辑,需验证状态流)→ 展示组件(纯渲染)。react-router-dom 用 createBrowserRouter 替换手写路由。Tailwind 只装不用,P0 结束现有 CSS 原样生效。

**Tech Stack:** React 18、react-router-dom 6(已装)、Tailwind CSS(新引入)、Vite 5

**Spec:** `docs/superpowers/specs/2026-06-18-frontend-overhaul-design.md` 第四节

**P0 核心约束:不改视觉、不改功能。** 每个任务结束后 `npm run dev` 必须能跑,所有功能行为与改造前完全一致。

---

## 文件结构(P0 结束时)

```
frontend-react/
├─ tailwind.config.js          # 新增:Tailwind 配置(结构 token 预留,P0 空 extend)
├─ postcss.config.js           # 新增:Tailwind 的 PostCSS 插件
├─ src/
│  ├─ main.jsx                 # 修改:换 createBrowserRouter
│  ├─ router.jsx               # 新增:路由表集中管理
│  ├─ App.jsx                  # 修改:瘦身到 < 300 行,只剩组装
│  ├─ styles.css               # 不动
│  ├─ app-shell.css            # 不动
│  ├─ styleTheme.js            # 不动
│  ├─ index.css                # 新增:Tailwind 指令入口(@tailwind base/components/utilities)
│  ├─ lib/
│  │  ├─ constants.js          # 新增:所有 LABELS / 枚举 / 初始状态常量
│  │  ├─ chapterPlan.js        # 新增:章节计划相关纯函数
│  │  ├─ revisionDiff.js       # 新增:校改 diff 纯函数
│  │  ├─ assets.js             # 新增:SVG data URL 生成纯函数(封面/分卷/角色徽章)
│  │  └─ chapterBundle.js      # 新增:normalizeChapterBundle / mergeFeedbackIntoPlan
│  ├─ hooks/
│  │  └─ useWorkbench.js       # 新增:从 App 抽出的创作台状态+逻辑
│  ├─ components/workbench/
│  │  ├─ WorkflowTabs.jsx      # 新增:顶部步骤 tab
│  │  ├─ PanelCard.jsx         # 新增:通用面板卡片
│  │  └─ Modal.jsx             # 新增:通用模态
│  └─ pages/
│     └─ WorkbenchPage.jsx     # 删除:死代码(只 import 没内容的半成品)
```

---

## Task 1: 引入 Tailwind CSS(只装不用)

**Files:**
- Create: `frontend-react/tailwind.config.js`
- Create: `frontend-react/postcss.config.js`
- Create: `frontend-react/src/index.css`
- Modify: `frontend-react/src/main.jsx:11`
- Modify: `frontend-react/package.json`(通过 npm 安装)

- [ ] **Step 1: 安装 Tailwind 及其 PostCSS 插件**

Run:
```bash
cd frontend-react
npm install -D tailwindcss @tailwindcss/postcss postcss autoprefixer
```
Expected: 安装成功,`package.json` devDependencies 新增 tailwindcss、@tailwindcss/postcss、postcss、autoprefixer

- [ ] **Step 2: 创建 Tailwind 配置**

Create `frontend-react/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // P0 阶段不扩展任何 token,保持空 extend,避免影响现有样式
  // P3 阶段会在这里加入结构 token(间距/圆角/字号/控件高度)
  theme: {
    extend: {}
  },
  plugins: []
};
```

- [ ] **Step 3: 创建 PostCSS 配置**

Create `frontend-react/postcss.config.js`:
```js
export default {
  plugins: {
    '@tailwindcss/postcss': {}
  }
};
```

- [ ] **Step 4: 创建 Tailwind 指令入口**

Create `frontend-react/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: 在 main.jsx 引入 index.css**

Modify `frontend-react/src/main.jsx` 第 11 行,在 `import './styles.css';` 之前加入:
```js
import './index.css';
```
注意:`index.css` 必须在 `styles.css` 之前引入,确保现有 CSS 能覆盖 Tailwind base reset。

- [ ] **Step 6: 验证开发服务器能跑且视觉不变**

Run:
```bash
cd frontend-react
npm run dev
```
Expected: Vite 启动成功,打开 http://127.0.0.1:5173/ ,所有页面视觉与改造前完全一致(Tailwind base reset 可能带来极细微的 margin 归零,但现有 CSS 已显式设置 margin,应无可见变化)。若发现视觉异常,检查 `index.css` 引入顺序。

- [ ] **Step 7: Commit**

```bash
cd frontend-react && cd ..
git add frontend-react/tailwind.config.js frontend-react/postcss.config.js frontend-react/src/index.css frontend-react/src/main.jsx frontend-react/package.json frontend-react/package-lock.json
git commit -m "chore(fe): introduce tailwind css (installed, not yet used)"
```

---

## Task 2: 删除死代码 WorkbenchPage.jsx

**Files:**
- Delete: `frontend-react/src/pages/WorkbenchPage.jsx`
- Verify: `frontend-react/src/main.jsx`(确认没有 import 它)

- [ ] **Step 1: 确认 WorkbenchPage.jsx 是死代码**

Run:
```bash
cd frontend-react
grep -rn "WorkbenchPage" src/
```
Expected: 只在 `src/pages/WorkbenchPage.jsx` 自身出现,无其他文件 import 它(main.jsx 的 `/workbench` 路由指向 `App`,不是 `WorkbenchPage`)。若发现有 import,停止此任务并报告。

- [ ] **Step 2: 删除文件**

Run:
```bash
cd frontend-react
rm src/pages/WorkbenchPage.jsx
```

- [ ] **Step 3: 验证开发服务器仍能跑**

Run:
```bash
cd frontend-react
npm run dev
```
Expected: 启动成功,所有路由可访问,无报错。

- [ ] **Step 4: Commit**

```bash
git add frontend-react/src/pages/WorkbenchPage.jsx
git commit -m "chore(fe): remove dead WorkbenchPage.jsx stub"
```

---

## Task 3: 抽取常量到 lib/constants.js

**Files:**
- Create: `frontend-react/src/lib/constants.js`
- Modify: `frontend-react/src/App.jsx:16-221`(移除常量定义,改为 import)

App.jsx 开头有大量常量定义(行 16-221):`emptyChapterStructure`、`emptyChapterPlan`、`initialGenerationState`、`emptyStorylineDraft`、`ROLE_EXECUTION_*`、`ROLE_*_LABELS`、`PLATFORM_LABELS`、`GENRE_LABELS`、`SUBGENRE_LABELS`、`TEMPLATE_LABELS`。这些是纯数据,零依赖,第一个搬最安全。

- [ ] **Step 1: 创建 lib/constants.js,原样搬入所有常量**

Create `frontend-react/src/lib/constants.js`,内容为 App.jsx 第 16-221 行的所有常量定义,原样复制(不做任何修改),并在文件末尾 export:

```js
export const emptyChapterStructure = {
  chapter_goal: '',
  key_scenes: '',
  conflict_escalation: '',
  character_change: '',
  reader_payoff: '',
  ending_hook: ''
};

export const emptyChapterPlan = {
  volume_number: 1,
  chapter_name: '',
  summary: '',
  chapter_mission: '',
  emotion_target: '',
  previous_hook: '',
  outline_text: '',
  character_notes: '',
  ending_hook: '',
  scene_outline: [],
  appearing_roles: [],
  role_execution: [],
  structured_content: {},
  chapter_structure: emptyChapterStructure,
  generation_settings: { word_count: 3000 },
  main_storyline_id: '',
  target_storylines: []
};

export const initialGenerationState = {
  hasContent: false,
  content: '',
  statusKind: 'info',
  statusTitle: '等待生成',
  statusText: '先补齐章节计划，再开始生成正文。',
  metaText: '还没有生成正文',
  wordCountLabel: '暂无正文',
  previewText: '生成后这里会显示正文摘要。',
  feedbackSummary: '生成完成后，这里会整理本章推进结果。',
  feedbackFocus: '下一章重点会在这里收口。'
};

export const emptyStorylineDraft = {
  id: '',
  volume_number: 1,
  storyline_name: '',
  storyline_type: 'branch',
  description: '',
  core_conflict: '',
  start_chapter: 1,
  end_chapter: 10
};

export const ROLE_EXECUTION_DIMENSIONS = new Set([
  'story_function',
  'risk_attitude',
  'trust_pattern',
  'responsibility',
  'emotion_control',
  'power_desire',
  'social_style',
  'moral_boundary'
]);

export const ROLE_EXECUTION_DIRECTIONS = new Set([
  'hold',
  'more_open',
  'more_closed',
  'more_active',
  'more_passive',
  'more_stable',
  'more_extreme',
  'stronger',
  'weaker'
]);

export const ROLE_EXECUTION_SCOPES = new Set([
  'temporary',
  'stage',
  'core_candidate'
]);

export const ROLE_EXECUTION_CONFIDENCE = new Set([
  'low',
  'medium',
  'high'
]);

export const ROLE_DIMENSION_LABELS = {
  story_function: '剧情职责',
  risk_attitude: '风险态度',
  trust_pattern: '信任方式',
  responsibility: '责任承担',
  emotion_control: '情绪控制',
  power_desire: '权力欲望',
  social_style: '社交姿态',
  moral_boundary: '道德边界'
};

export const ROLE_DIRECTION_LABELS = {
  hold: '保持当前底色',
  more_open: '更开放',
  more_closed: '更收敛',
  more_active: '更主动',
  more_passive: '更被动',
  more_stable: '更稳定',
  more_extreme: '更极端',
  stronger: '更强化',
  weaker: '更减弱'
};

export const ROLE_SCOPE_LABELS = {
  temporary: '本章表现',
  stage: '阶段变化',
  core_candidate: '底色候选'
};

export const ROLE_CONFIDENCE_LABELS = {
  low: '低',
  medium: '中',
  high: '高'
};

export const PLATFORM_LABELS = {
  qidian: '起点中文网',
  fanqie: '番茄小说',
  custom: '自定义渠道',
  '未设置': '未设置'
};

export const GENRE_LABELS = {
  urban: '都市异能',
  fantasy: '玄幻修真',
  xianxia: '仙侠修真',
  scifi: '科幻末世',
  history: '历史穿越',
  game: '游戏竞技',
  mystery: '悬疑惊悚',
  sports: '体育竞技',
  lightnovel: '轻小说动漫',
  fanfic: '同人衍生',
  military: '军事战争',
  western_fantasy: '西幻魔幻',
  wuxia: '传统武侠',
  supernatural: '灵异鬼怪',
  system: '系统流'
};

export const SUBGENRE_LABELS = {
  urban_superpower: '超能力',
  urban_rebirth: '重生流',
  urban_system: '系统流',
  urban_medical: '医圣流',
  urban_business: '商战流',
  fantasy_cultivation: '传统修真',
  fantasy_martial: '高武世界',
  fantasy_magic: '魔法大陆',
  fantasy_bloodline: '血脉流',
  xianxia_classic: '凡人流',
  xianxia_genius: '天才流',
  xianxia_sect: '宗门流',
  scifi_apocalypse: '末世流',
  scifi_interstellar: '星际文明',
  scifi_cyberpunk: '赛博朋克',
  scifi_time: '时空穿梭',
  history_threekingdoms: '三国流',
  history_tang: '大唐流',
  history_ming: '大明流',
  history_alternate: '架空历史',
  game_vrmmo: '虚拟网游',
  game_esports: '电子竞技',
  game_streamer: '主播流',
  mystery_horror: '恐怖灵异',
  mystery_detective: '侦探推理',
  mystery_survival: '求生无限',
  sports_basketball: '篮球',
  sports_football: '足球',
  sports_comprehensive: '综合体育',
  light_acg: '二次元',
  light_isekai: '异世界',
  light_school: '校园恋爱',
  fanfic_anime: '动漫同人',
  fanfic_novel: '小说同人',
  fanfic_movie: '影视同人',
  military_modern: '现代军旅',
  military_ancient: '古代战争',
  military_mercenary: '雇佣兵',
  western_dnd: 'DND风格',
  western_lord: '领主建设',
  western_god: '封神流',
  wuxia_classic: '金庸风格',
  wuxia_gulong: '古龙风格',
  wuxia_unconventional: '新派武侠',
  supernatural_fengshui: '风水相术',
  supernatural_exorcism: '道士捉鬼',
  supernatural_folklore: '民间传说',
  system_signin: '签到流',
  system_growth: '成长流',
  system_shop: '商城流'
};

export const TEMPLATE_LABELS = {
  fast_pace: '快节奏',
  detailed: '细腻描写',
  balanced: '均衡推进'
};
```

- [ ] **Step 2: 在 App.jsx 顶部加入 import,删除原有常量定义**

Modify `frontend-react/src/App.jsx`:
- 在第 1 行 `import { Fragment, useEffect, useRef, useState } from 'react';` 之后加入:
```js
import {
  emptyChapterStructure,
  emptyChapterPlan,
  initialGenerationState,
  emptyStorylineDraft,
  ROLE_EXECUTION_DIMENSIONS,
  ROLE_EXECUTION_DIRECTIONS,
  ROLE_EXECUTION_SCOPES,
  ROLE_EXECUTION_CONFIDENCE,
  ROLE_DIMENSION_LABELS,
  ROLE_DIRECTION_LABELS,
  ROLE_SCOPE_LABELS,
  ROLE_CONFIDENCE_LABELS,
  PLATFORM_LABELS,
  GENRE_LABELS,
  SUBGENRE_LABELS,
  TEMPLATE_LABELS
} from './lib/constants.js';
```
- 删除原 App.jsx 第 16-221 行的所有常量定义(从 `const emptyChapterStructure = {` 到 `const TEMPLATE_LABELS = { ... };` 结束)

- [ ] **Step 3: 验证开发服务器能跑且功能不变**

Run:
```bash
cd frontend-react
npm run dev
```
Expected: 启动成功,打开 `/workbench`,选书、改章节计划、生成等所有功能正常。若报 "X is not defined",说明有常量漏 import,对照 App.jsx 里用到的常量补全 import。

- [ ] **Step 4: Commit**

```bash
git add frontend-react/src/lib/constants.js frontend-react/src/App.jsx
git commit -m "refactor(fe): extract constants to lib/constants.js"
```

---

## Task 4: 抽取 SVG 资产生成纯函数到 lib/assets.js

**Files:**
- Create: `frontend-react/src/lib/assets.js`
- Modify: `frontend-react/src/App.jsx:253-340`(移除函数,改为 import)

App.jsx 行 253-340 有 4 个纯函数:`buildSvgDataUrl`、`createBookCoverDataUrl`、`createVolumePosterDataUrl`、`createCharacterBadgeDataUrl`、`buildCharacterSubtitle`。它们零依赖(只用了字符串拼接),安全搬运。

- [ ] **Step 1: 创建 lib/assets.js,原样搬入**

Create `frontend-react/src/lib/assets.js`,将 App.jsx 第 253-340 行的这 5 个函数原样复制,每个函数前加 `export`:

```js
export function buildSvgDataUrl(markup) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markup)}`;
}

export function createBookCoverDataUrl(title = '未命名书籍') {
  // ... 原样复制 App.jsx 第 257-284 行的函数体
}

export function createVolumePosterDataUrl(volumeLabel = '第1卷') {
  // ... 原样复制 App.jsx 第 286-306 行的函数体
}

export function createCharacterBadgeDataUrl(name = '角色') {
  // ... 原样复制 App.jsx 第 308-330 行的函数体
}

export function buildCharacterSubtitle(character) {
  // ... 原样复制 App.jsx 第 332-340 行的函数体
}
```

(实现时从 App.jsx 原样复制函数体,不做任何逻辑修改,只加 export 关键字)

- [ ] **Step 2: 在 App.jsx 加入 import,删除原函数**

Modify `frontend-react/src/App.jsx`:
- 在常量 import 之后加入:
```js
import {
  buildSvgDataUrl,
  createBookCoverDataUrl,
  createVolumePosterDataUrl,
  createCharacterBadgeDataUrl,
  buildCharacterSubtitle
} from './lib/assets.js';
```
- 删除原 App.jsx 第 253-340 行这 5 个函数的定义

- [ ] **Step 3: 验证开发服务器能跑且功能不变**

Run:
```bash
cd frontend-react
npm run dev
```
Expected: 启动成功,`/workbench` 全书规划区的书籍封面、分卷海报、角色徽章 SVG 正常显示。

- [ ] **Step 4: Commit**

```bash
git add frontend-react/src/lib/assets.js frontend-react/src/App.jsx
git commit -m "refactor(fe): extract svg asset generators to lib/assets.js"
```

---

## Task 5: 抽取章节计划纯函数到 lib/chapterPlan.js

**Files:**
- Create: `frontend-react/src/lib/chapterPlan.js`
- Modify: `frontend-react/src/App.jsx:223-221, 342-653`(移除函数,改为 import)

App.jsx 中以下纯函数属于章节计划处理,零依赖(或只依赖已抽出的 constants/assets):

- `normalizeLines`(223)、`normalizeRoleName`(230)、`normalizeRoleList`(243)、`summarizeText`(248)
- `buildConstraintBriefText`(342)
- `composeStructuredOutline`(397)、`composeSceneOutlineText`(416)、`buildChapterStructureFromPlan`(434)
- `normalizeRoleExecution`(449)、`describeRoleExecutionMeta`(509)
- `buildGenerationRiskReview`(517)
- `getPlanWordCount`(585)、`normalizeChapterStructureForSave`(595)、`prepareOutlineModalPlan`(610)、`withStructuredChapterPlan`(630)
- `hasText`(655)

- [ ] **Step 1: 创建 lib/chapterPlan.js**

Create `frontend-react/src/lib/chapterPlan.js`。将上述函数原样复制,每个加 `export`。文件顶部需要从 constants.js import 依赖的常量:

```js
import {
  emptyChapterStructure,
  ROLE_EXECUTION_DIMENSIONS,
  ROLE_EXECUTION_DIRECTIONS,
  ROLE_EXECUTION_SCOPES,
  ROLE_EXECUTION_CONFIDENCE,
  ROLE_DIMENSION_LABELS,
  ROLE_DIRECTION_LABELS,
  ROLE_SCOPE_LABELS,
  ROLE_CONFIDENCE_LABELS
} from './constants.js';

export function normalizeLines(text) {
  // ... 原样复制 App.jsx 第 223-228 行
}

export function normalizeRoleName(role) {
  // ... 原样复制 App.jsx 第 230-241 行
}

export function normalizeRoleList(roles) {
  // ... 原样复制 App.jsx 第 243-245 行
}

export function summarizeText(text, fallback = '') {
  // ... 原样复制 App.jsx 第 248-251 行
}

export function buildConstraintBriefText(generationConstraints, overrides) {
  // ... 原样复制 App.jsx 第 342-353 行
}

export function composeStructuredOutline(structure) {
  // ... 原样复制 App.jsx 第 397-414 行
}

export function composeSceneOutlineText(sceneOutline) {
  // ... 原样复制 App.jsx 第 416-431 行
}

export function buildChapterStructureFromPlan(plan) {
  // ... 原样复制 App.jsx 第 434-447 行(注意它调用了 composeSceneOutlineText,同文件内引用)
}

export function normalizeRoleExecution(roleExecution, appearingRoles = [], characterNotes = '', mission = '') {
  // ... 原样复制 App.jsx 第 449-507 行
}

export function describeRoleExecutionMeta(item) {
  // ... 原样复制 App.jsx 第 509-515 行
}

export function buildGenerationRiskReview(plan, generationConstraints, overrides = {}) {
  // ... 原样复制 App.jsx 第 517-583 行
}

export function getPlanWordCount(plan) {
  // ... 原样复制 App.jsx 第 585-593 行
}

export function normalizeChapterStructureForSave(plan) {
  // ... 原样复制 App.jsx 第 595-608 行
}

export function prepareOutlineModalPlan(plan) {
  // ... 原样复制 App.jsx 第 610-628 行(注意它调用 withStructuredChapterPlan,同文件内引用,需保证 withStructuredChapterPlan 在其之前定义或用函数声明提升)
}

export function withStructuredChapterPlan(plan, structure) {
  // ... 原样复制 App.jsx 第 630-653 行(注意它调用 composeStructuredOutline / getPlanWordCount,同文件内引用)
}

export function hasText(value) {
  // ... 原样复制 App.jsx 第 655-657 行
}
```

注意:这些函数之间有相互调用(如 `prepareOutlineModalPlan` 调 `withStructuredChapterPlan`,`withStructuredChapterPlan` 调 `composeStructuredOutline` 和 `getPlanWordCount`)。由于都用 `function` 声明(有提升),顺序不影响。保持原文件中的顺序即可。

- [ ] **Step 2: 在 App.jsx 加入 import,删除原函数**

Modify `frontend-react/src/App.jsx`:
- 加入 import:
```js
import {
  normalizeLines,
  normalizeRoleName,
  normalizeRoleList,
  summarizeText,
  buildConstraintBriefText,
  composeStructuredOutline,
  composeSceneOutlineText,
  buildChapterStructureFromPlan,
  normalizeRoleExecution,
  describeRoleExecutionMeta,
  buildGenerationRiskReview,
  getPlanWordCount,
  normalizeChapterStructureForSave,
  prepareOutlineModalPlan,
  withStructuredChapterPlan,
  hasText
} from './lib/chapterPlan.js';
```
- 删除 App.jsx 中这些函数的原定义(行 223-228、230-241、243-245、248-251、342-353、397-414、416-431、434-447、449-507、509-515、517-583、585-593、595-608、610-628、630-653、655-657)

- [ ] **Step 3: 验证开发服务器能跑且功能不变**

Run:
```bash
cd frontend-react
npm run dev
```
Expected: 启动成功。重点验证:`/workbench` 章节计划保存、角色执行参数编辑、生成风险简报显示、字数计算均正常。若报 "X is not defined",补全 import。

- [ ] **Step 4: Commit**

```bash
git add frontend-react/src/lib/chapterPlan.js frontend-react/src/App.jsx
git commit -m "refactor(fe): extract chapter plan pure functions to lib/chapterPlan.js"
```

---

## Task 6: 抽取校改 diff 纯函数到 lib/revisionDiff.js

**Files:**
- Create: `frontend-react/src/lib/revisionDiff.js`
- Modify: `frontend-react/src/App.jsx:659-839`(移除函数,改为 import)

App.jsx 行 659-839 有校改相关的纯函数:`normalizeParagraphs`、`splitRevisionParagraphs`、`normalizeRevisionText`、`normalizeSentences`、`similarityScore`、`buildRevisionDiff`、`buildRevisionSentenceDiff`、`buildRevisionEvaluation`、`buildLocalChapterFeedback`。

注意:`buildLocalChapterFeedback` 调用了 `chapterPlan` 里的函数吗?检查发现它只用了传入参数,无外部依赖,可一并搬走。但它语义上属于章节反馈而非纯 diff,放在 chapterBundle.js 更合适——不过为减少任务数,P0 阶段先统一放 revisionDiff.js(它和校改/反馈同属"生成后处理")。

- [ ] **Step 1: 创建 lib/revisionDiff.js**

Create `frontend-react/src/lib/revisionDiff.js`。原样复制上述函数,加 export:

```js
export function normalizeParagraphs(text) {
  // ... 原样复制 App.jsx 第 659-664 行
}

export function splitRevisionParagraphs(text) {
  // ... 原样复制 App.jsx 第 666-669 行
}

export function normalizeRevisionText(value) {
  // ... 原样复制 App.jsx 第 672-674 行
}

export function normalizeSentences(text) {
  // ... 原样复制 App.jsx 第 676-681 行
}

export function similarityScore(left, right) {
  // ... 原样复制 App.jsx 第 683-692 行
}

export function buildRevisionDiff(original, draft) {
  // ... 原样复制 App.jsx 第 694-720 行(调用 normalizeParagraphs / similarityScore,同文件内)
}

export function buildRevisionSentenceDiff(original, draft) {
  // ... 原样复制 App.jsx 第 722-748 行
}

export function buildRevisionEvaluation(original, draft, diffItems) {
  // ... 原样复制 App.jsx 第 750-802 行
}

export function buildLocalChapterFeedback({
  content,
  plan,
  chapterStructure,
  mainStorylineLabel,
  targetStorylineLabel,
  rhythmHints
}) {
  // ... 原样复制 App.jsx 第 804-839 行
}
```

- [ ] **Step 2: 在 App.jsx 加入 import,删除原函数**

Modify `frontend-react/src/App.jsx`:
- 加入 import:
```js
import {
  normalizeParagraphs,
  splitRevisionParagraphs,
  normalizeRevisionText,
  normalizeSentences,
  similarityScore,
  buildRevisionDiff,
  buildRevisionSentenceDiff,
  buildRevisionEvaluation,
  buildLocalChapterFeedback
} from './lib/revisionDiff.js';
```
- 删除 App.jsx 第 659-839 行这些函数的原定义

- [ ] **Step 3: 验证开发服务器能跑且功能不变**

Run:
```bash
cd frontend-react
npm run dev
```
Expected: 启动成功。重点验证:校改弹窗的段落 diff、句子 diff、校改评估、本地反馈生成都正常。

- [ ] **Step 4: Commit**

```bash
git add frontend-react/src/lib/revisionDiff.js frontend-react/src/App.jsx
git commit -m "refactor(fe): extract revision diff pure functions to lib/revisionDiff.js"
```

---

## Task 7: 抽取 chapterBundle 纯函数到 lib/chapterBundle.js

**Files:**
- Create: `frontend-react/src/lib/chapterBundle.js`
- Modify: `frontend-react/src/App.jsx:903-983`(移除函数,改为 import)

App.jsx 行 903-983 有 `normalizeChapterBundle` 和 `mergeFeedbackIntoPlan`。它们依赖已抽出的 `emptyChapterPlan`、`buildChapterStructureFromPlan`、`normalizeRoleExecution` 等。

- [ ] **Step 1: 创建 lib/chapterBundle.js**

Create `frontend-react/src/lib/chapterBundle.js`:

```js
import { emptyChapterPlan, initialGenerationState } from './constants.js';
import { buildChapterStructureFromPlan, normalizeRoleExecution, getPlanWordCount } from './chapterPlan.js';

export function normalizeChapterBundle(bundle, chapterNumber) {
  // ... 原样复制 App.jsx 第 903-971 行的函数体
}

export function mergeFeedbackIntoPlan(plan, chapterFeedback) {
  // ... 原样复制 App.jsx 第 973-983 行的函数体
}
```

- [ ] **Step 2: 在 App.jsx 加入 import,删除原函数**

Modify `frontend-react/src/App.jsx`:
- 加入 import:
```js
import { normalizeChapterBundle, mergeFeedbackIntoPlan } from './lib/chapterBundle.js';
```
- 删除 App.jsx 第 903-983 行这两个函数的原定义

- [ ] **Step 3: 验证开发服务器能跑且功能不变**

Run:
```bash
cd frontend-react
npm run dev
```
Expected: 启动成功。重点验证:切换章节时章计划数据正确加载和回填,生成后反馈正确 merge 进 plan。

- [ ] **Step 4: Commit**

```bash
git add frontend-react/src/lib/chapterBundle.js frontend-react/src/App.jsx
git commit -m "refactor(fe): extract chapter bundle normalizers to lib/chapterBundle.js"
```

---

## Task 8: 抽取展示组件到 components/workbench/

**Files:**
- Create: `frontend-react/src/components/workbench/WorkflowTabs.jsx`
- Create: `frontend-react/src/components/workbench/PanelCard.jsx`
- Create: `frontend-react/src/components/workbench/Modal.jsx`
- Modify: `frontend-react/src/App.jsx:841-901`(移除组件,改为 import)
- Modify: `frontend-react/src/App.jsx`(删除 `renderBlockedConstraints` 函数,355-395 行,它是纯渲染组件,一并抽出)

App.jsx 行 841-901 有 3 个纯展示组件:`WorkflowTabs`、`PanelCard`、`Modal`。另外 `renderBlockedConstraints`(355-395)也是纯渲染函数。这 4 个零状态依赖,安全抽出。

- [ ] **Step 1: 创建 WorkflowTabs.jsx**

Create `frontend-react/src/components/workbench/WorkflowTabs.jsx`:
```jsx
import { workflowSteps } from '../../mockData.js';
import '../../app-shell.css';

export default function WorkflowTabs({ activeStep, onChange }) {
  return (
    <div className="workflow-tabs" role="tablist" aria-label="创作主链">
      {workflowSteps.map((step) => (
        <button
          key={step.id}
          type="button"
          className={`workflow-tab${step.id === activeStep ? ' is-active' : ''}`}
          onClick={() => onChange(step.id)}
          role="tab"
          aria-selected={step.id === activeStep}
        >
          <span className="workflow-tab-index">{step.index}</span>
          <span className="workflow-tab-title">{step.title}</span>
          <span className="workflow-tab-note">{step.note}</span>
        </button>
      ))}
    </div>
  );
}
```
(原样复制 App.jsx 第 841-860 行的 JSX,workflowSteps 原来 App.jsx 从 mockData import,这里直接在组件内 import)

- [ ] **Step 2: 创建 PanelCard.jsx**

Create `frontend-react/src/components/workbench/PanelCard.jsx`:
```jsx
export default function PanelCard({ eyebrow, title, description, children, actions, headerActions, className = '' }) {
  return (
    <section className={`panel-card${className ? ` ${className}` : ''}`}>
      {eyebrow || title || description || headerActions ? (
        <div className="panel-card-head">
          <div className="panel-card-head-main">
            {eyebrow ? <span className="panel-card-eyebrow">{eyebrow}</span> : null}
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {headerActions ? <div className="panel-card-head-actions">{headerActions}</div> : null}
        </div>
      ) : null}
      <div className="panel-card-body">{children}</div>
      {actions ? <div className="panel-card-actions">{actions}</div> : null}
    </section>
  );
}
```
(原样复制 App.jsx 第 862-879 行)

- [ ] **Step 3: 创建 Modal.jsx**

Create `frontend-react/src/components/workbench/Modal.jsx`:
```jsx
export default function Modal({ title, description, children, onClose, actions }) {
  const modalClassName = title.includes('正文校改') ? 'modal-panel modal-panel-revision' : 'modal-panel';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={modalClassName} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <button type="button" className="ghost-btn modal-close-btn" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  );
}
```
(原样复制 App.jsx 第 881-901 行)

- [ ] **Step 4: 创建 BlockedConstraints.jsx(renderBlockedConstraints 抽出)**

Create `frontend-react/src/components/workbench/BlockedConstraints.jsx`:
```jsx
export default function BlockedConstraints({ generationConstraints, constraintOverrides, setConstraintOverride }) {
  const blocked = Array.isArray(generationConstraints?.blocked) ? generationConstraints.blocked : [];
  if (blocked.length === 0) return null;

  return (
    // ... 原样复制 App.jsx 第 355-395 行的 JSX(return 部分改为组件 return)
  );
}
```
(函数体原样复制,只是从 `function renderBlockedConstraints(...)` 改为 `export default function BlockedConstraints(...)`)

- [ ] **Step 5: 在 App.jsx 加入 import,删除原组件/函数**

Modify `frontend-react/src/App.jsx`:
- 加入 import:
```js
import WorkflowTabs from './components/workbench/WorkflowTabs.jsx';
import PanelCard from './components/workbench/PanelCard.jsx';
import Modal from './components/workbench/Modal.jsx';
import BlockedConstraints from './components/workbench/BlockedConstraints.jsx';
```
- 删除 App.jsx 第 841-901 行(WorkflowTabs/PanelCard/Modal 定义)和第 355-395 行(renderBlockedConstraints 定义)
- 删除 App.jsx 顶部对 `workflowSteps` 的 import(已移入 WorkflowTabs.jsx),检查 App.jsx 其他地方是否还用 workflowSteps,若不用则删 import
- App.jsx 中调用 `renderBlockedConstraints(...)` 的地方改为 `<BlockedConstraints ... />`(搜索 `renderBlockedConstraints` 替换为 JSX 组件用法)

- [ ] **Step 6: 验证开发服务器能跑且功能不变**

Run:
```bash
cd frontend-react
npm run dev
```
Expected: 启动成功。重点验证:WorkflowTabs 切换正常,PanelCard 渲染正常,校改弹窗 Modal 正常,禁止项约束区块(_blocked)渲染和切换正常。

- [ ] **Step 7: Commit**

```bash
git add frontend-react/src/components/workbench/ frontend-react/src/App.jsx
git commit -m "refactor(fe): extract presentational components to components/workbench/"
```

---

## Task 9: 启用 react-router-dom 替换手写路由

**Files:**
- Create: `frontend-react/src/router.jsx`
- Modify: `frontend-react/src/main.jsx`

现状 `main.jsx` 手写了基于 `pushState` 的路由。react-router-dom 6 已在 package.json,启用 `createBrowserRouter`。

- [ ] **Step 1: 创建 router.jsx 路由表**

Create `frontend-react/src/router.jsx`:
```jsx
import { createBrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import BooksPage from './pages/BooksPage.jsx';
import ChangelogPage from './pages/ChangelogPage.jsx';
import GenerationLogicPage from './pages/GenerationLogicPage.jsx';
import StartGuidePage from './pages/StartGuidePage.jsx';
import StyleManagerPage from './pages/StyleManagerPage.jsx';
import AppLayout from './AppLayout.jsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <StartGuidePage /> },
      { path: 'start-guide', element: <StartGuidePage /> },
      { path: 'books', element: <BooksPage /> },
      { path: 'books/outlines', element: <BooksPage /> },
      { path: 'books/characters', element: <BooksPage /> },
      { path: 'books/chapters', element: <BooksPage /> },
      { path: 'changelog', element: <ChangelogPage /> },
      { path: 'generation-logic', element: <GenerationLogicPage /> },
      { path: 'style-manager', element: <StyleManagerPage /> },
      { path: 'workbench', element: <App /> }
    ]
  }
]);
```

注意:原 main.jsx 有一个特殊逻辑——访问 `/visual-sample` 时 replaceState 到 `/style-manager`。react-router 用 `loader` 或 `<Navigate>` 处理。这里用路由配置直接重定向:

在 router.jsx 的 children 数组中加入:
```jsx
{ path: 'visual-sample', element: <Navigate to="/style-manager" replace /> }
```
并在顶部 import 加入 `import { Navigate } from 'react-router-dom';`

- [ ] **Step 2: 改造 AppLayout 使用 react-router 的 Outlet 和 useNavigate**

Modify `frontend-react/src/AppLayout.jsx`。现状它接收 `navigate` 和 `currentPath` props。改为使用 react-router 的 `useNavigate`、`useLocation` 和 `<Outlet>`:

```jsx
import './app-shell.css';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  function isActive(path) {
    return currentPath === path ? ' is-active' : '';
  }

  function handleNav(to) {
    return (event) => {
      event.preventDefault();
      navigate(to);
    };
  }

  return (
    <>
      <nav className="app-navbar">
        <div className="app-navbar-inner">
          <a href="/start-guide" className="nav-brand" onClick={handleNav('/start-guide')}>Alipro</a>
          <div className="nav-links">
            <a href="/start-guide" className={`nav-link${isActive('/start-guide')}`} onClick={handleNav('/start-guide')}>启动引导</a>
            <a href="/books" className={`nav-link${isActive('/books')}`} onClick={handleNav('/books')}>资料库</a>
            <a href="/workbench" className={`nav-link${isActive('/workbench')}`} onClick={handleNav('/workbench')}>创作台</a>
            <a href="/generation-logic" className={`nav-link${isActive('/generation-logic')}`} onClick={handleNav('/generation-logic')}>生成链路</a>
            <a href="/changelog" className={`nav-link${isActive('/changelog')}`} onClick={handleNav('/changelog')}>更新日志</a>
            <a href="/style-manager" className={`nav-link${isActive('/style-manager')}`} onClick={handleNav('/style-manager')}>样式管理</a>
          </div>
        </div>
      </nav>
      <Outlet />
    </>
  );
}
```

- [ ] **Step 3: 改造 main.jsx 使用 RouterProvider**

Modify `frontend-react/src/main.jsx`,替换整个 AppRouter 逻辑:

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router.jsx';
import { applyStyleTheme, getStoredStyleTheme } from './styleTheme.js';
import './index.css';
import './styles.css';

applyStyleTheme(getStoredStyleTheme());

ReactDOM.createRoot(document.getElementById('root')).render(
  <RouterProvider router={router} />
);
```

注意:原 main.jsx 第 13 行 `applyStyleTheme(getStoredStyleTheme());` 保留。删除原来的 ROUTES 对象、AppRouter 函数、useState/popstate 逻辑。

- [ ] **Step 4: 检查各页面内部是否有 window.location 跳转**

Run:
```bash
cd frontend-react
grep -rn "window.location" src/
```
Expected: 可能发现 `window.location.href = '/books?...'` 这类跳转(在 App.jsx 里)。这些在 P0 阶段**保持原样不改**——它们仍能工作(会触发整页刷新,功能正确,只是不是 SPA 跳转)。P1 阶段再统一改用 `useNavigate`。记录这些位置,P1 处理。

- [ ] **Step 5: 验证所有路由可访问**

Run:
```bash
cd frontend-react
npm run dev
```
Expected: 逐一访问以下路由,均正常渲染:
- http://127.0.0.1:5173/ (启动引导)
- http://127.0.0.1:5173/books (资料库)
- http://127.0.0.1:5173/workbench (创作台)
- http://127.0.0.1:5173/changelog (更新日志)
- http://127.0.0.1:5173/start-guide (启动引导)
- http://127.0.0.1:5173/generation-logic (生成链路)
- http://127.0.0.1:5173/style-manager (样式管理)
- http://127.0.0.1:5173/visual-sample (应重定向到 /style-manager)

导航栏点击各链接应无整页刷新(SPA 跳转)。浏览器后退/前进按钮正常工作。

- [ ] **Step 6: Commit**

```bash
git add frontend-react/src/router.jsx frontend-react/src/AppLayout.jsx frontend-react/src/main.jsx
git commit -m "refactor(fe): replace hand-written router with react-router-dom"
```

---

## Task 10: 抽取 useWorkbench hook(P0 最后一步,需谨慎验证)

**Files:**
- Create: `frontend-react/src/hooks/useWorkbench.js`
- Modify: `frontend-react/src/App.jsx`(App 组件瘦身)

这是 P0 最复杂的一步。App.jsx 的 `App` 组件(行 985+)包含大量 useState、useEffect 和处理函数。P0 阶段**不强行全部抽出**——只抽出能干净分离的部分,目标是 App.jsx 降到 < 300 行。如果某些状态和 JSX 深度耦合难以分离,保留在 App.jsx,P2 再处理。

**P0 的保守策略**:抽出"状态声明 + 数据加载 effect + 纯数据处理函数",保留"JSX 渲染 + 直接操作 DOM ref 的函数"在 App.jsx。

- [ ] **Step 1: 评估可抽出的部分**

阅读 App.jsx 第 985-1760 行(App 组件体)。识别:
- 纯状态声明(985-1015):可抽出
- useWorkbenchData 调用(1017-1027):已在单独 hook,保留调用
- loadChapter effect(1029-1058):可抽出
- constraintOverrides effect(1055-1058):可抽出
- 处理函数(handleSaveChapterPlan / handleGenerateChapter / handlePolishRevision 等):可抽出,但它们引用了大量 setState 和 ref
- 计算属性(selectedMainStoryline / generationRiskReview 等):可抽出

**判断**:由于处理函数和计算属性数量庞大且相互引用,强行全抽出会形成巨型 hook 文件,且容易引入 bug。P0 采取**最小可行抽取**:

只抽出到 `useWorkbench.js` 的内容:
- 所有 useState 声明
- loadChapter effect
- constraintOverrides reset effect
- 返回状态和 setState 函数

处理函数暂留 App.jsx(它们在 P2 组件化时会自然分散到各组件)。

- [ ] **Step 2: 创建 useWorkbench.js(最小版)**

Create `frontend-react/src/hooks/useWorkbench.js`:

```js
import { useEffect, useRef, useState } from 'react';
import { useWorkbenchData } from '../useWorkbenchData.js';
import { fetchChapterSetupBundle } from '../workbenchApi.js';
import { emptyChapterPlan, initialGenerationState, emptyStorylineDraft } from '../lib/constants.js';
import { normalizeChapterBundle } from '../lib/chapterBundle.js';

export function useWorkbench() {
  const [planningModal, setPlanningModal] = useState(null);
  const [chapterModal, setChapterModal] = useState(null);
  const [savingState, setSavingState] = useState({ loading: false, error: '' });
  const [planningNotice, setPlanningNotice] = useState('');
  const [chapterNumber, setChapterNumber] = useState(1);
  const [chapterContext, setChapterContext] = useState({});
  const [chapterView, setChapterView] = useState({});
  const [storylineOptions, setStorylineOptions] = useState([]);
  const [draftChapterPlan, setDraftChapterPlan] = useState(emptyChapterPlan);
  const [constraintOverrides, setConstraintOverrides] = useState({});
  const [generationRiskConfirmed, setGenerationRiskConfirmed] = useState(false);
  const [draftStoryline, setDraftStoryline] = useState(emptyStorylineDraft);
  const [generationState, setGenerationState] = useState(initialGenerationState);
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [revisionOriginal, setRevisionOriginal] = useState('');
  const [revisionDraft, setRevisionDraft] = useState('');
  const [revisionRequirement, setRevisionRequirement] = useState('增强画面感和爽点，保持原剧情不变。');
  const [revisionSuggestions, setRevisionSuggestions] = useState(null);
  const [revisionSaving, setRevisionSaving] = useState(false);
  const [revisionPolishing, setRevisionPolishing] = useState(false);
  const [revisionError, setRevisionError] = useState('');
  const [revisionNotice, setRevisionNotice] = useState('');
  const [revisionFocusIndex, setRevisionFocusIndex] = useState(0);
  const [revisionAppliedChangeKeys, setRevisionAppliedChangeKeys] = useState([]);
  const revisionParagraphRefs = useRef(new Map());
  const revisionChangeRefs = useRef(new Map());
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false);
  const [activeStep, setActiveStep] = useState('book');

  const workbenchData = useWorkbenchData();
  const { selectedBookId } = workbenchData;

  useEffect(() => {
    if (!selectedBookId) return;

    let cancelled = false;
    async function loadChapter() {
      setLoadingChapter(true);
      try {
        const bundle = await fetchChapterSetupBundle(selectedBookId, chapterNumber);
        if (cancelled) return;
        const normalized = normalizeChapterBundle(bundle, chapterNumber);
        setChapterContext(normalized.context);
        setChapterView(normalized.view);
        setStorylineOptions(normalized.storylineOptions);
        setDraftChapterPlan(normalized.draft);
        setGenerationState(normalized.generation);
      } finally {
        if (!cancelled) setLoadingChapter(false);
      }
    }

    loadChapter();
    return () => {
      cancelled = true;
    };
  }, [selectedBookId, chapterNumber]);

  useEffect(() => {
    setConstraintOverrides({});
    setGenerationRiskConfirmed(false);
  }, [selectedBookId, chapterNumber]);

  return {
    // workbench data
    ...workbenchData,
    // chapter state
    activeStep, setActiveStep,
    planningModal, setPlanningModal,
    chapterModal, setChapterModal,
    savingState, setSavingState,
    planningNotice, setPlanningNotice,
    chapterNumber, setChapterNumber,
    chapterContext, setChapterContext,
    chapterView, setChapterView,
    storylineOptions, setStorylineOptions,
    draftChapterPlan, setDraftChapterPlan,
    constraintOverrides, setConstraintOverrides,
    generationRiskConfirmed, setGenerationRiskConfirmed,
    draftStoryline, setDraftStoryline,
    generationState, setGenerationState,
    loadingChapter, setLoadingChapter,
    isGenerating, setIsGenerating,
    resultModalOpen, setResultModalOpen,
    revisionOriginal, setRevisionOriginal,
    revisionDraft, setRevisionDraft,
    revisionRequirement, setRevisionRequirement,
    revisionSuggestions, setRevisionSuggestions,
    revisionSaving, setRevisionSaving,
    revisionPolishing, setRevisionPolishing,
    revisionError, setRevisionError,
    revisionNotice, setRevisionNotice,
    revisionFocusIndex, setRevisionFocusIndex,
    revisionAppliedChangeKeys, setRevisionAppliedChangeKeys,
    revisionParagraphRefs,
    revisionChangeRefs,
    promptPreviewOpen, setPromptPreviewOpen
  };
}
```

- [ ] **Step 3: 改造 App.jsx 使用 useWorkbench**

Modify `frontend-react/src/App.jsx` 的 `App` 组件(行 985+):
- 删除所有 useState/useRef 声明(985-1015)
- 删除 useWorkbenchData 调用(1017-1027)
- 删除两个 useEffect(1029-1058)
- 在组件开头调用:
```js
const {
  books, selectedBookId, setSelectedBookId, planningState, loadingBooks, loadingPlanning, error, reloadPlanning, reloadBooks,
  activeStep, setActiveStep, planningModal, setPlanningModal, chapterModal, setChapterModal,
  savingState, setSavingState, planningNotice, setPlanningNotice, chapterNumber, setChapterNumber,
  chapterContext, setChapterContext, chapterView, setChapterView, storylineOptions, setStorylineOptions,
  draftChapterPlan, setDraftChapterPlan, constraintOverrides, setConstraintOverrides,
  generationRiskConfirmed, setGenerationRiskConfirmed, draftStoryline, setDraftStoryline,
  generationState, setGenerationState, loadingChapter, setLoadingChapter, isGenerating, setIsGenerating,
  resultModalOpen, setResultModalOpen, revisionOriginal, setRevisionOriginal, revisionDraft, setRevisionDraft,
  revisionRequirement, setRevisionRequirement, revisionSuggestions, setRevisionSuggestions,
  revisionSaving, setRevisionSaving, revisionPolishing, setRevisionPolishing,
  revisionError, setRevisionError, revisionNotice, setRevisionNotice,
  revisionFocusIndex, setRevisionFocusIndex, revisionAppliedChangeKeys, setRevisionAppliedChangeKeys,
  revisionParagraphRefs, revisionChangeRefs, promptPreviewOpen, setPromptPreviewOpen
} = useWorkbench();
```
- 加入 import:
```js
import { useWorkbench } from './hooks/useWorkbench.js';
```
- 删除 App.jsx 顶部对 `useWorkbenchData` 和 `fetchChapterSetupBundle` 的 import(已移入 hook)。但注意:`normalizeChapterBundle` 已在 hook 内用,App.jsx 里若还有其他地方直接用则保留 import。

- [ ] **Step 4: 验证开发服务器能跑且所有功能不变(关键验证)**

Run:
```bash
cd frontend-react
npm run dev
```
Expected: 启动成功。**逐一验证以下完整流程**(这是 P0 验收的核心):
1. 打开 `/workbench`,书籍列表加载正常
2. 选择一本书,章节计划加载正常(章号、任务、角色执行等回填)
3. 修改章节计划并保存,保存成功且数据回填
4. 切换到上一章/下一章(改章号),数据正确切换
5. 点击生成正文,生成成功,正文显示,反馈写回
6. 打开校改弹窗,校改流程正常
7. 编辑剧情线,保存正常
8. 打开/关闭各类模态正常

若任何一步异常,检查是否漏解构某个状态,或 hook 里 effect 依赖是否正确。

- [ ] **Step 5: 检查 App.jsx 行数**

Run:
```bash
cd frontend-react
wc -l src/App.jsx
```
Expected: 应显著低于 2732 行(目标 < 1500 行,因为只抽了状态和 effect,处理函数和 JSX 还在)。记录实际行数。P2 会继续瘦身到 < 300。

- [ ] **Step 6: Commit**

```bash
git add frontend-react/src/hooks/useWorkbench.js frontend-react/src/App.jsx
git commit -m "refactor(fe): extract workbench state and effects to useWorkbench hook"
```

---

## Task 11: P0 整体验收

**Files:** 无新文件,纯验证

- [ ] **Step 1: 完整功能回归测试**

Run:
```bash
cd frontend-react
npm run dev
```
逐一验证所有路由和核心功能(参照 Task 10 Step 4 的清单),外加:
- `/books` 资料库:列表、搜索、新建/编辑弹窗、详情页
- `/style-manager` 样式管理:切换预设、调整维度、保存
- `/changelog` 更新日志显示
- `/start-guide` 启动引导显示
- `/generation-logic` 生成链路显示

- [ ] **Step 2: 验证生产构建**

Run:
```bash
cd frontend-react
npm run build
```
Expected: 构建成功,无报错。`dist/` 生成。

- [ ] **Step 3: 检查文件行数达标**

Run:
```bash
cd frontend-react
wc -l src/App.jsx src/lib/*.js src/hooks/*.js src/components/workbench/*.jsx src/router.jsx
```
Expected:
- `App.jsx` < 1500 行(P0 目标,P2 再降到 < 300)
- `lib/constants.js`、`lib/chapterPlan.js`、`lib/revisionDiff.js` 等各自合理
- 无单文件超过 500 行(lib 文件可能较大但都是纯数据/纯函数,可接受;若 chapterPlan.js 超 500,记录但 P0 不强制拆)

- [ ] **Step 4: 确认无死代码残留**

Run:
```bash
cd frontend-react
grep -rn "WorkbenchPage" src/
```
Expected: 无匹配(已删除)。

- [ ] **Step 5: 确认 Tailwind 已装但未强制使用**

Run:
```bash
cd frontend-react
grep -c "className=\"[^\"]*\b\(flex\|grid\|p-\|m-\|text-\|bg-\)" src/App.jsx src/components/workbench/*.jsx
```
Expected: 0 或极少(P0 阶段新代码不用 Tailwind class,保持现有 CSS class)。Tailwind 只是装好能用,P1 才开始用。

- [ ] **Step 6: P0 完成提交(若有未提交的验收修复)**

若验收过程中修复了问题:
```bash
git add -A
git commit -m "chore(fe): P0 foundation complete - tooling, router, file split"
```
若一切正常无需额外提交,标记 P0 完成。

---

## P0 完成标准回顾

- [x] `npm run dev` 能跑,所有路由可访问
- [x] 创作台所有功能行为与改造前完全一致
- [x] 单文件最大不超过 500 行(App.jsx P0 目标 < 1500,P2 再降)
- [x] Tailwind 已配置但未强制使用,现有 CSS 原样生效
- [x] `react-router-dom` 真正接管路由,手写路由代码删除
- [x] 死代码 WorkbenchPage.jsx 已删
- [x] App.jsx 常量/纯函数/展示组件已拆分到 lib/ 和 components/workbench/

P0 完成后,代码地基干净,可安全进入 P1(创作台信息架构重构)。P1 的实现计划将在 P0 完成后单独编写,因为 P1 的文件拆分依赖 P0 落地后的实际结构。
