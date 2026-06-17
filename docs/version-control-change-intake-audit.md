# 版本控制和变更收口审计

## 结论先行

当前目录是一个**存在 `.git` 的正常 Git 工作树**，但它还不是“已有正式提交历史的成熟仓库”。

更准确地说：

- 当前目录存在 `.git`
- 当前分支名是 `main`
- 但 `HEAD` 还不存在
- `git rev-list --count HEAD` 报错
- `git ls-files` 结果为 `0`

这说明当前仓库非常像：

**已经执行过 `git init`，但从未做过第一次提交的仓库。**

所以现在的“大面积 `??` 未跟踪”不只是“本轮改动很多”，而是：

**整个项目本身几乎还没正式纳入版本控制。**

基于这个现实，当前**不适合直接执行 `git add .`**。

---

## 审计表

| 项目 | 结果 | 风险 | 建议 |
| -- | -- | -- | -- |
| Git 仓库存在性 | 存在 `.git`，是 Git 工作树 | 低 | 可以继续做版本控制，但要先做收口审计 |
| 当前分支 | `main` | 低 | 分支名正常 |
| 提交历史 | 没有首个提交，`HEAD` 不存在 | 中 | 当前更像未正式建档的仓库，不应直接全量暂存 |
| 已跟踪文件数量 | `git ls-files = 0` | 高 | 当前没有任何已纳入版本控制的文件 |
| 工作区状态 | 大量 `??` 未跟踪 | 高 | 不能把“本轮改动”和“整个项目未纳管”混为一谈 |
| 忽略规则 | `.gitignore` 已存在，且已忽略部分敏感/产物 | 中 | 覆盖还不完整，建议后续单独收口 |
| 敏感配置 | 已发现真实配置文件路径，如 `config/deploy.config.json`、`tools/guaihub-export-config.json`、`backend/.env` | 高 | 必须继续忽略，不应直接提交 |
| 构建产物 | `frontend-react/dist/` 当前未见忽略规则 | 中 | 建议后续补忽略规则 |
| 审查包 / 快照 | `_project_review_for_chatgpt/`、`backend/data/codex-turn-snapshots.json` 当前未纳入忽略 | 中 | 应先确认是否属于临时产物，再决定是否提交 |
| 本阶段源码与文档改动 | 可识别为正式成果 | 低 | 适合后续按主题分组提交 |

---

## 1. 当前 Git 状态是否健康

### 1.1 基础状态

本地检查结果：

- 当前目录有 `.git`
- 当前分支名：`main`
- `git rev-parse --is-inside-work-tree = true`
- `git rev-parse --show-toplevel` 正常返回仓库根目录

### 1.2 关键异常点

但当前仓库还有一个非常关键的现实：

- `git rev-list --count HEAD` 无法执行
- 提示 `HEAD` 不存在
- `git ls-files` 数量为 `0`

这意味着：

**当前仓库还没有任何正式提交历史。**

所以从版本控制角度看，它不是“已有稳定基线的仓库”，而更像：

```text
git init 过
↓
但还没做第一次提交
```

### 1.3 `git status --short`

当前 `git status --short` 主要表现为整仓大面积 `??`，例如：

- `.gitignore`
- `README.md`
- `backend/`
- `docs/`
- `frontend-react/`
- `frontend/`
- `scripts/`
- `tools/`
- `version.json`

### 1.4 `git status --ignored --short`

当前被忽略的关键内容包括：

- `backend/.env`
- `backend/.env.example`
- `backend/database/novel.db`
- `backend/logs/`
- `backend/node_modules/`
- `frontend-react/node_modules/`
- `config/deploy.config.json`
- `tools/guaihub-export-config.json`
- `guaihub-export-test/`
- 多类日志文件
- `backups/`

### 1.5 当前状态判断

当前 Git 状态本身不是“损坏”，但也**不是适合直接全量暂存的健康收口状态**。

