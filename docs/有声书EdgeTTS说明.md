# 有声书与 Edge TTS 说明

## 功能入口

桌面 IDE 与 Web 前端均提供「有声书」页面（`/audiobook`）：

1. 左侧选择书籍与章节（已生成 / 暂无正文会有状态标记）；
2. 选择中文音色（实时拉取微软音色列表，离线时回退内置常用音色；卡片上可单独「试听」某个音色）；
3. 朗读参数：语速（-30% ~ +30%）、音量（-50% ~ +50%）、音调（-15Hz ~ +15Hz），
   以及音质（标准 48kbps / 高清 96kbps）；
4. 「试听当前设置」用所选章节开头一句话、按当前参数即时试听；
5. 点击「生成第N章」单章生成，或「生成全书」顺序批量生成（可中途停止）；
6. 已生成音频支持播放、重新生成、删除，列表会显示该段音频使用的音色与全部参数。

## 技术实现

### 后端（`backend/routes/tts.js` + `backend/services/tts-service.js`）

| 接口 | 说明 |
|---|---|
| `GET /api/tts/voices` | 中文音色列表（缓存 6 小时，离线回退内置列表） |
| `POST /api/tts/synthesize` | 生成一章有声书；传 `bookId + chapterNumber` 读库内正文，或直接传 `text` |
| `POST /api/tts/preview` | 试听接口：合成一段短文本（≤500 字）并按 base64 返回，不写入音频清单 |
| `GET /api/tts/books/:bookId/audio` | 查询某书已生成音频 |
| `GET /api/tts/audio/:id` | 流式返回 MP3（支持 `<audio>` 的 Range 请求） |
| `DELETE /api/tts/audio/:id` | 删除音频与记录 |

合成引擎为 Python 版 `edge-tts`（Microsoft Edge 在线朗读接口，免密钥）：

- 后端通过子进程调用 `backend/services/edge-tts-helper.py`，文本走 stdin 传输，避免编码问题；
- 单次请求有长度上限，长文本按句子边界分片（默认 1200 字/片），逐片合成后拼接 MP3
  （后续分片会剥离 ID3 头，保证播放连续）；
- 语速/音量/音调直接映射为 SSML 的 `prosody` 参数；端点对极值支持不稳定，已在服务层
  约束为上面列出的可用范围（超出会被夹取），并内置 3 次重试缓解免费接口的偶发限流；
- 高清 96kbps 需要修改 WebSocket 的 `speech.config` 输出格式，`edge-tts` 7.2.8 写死为 48kbps，
  因此 helper 在选高清时改用原始 WebSocket 协议合成（复用官方库的 DRM/SSML 处理）；
- 子进程环境显式放行 `speech.platform.bing.com`（`NO_PROXY`），避免 Windows 系统代理
  把合成请求打入代理导致连接失败；
- 运行环境：`backend/tts-venv`（`python -m venv tts-venv && tts-venv\Scripts\python.exe -m pip install edge-tts`），
  可用 `ALIPRO_TTS_PYTHON` 覆盖，用 `ALIPRO_TTS_DIR` 覆盖输出目录；
- 生成结果持久化在 `backend/data/audio/`（manifest.json + 按书分目录的 MP3），已加入 `.gitignore`。

> 注意：edge-tts 是免费在线接口，属于尽力而为的服务；网络不可用时合成会报错，
> 页面会提示稍后重试。音频产出仅供个人创作使用。

### 能力边界（对照参考站 new.text-to-speech.cn）

参考站里的「感情（express-as 风格）」「句尾停顿（break 静音）」「多音字（phoneme）」
依赖标准 SSML/微软专属标签，但免费 Edge 端点会静默拒绝这类 SSML（实测不返回音频），
因此当前版本没有提供这三个选项。若后续确实需要，需接入带密钥的 Azure TTS 服务
（`mstts:express-as` 等标签由 Azure Speech Service 支持），再在 helper 中切换请求地址即可。

「模仿角色（girl/boy 等 persona）」也不属于免费端点能力，未纳入范围。

## 前端

- `frontend-react/src/pages/AudiobookPage.jsx`：有声书页面；
- `frontend-react/src/AppLayout.jsx`：IDE 侧边栏外壳与导航配置（未来「视频工坊 / 灵感探索」页面
  只需在导航数组加一项 + 在 `router.jsx` 注册路由）；
- 页面样式全部使用 `docs/paper-theme-spec.md` 的 `--paper-*` token；
  `frontend-react/src/paper-tokens.css` 为浏览器环境提供同源 token 兜底。
