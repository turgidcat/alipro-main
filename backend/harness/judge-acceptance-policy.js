const fs = require('fs');
const path = require('path');

function assertJudgeAcceptanceForPaidRun({ chapters = [], reportPath = '', allowPaidLongRun = false } = {}) {
  const chapterCount = Array.isArray(chapters) ? chapters.length : 0;
  if (chapterCount <= 3) return { required: false, accepted: true, reason: 'smoke_test_only' };
  if (allowPaidLongRun) {
    return { required: false, accepted: true, reason: 'explicit_deepseek_budget_mode' };
  }
  if (!String(reportPath || '').trim()) {
    throw new Error(`连续生成 ${chapterCount} 章需要显式传入 --allow-paid-long-run，或提供 --judge-acceptance-report`);
  }
  const resolved = path.resolve(reportPath);
  if (!fs.existsSync(resolved)) throw new Error(`Judge 验收报告不存在：${resolved}`);
  const report = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const holdoutRevealed = report.holdout && report.holdout.status !== 'locked';
  const accepted = report.acceptance_status === 'passed'
    && holdoutRevealed
    && Array.isArray(report.readiness_problems)
    && report.readiness_problems.length === 0;
  if (!accepted) {
    throw new Error('Judge 校准报告尚未通过；可修正报告，或明确使用 --allow-paid-long-run 进入 DeepSeek 预算模式');
  }
  return { required: true, accepted: true, reportPath: resolved, datasetHash: report.dataset_hash || '' };
}

module.exports = { assertJudgeAcceptanceForPaidRun };
