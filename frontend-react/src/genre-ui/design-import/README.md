# genre-ui design-import

这个目录用于承接后续的“设计导入包”。

它的定位很简单：

- 用来接住 GPT、Figma、即时设计或人工整理出来的设计包对象
- 设计包可以包含 theme tokens、SVG icon source、divider source、corner ornament source、component spec、page template spec
- 当前阶段不做文件上传
- 当前阶段不做自动导入真实设计工具
- 当前阶段只定义结构、示例和 normalize 工具，方便后续扩展

## 目录内容

- `designPackSchema.js`
  - 设计包结构说明和基础校验字段
- `sampleDesignPack.js`
  - 一个最小可读的示例设计包
- `normalizeDesignPack.js`
  - 把不完整设计包安全整理成统一结构
- `index.js`
  - 统一导出入口

## 设计包建议结构

```js
{
  meta: {
    name,
    version,
    source,
    createdAt
  },
  themes: {
    lightnovel: {
      tokens: {
        colors,
        shape,
        shadow,
        surface,
        ornament,
        interaction
      },
      icons: {
        main,
        chapterStages,
        characterRoles,
        worldElements,
        dividers,
        corners
      },
      components: {
        button,
        badge,
        card,
        panel,
        sectionHeader
      },
      pageTemplates: {
        showcase,
        bookDetail,
        chapterList
      }
    }
  }
}
```

## 给 GPT 生成设计包的提示词模板

请为网络小说类型包 UI 系统生成一个设计导入包。

只包含 6 个 UI theme：

- `urban`
- `fantasy`
- `scifi`
- `mystery`
- `game`
- `lightnovel`

每个 theme 输出：

1. `colors`
2. `shape`
3. `shadow`
4. `surface`
5. `ornament`
6. `interaction`
7. 主图标 SVG
8. 分割线 SVG
9. 卡片角标 SVG
10. 按钮组件说明
11. 卡片组件说明
12. 页面模板说明

SVG 要求：

- `viewBox` 统一
- 使用 `currentColor`
- 不写死颜色
- 不包含文字
- 不包含位图
- 不使用 PNG/JPG
- 不用渐变和滤镜
- 适合导入 Figma 或即时设计后继续编辑
- 适合后续转成 React 组件

输出格式要求：

- 返回一个 JS 对象
- theme key 只能使用 `urban / fantasy / scifi / mystery / game / lightnovel`
- 不要输出业务接口
- 不要输出上传流程
- 不要输出图片链接
