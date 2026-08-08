const test = require('node:test');
const assert = require('node:assert/strict');
const cases = require('./fixtures/deterministic-cases.json');
const { inspectDeterministicContent } = require('./deterministic-judge');

test('固定评测集包含 10 个正常样本和 20 个缺陷样本', () => {
  assert.equal(cases.length, 30);
  assert.equal(cases.filter((item) => item.label === 'normal').length, 10);
  assert.equal(cases.filter((item) => item.label === 'defect').length, 20);
});

test('确定性 Judge 对固定标签保持精确匹配', () => {
  const mismatches = [];
  for (const item of cases) {
    const actual = inspectDeterministicContent(item.input).issues.map((issue) => issue.code).sort();
    const expected = [...item.expected].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) mismatches.push({ id: item.id, expected, actual });
  }
  assert.deepEqual(mismatches, []);
});

test('固定缺陷集的样本级 precision 与 recall 均为 1', () => {
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  for (const item of cases) {
    const predictedDefect = inspectDeterministicContent(item.input).issues.length > 0;
    const actualDefect = item.label === 'defect';
    if (predictedDefect && actualDefect) truePositive += 1;
    if (predictedDefect && !actualDefect) falsePositive += 1;
    if (!predictedDefect && actualDefect) falseNegative += 1;
  }
  assert.equal(truePositive / (truePositive + falsePositive), 1);
  assert.equal(truePositive / (truePositive + falseNegative), 1);
});
