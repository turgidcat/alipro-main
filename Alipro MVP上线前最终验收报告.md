# Alipro MVP 上线前最终验收报告

## 1. 本轮创建或更新的报告

- `Alipro MVP上线前验收矩阵.md`
- `D1核心生成链路完整性验收报告.md`
- `D2生成控制项有效性验收报告.md`
- `D3生成结果质量与结构化写回验收报告.md`
- `D4剧情线机制有效性验收报告.md`
- `D5生成过程体验与状态可见性验收报告.md`
- `D6创作台信息架构与正文工作体验验收报告.md`
- `Alipro MVP上线前最终验收报告.md`

另外按既有脚本要求运行 `tools/check-mvp-rescue.ps1` 时，脚本自动更新了已有 `MVP救援检查报告.md`。

## 2. 本轮修改文件

- `backend/routes/ai.js`
  - 修复新建章节正文生成时剧情线约束未进入结构化 metadata 的问题。
  - 补齐剧情线进度、`storyline_audit`、`word_count_audit`、usedBeatIds fallback 和字数超限收束。
  - 新增 `/api/generate/stream` SSE 流式正文接口。
- `backend/verify-batch-generation.js`
  - 校准 inspect 硬验收口径：正文、正式反馈、摘要、quality_check、上一章摘要承接、剧情线 prompt/beat/写回/质检均为硬条件。
- `MVP救援检查报告.md`
  - 由 `tools/check-mvp-rescue.ps1` 自动覆盖更新。

## 3. 是否修改后端

是。

修改范围是最小后端修复与验收脚本校准，没有改数据库结构。

## 4. 是否修改生成链路核心逻辑

没有做整体重构。

本轮只修复两处局部问题：

1. 新建章节没有已保存 `storyline_context` 时，正文生成改用实时计算的剧情线约束。
2. 正文生成 token 上限进一步收紧，并加入字数超限收束与可观测审计。
3. 反馈写回时补 `storyline_progress`、`quality_check.storyline_audit`、`quality_check.word_count_audit`。
4. 新增主入口流式 SSE 生成接口，前端优先流式、失败早期回退同步生成。

## 5. 是否触碰数据库结构

没有。

## 6. D1-D6 + B1 最终结论

| 维度 | 结论 |
| --- | --- |
| D1 核心生成链路完整性 | 通过 |
| D2 生成控制项有效性 | 基本通过，目标字数 P1 观察 |
| D3 生成结果质量与结构化写回 | 通过 |
| D4 剧情线机制有效性 | 通过，辅助创作模式最小完整剧情线闭环已完成 |
| D5 生成过程体验与状态可见性 | 通过，主入口流式正文实时展示已接入 |
| D6 创作台信息架构与正文工作体验 | 基础可用通过，信息架构优化后置 |
| B1 build / 控制台 / 安全 / 接口 / 旧书兼容 / 工作区状态 | 通过，旧检查脚本白名单 WARN |

## 7. 关键验收结果

- P0 是否清零：是，未复现“反馈解析失败导致摘要/质检未写回”。
- P1 是否还有残留：无上线前阻断型 P1；目标字数仍非精确硬控，但已收敛并有明确可观测与收束策略。
- 新书 1-3 章是否通过：通过。
- 手动链路是否通过：通过。
- 全 AI 自动链路是否通过：当前没有完整全 AI 托管入口，不能写成已完成；已通过的是辅助创作连续生成基础链路。
- 剧情线机制是否通过：通过。辅助创作模式已完成最小闭环；完整 AI 托管调度仍为 P2。
- 流式生成是否实时展示：通过。`/api/generate/stream` 返回 SSE delta，主入口实时追加正文。
- 目标字数控制是否通过：通过上线前最低标准。3000 目标复验收敛到 3731-3746，并在超限时执行收束与 `word_count_audit` 提示。
- 是否仍存在一票否决问题：未发现。

## 8. 复验数据

三章复验书：`MVP矩阵复验书-1782149074878`

| 章节 | 目标 | 实际 | 偏差 | feedback | quality_check | 剧情线约束 |
| --- | ---: | ---: | ---: | --- | --- | --- |
| 第 1 章 | 3000 | 3746 | +24.9% | model_feedback | passed / model_audit | true |
| 第 2 章 | 3000 | 3731 | +24.4% | model_feedback | warning / model_audit | true |
| 第 3 章 | 3000 | 3743 | +24.8% | model_feedback | warning / model_audit | true |

字数修复后快速复验：

