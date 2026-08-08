# 纸感主题设计规范（Paper Theme Spec）

适用：`desktop-ide`（Longform Studio IDE）。色板来源：B 站 BV1L23z6eEak「星炉」实测。
代码实现：`desktop-ide/src/paper-theme.css` 顶部 `--paper-*` token 块。

## 一、设计原则

1. **纸感**：暖白为底、米色分层，像纸张而非屏幕，降低视觉疲劳。
2. **低饱和**：全色板无高饱和颜色；操作色用暖褐，不用冷蓝/荧光。
3. **层级靠"色阶 + 边框"表达**：背景色从浅到深 5 级，配合 1px 暖褐框线形成"框中框"。
4. **语义优先**：任何颜色变化必须通过 token，禁止在组件里写死色值。

## 二、背景与面板层

| Token | 色值 | 用途 |
|---|---|---|
| `--paper-bg` | `#FEFFFA` | 页面主背景（暖白） |
| `--paper-surface` | `#F5F2EB` | 侧栏 / 面板 / 指标卡底 |
| `--paper-surface-raised` | `#FFFFFF` | 浮层 / 弹窗 / 卡片 / 输入框 |
| `--paper-surface-sunken` | `#F7F4ED` | 外层卡片内的内层区块（框中框） |
| `--paper-surface-deep` | `#F0ECE3` | 更深一层：输入容器 / 标签条 |
| `--paper-glass` | `rgba(254,255,250,.92)` | 顶部导航毛玻璃底 |
| `--paper-glass-strong` | `rgba(254,255,250,.96)` | 工作台工具条毛玻璃底 |
| `--paper-overlay` | `rgba(90,75,60,.32)` | 弹窗遮罩（暖褐） |
| `--paper-tint` | `#FDF6F4` | 错误态浅底 / 警示底 |
| `--paper-tint-warm` | `#E9D5CF` | 品牌点缀（logo / 标签） |

## 三、边框层

| Token | 色值 | 用途 |
|---|---|---|
| `--paper-border` | `#DCD7CF` | 默认边框 / 分隔线 |
| `--paper-border-subtle` | `#E4DFD5` | 卡片弱边框（外层） |
| `--paper-border-strong` | `#C6BFB7` | 输入框 / 焦点边框 |
| `--paper-border-line` | `rgba(140,125,110,.28)` | 内层区块框线（框中框） |

## 四、文字层

| Token | 色值 | 对比度（on #FEFFFA） | 用途 |
|---|---|---:|---|
| `--paper-text` | `#4A4038` | ≈9:1 | 正文 / 标题 |
| `--paper-text-soft` | `#6B5D55` | ≈7:1 | 副标题 / 强调次要文字 |
| `--paper-text-muted` | `#7C6D67` | ≈5:1 | 说明 / 元信息 |
| `--paper-text-tertiary` | `#998F86` | ≈3.5:1 | 占位符 / 禁用 |

## 五、操作与强调层

| Token | 色值 | 用途 |
|---|---|---|
| `--paper-primary` | `#6F6158` | 主按钮 / 激活标签底（配白字） |
| `--paper-primary-hover` | `#5F534B` | 主按钮 hover |
| `--paper-primary-soft` | `rgba(111,97,88,.06)` | 次要按钮浅底 |
| `--paper-accent` | `#A98874` | 强调 / 链接 / 活跃元素 |
| `--paper-accent-deep` | `#7C5C4C` | 强调文字 / 深色标签 |
| `--paper-accent-soft` | `rgba(169,136,116,.12)` | 选中 / 激活浅底 |
| `--paper-accent-soft-strong` | `rgba(169,136,116,.24)` | 更强的选中底 |
| `--paper-accent-hover` | `rgba(169,136,116,.1)` | hover 浅底 |
| `--paper-accent-border` | `rgba(169,136,116,.5)` | 强调边框（focus/hover） |
| `--paper-gold` | `#B08A4F` | 金色点缀（徽章 / 星级） |

## 六、语义色

| Token | 色值 | 用途 |
|---|---|---|
| `--paper-danger` | `#A85A4D` | 错误文字 / 危险按钮 |
| `--paper-danger-soft` | `rgba(168,90,77,.08)` | 错误浅底 |
| `--paper-danger-line` | `rgba(168,90,77,.3)` | 错误边框 |
| `--paper-danger-hover-line` | `rgba(168,90,77,.4)` | 错误 hover 边框 |
| `--paper-success` | `#7C8B6F` | 成功文字 |
| `--paper-success-soft` | `rgba(124,139,111,.12)` | 成功浅底 |
| `--paper-success-line` | `rgba(124,139,111,.34)` | 成功边框 |

## 七、阴影 / 圆角 / 间距

| Token | 值 | 用途 |
|---|---|---|
| `--paper-shadow-card` | `0 8px 20px rgba(90,75,60,.06)` | 卡片 |
| `--paper-shadow-panel` | `0 10px 26px rgba(90,75,60,.08)` | 外层面板 |
| `--paper-shadow-nav` | `0 10px 30px rgba(90,75,60,.08)` | 顶部导航 |
| `--paper-shadow-prose` | `0 12px 34px rgba(90,75,60,.08)` | 正文纸面 |
| `--paper-radius-sm` | `8px` | 按钮 / 输入框 |
| `--paper-radius-md` | `12px` | 内层区块 / 卡片 |
| `--paper-radius-lg` | `16px` | 外层面板 |
| `--paper-pad-card` | `18px` | 卡片内边距 |
| `--paper-pad-section` | `16px 18px` | 内层区块内边距 |
| `--paper-pad-editor` | `14px` | 编辑器容器内边距 |

## 八、层级速查（从外到内）

```text
页面背景  --paper-bg
  └ 侧栏 / 导航  --paper-surface（毛玻璃用 --paper-glass）
      └ 外层卡片  --paper-surface-raised + --paper-shadow-panel
          └ 内层区块  --paper-surface-sunken + --paper-border-line（框中框）
              └ 输入区  --paper-surface-deep
                  └ 输入框  --paper-surface-raised + --paper-border-strong
```

## 九、使用规范

1. 背景：只从背景层选；卡片内容浮层用 `raised`，容器内分区用 `sunken/deep`。
2. 边框：默认 `--paper-border`；卡片弱化用 `subtle`；需要强调交互用 `strong`；内层框线用 `border-line`。
3. 文字：正文 `text`，元信息 `muted`，占位 `tertiary`；不要在浅底上直接用 `tertiary` 做正文。
4. 主操作：`--paper-primary` 配 `#FFFFFF` 文字；hover 用 `--paper-primary-hover`。
5. 状态：错误/成功必须用对应语义 token，不直接用红色系裸值。
6. 圆角：按钮 `sm`、区块 `md`、面板 `lg`，不随意引入新圆角值。

## 十、修改指南

1. 只改 `paper-theme.css` 顶部 `--paper-*` 块，全局生效。
2. 改完跑一次全页面暗色扫描（验证工具见 `main.cjs` 的批量截图模式），确认无回归。
3. 新增颜色必须先加 token，禁止在覆盖规则里写裸色值。
