const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const deepseekService = require('../services/deepseek');
const { resolveDeepSeekModel, resolveDeepSeekJudgeModel } = require('../config/runtime');
const { assignSplit, validatePrediction } = require('./judge-calibration-core');

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function parseJson(value) {
  const text = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try { return JSON.parse(text); } catch (_) { return null; }
}

async function callJudge(model, sample) {
  const result = await deepseekService.generate({
    model,
    systemPrompt: '你是只读质量裁判。不得生成、续写或修稿；所有缺陷必须引用输入原文证据。',
    prompt: buildPrompt(sample),
    temperature: 0,
    maxTokens: 2200,
    responseFormat: { type: 'json_object' }
  });
  return {
    success: !!result.success,
    content: result.content || '',
    model: result.model || model,
    usage: result.usage || null,
    finishReason: result.finishReason || '',
    error: result.error || ''
  };
}

function buildPrompt(sample) {
  return [
    '你是独立的长篇小说质量裁判，不负责生成或修稿。你不知道人工标签，也不得迎合生成模型。',
    '只根据提供的上一章结尾、章节规划和当前正文判断。每个缺陷必须给出可以在原文中逐字找到的短证据；没有证据就不得判缺陷。',
    '不要把“未解释但可作为后续悬念”判成冲突；不要把同义改写判成计划遗漏；不要在 defects 中写“不构成问题”的排除过程。',
    'decision=pass 时 defects 必须为空；review 表示证据不足但确需人工判断；fail 表示证据明确。',
    '',
    '严格输出 JSON：',
    JSON.stringify({
      decision: 'pass/review/fail',
      defects: [{
        code: 'text_integrity/chapter_handoff/fact_continuity/character_continuity/plan_mission/outline_coverage/forbidden_event/summary_fidelity/pacing/dialogue/prose_naturalness/repetition/ending_hook',
        severity: 'low/medium/high/block',
        claim: '明确、可证伪的缺陷描述',
        evidence: { current_quote: '当前正文逐字短引文或空字符串', previous_quote: '上一章结尾逐字短引文或空字符串' }
      }],
      literary_scores: { plot_progress: 1, character_consistency: 1, dialogue: 1, pacing: 1, hook: 1, prose_naturalness: 1 },
      summary: '不超过100字的裁判结论'
    }, null, 2),
    '',
    `样本ID：${sample.id}`,
    `章节：第${sample.chapter_number}章 ${sample.title}`,
    `章节任务：${sample?.plan?.mission || '未提供'}`,
    `章节细纲：${sample?.plan?.outline || '未提供'}`,
    `剧情线约束：${JSON.stringify(sample?.plan?.storyline_context || {})}`,
    `上一章正文结尾：\n${sample.previous_chapter_tail || '第一章，无上一章'}`,
    `当前正文：\n${sample.content || ''}`
  ].join('\n');
}

async function main() {
  const inputPath = path.resolve(arg('--input'));
  const outputPath = path.resolve(arg('--output', 'harness-results/judge-calibration.predictions.json'));
  const split = arg('--split', 'development');
  const limit = Math.max(0, Number(arg('--limit', '0')) || 0);
  const unlockHoldout = process.argv.includes('--unlock-holdout');
  if (!fs.existsSync(inputPath)) throw new Error(`盲标题册不存在：${inputPath}`);
  if (!['development', 'holdout', 'all'].includes(split)) throw new Error('--split 只能是 development/holdout/all');
  if ((split === 'holdout' || split === 'all') && !unlockHoldout) throw new Error('保留集默认锁定；最终验收时显式传入 --unlock-holdout');

  const packet = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const generationModel = resolveDeepSeekModel();
  const judgeModel = resolveDeepSeekJudgeModel(process.env.DEEPSEEK_JUDGE_MODEL || generationModel);

  let samples = (packet.samples || []).filter((sample) => split === 'all' || assignSplit(sample) === split);
  if (limit > 0) samples = samples.slice(0, limit);
  const predictions = [];
  for (const [index, sample] of samples.entries()) {
    const startedAt = Date.now();
    let result = null;
    let apiError = '';
    try {
      result = await callJudge(judgeModel, sample);
      if (!result.success) apiError = String(result.error || 'DeepSeek Judge 调用失败');
    } catch (error) {
      apiError = String(error.response?.data?.error?.message || error.message || error);
    }
    const apiSuccess = !!result?.success;
    const parsed = apiSuccess ? parseJson(result.content) : null;
    const prediction = {
      id: sample.id,
      sample_hash: sample.sample_hash,
      split: assignSplit(sample),
      model: result?.model || judgeModel,
      prompt_version: 'judge.evidence.v1',
      decision: parsed?.decision || 'fail',
      defects: Array.isArray(parsed?.defects) ? parsed.defects : [],
      literary_scores: parsed?.literary_scores || {},
      summary: String(parsed?.summary || ''),
      usage: result?.usage || null,
      finish_reason: result?.finishReason || '',
      duration_ms: Date.now() - startedAt,
      api_success: apiSuccess,
      parse_success: !!parsed,
      error: apiError
    };
    const validation = validatePrediction(sample, prediction);
    prediction.prediction_valid = validation.valid && apiSuccess && !!parsed;
    prediction.validation_errors = [...validation.errors, ...(!apiSuccess ? ['api_failed'] : []), ...(!parsed ? ['json_parse_failed'] : [])];
    predictions.push(prediction);
    console.log(`[${index + 1}/${samples.length}] ${sample.id}: ${prediction.decision}, valid=${prediction.prediction_valid}`);
  }

  const output = {
    schema_version: 2,
    dataset_hash: packet.dataset_hash,
    generated_at: new Date().toISOString(),
    judge_kind: 'isolated_evidence_judge',
    judge_provider: 'deepseek',
    judge_model: judgeModel,
    generation_provider: 'deepseek',
    generation_model: generationModel,
    independent_model: judgeModel !== generationModel,
    independent_provider: false,
    isolated_judge_run: true,
    prompt_version: 'judge.evidence.v1',
    evaluated_split: split,
    holdout_unlocked: unlockHoldout,
    predictions
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`独立 Judge 结果：${outputPath}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