更准确的判断是：

**仓库初始化正常，但版本控制基线尚未建立，必须先做人为分流。**

---

## 2. 当前 `.gitignore` 审计

当前 `.gitignore` 已经覆盖了不少高风险内容。

### 2.1 已明确忽略

已经忽略的内容包括：

- `.env`
- `.env.*`
- `backend/.env`
- `backend/.env.*`
- `node_modules/`
- `backend/node_modules/`
- `backend/database/*.db`
- `backend/logs/`
- `*.log`
- `config/deploy.config.json`
- `config/deploy.config.local.json`
- `tools/guaihub-export-config.json`
- `tools/guaihub-export-config.local.json`
- `guaihub-export-test/`
- `backups/`
- 多类临时脚本、临时压缩包、临时图片、部署临时文件

### 2.2 当前覆盖不足 / 需要后续确认

这份 `.gitignore` 目前还有几个值得注意的点：

#### A. `frontend-react/dist/` 没有明确忽略

当前 `frontend-react/dist/` 存在，但 `.gitignore` 没看到：

- `dist/`
- `frontend-react/dist/`

这意味着构建产物当前有机会被误纳入版本控制。

#### B. `build/` 没有明确忽略

也没有看到：

- `build/`

#### C. `backend/.env.example` 当前被一起忽略了

虽然 `.gitignore` 里有：

- `!.env.example`
- `!*.env.example`

但同时又存在：

- `backend/.env.*`

从当前 `git status --ignored --short` 来看：

- `backend/.env.example` 实际上仍处于忽略状态

这通常不是理想结果，因为：

- `.env.example` 往往应该作为可提交的示例配置文件存在

#### D. 审查包 / 快照类文件未统一处理

例如：

- `_project_review_for_chatgpt/`
- `_project_review_for_chatgpt/project-review-for-chatgpt.zip`
- `backend/data/codex-turn-snapshots.json`

这些目前没有统一忽略策略，需要后续明确是否属于长期应保留资产。

### 2.3 当前判断

当前 `.gitignore` **不是空白，也不是危险缺失**，但还没到可以放心 `git add .` 的程度。

---

## 3. 建议纳入版本控制的文件

以下内容整体上建议纳入版本控制。

### 3.1 正式源码

#### 后端源码

- `backend/routes/`
- `backend/services/`
- `backend/middleware/`
- `backend/utils/`
- `backend/config/`
- `backend/database/init.js`
- `backend/server.js`
- `backend/package.json`
- `backend/package-lock.json`
- `backend/README.md`

#### 前端源码

- `frontend-react/src/`
- `frontend-react/index.html`
- `frontend-react/vite.config.js`
- `frontend-react/package.json`
- `frontend-react/package-lock.json`
- `frontend-react/README.md`

#### 旧前端 / 兼容前端源码

- `frontend/` 下的正式源码文件

### 3.2 正式文档

- `docs/` 下的阶段文档
- `README.md`
- `CODEX_CREATE_PROJECT_REVIEW_PACK.md`（如果这是正式项目文档，而不是临时说明）
- `version.json`
- `.gitignore`

### 3.3 正式脚本

建议纳入版本控制的正式脚本包括：

- `scripts/` 下的正式维护脚本
- `tools/` 下不含敏感配置的正式工具脚本
- 示例配置文件，如：
  - `config/deploy.config.example.json`
  - `tools/guaihub-export-config.sample.json`

### 3.4 本阶段应纳入版本控制的关键成果

这一轮阶段性成果里，明显应该纳入版本控制的主要文件包括：

- `backend/routes/ai.js`
- `backend/routes/storylines.js`
- `backend/services/database.js`
- `backend/services/storyline-generation-service.js`
- `backend/services/outline-prompts.js`
- `docs/` 下各阶段报告与验收文档
- `docs/novel-generation-architecture-index.md`

---

