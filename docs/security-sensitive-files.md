# 敏感配置与上传排除说明

## 哪些文件属于敏感配置

以下文件或同类文件包含服务器连接信息、认证信息、导出凭证或可直接访问受限资源的字段，不应上传到公开仓库、聊天工具或项目审查包：

- `config/deploy.config.json`
  - 典型字段：服务器地址、端口、用户名、密码或私钥路径、部署目录。
- `tools/guaihub-export-config.json`
  - 典型字段：`token`、`uid`、导出范围、输出目录。
- `backend/.env` 及其他 `.env.*`
  - 典型字段：`DEEPSEEK_API_KEY`、`ALIYUN_BAILIAN_API_KEY`、`JWT_SECRET`、各类 `TOKEN`、`SECRET`、`PASSWORD`。
- 任何包含以下敏感字段的配置文件
  - `password`
  - `token`
  - `uid`
  - `cookie`
  - `Authorization`
  - `Bearer`
  - `API Key`
  - `secret`
- 导出数据与日志目录
  - `guaihub-export-test/`
  - `backend/logs/`
  - 各类 `*.log`

## 为什么不应该上传

- 这些文件可能直接暴露服务器登录入口、模型调用密钥、JWT 签名密钥或第三方平台凭证。
- 一旦上传到聊天工具、网盘、审查包或公开仓库，后续很难确认谁已经拿到副本。
- 即使只泄露 `uid`、导出目录、日志或 Bearer Token，也可能帮助别人拼出完整访问路径或复用会话。

## 应该使用哪些 .example / .sample 文件

保留配置结构时，应该只提供脱敏模板文件，不提供真实值：

- `config/deploy.config.example.json`
  - 用于说明部署配置结构。
- `tools/guaihub-export-config.sample.json`
  - 用于说明导出配置结构。
- `backend/.env.example`
  - 用于说明后端环境变量结构。

使用规则：

- 只保留字段名、层级结构和必要注释。
- 所有值都必须替换成占位符。
- 占位符应明确表达用途，例如：
  - `your-server-ip-here`
  - `replace-with-your-guaihub-uid`
  - `your_api_key_here`
  - `your_jwt_secret_here`

## 当前建议的 .gitignore 保护范围

当前项目应至少排除以下真实敏感文件和目录：

- `.env`
- `.env.*`
- `backend/.env`
- `backend/.env.*`
- `config/deploy.config.json`
- `config/deploy.config.local.json`
- `tools/guaihub-export-config.json`
- `tools/guaihub-export-config.local.json`
- `guaihub-export-test/`
- `backend/logs/`
- `*.log`

说明：

- 示例文件如 `.env.example`、`config/deploy.config.example.json`、`tools/guaihub-export-config.sample.json` 可以保留在仓库中。
- 示例文件必须持续保持脱敏状态，不能混入真实值。

## 后续生成项目审查包时必须排除

后续生成 `_project_review_for_chatgpt` 或任何“给 ChatGPT 审查”的压缩包时，必须排除：

- 所有真实 `.env` 文件
- 所有真实部署配置文件
- 所有真实导出配置文件
- 所有 API Key、Token、Cookie、Bearer、Authorization 明文
- 所有数据库文件
- 所有日志文件
- `guaihub-export-test/` 这类导出数据目录
- `node_modules/`、构建产物、缓存目录

## 操作约束

- 不删除真实配置文件，除非人工确认。
- 不在终端、文档、截图或审查包里打印真实密码、Token、Cookie 或 API Key。
- 如果需要排查问题，只记录“文件路径 + 字段名 + 风险说明”，不要记录真实值。
