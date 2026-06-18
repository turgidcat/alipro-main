# Codex 任务说明：生成给 ChatGPT 审查用的项目快照包

## 任务目标

请在当前项目根目录下，自动整理一个“给 ChatGPT 审查项目用的项目快照包”。

这个任务不是修改业务代码，而是生成一组报告文件和一个压缩包，让 ChatGPT 后续可以分析：

1. 当前 AI 小说生成工具项目中，哪些环节应该使用 GPT。
2. 哪些环节应该使用 DeepSeek。
3. 哪些环节不需要模型，应该使用普通系统函数。
4. Codex 开发过程中是否把一些本该由模型判断的小说创作任务，写成了简单系统函数。
5. 当前项目中哪些地方可能导致小说内容机械、套路化、人物崩坏、上下文丢失、伏笔断裂或 API 成本过高。

---

## 一、安全边界

请严格遵守：

1. 不要修改、删除、重构我的原项目业务代码。
2. 不要提交 git commit。
3. 只允许在项目根目录下新建一个文件夹：

```text
_project_review_for_chatgpt
```

4. 所有生成文件都放进该文件夹。
5. 不要复制或打包任何真实密钥、API Key、Token、Cookie、账号密码、数据库真实数据、用户隐私数据。

必须排除：

```text
.env
.env.*
*.key
*.pem
*.p12
*.crt
*.db
*.sqlite
*.sqlite3
*.log
node_modules
.git
.next
dist
build
out
coverage
venv
.venv
__pycache__
.cache
```

如需展示环境变量结构，只生成脱敏版 `.env.example`，所有值替换为占位符，例如：

```env
OPENAI_API_KEY=your_openai_key_here
DEEPSEEK_API_KEY=your_deepseek_key_here
OPENAI_BASE_URL=your_base_url_here
```

如果发现疑似密钥，只记录“文件路径 + 变量名 + 风险说明”，不要复制真实值。

---

## 二、Windows / PowerShell 特别要求

我在 Windows 上经常遇到 PowerShell 转义、编码、中文路径乱码等问题。

因此请优先使用脚本扫描项目，不要主要依赖 PowerShell 命令输出。

请优先创建并运行：

```text
_project_review_for_chatgpt/create-review-pack.js
```

如果当前项目不是 Node.js 项目，也可以创建：

```text
_project_review_for_chatgpt/create-review-pack.py
```

要求：

1. 用 Node.js 或 Python 的文件系统 API 扫描项目。
2. 不要依赖 `tree /F /A`、`findstr`、PowerShell 复杂管道、多层引号拼接作为核心数据来源。
3. 所有 `.txt`、`.md`、`.json` 文件必须使用 UTF-8 编码。
4. 路径处理使用 `path.join` / `path.resolve` 或 Python 的 `pathlib`。
5. 中文路径、空格路径、特殊字符路径也要正确处理。
6. PowerShell 只允许用于简单执行脚本或压缩文件，不要用它分析源码内容。

---

## 三、最终生成结构

请最终生成：

```text
_project_review_for_chatgpt/
├─ create-review-pack.js 或 create-review-pack.py
├─ PROJECT_TREE.txt
├─ PROJECT_OVERVIEW.md
├─ MODEL_CALLS_AUDIT.md
├─ SYSTEM_FUNCTION_AUDIT.md
├─ PROMPTS_INDEX.md
├─ NOVEL_GENERATION_FLOW.md
├─ MODEL_ROUTING_RECOMMENDATION_DRAFT.md
├─ SECURITY_AND_PRIVACY_CHECK.md
├─ SCAN_MANIFEST.json
├─ ENCODING_CHECK.md
├─ LARGE_FILES_SKIPPED.md
├─ README_FOR_CHATGPT.md
├─ source_snapshot/
└─ project-review-for-chatgpt.zip
```

如果无法生成 zip，也请完成其他报告，并在 `SCAN_MANIFEST.json` 中说明原因。

---

## 四、PROJECT_TREE.txt

生成：

```text
_project_review_for_chatgpt/PROJECT_TREE.txt
```

要求：

1. 展示项目文件树。
2. 排除依赖、缓存、构建产物和敏感文件。
3. 尽量完整，但不要展开 `node_modules`、`.git`、`.next`、`dist`、`build`、`venv` 等目录。
4. 标注关键目录，例如：`src`、`app`、`lib`、`server`、`api`、`services`、`prompts`、`components`、`types`、`schema`、`prisma`、`docs`。

---

## 五、PROJECT_OVERVIEW.md

生成：

```text
_project_review_for_chatgpt/PROJECT_OVERVIEW.md
```

请说明：