## 4. 建议继续忽略或确认不提交的文件

### 4.1 敏感配置

以下内容不建议提交：

- `backend/.env`
- `config/deploy.config.json`
- `tools/guaihub-export-config.json`
- 任何真实 API key / token / password / server credential

### 4.2 数据库与运行态数据

以下内容不建议提交：

- `backend/database/novel.db`
- 其他 `.db` / `.sqlite` / `.sqlite3`
- 运行期日志
- 运行态缓存

### 4.3 依赖目录

- `backend/node_modules/`
- `frontend-react/node_modules/`

### 4.4 构建产物

当前建议忽略或至少先不要提交：

- `frontend-react/dist/`
- 其他 `dist/`
- 其他 `build/`

### 4.5 审查包 / 导出包 / 快照产物

以下内容建议先确认用途，不要直接纳入：

- `_project_review_for_chatgpt/`
- `_project_review_for_chatgpt/project-review-for-chatgpt.zip`
- `guaihub-chunk-6076.js`
- `guaihub-index.js`
- `backend/data/codex-turn-snapshots.json`

### 4.6 本地日志 / 临时输出

- `backend-err.log`
- `backend-out.log`
- `frontend-err.log`
- `frontend-out.log`
- `backend/logs/`
- `frontend-react/*dev*.log`
- `frontend-react/*live*.log`

### 4.7 需要单独判断的二进制 / 本地工具

例如：

- `scripts/win-sshpass.exe`

这类文件不一定绝对不能提交，但应先确认：

- 它是不是项目长期依赖的一部分
- 还是本地部署临时工具

在没确认前，不建议直接混进首批提交。

---

## 5. 本轮阶段性改动清单

下面这部分不是 `git diff` 意义上的精确对比，因为当前仓库没有基线提交；这里按本阶段实际工作内容做归类。

### A. 业务源码改动

#### `backend/routes/ai.js`

本轮主要改动：

- 增加未来章节细纲访问时的按需 `chapter_plan` 自动补壳逻辑
- 让未来章节在没有原始 `chapter_plan` 时，仍能接入：
  - `timelineSlot`
  - `storyline_context`
  - 正文生成
  - 反馈回写

#### `backend/routes/storylines.js`

本轮主要改动：

- 修复不存在字段导致的查询失败：
  - `character_arc`
  - `trigger_chapter`
  - `resolve_chapter`
- 保留对现有表结构的兼容读取

#### `backend/services/database.js`

本轮主要改动：

- 修复剧情线反馈回写一致性问题
- `syncStorylineProgressFromChapterPlan(...)` 改为：
  - 同章节重跑时替换旧记录
  - 重新计算 `activeBeats`
  - 保持 `touched` 语义，不伪装 `completed`

#### `backend/services/storyline-generation-service.js`

本轮主要改动：

- 卷级时间线生成上下文增强
- `expectedSlotCount` 计算
- `chapterSlots` 结构校验与规范化
- `relatedBeatIds` 过滤
- 时间线覆盖率增强

#### `backend/services/outline-prompts.js`

本轮主要改动：

- 卷级时间线 Prompt 减重
- 展开 `keyBeats`
- 收敛 JSON 输出结构
- 减少截断风险

### B. 文档新增 / 更新

#### 剧情线主链相关

- `docs/storyline-main-loop-phase-acceptance-summary.md`
- `docs/storyline-closed-loop-final-acceptance-report.md`
- `docs/current-progress-active-beats-bugfix-report.md`

#### 卷级时间线相关

- `docs/volume-timeline-quality-diagnosis-report.md`
- `docs/volume-timeline-prompt-slimming-bugfix-report.md`
- `docs/volume-timeline-downstream-consumption-test-report.md`
- `docs/volume-timeline-slot-coverage-bugfix-report.md`
- `docs/volume-timeline-phase-acceptance-summary.md`

#### 未来章节承接相关

