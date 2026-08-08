const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const dbPromise = require('../database/init');
const { saveDatabase } = require('./database');

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = stableValue(value[key]);
    return result;
  }, {});
}

function stableJson(value) {
  return JSON.stringify(stableValue(value ?? {}));
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function decideGate(audit = {}) {
  const verdict = String(audit?.verdict || '').toLowerCase();
  const planStatus = String(audit?.plan_anchor_audit?.status || '').toLowerCase();
  const outlineStatus = String(audit?.outline_coverage_audit?.status || '').toLowerCase();
  if (verdict === 'risky' || planStatus === 'risky' || outlineStatus === 'risky') return 'blocked';
  if (audit?.needs_human_review || verdict === 'needs_review' || planStatus === 'needs_review' || outlineStatus === 'needs_review') return 'review';
  return 'passed';
}

async function recordGenerationRun(input = {}) {
  const db = await dbPromise;
  const promptText = String(input.promptText || '');
  const contextJson = stableJson(input.contextSnapshot || {});
  const normalizedAudit = input.judgeNormalized || (input.audit && typeof input.audit === 'object'
    ? Object.fromEntries(Object.entries(input.audit).filter(([key]) => key !== 'raw_model_output'))
    : {});
  const judgeRawJson = stableJson(input.judgeRaw || input.audit?.raw_model_output || input.audit || {});
  const judgeNormalizedJson = stableJson(normalizedAudit);
  const id = input.id || uuidv4();
  db.run(`
    INSERT INTO generation_runs (
      id, book_id, chapter_number, prompt_type, prompt_version, prompt_hash, prompt_text,
      context_snapshot_hash, context_snapshot_json, model, temperature, max_tokens,
      response_format, raw_output, final_output, finish_reason, usage_json, duration_ms,
      retry_count, judge_raw_json, judge_normalized_json, gate_decision, status, error_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    String(input.bookId || ''),
    Number(input.chapterNumber || 0),
    String(input.promptType || 'chapter'),
    String(input.promptVersion || 'chapter.v1'),
    sha256(promptText),
    promptText,
    sha256(contextJson),
    contextJson,
    String(input.model || ''),
    Number.isFinite(Number(input.temperature)) ? Number(input.temperature) : null,
    Number.isFinite(Number(input.maxTokens)) ? Number(input.maxTokens) : null,
    stableJson(input.responseFormat || {}),
    String(input.rawOutput || ''),
    String(input.finalOutput || ''),
    String(input.finishReason || ''),
    stableJson(input.usage || {}),
    Number(input.durationMs || 0),
    Number(input.retryCount || 0),
    judgeRawJson,
    judgeNormalizedJson,
    String(input.gateDecision || decideGate(input.audit || {})),
    String(input.status || 'completed'),
    String(input.errorText || '')
  ]);
  saveDatabase(db);
  return {
    id,
    promptHash: sha256(promptText),
    promptLength: promptText.length,
    contextSnapshotHash: sha256(contextJson),
    contextSnapshotLength: contextJson.length,
    gateDecision: String(input.gateDecision || decideGate(input.audit || {}))
  };
}

module.exports = {
  decideGate,
  recordGenerationRun,
  sha256,
  stableJson
};
