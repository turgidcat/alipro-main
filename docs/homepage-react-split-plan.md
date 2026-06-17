# 首页创作台 React 拆分方案

> 最后更新：2026-06-09
> 适用项目：`alipro-main`
> 目标：把首页创作台迁成一个边界清晰、可热更新、可持续迭代的 React 子应用，同时尽量不打断当前项目运行

---

## 1. 这份文档解决什么

前面我们已经定了：

- 迁 React 是长期正确方向
- 但不能整站一把梭
- 必须按业务区域整块迁

那么现在的问题就变成：

`首页创作台这一块，具体该怎么拆`

这份文档会回答：

1. 首页创作台迁移时，React 应该接管哪些区域
2. 组件怎么拆
3. 状态放哪里
4. 该调用哪些现有接口
5. 哪些旧脚本暂时保留，哪些以后要下线

---

## 2. 先说核心结论

首页不是要被“局部 React 化”，而是要被重构成一个：

`React 创作工作台`

这个工作台只接管首页最核心的创作区域：

- 当前书籍与全书规划
- 单章设置
- 正文生成与结果查看

而不是一上来把所有顶栏、所有弹窗、所有辅助功能都一起吞进去。

一句话：

`先迁创作引擎，不先迁全站外壳`

---

## 3. 首页创作台的迁移边界

## 3.1 React 应优先接管的区域

建议 React 首批接管下面这 3 个主区：

### A. 第一步：全书规划区

对应当前首页里的：

- 当前书籍卡片
- 基础信息卡片
- 角色摘要卡片
- 大纲摘要卡片

### B. 第二步：单章设置区

对应当前首页里的：

- 章号 / 章名
- 本章大纲卡片
- 本章新增角色卡片
- 本章大纲编辑弹窗
- 本章角色编辑弹窗

### C. 第三步：正文生成区

对应当前首页里的：

- 生成章节
- 批量生成
- 生成结果
- 阅读展开
- 章节历史切换

## 3.2 React 首批不要接管的区域

这些先别动：

- 顶部导航栏
- 用户管理弹窗
- 外观设置弹窗
- 更新日志入口
- 暗黑模式切换
- 资料库页面

原因很简单：

- 它们不是创作主链核心
- 它们和旧全局脚本耦合更深
- 先迁它们，收益远小于风险

所以首页第一阶段的正确边界是：

```text
旧页面外壳
  └─ React 创作工作台
```

---

## 4. 推荐挂载方式

## 4.1 不直接推翻整个 `index.html`

第一阶段不要把整个 [index.html](/C:/Users/turgidcat/Desktop/alipro-main/frontend/index.html) 全删掉。

更稳的做法是：

- 保留现有页面骨架
- 在主内容区域给 React 留一个根节点
- 让 React 接管工作台主体

例如：

```html
<div id="creative-workbench-root"></div>
```

## 4.2 旧区域与新区域物理隔离

规则必须定死：

- React 只操作 `creative-workbench-root`
- 旧脚本不再直接操作这个根节点内部 DOM
- React 组件不再依赖旧页面的 `document.getElementById(...)`

这一步是为了彻底避免：

`新旧两套渲染逻辑互相拽头发`

---

## 5. 组件拆分方案

这一节是最重要的施工图。

## 5.1 顶层组件树

建议首页 React 工作台先拆成这棵树：

```text
CreativeWorkbenchApp
├─ WorkbenchShell
│  ├─ WorkflowTabs
│  ├─ BookPlanningPanel
│  ├─ ChapterSetupPanel
│  └─ ContentGenerationPanel
├─ ChapterOutlineModal
├─ ChapterCharacterModal
├─ PlanningPreviewModal
├─ ChapterPreviewModal
└─ BatchGenerateModal
```

## 5.2 各组件职责

### `CreativeWorkbenchApp`

职责：

- 作为首页创作台总入口
- 管当前书籍、当前步骤、核心共享状态
- 管所有接口调用协调

它是：

`工作台总控台`

### `WorkbenchShell`

职责：

- 管工作台整体布局
- 承载三步切换视图

它不管业务细节，只管：

- 当前显示哪一步
- 哪个面板展开

### `WorkflowTabs`

职责：

- 显示三步主链
- 切换步骤

当前文案：

- `全书规划`
- `单章设置`
- `正文生成`

### `BookPlanningPanel`

职责：

- 当前书籍选择与保存
- 基础信息编辑
- 角色摘要展示与编辑入口
- 大纲摘要展示与编辑入口

建议子组件继续拆：

```text
BookPlanningPanel
├─ CurrentBookCard
├─ BookMetaCard
├─ CharacterSummaryCard
└─ OutlineSummaryCard
```

### `ChapterSetupPanel`

职责：