1. 项目大概是什么类型。
2. 技术栈：前端框架、后端框架、数据库、ORM、AI SDK、模型供应商、部署方式、包管理器。
3. 主要入口文件。
4. 跟 AI 小说生成相关的核心模块。
5. 跟模型调用相关的核心模块。
6. 跟 Prompt 模板相关的文件。
7. 跟用户输入、题材识别、世界观、角色、大纲、章节、正文、审稿、润色、保存结果相关的文件。
8. 不确定的地方请标注“待确认”，不要瞎猜。

---

## 六、MODEL_CALLS_AUDIT.md

请搜索所有疑似模型调用位置。

重点关键词：

```text
openai
OpenAI
deepseek
DeepSeek
gpt
chat
completion
responses
model
apiKey
api_key
baseURL
base_url
fetch(
axios
stream
generate
llm
ai
prompt
temperature
max_tokens
maxTokens
messages
system
user
assistant
```

生成：

```text
_project_review_for_chatgpt/MODEL_CALLS_AUDIT.md
```

表格格式：

| 文件路径 | 函数/模块名 | 当前调用模型或供应商 | 用途 | 是否确定是模型调用 | 风险/备注 |
|---|---|---|---|---|---|

额外总结：

1. 哪些地方明显用了 GPT / OpenAI。
2. 哪些地方明显用了 DeepSeek。
3. 哪些地方用了其他模型供应商。
4. 哪些地方写死了模型名。
5. 哪些地方写死了 base_url / baseURL。
6. 哪些地方可能导致本来想走中转，却发到了官方。
7. 哪些地方可能缺少模型路由。
8. 哪些地方看起来像模型调用，但实际只是普通函数。
9. 哪些地方可能导致 API 成本过高。
10. 哪些地方适合抽象成统一的 modelRouter。

---

## 七、SYSTEM_FUNCTION_AUDIT.md

请重点审查“看起来像智能判断，但其实可能只是普通系统函数”的地方。

重点搜索：

```text
题材识别
小说类型判断
风格识别
大纲生成
角色生成
章节生成
正文生成
章节评分
剧情质量评分
爽点评估
敏感内容检测
伏笔追踪
上下文总结
人物弧光生成
文风选择
Prompt 拼接
模型选择
自动续写
自动润色
审稿
质量检查
```

重点函数名：

```text
classifyGenre
detectStoryType
detectGenre
generateOutline
generateChapter
generateNovel
generateChapterOutline
evaluateChapterQuality
scorePlot
scoreChapter
detectSensitiveContent
buildCharacterArc
trackForeshadowing
summarizeContext
summarizeChapter
selectWritingStyle
buildPrompt
routeModel
reviewChapter
polishText
rewriteChapter
continueWriting
analyzeStory
analyzePrompt
```

生成：

```text
_project_review_for_chatgpt/SYSTEM_FUNCTION_AUDIT.md
```

表格格式：

| 文件路径 | 函数名 | 当前实现方式 | 模型调用还是普通函数 | 是否适合真实小说生产 | 风险说明 | 建议 |
|---|---|---|---|---|---|---|

判断原则：

1. 如果函数只是 `if/else`、关键词匹配、正则判断、随机数组、固定模板拼接、简单字数判断、简单标签映射，却承担文学判断或创作判断，请标记：

```text
可能是假智能，不适合真实小说生产
```

2. 适合系统函数的任务包括：保存数据、读取数据、拼接 prompt、记录 token、缓存结果、管理状态、校验字段、处理文件、控制任务队列、选择模型供应商、统计成本。

3. 应建议使用模型，或“系统函数 + 模型判断”的任务包括：判断人物是否崩坏、判断剧情是否合理、生成主角心理变化、设计反转、评估章节爽点、判断文风是否统一、提炼伏笔、判断主题是否跑偏、审稿、润色、分析用户真实创作意图。

---

## 八、PROMPTS_INDEX.md

请整理项目中所有 Prompt 模板。

重点搜索：

```text
system prompt
user prompt
assistant prompt
大纲 prompt
角色 prompt
章节 prompt
正文 prompt
润色 prompt
审稿 prompt
风格 prompt
敏感内容 prompt
模型路由 prompt
世界观 prompt
人物卡 prompt
伏笔 prompt
```

生成：

```text
_project_review_for_chatgpt/PROMPTS_INDEX.md
```

表格格式：

| 文件路径 | Prompt 名称/用途 | 大致内容摘要 | 使用场景 | 当前调用模型 | 可能问题 |
|---|---|---|---|---|---|

请判断 Prompt 是否存在：

