const path = require('path');

const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';
const DEFAULT_DATABASE_PATH = path.join(__dirname, '..', 'database', 'novel.db');

function resolveDeepSeekModel(value = '') {
  return String(value || process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL).trim()
    || DEFAULT_DEEPSEEK_MODEL;
}

function resolveDeepSeekJudgeModel(value = '') {
  return String(value || process.env.DEEPSEEK_JUDGE_MODEL || '').trim() || resolveDeepSeekModel();
}

function resolveDeepSeekRepairModel(value = '') {
  return String(value || process.env.DEEPSEEK_REPAIR_MODEL || '').trim() || resolveDeepSeekModel();
}

function resolveDatabasePath() {
  const configured = String(process.env.NOVEL_DB_PATH || '').trim();
  return configured
    ? path.resolve(configured)
    : DEFAULT_DATABASE_PATH;
}

module.exports = {
  DEFAULT_DATABASE_PATH,
  DEFAULT_DEEPSEEK_MODEL,
  resolveDeepSeekModel,
  resolveDeepSeekJudgeModel,
  resolveDeepSeekRepairModel,
  resolveDatabasePath
};