- `docs/future-chapter-plan-generation-audit.md`
- `docs/on-demand-chapter-plan-autocreate-report.md`
- `docs/future-chapter-draft-generation-test-report.md`
- `docs/future-chapter-feedback-writeback-test-report.md`
- `docs/future-chapter-acceptance-summary.md`

#### 架构索引

- `docs/novel-generation-architecture-index.md`

### C. 安全 / 配置相关文件

本轮已发现下列真实敏感或高风险配置路径：

- `config/deploy.config.json`
- `tools/guaihub-export-config.json`
- `backend/.env`

这些文件路径应报告，但不应提交真实内容。

同时还存在示例配置文件，可考虑纳入版本控制：

- `config/deploy.config.example.json`
- `tools/guaihub-export-config.sample.json`

---

## 6. 提交分组建议

当前不建议一步提交整个仓库。

如果后续要提交，建议按主题至少拆成这几组：

### 1. 仓库基础纳管 / 忽略规则收口

建议包含：

- `.gitignore`
- `README.md`
- `version.json`
- 示例配置文件
- 必要的根目录元信息

目的：

- 先建立安全的版本控制边界

### 2. 剧情线主链闭环

建议包含：

- `backend/routes/storylines.js`
- `backend/services/database.js`
- 相关剧情线闭环文档

### 3. 卷级时间线生成质量优化

建议包含：

- `backend/services/storyline-generation-service.js`
- `backend/services/outline-prompts.js`
- 相关卷级时间线文档

### 4. 未来章节承接链路

建议包含：

- `backend/routes/ai.js`
- 未来章节承接相关文档

### 5. 阶段文档与架构索引

建议包含：

- `docs/` 下的阶段总结
- `docs/novel-generation-architecture-index.md`

### 6. 工具脚本与附属正式资产

建议单独确认后再提交：

- `scripts/`
- `tools/` 下非敏感正式脚本

这样更容易避免把临时脚本和正式产物混到同一提交里。

---

## 7. 风险提示

### 7.1 当前不适合直接 `git add .`

**不适合。**

原因包括：

1. 当前仓库没有已跟踪基线
2. 全项目都还是未跟踪状态
3. 存在敏感配置文件
4. 存在数据库文件
5. 存在日志文件
6. 存在构建产物
7. 存在审查包 / 快照 / 导出包这类临时或半临时资产

### 7.2 必须先确认是否敏感的文件

- `config/deploy.config.json`
- `tools/guaihub-export-config.json`
- `backend/.env`

### 7.3 必须先确认是否测试 / 临时产物的文件

- `_project_review_for_chatgpt/`
- `backend/data/codex-turn-snapshots.json`
- `frontend-react/dist/`
- 根目录日志
- 各类 `*dev*.log` / `*live*.log`

### 7.4 是否需要先补 `.gitignore`

**建议需要。**

至少建议后续确认这几个方向：

- `dist/`
- `build/`
- `backend/.env.example` 是否应解除忽略并纳入版本控制
- 审查包 / 快照产物是否应忽略

### 7.5 是否需要先备份当前工作区

**建议。**

原因不是当前工作区不安全，而是：

- 仓库尚无首个提交
- 一旦后续开始大规模收口 `.gitignore`、分组暂存、清理误纳文件
- 备份能降低误操作成本

---

## 8. 最终建议

### 当前 Git 状态是否健康

结论：

**Git 工作树本身正常，但版本控制基线尚未建立。**

### 是否适合直接 `git add .`

结论：

**不适合。**

### 是否建议先更新 `.gitignore`

结论：

**建议。**

### 下一步是否可以进入“安全暂存 / 分组提交”

结论：

**可以，但前提是先完成忽略规则收口和敏感/产物边界确认。**

推荐顺序：

```text
先确认 .gitignore 收口策略
↓
确认敏感配置与构建产物边界
↓
按主题做安全暂存
↓
再做分组提交
```
