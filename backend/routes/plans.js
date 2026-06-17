const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { BookPlanService, VolumePlanService } = require('../services/database');
const deepseekService = require('../services/deepseek');

const bookPlanService = new BookPlanService();
const volumePlanService = new VolumePlanService();

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function tryParseJsonObject(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  try {
    return JSON.parse(normalized);
  } catch (_) {
    const match = normalized.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (_) {
      return null;
    }
  }
}

function normalizeVolumePlanDraft(item, index) {
  if (!item || typeof item !== 'object') return null;
  const volumeNumber = Number(item.volume_number || item.volumeNumber || item.number || index + 1);
  const volumeName = normalizeText(item.volume_name || item.volumeName || item.title || `第${volumeNumber}卷`);
  const volumeTheme = normalizeText(item.volume_theme || item.volumeTheme || item.theme || '');
  const stageGoal = normalizeText(item.stage_goal || item.stageGoal || item.goal || '');
  const coreConflict = normalizeText(item.core_conflict || item.coreConflict || '');
  const startRoleState = normalizeText(item.start_role_state || item.startRoleState || '');
  const endRoleState = normalizeText(item.end_role_state || item.endRoleState || '');
  const estimatedChapters = Math.max(1, Number(item.estimated_chapters || item.estimatedChapters || 15) || 15);
  const storylineQuota = Math.max(1, Number(item.storyline_quota || item.storylineQuota || 3) || 3);
  const notes = normalizeText(item.notes || item.summary || item.description || '');

  if (!stageGoal && !coreConflict && !notes && !volumeTheme) return null;

  return {
    volume_number: volumeNumber,
    volume_name: volumeName,
    volume_theme: volumeTheme,
    stage_goal: stageGoal,
    core_conflict: coreConflict,
    start_role_state: startRoleState,
    end_role_state: endRoleState,
    estimated_chapters: estimatedChapters,
    storyline_quota: storylineQuota,
    notes
  };
}

function buildVolumePlanGenerationPrompt(bookPlan = {}, bookId = '', targetVolumeCount = 0) {
  const premise = normalizeText(bookPlan.premise || '');
  const mainGoal = normalizeText(bookPlan.main_goal || '');
  const coreConflict = normalizeText(bookPlan.core_conflict || '');
  const worldRules = normalizeText(bookPlan.world_rules || '');
  const roleSummary = normalizeText(bookPlan.role_summary || '');
  const mainOutline = normalizeText(bookPlan.main_outline || '');
  const volumeOutline = normalizeText(bookPlan.volume_outline || '');
  const detailedOutline = normalizeText(bookPlan.detailed_outline || '');

  return [
    '你是一名网文分卷规划编辑。',
    '任务：根据全书规划，拆出可以直接写入 volume_plans 的分卷规划。',
    '不要写分析过程，只输出严格 JSON。',
    '',
    '输出 schema：',
    '{',
    '  "volumes": [',
    '    {',
    '      "volume_number": 1,',
    '      "volume_name": "卷名",',
    '      "volume_theme": "这一卷的气质或主题",',
    '      "stage_goal": "这一卷阶段目标",',
    '      "core_conflict": "这一卷最核心的冲突",',
    '      "start_role_state": "这一卷开始时关键角色的大状态",',
    '      "end_role_state": "这一卷结束时关键角色的大状态",',
    '      "estimated_chapters": 15,',
    '      "storyline_quota": 3,',
    '      "notes": "这卷的大致推进、关键转折和收束方向"',
    '    }',
    '  ]',
    '}',
    '',
    '规则：',
    '1. 只按现有全书规划拆卷，不要补外部设定。',
    '2. volume_number 必须从 1 开始连续递增。',
    '3. 每卷都必须有 stage_goal 和 core_conflict。',
    '4. start_role_state / end_role_state 只写阶段状态，不要写单章细节。',
    '5. estimated_chapters 取合理范围，常规网文卷一般 8 到 30 章。',
    '6. storyline_quota 只写这一卷同时活跃的主要剧情线数量，常规 1 到 5。',
    '7. 如果现有规划不足以支撑太多分卷，就宁可少拆，不要硬凑。',
    '8. 输出必须能直接落库，不要返回解释文本。',
    targetVolumeCount > 0 ? `9. 本次目标卷数为 ${targetVolumeCount} 卷，除非全书规划明显不足，否则请尽量按这个卷数拆分。` : '9. 如果没有明确卷数要求，请根据全书规划自行判断合理卷数。',
    '',
    `book_id: ${bookId || 'unknown'}`,
    `作品前提：${premise || '未提供'}`,
    `全书主目标：${mainGoal || '未提供'}`,
    `全书核心冲突：${coreConflict || '未提供'}`,
    `世界规则：${worldRules || '未提供'}`,
    `角色底盘：${roleSummary || '未提供'}`,
    '',
    `全书主线：\n${mainOutline || '未提供'}`,
    '',
    `分卷推进：\n${volumeOutline || '未提供'}`,
    '',
    `详细推进：\n${detailedOutline || '未提供'}`
  ].join('\n');
}

