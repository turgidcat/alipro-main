const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { assertJudgeAcceptanceForPaidRun } = require('./judge-acceptance-policy');

test('最多三章冒烟测试不要求 Judge 验收报告', () => {
  assert.equal(assertJudgeAcceptanceForPaidRun({ chapters: [1, 2, 3] }).accepted, true);
});

test('Judge 未验收时拒绝 20 章付费长跑', () => {
  assert.throws(() => assertJudgeAcceptanceForPaidRun({ chapters: Array.from({ length: 20 }, (_, index) => index + 1) }), /allow-paid-long-run/);
});

test('明确确认 DeepSeek 预算模式后允许付费长跑', () => {
  const result = assertJudgeAcceptanceForPaidRun({
    chapters: [1, 2, 3, 4],
    allowPaidLongRun: true
  });
  assert.equal(result.accepted, true);
  assert.equal(result.reason, 'explicit_deepseek_budget_mode');
});

test('可选的人工校准报告通过后也允许长跑', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-policy-'));
  const reportPath = path.join(dir, 'report.json');
  try {
    fs.writeFileSync(reportPath, JSON.stringify({ acceptance_status: 'passed', holdout: { samples: 13 }, readiness_problems: [], dataset_hash: 'fixed' }));
    assert.equal(assertJudgeAcceptanceForPaidRun({ chapters: [1, 2, 3, 4], reportPath }).accepted, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