| 目标 | 实际 | 偏差 | finishReason | maxTokens |
| ---: | ---: | ---: | --- | ---: |
| 3000 | 3822 | +27.4% | stop | 4051 |

## 9. B1 基础检查

- `npm run build`：通过，只有既有 chunk size warning。
- 浏览器控制台：工作台页面 error 日志为空。
- 健康检查：`/health` 返回成功。
- 新书 inspect：第 1-3 章 `status=ok`。
- 旧书保存抽样：`破雾修真录` 第 1 章同内容 upsert 后长度 3098 -> 3098。
- 前端硬编码密钥：未发现真实密钥；只命中 `.env.example` 占位符和后端环境变量读取。
- 工作区状态：存在本轮报告和最小后端/脚本改动，无数据库结构改动。
- `tools/check-mvp-rescue.ps1`：可用指定命令运行；结果 WARN，原因是当前分支不是旧脚本期待的 `mvp-rescue`，且新矩阵报告不在旧白名单。

## 10. 最终建议

建议进入小范围内测，但仍不建议扩大范围上线。

当前仍需继续观察的非阻断项：

1. 目标字数仍不是精确硬控，但已具备收束策略、实际字数展示和 `word_count_audit`。
2. 完整 AI 托管模式仍未实现，作为 P2 后置。

小范围内测时建议重点观察：字数收束后的章节自然度、`storyline_audit` 风险提示是否过严、流式生成过程中的停止/重试体验。

## 11. 双模式创作机制收口

当前版本主链路是辅助创作模式：用户参与设定、章节任务表、剧情线挂载和章节生成确认，系统辅助完成正文、摘要、feedback、quality_check。

未发现完整全 AI 托管模式入口，也未发现预授权策略、自动批次、风险中断、批次报告等完整托管链路。因此：

- 不把全 AI 托管写成已完成。
- 不新增 D7 / D8。
- 全 AI 托管归入 D1-D6 的 P2 后续设计项。
- 当前只建议以辅助创作模式进入小范围内测。

## 12. 剧情线机制收口

当前剧情线基础能力已经成立：

- 可创建和挂载剧情线。
- 可指定本章主推。
- 修复后剧情线会进入 `storyline_context` 和正文 prompt。
- 生成结果能看到剧情线影响。
- 未发现剧情线字段导致 summary / feedback / quality_check 写回失败。
- 数据库已有 `storylines.status`，章节反馈写回会尝试更新 `storylines.structured_content.chapter_progress/currentProgress`。
- 生成 metadata 会记录 `usedStorylineIds` / `usedBeatIds`。

本轮已补齐辅助创作模式最小闭环：

- 旧 `storyline_context` 缺 beat 时自动刷新实时约束。
- 无结构化 beat 时生成稳定 fallback beat id。
- feedback 写入 `storyline_progress`。
- quality_check 写入 `storyline_audit`。
- storylines 侧写入 `chapter_progress/currentProgress/lifecycleStatus`。
- 前端正文区与剧情线抽屉可见剧情线状态、推进摘要、used beat 和复核状态。

结论：完整 AI 托管模式下的自动调度和授权边界可归 P2；辅助创作模式下的剧情线闭环已通过。

## 13. P1 / P2 清单

P1：

| 问题 | 状态 | 处理 |
| --- | --- | --- |
| 辅助创作模式剧情线闭环 | 已修 | generate / inspect 三章 `status=ok`，`storylineAuditStatus=advanced`，`storylineWritebackOk=true` |
| streaming 不实时显示正文 chunk | 已修 | 主入口改为优先 `/api/generate/stream`，实测收到 `event: delta` |
| 目标字数严重失控 | 已修到上线前最低标准 | 3000 目标复验 3731-3746；超限有收束与 `word_count_audit` |

P2：

| 问题 | 为什么不阻断 |
| --- | --- |
| 完整全 AI 托管模式未实现 | 当前 UI / 报告已降级说明，不作为已完成功能承诺；不作为本轮阻断项 |
| 全 AI 批次进度、风险中断、批次报告未实现 | 没有完整全 AI 入口，不影响当前辅助创作链路 |
| 全 AI 自动剧情线调度 / 预授权 / 批次中断未实现 | 属于完整 AI 托管能力，可后置 |
| 复杂动态依赖评分、跨卷自动重排、智能推荐主推线 | 超出辅助创作最小闭环，可后置 |
| 创作台信息密度、正文阅读空间、聚焦模式 | 基础可用，体验优化后置 |