- 当前章号 / 章名
- 本章大纲概览
- 本章新增角色概览
- 打开章节编辑弹窗

建议子组件：

```text
ChapterSetupPanel
├─ ChapterHeaderCard
├─ ChapterOutlineSummaryCard
└─ ChapterCharacterSummaryCard
```

### `ContentGenerationPanel`

职责：

- 生成章节
- 批量生成
- 展示正文结果
- 阅读预览
- 章节历史导航

建议子组件：

```text
ContentGenerationPanel
├─ GenerateActionBar
├─ OutputResultPanel
├─ ChapterHistoryNavigator
└─ ExportActionBar
```

### `ChapterOutlineModal`

职责：

- 编辑本章任务
- 编辑情绪方向
- 编辑承接
- 编辑大纲文本
- 编辑主推进剧情线
- 编辑关联剧情线
- 编辑结尾钩子

它将成为未来最重要的章节规划入口。

### `ChapterCharacterModal`

职责：

- 编辑本章新增角色
- 生成本章新增角色

### `PlanningPreviewModal`

职责：

- 查看全书角色摘要 / 大纲摘要全文

### `ChapterPreviewModal`

职责：

- 查看章节计划说明书
- 查看本章新增角色全文

### `BatchGenerateModal`

职责：

- 批量生成章数设置
- 生成前检查结果展示

---

## 6. 状态拆分方案

React 最大的价值之一，就是把现在散落一地的状态收起来。

## 6.1 顶层共享状态

这些状态应该放在 `CreativeWorkbenchApp`：

| 状态 | 说明 |
|---|---|
| `currentBookId` | 当前书籍 ID |
| `activeWorkflowStep` | 当前步骤 |
| `currentBook` | 当前书籍基础信息 |
| `planningSummary` | 首页全书摘要数据 |
| `chapterPlan` | 当前章规划对象 |
| `generatedContent` | 当前正文结果 |
| `chapterHistory` | 历史章节导航 |
| `currentChapterContextHint` | 当前章上下文提示 |
| `storylineOptions` | 当前可选剧情线列表 |
| `loadingState` | 全局加载态 |

## 6.2 面板内局部状态

这些可以放在对应面板或弹窗内部：

| 组件 | 局部状态 |
|---|---|
| `BookPlanningPanel` | 书名输入中、类型选择中 |
| `ChapterOutlineModal` | 表单草稿、弹窗内输入态 |
| `ChapterCharacterModal` | 本章角色草稿 |
| `BatchGenerateModal` | 章数、检查结果 |

## 6.3 明确禁止的状态放法

迁 React 后，禁止继续这样放：

- 同时一份在 DOM
- 一份在全局变量
- 一份在 React state
- 一份在 localStorage

正式来源必须尽量收口到：

`React state + 后端 API`

---

## 7. 数据对象映射方案

为了不让 React 组件继续接触一堆原始字段，建议先定义前端工作台专用对象。

## 7.1 书籍对象

```ts
type WorkbenchBook = {
  id: string | null;
  title: string;
  genre: string;
  subgenre: string;
  targetPlatform: string;
  template: string;
};
```

## 7.2 全书摘要对象

```ts
type PlanningSummary = {
  characterSummary: string;
  outlineSummary: string;
  characterCountLabel: string;
  outlineStatusLabel: string;
};
```

## 7.3 当前章规划对象

```ts
type ChapterPlanModel = {
  chapterNumber: number;
  chapterName: string;
  chapterMission: string;
  emotionTarget: string;
  outlineText: string;
  characterNotes: string;
  previousHook: string;
  endingHook: string;
  mainStorylineId: string;
  targetStorylineIds: string[];
};
```

## 7.4 正文结果对象

```ts
type GeneratedChapter = {
  chapterNumber: number;
  chapterName: string;
  content: string;
  updatedAt: string;
};
```

---

## 8. API 对接方案

React 迁移阶段不应重写全部接口，优先复用现有接口。

## 8.1 首页创作台首批直接复用的接口

| 用途 | 接口 |
|---|---|
| 获取书籍列表 | `GET /api/books` |
| 获取单本书 | `GET /api/books/:id` |
| 创建书籍 | `POST /api/books` |
| 更新书籍 | `PUT /api/books/:id` |
| 获取章节规划 | `GET /api/books/:bookId/chapter-plans/:chapterNumber` |
| 保存章节规划 | `POST /api/books/:bookId/chapter-plans/:chapterNumber` |
| 获取剧情线列表 | `GET /api/storylines/:bookId/storylines` |
| 获取章节历史 | `GET /api/books/:bookId/chapters` |
| 生成正文 | `POST /api/generate` |

## 8.2 首页创作台优先追加的接口能力

后面建议补：

- 获取首页工作台聚合数据
- 保存全书摘要专用接口
- 保存单章设置专用接口