router.get('/books/:bookId/book-plan', async (req, res) => {
  try {
    const userId = '';
    const plan = await bookPlanService.getByBookId(req.params.bookId, userId);
    res.json({
      success: true,
      data: plan || null
    });
  } catch (error) {
    logger.error('Get book plan failed', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: '获取全书规划失败' });
  }
});

router.post('/books/:bookId/book-plan', async (req, res) => {
  try {
    const userId = '';
    const payload = {
      premise: normalizeText(req.body.premise || ''),
      main_goal: normalizeText(req.body.main_goal || req.body.mainGoal || ''),
      core_conflict: normalizeText(req.body.core_conflict || req.body.coreConflict || ''),
      world_rules: normalizeText(req.body.world_rules || req.body.worldRules || ''),
      role_summary: normalizeText(req.body.role_summary || req.body.roleSummary || ''),
      main_outline: normalizeText(req.body.main_outline || req.body.mainOutline || ''),
      volume_outline: normalizeText(req.body.volume_outline || req.body.volumeOutline || ''),
      detailed_outline: normalizeText(req.body.detailed_outline || req.body.detailedOutline || ''),
      structured_content: req.body.structured_content || req.body.structuredContent || {},
      source: normalizeText(req.body.source || 'manual') || 'manual',
      status: normalizeText(req.body.status || 'draft') || 'draft'
    };

    const plan = await bookPlanService.upsert(req.params.bookId, payload, userId);
    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    logger.error('Save book plan failed', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: '保存全书规划失败' });
  }
});

router.get('/books/:bookId/volume-plans', async (req, res) => {
  try {
    const userId = '';
    const plans = await volumePlanService.getByBookId(req.params.bookId, userId);
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    logger.error('Get volume plans failed', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: '获取分卷规划失败' });
  }
});

router.post('/books/:bookId/volume-plans/generate', async (req, res) => {
  try {
    const userId = '';
    const { bookId } = req.params;
    const overwrite = req.body?.overwrite !== false;
    const targetVolumeCount = Math.max(0, Number.parseInt(req.body?.target_volume_count ?? req.body?.targetVolumeCount ?? 0, 10) || 0);
    const bookPlan = await bookPlanService.getByBookId(bookId, userId);

    if (!bookPlan) {
      return res.status(404).json({ success: false, error: '未找到全书规划，无法拆分分卷' });
    }

    const hasOutline = [
      bookPlan.main_outline,
      bookPlan.volume_outline,
      bookPlan.detailed_outline
    ].some((item) => normalizeText(item));

    if (!hasOutline) {
      return res.status(400).json({ success: false, error: '全书规划还没有大纲内容，无法拆分分卷' });
    }

    const existingPlans = await volumePlanService.getByBookId(bookId, userId);
    if (!overwrite && Array.isArray(existingPlans) && existingPlans.length > 0) {
      return res.status(400).json({ success: false, error: '当前书籍已经有分卷规划，如需重拆请允许覆盖' });
    }

    const prompt = buildVolumePlanGenerationPrompt(bookPlan, bookId, targetVolumeCount);
    const result = await deepseekService.generate({
      prompt,
      model: 'deepseek-chat',
      temperature: 0.35,
      maxTokens: 2200,
      responseFormat: { type: 'json_object' }
    });

    if (!result.success) {
      return res.status(result.statusCode || 500).json({ success: false, error: result.error || '分卷拆解失败' });
    }

    const parsed = tryParseJsonObject(result.content);
    const volumeDrafts = Array.isArray(parsed?.volumes)
      ? parsed.volumes.map((item, index) => normalizeVolumePlanDraft(item, index)).filter(Boolean)
      : [];

    if (volumeDrafts.length === 0) {
      return res.status(500).json({ success: false, error: '模型没有返回可用的分卷规划' });
    }

    if (overwrite) {
      await volumePlanService.deleteByBookId(bookId, userId);
    }

    for (const draft of volumeDrafts) {
      await volumePlanService.upsert(bookId, draft.volume_number, {
        ...draft,
        source: 'ai',
        status: 'draft',
        structured_content: {
          generated_from: 'book_plans',
          generated_at: new Date().toISOString()
        }
      }, userId);
    }

    const plans = await volumePlanService.getByBookId(bookId, userId);
    res.json({
      success: true,
      data: {
        plans,
        generatedCount: volumeDrafts.length,
        targetVolumeCount
      }
    });
  } catch (error) {
    logger.error('Generate volume plans failed', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: '自动拆分分卷失败' });
  }
});

router.post('/books/:bookId/volume-plans/:volumeNumber', async (req, res) => {
  try {
    const userId = '';
    const volumeNumber = Number.parseInt(req.params.volumeNumber, 10);
    if (!Number.isFinite(volumeNumber) || volumeNumber < 1) {
      return res.status(400).json({ success: false, error: 'volumeNumber 必须大于 0' });
    }

    const plans = await volumePlanService.upsert(req.params.bookId, volumeNumber, req.body || {}, userId);
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    logger.error('Save volume plan failed', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: '保存分卷规划失败' });
  }
});

module.exports = router;
