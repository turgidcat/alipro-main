# 网文生成器后端服务

基于 Express + SQLite（sql.js）的网文 AI 创作平台后端，提供 DeepSeek API 中转、用户认证、大纲管理、数据持久化等功能。

## 功能特性

- ✅ DeepSeek/阿里云百炼 API 中转代理（API Key 安全存储在服务端）
- ✅ 用户注册/登录/Token 认证（JWT + bcrypt）
- ✅ 书籍/章节/分卷管理
- ✅ 大纲系统（全书大纲 / 分卷大纲 / 章节大纲）
- ✅ 小说配置服务（流派、平台、爽点标签等预设）
- ✅ 创作模板系统
- ✅ 伏笔追踪管理
- ✅ 请求参数校验中间件
- ✅ TXT 导出功能
- ✅ 前端静态文件托管（支持 Nginx 反向代理）
- ✅ 结构化日志（Winston）

## 快速启动

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```env
# DeepSeek API（必填）
DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY_HERE

# 阿里云百炼 API（可选，用于创意命名等增强功能）
ALIYUN_BAILIAN_API_KEY=YOUR_ALIYUN_BAILIAN_API_KEY_HERE

# JWT 密钥（生产环境务必修改）
JWT_SECRET=YOUR_JWT_SECRET_HERE

# 服务器配置
PORT=3000
NODE_ENV=development
```

### 3. 启动

```bash
npm start        # 生产模式
npm run dev      # 开发模式（nodemon 自动重启）
```

### 4. 验证

访问 `http://localhost:3000/health`，返回 `{"success":true,"message":"服务运行正常"}` 即成功。

## 项目结构

```
backend/
├── config/
│   ├── novel-config.js       # 小说配置（流派、平台、爽点等）
│   └── templates.js          # 内置创作模板
├── data/
│   └── templates.json        # 模板静态数据
├── database/
│   ├── init.js               # 数据库初始化 & 自动迁移
│   └── migrate.js            # 数据迁移脚本
├── middleware/
│   ├── auth.js               # JWT 认证中间件
│   └── validation.js         # 请求参数校验中间件
├── public/
│   └── （无业务主页面）        # 如需放调试静态资源，请明确标注用途
├── routes/
│   ├── ai.js                 # AI 生成/润色/续写接口
│   ├── auth.js               # 用户认证接口（注册/登录/Token）
│   ├── config.js             # 小说配置接口
│   ├── data.js               # 书籍/章节/模板/伏笔 CRUD
│   └── outlines.js           # 大纲管理接口
├── services/
│   ├── ai.js                 # 通用 AI 服务
│   ├── database.js           # 数据库操作工具函数
│   ├── deepseek.js           # DeepSeek API 封装
│   └── novel-config-service.js  # 小说配置服务
├── utils/
│   └── logger.js             # Winston 日志工具
├── .env.example              # 环境变量模板
├── .gitignore
├── package.json
└── server.js                 # 入口文件
```

## API 接口

### 路由挂载

| 路径前缀 | 用途 |
|----------|------|
| `/api/*` | 本地开发直连 |
| `/projects/alipro/api/*` | 生产环境 Nginx 反向代理 |

两组前缀路由完全相同，以下以 `/api` 为例。

---

### 认证接口 (`/api/auth`)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/register` | 用户注册 | 否 |
| POST | `/login` | 用户登录 | 否 |
| POST | `/verify` | 验证 Token 有效性 | 否 |
| GET | `/profile` | 获取当前用户信息 | Bearer Token |

---

### AI 生成接口 (`/api`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/generate` | 生成网文正文/书名/大纲 |
| POST | `/polish` | AI 润色 |
| POST | `/continue` | AI 续写 |

**生成参数示例：**

```json
{
  "genre": "urban",
  "subgenre": "系统流",
  "chapterTitle": "第1章 觉醒系统",
  "outline": "主角获得系统...",
  "characters": "主角:张三，性格:谨慎",
  "shuangTags": ["打脸反转", "扮猪吃虎"],
  "emotionIntensity": 70,
  "colloquialLevel": 80,
  "dialogueRatio": 30,
  "wordCount": 2000,
  "addCliffhanger": true,
  "avoidAIFeel": true,
  "model": "deepseek-chat",
  "promptType": "content"
}
```

`promptType` 可选值：`content`（正文）、`book_title`（书名）、`outline`（大纲）。

---

### 数据管理接口 (`/api`)

