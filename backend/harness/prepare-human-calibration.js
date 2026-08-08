const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const {
  DEFECT_TYPES,
  assignSplit,
  computeDatasetHash,
  createBlindSample
} = require('./judge-calibration-core');

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function parse(value, fallback = {}) {
  try { return JSON.parse(value || '') || fallback; } catch (_) { return fallback; }
}

function query(db, sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function replaceJsonSuffix(filePath, suffix) {
  return filePath.toLowerCase().endsWith('.json') ? `${filePath.slice(0, -5)}${suffix}.json` : `${filePath}${suffix}.json`;
}

async function main() {
  const databasePath = path.resolve(arg('--database'));
  const bookId = arg('--book-id');
  const outputPath = path.resolve(arg('--output', 'harness-results/judge-calibration.review.json'));
  const baselinePath = path.resolve(arg('--baseline-output', replaceJsonSuffix(outputPath, '.legacy-predictions')));
  const from = Math.max(1, Number(arg('--from', '1')) || 1);
  const to = Math.max(from, Number(arg('--to', '50')) || 50);
  if (!fs.existsSync(databasePath)) throw new Error(`数据库不存在：${databasePath}`);
  if (!bookId) throw new Error('请提供 --book-id');

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(databasePath));
  const chapters = query(db, `SELECT chapter_number, title, content FROM chapters
    WHERE book_id = ? AND chapter_number BETWEEN ? AND ? ORDER BY chapter_number`, [bookId, from, to]);
  const plans = query(db, `SELECT chapter_number, chapter_name, chapter_mission, outline_text, appearing_roles, structured_content
    FROM chapter_plans WHERE book_id = ? AND chapter_number BETWEEN ? AND ? ORDER BY chapter_number`, [bookId, from, to]);
  const runs = query(db, `SELECT chapter_number, model, prompt_version, judge_normalized_json, gate_decision, created_at
    FROM generation_runs WHERE book_id = ? AND chapter_number BETWEEN ? AND ? ORDER BY created_at`, [bookId, from, to]);
  const planByChapter = new Map(plans.map((item) => [Number(item.chapter_number), item]));
  const latestRunByChapter = new Map(runs.map((item) => [Number(item.chapter_number), item]));
  const chapterByNumber = new Map(chapters.map((item) => [Number(item.chapter_number), item]));

  const blindSamples = chapters.map((chapter) => {
    const chapterNumber = Number(chapter.chapter_number);
    const plan = planByChapter.get(chapterNumber) || {};
    const structured = parse(plan.structured_content);
    const previous = chapterByNumber.get(chapterNumber - 1);
    return createBlindSample({
      id: `${bookId}:${chapterNumber}`,
      book_id: bookId,
      chapter_number: chapterNumber,
      title: chapter.title || plan.chapter_name || '',
      previous_chapter_tail: String(previous?.content || '').slice(-2000),
      plan: {
        mission: plan.chapter_mission || '',
        outline: plan.outline_text || '',
        appearing_roles: parse(plan.appearing_roles, []),
        storyline_context: structured.storyline_context || {}
      },
      content: chapter.content || ''
    });
  });
  const datasetHash = computeDatasetHash(blindSamples);
  const splitCounts = blindSamples.reduce((result, sample) => {
    const split = assignSplit(sample);
    result[split] = (result[split] || 0) + 1;
    return result;
  }, {});
  const reviewPacket = {
    schema_version: 2,
    dataset_hash: datasetHash,
    generated_at: new Date().toISOString(),
    source_database: databasePath,
    book_id: bookId,
    split_policy: 'sha256 固定分组；development 用于调 Judge，holdout 只在最终验收时揭示',
    split_counts: splitCounts,
    defect_types: DEFECT_TYPES,
    instructions: [
      '这是盲标题册，文件中不包含任何 Judge 预测。两名评审必须独立填写 reviewer_a/reviewer_b。',
      'semantic_pass 只在不存在需要修改的问题时填 true；severe_defect 表示会污染后续章节或破坏核心剧情。',
      'evidence 必须填写正文原句和缺陷类型；文学质量六项均使用 1-5 分。',
      '两名评审结论不一致时，由第三人只填写 adjudication。不要在标注过程中查看预测文件。'
    ],
    samples: blindSamples
  };

  const baselinePredictions = blindSamples.map((sample) => {
    const run = latestRunByChapter.get(Number(sample.chapter_number)) || {};
    const judge = parse(run.judge_normalized_json);
    return {
      id: sample.id,
      sample_hash: sample.sample_hash,
      source: 'legacy_same_pipeline_judge',
      model: run.model || '',
      prompt_version: run.prompt_version || '',
      decision: run.gate_decision === 'passed' && judge.verdict === 'stable' ? 'pass' : (judge.verdict === 'risky' ? 'fail' : 'review'),
      legacy_risks: judge.risks || [],
      warning: '仅用于历史对照，不满足独立 Judge 和证据 schema，不能用于正式验收。'
    };
  });
  const baselinePacket = {
    schema_version: 2,
    dataset_hash: datasetHash,
    generated_at: new Date().toISOString(),
    judge_kind: 'legacy_baseline_invalid_for_acceptance',
    predictions: baselinePredictions
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(reviewPacket, null, 2)}\n`, 'utf8');
  fs.writeFileSync(baselinePath, `${JSON.stringify(baselinePacket, null, 2)}\n`, 'utf8');
  db.close();
  console.log(`盲标题册：${outputPath}`);
  console.log(`隐藏历史预测：${baselinePath}`);
  console.log(`样本 ${blindSamples.length} 个，development=${splitCounts.development || 0}，holdout=${splitCounts.holdout || 0}，dataset_hash=${datasetHash}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