1. 太短或太泛。
2. 没有角色卡。
3. 没有世界观约束。
4. 没有章节目标。
5. 没有前文摘要。
6. 没有风格约束。
7. 没有禁止跑偏规则。
8. 没有输出格式。
9. 没有质量标准。
10. 没有区分 GPT / DeepSeek。
11. 不适合批量生成小说。

如果 Prompt 很长，不要全文复制，只摘取结构和摘要。  
如果包含密钥、用户隐私、真实数据，标记为 `[已脱敏]`。

---

## 九、NOVEL_GENERATION_FLOW.md

请根据代码和文档，推断从用户输入到小说生成结果的大致流程。

生成：

```text
_project_review_for_chatgpt/NOVEL_GENERATION_FLOW.md
```

请说明：

1. 用户输入了什么。
2. 系统如何理解用户输入。
3. 是否生成题材标签。
4. 是否生成世界观。
5. 是否生成角色。
6. 是否生成主角弧光。
7. 是否生成大纲。
8. 是否生成卷纲。
9. 是否生成章节细纲。
10. 是否生成正文。
11. 是否审稿。
12. 是否润色。
13. 是否保存结果。
14. 是否支持多轮修改。
15. 是否有上下文记忆。
16. 是否有角色卡。
17. 是否有伏笔表。
18. 是否有设定库。
19. 是否有章节摘要。
20. 哪些步骤调用模型。
21. 哪些步骤只是系统函数。
22. 哪些步骤目前可能缺失。
23. 哪些步骤容易导致长篇小说断线、人物崩坏、前后矛盾。

请用 Markdown 文本流程图表示真实流程。

---

## 十、MODEL_ROUTING_RECOMMENDATION_DRAFT.md

请根据当前项目代码，先给出一份初步的模型分工建议。

生成：

```text
_project_review_for_chatgpt/MODEL_ROUTING_RECOMMENDATION_DRAFT.md
```

表格格式：

| 功能环节 | 当前实现 | 推荐 GPT | 推荐 DeepSeek | 推荐系统函数 | 理由 | 风险 |
|---|---|---|---|---|---|---|

重点分析：

1. 用户意图理解
2. 题材识别
3. 故事风格识别
4. 世界观生成
5. 角色生成
6. 主角弧光设计
7. 卷纲生成
8. 章节细纲生成
9. 正文初稿生成
10. 批量扩写
11. 暗黑/尖锐题材正文生成
12. 章节审稿
13. 人物一致性检查
14. 伏笔追踪
15. 上下文总结
16. 文风润色
17. 敏感内容改写
18. 成本控制
19. 缓存
20. 状态管理
21. Prompt 拼接
22. 模型路由

判断原则：

- GPT 更适合：总纲、结构设计、主角弧光、复杂判断、审稿、提示词系统、质量控制、风格统一。
- DeepSeek 更适合：低成本正文初稿、批量扩写、中文网文风生成、设定整理、多版本草稿。
- 系统函数更适合：存储、读取、缓存、拼接、状态管理、成本统计、字段校验、任务队列、模型路由执行。

---

## 十一、SECURITY_AND_PRIVACY_CHECK.md

生成：

```text
_project_review_for_chatgpt/SECURITY_AND_PRIVACY_CHECK.md
```

内容包括：

1. 本次审查包排除了哪些敏感文件。
2. 是否发现疑似 API Key、Token、密码、Cookie。
3. 如果发现，只记录文件路径和变量名，不复制真实值。
4. 是否发现真实用户数据。
5. 是否发现数据库文件。
6. 是否发现日志中可能含密钥。
7. 是否确认没有把 `.env`、真实 API Key、数据库文件、日志文件打包进审查包。

检查关键词：

```text
sk-
api_key
apikey
API_KEY
token
TOKEN
secret
SECRET
password
PASSWORD
Authorization
Bearer
cookie
COOKIE
OPENAI_API_KEY
DEEPSEEK_API_KEY
GROK_API_KEY
ANTHROPIC_API_KEY
```

---

## 十二、SCAN_MANIFEST.json

生成：

```text
_project_review_for_chatgpt/SCAN_MANIFEST.json
```

格式：

```json
{
  "scan_time": "",
  "project_root": "",
  "total_files_scanned": 0,
  "files_copied_to_snapshot": 0,
  "directories_skipped": [],
  "files_skipped": [],
  "large_files_skipped": [],
  "sensitive_files_detected": [],
  "sensitive_patterns_detected": [],
  "reports_generated": [],
  "zip_generated": true,
  "zip_path": "",
  "notes": []
}
```

不要在 JSON 中写入任何真实密钥。

---

## 十三、ENCODING_CHECK.md

生成：

```text
_project_review_for_chatgpt/ENCODING_CHECK.md
```

内容包括：