#### 书籍
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/books` | 所有书籍 |
| POST | `/books` | 创建书籍 |
| GET | `/books/:id` | 书籍详情 |
| PUT | `/books/:id` | 更新书籍 |
| DELETE | `/books/:id` | 删除书籍 |
| GET | `/books/:bookId/export` | 导出 TXT |

#### 章节
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/books/:bookId/chapters` | 章节列表 |
| POST | `/books/:bookId/chapters` | 创建章节 |
| GET | `/chapters/:id` | 章节详情 |
| PUT | `/chapters/:id` | 更新章节 |
| DELETE | `/chapters/:id` | 删除章节 |

#### 模板
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/templates` | 模板列表 |
| POST | `/templates` | 创建模板 |
| DELETE | `/templates/:id` | 删除模板 |

#### 伏笔
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/books/:bookId/foreshadowing` | 伏笔列表 |
| POST | `/books/:bookId/foreshadowing` | 添加伏笔 |
| PUT | `/foreshadowing/:id` | 更新伏笔 |
| DELETE | `/foreshadowing/:id` | 删除伏笔 |

---

### 全书规划接口 (`/api/books/:bookId/book-plan`)

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/books/:bookId/book-plan` | 获取全书规划 | 否 |
| POST | `/api/books/:bookId/book-plan` | 创建/更新全书规划 | 否 |
| GET | `/api/books/:bookId/volume-plans` | 获取分卷规划 | 否 |
| GET | `/api/books/:bookId/chapter-plans` | 获取章节细纲 | 否 |

全书、分卷、章节分别使用 `book_plans`、`volume_plans`、`chapter_plans`，不再读取旧大纲表。

---

### 配置接口 (`/api/config`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/novel` | 获取小说配置（流派、平台等） |
| GET | `/novel/genres` | 获取流派列表 |
| GET | `/novel/platforms` | 获取平台列表 |
| GET | `/novel/shuang-tags` | 获取爽点标签 |

---

### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/database-view` | 跳转到正式数据库查看器前端页面 |

---

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | **必填** |
| `ALIYUN_BAILIAN_API_KEY` | 阿里云百炼 API 密钥（可选） | — |
| `PORT` | 服务端口 | `3000` |
| `NODE_ENV` | 运行环境 | `development` |
| `JWT_SECRET` | JWT 签名密钥 | `your-secret-key-change-in-production` |

## 数据库

使用 **sql.js**（纯 JavaScript 的 SQLite 实现），无需安装外部数据库服务。

- 数据库文件：`database/novel.db`（首次启动自动创建）
- 支持自动迁移：新增字段时无需手动重建数据库
- 外键约束已启用

**数据表：**
- `users` — 用户（含密码哈希、角色、状态）
- `books` — 书籍信息
- `chapters` — 章节内容
- `templates` — 创作模板
- `foreshadowing` — 伏笔追踪
- `book_plans` — 全书规划
- `volume_plans` — 分卷规划
- `chapter_plans` — 章节细纲

---

## 认证说明

- 使用 **JWT**（JSON Web Token）进行身份认证
- Token 有效期 7 天
- 注册时密码经 **bcrypt**（10轮）加密存储
- 认证中间件对未登录用户授予匿名身份，由具体路由决定权限
- 大纲等接口要求 Bearer Token，书籍/章节接口支持匿名用户的临时数据

---

## 前端静态文件

后端当前只负责托管 React 构建产物：

| 路径 | 对应目录 |
|------|----------|
| `/` | `../frontend-react/dist/` |

当前正式页面入口统一为：

- `http://localhost:3000/`
- `http://localhost:3000/changelog`
- `http://localhost:3000/start-guide`

说明：

- `backend/public/` 不再承载业务主页面
- `/database-view` 已退场，当前统一跳回 `/`

HTML 文件禁用缓存（开发友好），CSS/JS 缓存 5 分钟。

---

## 安全提醒

1. **不要** 将 `.env` 提交到 Git
2. 生产环境务必修改 `JWT_SECRET`
3. 定期备份 `database/novel.db`
4. API Key 泄露后立即在对应平台控制台重置

---

## 常见问题

### 启动失败：DEEPSEEK_API_KEY is not configured

```bash
cp .env.example .env
# 编辑 .env，填入真实 API Key
```

### 端口被占用

修改 `.env` 中 `PORT=3001` 或其他端口。

### 数据库文件损坏

删除 `database/novel.db` 后重启，系统会自动重建（注意：数据会丢失）。

---

**版本**: v1.2.5
**最后更新**: 2025-05-25
