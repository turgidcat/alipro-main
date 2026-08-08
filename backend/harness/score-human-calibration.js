const fs = require('fs');
const path = require('path');
const {
  DEFECT_TYPES,
  assignSplit,
  computeDatasetHash,
  resolveGoldLabel,
  scoreRows,
  validatePrediction
} = require('./judge-calibration-core');

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function divide(numerator, denominator) {
  return denominator ? Number((numerator / denominator).toFixed(4)) : null;
}

function scoreDefectTypes(rows) {
  return Object.fromEntries(DEFECT_TYPES.map((type) => {
    let tp = 0; let fp = 0; let fn = 0;
    for (const row of rows) {
      const expected = (row.gold.defect_types || []).includes(type);
      const actual = (row.prediction.defects || []).some((item) => item.code === type);
      if (expected && actual) tp += 1;
      else if (!expected && actual) fp += 1;
      else if (expected && !actual) fn += 1;
    }
    return [type, { support: tp + fn, precision: divide(tp, tp + fp), recall: divide(tp, tp + fn) }];
  }));
}

function meetsTargets(score) {
  return score.samples > 0
    && score.defect_precision !== null && score.defect_precision >= 0.9
    && score.defect_recall !== null && score.defect_recall >= 0.95
    && score.false_positive_rate !== null && score.false_positive_rate <= 0.1
    && score.severe_false_negatives === 0;
}

function main() {
  const inputPath = path.resolve(arg('--input'));
  const predictionPaths = arg('--predictions').split(',').map((item) => item.trim()).filter(Boolean).map((item) => path.resolve(item));
  const outputPath = arg('--output') ? path.resolve(arg('--output')) : '';
  const revealHoldout = process.argv.includes('--reveal-holdout');
  if (!fs.existsSync(inputPath)) throw new Error(`盲标文件不存在：${inputPath}`);
  if (predictionPaths.length === 0) throw new Error('请提供 --predictions；development 与 holdout 文件可用逗号分隔');
  predictionPaths.forEach((item) => { if (!fs.existsSync(item)) throw new Error(`Judge 预测文件不存在：${item}`); });
  const packet = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const predictionPackets = predictionPaths.map((item) => JSON.parse(fs.readFileSync(item, 'utf8')));
  const predictionPacket = predictionPackets[0];
  const currentDatasetHash = computeDatasetHash(packet.samples || []);
  if (packet.dataset_hash !== currentDatasetHash) throw new Error('盲标题册内容已变化，dataset_hash 校验失败');
  if (predictionPackets.some((item) => item.dataset_hash !== packet.dataset_hash)) throw new Error('预测文件与盲标题册不是同一固定题库');

  const predictionById = new Map(predictionPackets.flatMap((item) => item.predictions || []).map((item) => [item.id, item]));
  const labelStatusCounts = { agreed: 0, adjudicated: 0, disputed: 0, incomplete: 0 };
  const validRows = [];
  const invalidPredictions = [];
  for (const sample of packet.samples || []) {
    const resolution = resolveGoldLabel(sample);
    labelStatusCounts[resolution.status] = (labelStatusCounts[resolution.status] || 0) + 1;
    if (!resolution.label) continue;
    const prediction = predictionById.get(sample.id);
    if (!prediction) continue;
    const validation = validatePrediction(sample, prediction);
    if (!validation.valid || prediction.prediction_valid === false) {
      invalidPredictions.push({ id: sample.id, errors: prediction.validation_errors || validation.errors });
      continue;
    }
    validRows.push({ sample, gold: resolution.label, prediction, split: assignSplit(sample) });
  }

  const developmentRows = validRows.filter((row) => row.split === 'development');
  const holdoutRows = validRows.filter((row) => row.split === 'holdout');
  const developmentScore = scoreRows(developmentRows);
  const holdoutScore = revealHoldout ? scoreRows(holdoutRows) : null;
  const readinessProblems = [];
  const independentModel = predictionPackets.every((item) => item.independent_model === true);
  const independentProvider = predictionPackets.every((item) => item.independent_provider === true
    && item.judge_provider && item.generation_provider && item.judge_provider !== item.generation_provider);
  const isolatedJudgeRun = predictionPackets.every((item) => item.isolated_judge_run === true);
  if (!isolatedJudgeRun) readinessProblems.push('Judge 预测未通过独立调用流程生成');
  if (invalidPredictions.length > 0) readinessProblems.push(`存在 ${invalidPredictions.length} 个无效或无原文证据的预测`);
  if (labelStatusCounts.incomplete > 0) readinessProblems.push(`仍有 ${labelStatusCounts.incomplete} 个样本未完成双人标注`);
  if (labelStatusCounts.disputed > 0) readinessProblems.push(`仍有 ${labelStatusCounts.disputed} 个分歧样本未裁决`);
  if (developmentRows.length < 20) readinessProblems.push('development 有效标注少于 20 个');
  if (revealHoldout && holdoutRows.length < 10) readinessProblems.push('holdout 有效标注少于 10 个');

  let acceptanceStatus = 'not_ready';
  if (readinessProblems.length === 0) {
    if (!revealHoldout) acceptanceStatus = meetsTargets(developmentScore) ? 'development_passed' : 'development_failed';
    else acceptanceStatus = meetsTargets(developmentScore) && meetsTargets(holdoutScore) ? 'passed' : 'failed';
  }
  const report = {
    schema_version: 2,
    generated_at: new Date().toISOString(),
    dataset_hash: packet.dataset_hash,
    judge_model: predictionPacket.judge_model || '',
    judge_provider: predictionPacket.judge_provider || '',
    generation_model: predictionPacket.generation_model || '',
    generation_provider: predictionPacket.generation_provider || '',
    independent_model: independentModel,
    independent_provider: independentProvider,
    isolated_judge_run: isolatedJudgeRun,
    prompt_version: predictionPacket.prompt_version || '',
    label_status_counts: labelStatusCounts,
    valid_prediction_samples: validRows.length,
    invalid_predictions: invalidPredictions,
    development: { ...developmentScore, defect_types: scoreDefectTypes(developmentRows) },
    holdout: revealHoldout ? { ...holdoutScore, defect_types: scoreDefectTypes(holdoutRows) } : { status: 'locked', samples_withheld: (packet.samples || []).filter((sample) => assignSplit(sample) === 'holdout').length },
    acceptance_targets: { defect_precision_at_least: 0.9, defect_recall_at_least: 0.95, false_positive_rate_at_most: 0.1, severe_false_negatives: 0 },
    acceptance_status: acceptanceStatus,
    readiness_problems: readinessProblems
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, serialized, 'utf8');
    console.log(`Judge 校准报告：${outputPath}`);
  } else process.stdout.write(serialized);
  if (acceptanceStatus !== 'passed') process.exitCode = 2;
}

try { main(); } catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}