1. 所有报告文件是否使用 UTF-8 写入。
2. 是否检测到无法读取的文件。
3. 是否检测到二进制文件。
4. 是否检测到乱码风险。
5. 哪些文件因为编码问题跳过。
6. 哪些文件因为体积太大跳过。
7. 是否存在中文路径或特殊字符路径。
8. 如果存在，是否已经正确处理。

---

## 十四、source_snapshot/

请把关键文件复制到：

```text
_project_review_for_chatgpt/source_snapshot/
```

优先复制：

1. README
2. 产品文档
3. 设计文档
4. 模型调用相关代码
5. Prompt 模板相关代码
6. 小说生成流程相关代码
7. 数据结构、schema、类型定义相关文件
8. 路由文件
9. API handler 文件
10. services / lib / utils 中和小说生成有关的文件
11. `.env.example`
12. 生成样例或测试样例，但必须确认不含隐私和密钥

优先扩展名：

```text
.md
.txt
.json
.yaml
.yml
.toml
.js
.jsx
.ts
.tsx
.py
prisma
sql
```

不要复制真实 `.env`、数据库、日志、大体积文件、依赖包、构建产物。  
如果文件超过 300KB，请不要完整复制，记录到 `LARGE_FILES_SKIPPED.md`。

---

## 十五、LARGE_FILES_SKIPPED.md

生成：

```text
_project_review_for_chatgpt/LARGE_FILES_SKIPPED.md
```

表格格式：

| 文件路径 | 文件大小 | 跳过原因 | 是否可能重要 | 建议 |
|---|---:|---|---|---|

---

## 十六、README_FOR_CHATGPT.md

生成：

```text
_project_review_for_chatgpt/README_FOR_CHATGPT.md
```

内容：

```text
这是一个 AI 小说生成工具项目的审查包。

请根据这些文件，帮我分析：

1. 当前小说生成链路是否合理。
2. 哪些模块应该用 GPT。
3. 哪些模块应该用 DeepSeek。
4. 哪些模块不需要模型，只需要普通系统函数。
5. 哪些系统函数是假智能，真实小说生产中可能会出问题。
6. 哪些 Prompt 需要重构。
7. 哪些地方会导致小说内容机械、套路化、人物崩坏。
8. 哪些地方会导致上下文丢失、伏笔断裂。
9. 哪些地方可能会增加不必要的 API 成本。
10. 推荐的真实生产环境模型架构。
11. 推荐的低成本模型架构。
12. 推荐的高质量模型架构。
13. 哪些修改应该交给 Codex 执行。
14. 哪些规划和审稿可以继续放在 ChatGPT 里完成。

请重点关注：
- 模型调用
- Prompt 设计
- 小说生成流程
- 系统函数是否承担了过多创作判断
- GPT / DeepSeek / 系统函数的合理分工
```

---

## 十七、生成压缩包

最后请把 `_project_review_for_chatgpt` 文件夹压缩成：

```text
_project_review_for_chatgpt/project-review-for-chatgpt.zip
```

压缩包必须包含所有报告文件和 `source_snapshot/`。  
压缩包不得包含真实密钥、`.env`、数据库、日志、依赖包、构建产物。

---

## 十八、执行完成后汇报

完成后，请汇报：

1. 是否成功生成 `_project_review_for_chatgpt` 文件夹。
2. 是否成功生成 `project-review-for-chatgpt.zip`。
3. 压缩包完整路径。
4. 扫描了多少文件。
5. 复制了多少关键文件到 `source_snapshot/`。
6. 跳过了哪些大文件。
7. 是否发现疑似密钥或隐私。
8. 是否确认没有打包 `.env`。
9. 是否确认没有打包真实 API Key。
10. 是否确认没有打包数据库文件。
11. 是否确认没有打包日志文件。
12. 下一步我应该上传给 ChatGPT 的文件名。

---

## 十九、如果遇到问题

如果某一步失败，请不要瞎生成。请说明：

1. 哪一步失败。
2. 失败原因。
3. 已完成哪些文件。
4. 哪些文件需要我手动提供。
5. 是否可能与 Windows 路径、权限、编码有关。
6. 是否可以改用 Node.js / Python 方式继续。

---

## 二十、最终确认

请再次确认：

1. 不修改原项目业务代码。
2. 不提交 git commit。
3. 不删除任何文件。
4. 不上传、打印、复制真实密钥。
5. 不把 `.env` 打包进去。
6. 不把数据库、日志、依赖、构建产物打包进去。
7. 所有报告文件使用 UTF-8 编码。
8. 优先用 Node.js / Python 脚本扫描，不依赖 PowerShell 复杂命令输出。

请现在开始执行。
