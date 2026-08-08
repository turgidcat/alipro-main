const fs = require('fs');
const path = require('path');

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function countBy(rows, key, fallback = 'missing') {
  return rows.reduce((result, row) => {
    const value = String(row?.[key] ?? '').trim() || fallback;
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function main() {
  const outputPath = arg('--output');
  const latestPerChapter = process.argv.includes('--latest-per-chapter');
  const inputs = process.argv.slice(2).filter((item, index, args) => {
    if (item === '--output') return false;
    if (index > 0 && args[index - 1] === '--output') return false;
    return !item.startsWith('--');
  });
  if (inputs.length < 1) throw new Error('请提供至少一个 JSON 报告路径');

  const reports = inputs.map((item) => {
    const filePath = path.resolve(item);
    return { filePath, data: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  });
  const allRows = reports.flatMap(({ filePath, data }) => (data.rows || []).map((row) => ({
    ...row,
    sourceReport: path.basename(filePath)
  })));
  const rows = latestPerChapter
    ? [...allRows.reduce((result, row) => {
        result.set(Number(row.chapterNumber), row);
        return result;
      }, new Map()).values()].sort((left, right) => Number(left.chapterNumber) - Number(right.chapterNumber))
    : allRows;
  const passed = rows.filter((row) => row.status === 'ok').length;
  const summary = {
    generatedAt: new Date().toISOString(),
    reports: reports.map((item) => item.filePath),
    latestPerChapter,
    chapterRange: rows.length ? [Math.min(...rows.map((row) => row.chapterNumber)), Math.max(...rows.map((row) => row.chapterNumber))] : [],
    total: rows.length,
    passed,
    failed: rows.length - passed,
    passRate: rows.length ? Number((passed / rows.length).toFixed(4)) : 0,
    totalDurationSeconds: Number(rows.reduce((sum, row) => sum + Number(row.durationSeconds || 0), 0).toFixed(1)),
    promptTokens: rows.reduce((sum, row) => sum + Number(row.promptTokens || 0), 0),
    completionTokens: rows.reduce((sum, row) => sum + Number(row.completionTokens || 0), 0),
    statusCounts: countBy(rows, 'status'),
    gateDecisionCounts: countBy(rows, 'gateDecision'),
    qualityStatusCounts: countBy(rows, 'qualityStatus'),
    planAnchorCounts: countBy(rows, 'planAnchorAuditStatus'),
    storylineCounts: countBy(rows, 'storylineAuditStatus'),
    wordCountCounts: countBy(rows, 'wordCountAuditStatus'),
    failures: rows.filter((row) => row.status !== 'ok').map((row) => ({
      chapterNumber: row.chapterNumber,
      status: row.status,
      gateDecision: row.gateDecision,
      qualityStatus: row.qualityStatus,
      qualityVerdict: row.qualityVerdict,
      planAnchorAuditStatus: row.planAnchorAuditStatus,
      storylineAuditStatus: row.storylineAuditStatus,
      wordCountAuditStatus: row.wordCountAuditStatus,
      qualityRisks: row.qualityRisks,
      sourceReport: row.sourceReport
    }))
  };
  const serialized = `${JSON.stringify(summary, null, 2)}\n`;
  if (outputPath) {
    const resolved = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, serialized, 'utf8');
    console.log(`汇总报告已写入：${resolved}`);
  } else {
    process.stdout.write(serialized);
  }
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}