例如：

| 用途 | 建议接口 |
|---|---|
| 获取首页初始化数据 | `GET /api/workbench/:bookId` |
| 保存全书规划摘要 | `PUT /api/workbench/:bookId/planning-summary` |
| 保存单章设置 | `PUT /api/workbench/:bookId/chapter/:chapterNumber` |

这样 React 前端后面就不用继续自己拼好多散接口。

---

## 9. 旧脚本保留与淘汰方案

## 9.1 首批保留的旧脚本

这些先保留：

- [utils.js](/C:/Users/turgidcat/Desktop/alipro-main/frontend/js/utils.js)
- [storage.js](/C:/Users/turgidcat/Desktop/alipro-main/frontend/js/storage.js)
- [config-manager.js](/C:/Users/turgidcat/Desktop/alipro-main/frontend/js/config-manager.js)

原因：

- 它们更像基础工具层
- 暂时不必在第一阶段就全迁

## 9.2 首批要逐步替代的旧脚本

这些是 React 创作台迁移时要重点下线的：

- [api.js](/C:/Users/turgidcat/Desktop/alipro-main/frontend/js/api.js)
- [app.js](/C:/Users/turgidcat/Desktop/alipro-main/frontend/js/app.js)
- [ui.js](/C:/Users/turgidcat/Desktop/alipro-main/frontend/js/ui.js)
- [book-gate-overrides.js](/C:/Users/turgidcat/Desktop/alipro-main/frontend/js/book-gate-overrides.js)

不是一下删，而是：

- 首页创作台部分逐步不再依赖它们
- 等 React 工作台稳定后再拆旧逻辑

## 9.3 暂缓处理的旧脚本

这些先别急：

- [mobile-wizard.js](/C:/Users/turgidcat/Desktop/alipro-main/frontend/js/mobile-wizard.js)
- [character-manager.js](/C:/Users/turgidcat/Desktop/alipro-main/frontend/js/character-manager.js)
- [outline-manager.js](/C:/Users/turgidcat/Desktop/alipro-main/frontend/js/outline-manager.js)

因为它们更适合在后续资料库迁移阶段一起整理。

---

## 10. Vite 形态建议

首页创作台迁 React 时，建议直接用 `Vite`。

## 10.1 推荐目录形态

```text
frontend-react/
├─ package.json
├─ vite.config.ts
├─ index.html
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ components/
│  ├─ features/
│  ├─ hooks/
│  ├─ services/
│  ├─ store/
│  └─ styles/
```

## 10.2 推荐功能切分

```text
src/features/
├─ book-planning/
├─ chapter-setup/
├─ content-generation/
└─ shared-preview/
```

这会比按“button / modal / card”零散拆更稳。

---

## 11. 第一版 React 工作台的最小范围

不要一上来把所有功能都背进去。

第一版 React 工作台建议只做下面这些：

## 11.1 必做

- 当前书籍选择与保存
- 全书规划 4 张卡
- 单章设置 3 张卡
- 本章大纲弹窗
- 本章角色弹窗
- 生成章节
- 正文结果展示

## 11.2 暂缓

- 批量生成复杂流程
- 外观设置
- 用户管理
- 暗黑模式细节联动
- 全部辅助弹窗统一化

原因：

- 第一版的任务是“跑通主链”
- 不是“顺手把全站也做完”

---

## 12. 推荐实施顺序

## 12.1 第一步：先建 React 工作台空壳

目标：

- 先让 React 能挂起来
- 先跑通基础布局和步骤切换

## 12.2 第二步：接全书规划区

目标：

- 接当前书籍
- 接基础信息
- 接角色摘要 / 大纲摘要

## 12.3 第三步：接单章设置区

目标：

- 接章号章名
- 接章节规划
- 接剧情线选择
- 接大纲 / 角色弹窗

## 12.4 第四步：接正文生成区

目标：

- 接生成按钮
- 接结果展示
- 接章节历史

## 12.5 第五步：切断旧首页脚本

最后才做：

- 不再让旧首页脚本接管创作台区域
- 保留外壳，替换内核

---

## 13. 最终建议

首页创作台迁 React，最安全的方式不是：

`一点点把旧页面零件替换掉`

而是：

`把首页创作主链整体定义成一个 React 子应用，再逐步接入真实数据`

这套方案的核心价值不是“更时髦”，而是：

- 状态会收口
- 交互会更可控
- 缓存问题会减少
- 新旧系统边界更清楚

如果后面真开始实施，我建议严格按这条线走：

1. 先起 React 工作台空壳
2. 先接首页创作主链
3. 旧外壳先保留
4. 最后再清旧脚本

这样迁完以后，你得到的不会是“又一套半新半旧的前端”，而是真正意义上的：

`首页创作台新内核`
