const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

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
  const result = [];
  while (stmt.step()) result.push(stmt.getAsObject());
  stmt.free();
  return result;
}

async function main() {
  const databasePath = path.resolve(arg('--database'));
  const bookId = arg('--book-id');
  const chapterNumber = Number(arg('--chapter', '0')) || 0;
  const includePrompt = process.argv.includes('--include-prompt');
  const includeContent = process.argv.includes('--include-content');
  if (!databasePath || !bookId) throw new Error('请提供 --database 和 --book-id');
  if (!fs.existsSync(databasePath)) throw new Error(`数据库不存在：${databasePath}`);
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(databasePath));
  const plans = query(db, `SELECT chapter_number, chapter_name, structured_content FROM chapter_plans
    WHERE book_id = ? AND (? = 0 OR chapter_number = ?) ORDER BY chapter_number`, [bookId, chapterNumber, chapterNumber]);
  const runs = query(db, `SELECT id, chapter_number, prompt_version, model, finish_reason, duration_ms,
    gate_decision, usage_json, judge_normalized_json, created_at${includePrompt ? ', prompt_text' : ''} FROM generation_runs
    WHERE book_id = ? AND (? = 0 OR chapter_number = ?) ORDER BY created_at`, [bookId, chapterNumber, chapterNumber]);
  const report = {
    databasePath,
    chapters: plans.map((plan) => {
      const structured = parse(plan.structured_content);
      const feedback = structured.chapter_feedback || {};
      const quality = feedback.quality_check || {};
      return {
        chapterNumber: plan.chapter_number,
        chapterName: plan.chapter_name,
        feedbackSource: feedback.source || '',
        qualityStatus: quality.status || '',
        verdict: quality.verdict || '',
        risks: quality.risks || [],
        planAnchorAudit: quality.plan_anchor_audit || {},
        storylineAudit: quality.storyline_audit || {},
        wordCountAudit: quality.word_count_audit || {},
        needsHumanReview: Boolean(quality.needs_human_review)
      };
    }),
    runs: runs.map((run) => ({
      ...run,
      usage: parse(run.usage_json),
      judge: parse(run.judge_normalized_json)
    }))
  };
  if (includeContent) {
    report.generatedChapters = query(db, `SELECT chapter_number, title, content FROM chapters
      WHERE book_id = ? AND (? = 0 OR chapter_number = ?) ORDER BY chapter_number`, [bookId, chapterNumber, chapterNumber]);
  }
  console.log(JSON.stringify(report, null, 2));
  db.close();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
