require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { DEFAULT_DATABASE_PATH, resolveDatabasePath } = require('./config/runtime');
const { DEFAULT_WORD_COUNT } = require('./services/word-count-policy');

let persistenceRuntime = null;

function getPersistenceRuntime() {
  if (!persistenceRuntime) {
    persistenceRuntime = {
      dbPromise: require('./database/init'),
      ...require('./services/database')
    };
  }
  return persistenceRuntime;
}

const DEFAULT_BASE_URL = process.env.BATCH_VERIFY_BASE_URL || 'http://localhost:3000';
const DEFAULT_BOOK_ID = process.env.BATCH_VERIFY_BOOK_ID || 'b8bd76b6-170f-4666-9233-36e86b1f8b1d';
const DEFAULT_MODE = (process.env.BATCH_VERIFY_MODE || 'inspect').trim().toLowerCase();
const DEFAULT_CHAPTERS = process.env.BATCH_VERIFY_CHAPTERS || '1,2,3';

function getArgValue(name, fallback = '') {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const next = args[index + 1];
  return typeof next === 'string' ? next : fallback;
}

function parseChapters(value) {
  return String(value || '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

const MODE = getArgValue('--mode', DEFAULT_MODE) || 'inspect';
const BASE_URL = getArgValue('--base-url', DEFAULT_BASE_URL) || DEFAULT_BASE_URL;
const BOOK_ID = getArgValue('--book-id', DEFAULT_BOOK_ID) || DEFAULT_BOOK_ID;
const CHAPTERS = parseChapters(getArgValue('--chapters', DEFAULT_CHAPTERS));
const PROMPT_VERSION = getArgValue('--prompt-version', process.env.BATCH_VERIFY_PROMPT_VERSION || 'chapter.v2') || 'chapter.v2';
const REPORT_PATH = getArgValue('--report-path', process.env.BATCH_VERIFY_REPORT_PATH || '');
const CONTINUE_ON_FAILURE = process.argv.includes('--continue-on-failure') || process.env.BATCH_VERIFY_CONTINUE_ON_FAILURE === '1';

function normalizeText(value) {
  return String(value || '').trim();
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function hasMeaningfulOutlineStructure(value) {
  const structure = parseJsonObject(value);
  return [
    structure.chapter_goal,
    structure.key_scenes,
    structure.conflict_escalation,
    structure.character_change,
    structure.reader_payoff,
    structure.ending_hook
  ].some((item) => normalizeText(item));
}

function normalizeQualityCheck(value = {}) {
  const qualityCheck = value && typeof value === 'object' ? value : {};
  const planAnchorAudit = parseJsonObject(qualityCheck.plan_anchor_audit || qualityCheck.planAnchorAudit);
  const storylineAudit = parseJsonObject(qualityCheck.storyline_audit || qualityCheck.storylineAudit);
  const wordCountAudit = parseJsonObject(qualityCheck.word_count_audit || qualityCheck.wordCountAudit);
  return {
    status: normalizeText(qualityCheck.status || ''),
    source: normalizeText(qualityCheck.source || ''),
    verdict: normalizeText(qualityCheck.verdict || ''),
    risks: parseJsonArray(qualityCheck.risks).map((item) => normalizeText(item)).filter(Boolean),
    checkedAt: normalizeText(qualityCheck.checked_at || qualityCheck.checkedAt || ''),
    needsHumanReview: Boolean(qualityCheck.needs_human_review),
    planAnchorAudit: {
      status: normalizeText(planAnchorAudit.status || '')
    },
    storylineAudit: {
      status: normalizeText(storylineAudit.status || ''),
      usedStorylineIds: parseJsonArray(storylineAudit.used_storyline_ids || storylineAudit.usedStorylineIds),
      usedBeatIds: parseJsonArray(storylineAudit.used_beat_ids || storylineAudit.usedBeatIds),
      requiresReview: Boolean(storylineAudit.requires_review || storylineAudit.requiresReview)
    },
    wordCountAudit: {
      status: normalizeText(wordCountAudit.status || ''),
      target: Number(wordCountAudit.target || 0) || 0,
      actual: Number(wordCountAudit.actual || 0) || 0
    }
  };
}

function buildStorylineProgressSnapshot(storylineRows = []) {
  return (Array.isArray(storylineRows) ? storylineRows : []).map((row) => {
    const structured = parseJsonObject(row.structured_content);
    const currentProgress = parseJsonObject(structured.currentProgress);
    const chapterProgress = parseJsonArray(structured.chapter_progress);
    return {
      id: row.id,
      status: normalizeText(row.status || ''),
      lifecycleStatus: normalizeText(currentProgress.lifecycleStatus || structured.lifecycleStatus || ''),
      lastUpdatedChapterNumber: Number(currentProgress.lastUpdatedChapterNumber || 0) || 0,
      lastProgressSummary: normalizeText(currentProgress.lastProgressSummary || structured?.last_chapter_feedback?.story_progress || ''),
      lastUsedBeatIds: parseJsonArray(currentProgress.lastUsedBeatIds),
      chapterProgressNumbers: chapterProgress.map((item) => Number(item.chapter_number || item.chapterNumber || 0)).filter(Boolean),
      chapterProgressCount: chapterProgress.length,
      requiresReview: Boolean(currentProgress.requiresReview)
    };
  });
}

function buildSnapshotFromRows({ chapter, plan, storylineRows = [] }) {
  const structuredContent = parseJsonObject(plan?.structured_content);
  const feedback = parseJsonObject(structuredContent.chapter_feedback);
  const storylineContext = parseJsonObject(structuredContent.storyline_context);
  return {
    chapter,
    plan,
    structuredContent,
    storylineContext,
    feedback,
    storylineProgress: feedback.storyline_progress || null,
    storylineRows: buildStorylineProgressSnapshot(storylineRows),
    feedbackSource: normalizeText(feedback.source || ''),
    qualityCheck: normalizeQualityCheck(feedback.quality_check)
  };
}

function evaluateChapterSnapshot(chapterNumber, snapshot, previousSnapshot = null) {
  const hasContent = normalizeText(snapshot?.chapter?.content || '').length > 0;
  const hasFeedback = snapshot?.feedback && typeof snapshot.feedback === 'object' && Object.keys(snapshot.feedback).length > 0;
  const feedbackSource = normalizeText(snapshot?.feedbackSource || '');
  const hasSummary = normalizeText(snapshot?.feedback?.chapter_summary || '').length > 0;
  const hasQualityCheck = normalizeText(snapshot?.qualityCheck?.status || '').length > 0;
  const qualityStatus = normalizeText(snapshot?.qualityCheck?.status || '');
  const qualitySource = normalizeText(snapshot?.qualityCheck?.source || '');
  const qualityVerdict = normalizeText(snapshot?.qualityCheck?.verdict || '');
  const qualityRisks = parseJsonArray(snapshot?.qualityCheck?.risks).map((item) => normalizeText(item)).filter(Boolean);
  const planAnchorAuditStatus = normalizeText(snapshot?.qualityCheck?.planAnchorAudit?.status || '');
  const storylineAuditStatus = normalizeText(snapshot?.qualityCheck?.storylineAudit?.status || '');
  const wordCountAuditStatus = normalizeText(snapshot?.qualityCheck?.wordCountAudit?.status || '');
  const targetStorylineIds = [
    normalizeText(snapshot?.plan?.main_storyline_id || ''),
    ...parseJsonArray(snapshot?.plan?.target_storylines).map((item) => normalizeText(item))
  ].filter(Boolean);
  const usedStorylineIds = parseJsonArray(snapshot?.storylineContext?.usedStorylineIds).map((item) => normalizeText(item)).filter(Boolean);
  const usedBeatIds = parseJsonArray(snapshot?.storylineContext?.usedBeatIds).map((item) => normalizeText(item)).filter(Boolean);
  const hasStorylineTarget = targetStorylineIds.length > 0;
  const storylinePromptOk = !hasStorylineTarget || usedStorylineIds.length > 0;
  const storylineBeatOk = !hasStorylineTarget || usedBeatIds.length > 0;
  const storylineFeedbackOk = !hasStorylineTarget || !!snapshot?.storylineProgress?.summary;
  const storylineWritebackOk = !hasStorylineTarget || snapshot?.storylineRows?.some((item) =>
    (Array.isArray(item.chapterProgressNumbers) && item.chapterProgressNumbers.includes(chapterNumber))
    || item.lastUpdatedChapterNumber === chapterNumber
  );
  const storylineQualityOk = !hasStorylineTarget || ['advanced', 'passed'].includes(storylineAuditStatus);
  const needsHumanReview = !!snapshot?.qualityCheck?.needsHumanReview;
  const previousSummary = chapterNumber > 1
    ? normalizeText(previousSnapshot?.feedback?.chapter_summary || '')
    : '';
  const canReadPreviousSummary = chapterNumber === 1 ? 'n/a' : !!previousSummary;
  const formalFeedbackOk = hasFeedback && feedbackSource === 'model_feedback';
  const formalQualityCheckOk =
    hasQualityCheck
    && qualitySource === 'model_audit'
    && qualityStatus !== 'degraded'
    && qualityStatus !== 'not_run'
    && qualityStatus !== 'none'
    && qualitySource !== 'local_fallback'
    && qualitySource !== 'none';
  const planAnchorAuditOk =
    normalizeText(planAnchorAuditStatus).length > 0
    && planAnchorAuditStatus !== 'skipped'
    && planAnchorAuditStatus !== 'not_run'
    && planAnchorAuditStatus !== 'none';
  const qualityGreen = qualityStatus === 'passed';
  const wordCountAuditOk = ['passed', 'not_applicable'].includes(wordCountAuditStatus);

  const checks = chapterNumber === 1
    ? [hasContent, formalFeedbackOk, hasSummary, formalQualityCheckOk, qualityGreen, planAnchorAuditOk, wordCountAuditOk, !needsHumanReview]
    : [!!canReadPreviousSummary, hasContent, formalFeedbackOk, hasSummary, formalQualityCheckOk, qualityGreen, planAnchorAuditOk, wordCountAuditOk, !needsHumanReview];
  if (hasStorylineTarget) {
    checks.push(storylinePromptOk, storylineBeatOk, storylineFeedbackOk, storylineWritebackOk, storylineQualityOk);
  }

  return {
    chapterNumber,
    chapterName: normalizeText(snapshot?.plan?.chapter_name || snapshot?.chapter?.chapter_name || snapshot?.chapter?.title || ''),
    hasContent,
    hasFeedback,
    feedbackSource,
    hasSummary,
    hasQualityCheck,
    qualityStatus,
    qualitySource,
    qualityVerdict,
    qualityRisks: qualityRisks.join(' | '),
    planAnchorAuditStatus,
    storylineAuditStatus,
    wordCountAuditStatus,
    hasStorylineTarget,
    usedStorylineIds: usedStorylineIds.join(','),
    usedBeatIds: usedBeatIds.join(','),
    storylinePromptOk,
    storylineBeatOk,
    storylineFeedbackOk,
    storylineWritebackOk,
    storylineQualityOk,
    formalFeedbackOk,
    formalQualityCheckOk,
    planAnchorAuditOk,
    qualityGreen,
    wordCountAuditOk,
    needsHumanReview,
    canReadPreviousSummary,
    previousSummaryPreview: previousSummary.slice(0, 80),
    status: checks.every(Boolean) ? 'ok' : 'missing_required_link'
  };
}

async function requestJson(path, options = {}) {
  const requestTimeoutMs = Number(process.env.BATCH_VERIFY_REQUEST_TIMEOUT_MS || 1200000);
  let requestData;
  if (typeof options.body === 'string' && options.body.length > 0) {
    try {
      requestData = JSON.parse(options.body);
    } catch (_) {
      requestData = options.body;
    }
  }
  const response = await axios.request({
    url: `${BASE_URL}${path}`,
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    data: requestData,
    timeout: Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0
      ? requestTimeoutMs
      : 1200000,
    validateStatus: () => true
  });
  const json = response.data && typeof response.data === 'object'
    ? response.data
    : { raw: String(response.data || '') };

  if (response.status < 200 || response.status >= 300 || json.success === false) {
    throw new Error(json.error || `HTTP ${response.status}`);
  }

  return json.data;
}

function writeReport(rows, book = {}) {
  if (!REPORT_PATH) return;
  const absolutePath = path.resolve(REPORT_PATH);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const failed = rows.filter((item) => item.status !== 'ok');
  const durations = rows.map((item) => Number(item.durationSeconds || 0)).filter((item) => item > 0);
  const totalPromptTokens = rows.reduce((sum, item) => sum + Number(item.promptTokens || 0), 0);
  const totalCompletionTokens = rows.reduce((sum, item) => sum + Number(item.completionTokens || 0), 0);
  const promptLengths = rows.map((item) => Number(item.promptLength || 0)).filter((item) => item > 0);
  fs.writeFileSync(absolutePath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    mode: MODE,
    book: { id: BOOK_ID, title: normalizeText(book?.title || '') },
    chapters: CHAPTERS,
    promptVersion: PROMPT_VERSION,
    summary: {
      total: rows.length,
      passed: rows.length - failed.length,
      failed: failed.length,
      passRate: rows.length ? Number(((rows.length - failed.length) / rows.length).toFixed(4)) : 0,
      durationSeconds: Number(durations.reduce((sum, item) => sum + item, 0).toFixed(1)),
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      averagePromptLength: promptLengths.length
        ? Number((promptLengths.reduce((sum, item) => sum + item, 0) / promptLengths.length).toFixed(1))
        : 0,
      continuedAfterFailure: CONTINUE_ON_FAILURE
    },
    rows
  }, null, 2), 'utf8');
  console.log(`验收报告已写入：${absolutePath}`);
}

async function fetchApiSnapshot(bookId, chapterNumber) {
  const [chapterList, plan, storylineRows] = await Promise.all([
    requestJson(`/api/books/${bookId}/chapters`).catch(() => []),
    requestJson(`/api/books/${bookId}/chapter-plans/${chapterNumber}`).catch(() => null),
    requestJson(`/api/storyline-workbench/${bookId}/storylines`).catch(() => [])
  ]);

  const chapter = Array.isArray(chapterList)
    ? chapterList.find((item) => Number(item.chapter_number || 0) === Number(chapterNumber)) || null
    : null;

  return buildSnapshotFromRows({ chapter, plan, storylineRows });
}

async function runInspectMode() {
  const { dbPromise, execQuery, execQueryOne } = getPersistenceRuntime();
  const db = await dbPromise;
  const book = execQueryOne(db, 'SELECT id, title FROM books WHERE id = ? LIMIT 1', [BOOK_ID]);

  if (!book) {
    throw new Error(`未找到书籍：${BOOK_ID}`);
  }

  console.log(`连续 ${CHAPTERS.length} 章闭环验收（inspect）：book=${BOOK_ID}《${book.title || '未命名作品'}》，chapters=${CHAPTERS.join(',')}`);

  const rows = [];
  for (const chapterNumber of CHAPTERS) {
    const chapter = execQueryOne(
      db,
      'SELECT * FROM chapters WHERE book_id = ? AND chapter_number = ? LIMIT 1',
      [BOOK_ID, chapterNumber]
    );
    const plan = execQueryOne(
      db,
      'SELECT * FROM chapter_plans WHERE book_id = ? AND chapter_number = ? ORDER BY updated_at DESC LIMIT 1',
      [BOOK_ID, chapterNumber]
    );
    const previousPlan = chapterNumber > 1
      ? execQueryOne(
          db,
          'SELECT * FROM chapter_plans WHERE book_id = ? AND chapter_number = ? ORDER BY updated_at DESC LIMIT 1',
          [BOOK_ID, chapterNumber - 1]
        )
      : null;

    const targetIds = [
      normalizeText(plan?.main_storyline_id || ''),
      ...parseJsonArray(plan?.target_storylines).map((item) => normalizeText(item)).filter(Boolean)
    ].filter(Boolean);
    let matchedStorylineRows = [];
    if (targetIds.length > 0) {
      const placeholders = targetIds.map(() => '?').join(',');
      matchedStorylineRows = execQuery(
        db,
        `SELECT id, status, structured_content FROM storylines WHERE book_id = ? AND id IN (${placeholders})`,
        [BOOK_ID, ...targetIds]
      );
    }
    const snapshot = buildSnapshotFromRows({ chapter, plan, storylineRows: matchedStorylineRows });
    const previousSnapshot = buildSnapshotFromRows({ chapter: null, plan: previousPlan });
    rows.push(evaluateChapterSnapshot(chapterNumber, snapshot, previousSnapshot));
  }

  console.table(rows);
  writeReport(rows, book);
  const failed = rows.filter((item) => item.status !== 'ok');
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

async function runGenerateMode() {
  const book = await requestJson(`/api/books/${BOOK_ID}`);
  console.log(`连续 ${CHAPTERS.length} 章闭环验收（generate）：book=${BOOK_ID}《${book.title || '未命名作品'}》，chapters=${CHAPTERS.join(',')}`);

  const rows = [];
  for (const chapterNumber of CHAPTERS) {
    try {
      const startedAt = Date.now();
      const beforeSnapshot = await fetchApiSnapshot(BOOK_ID, chapterNumber);
      const previousSnapshot = chapterNumber > 1
        ? await fetchApiSnapshot(BOOK_ID, chapterNumber - 1)
        : null;
      const plan = beforeSnapshot.plan;

      if (!plan) {
        rows.push({
          chapterNumber,
          status: 'missing_plan',
          detail: '未找到章节任务表'
        });
        continue;
      }

      if (chapterNumber > 1 && !normalizeText(previousSnapshot?.feedback?.chapter_summary || '')) {
        rows.push({
          chapterNumber,
          status: 'missing_previous_summary',
          detail: `第 ${chapterNumber} 章生成前未读到第 ${chapterNumber - 1} 章摘要`
        });
        continue;
      }

      const structuredContent = parseJsonObject(plan.structured_content);
      const hasStructuredOutline = hasMeaningfulOutlineStructure(structuredContent.chapter_outline_structure);
      const targetWordCount = Number(structuredContent?.generation_settings?.word_count || DEFAULT_WORD_COUNT) || DEFAULT_WORD_COUNT;
      const chapterTitle = plan.chapter_name
        ? `第 ${chapterNumber} 章 ${plan.chapter_name}`
        : `第 ${chapterNumber} 章`;
      const inputMode = hasStructuredOutline ? 'stored_structured_outline' : 'outline_text';

      const generateRes = await requestJson('/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          promptType: 'chapter',
          bookId: BOOK_ID,
          bookTitle: book.title || '',
          genre: book.genre || 'urban',
          subgenre: book.subgenre || '',
          platform: book.target_platform || 'qidian',
          template: book.writing_style || 'fast_pace',
          chapterNumber,
          chapterTitle,
          chapterName: plan.chapter_name || '',
          promptVersion: PROMPT_VERSION,
          outline: hasStructuredOutline ? '' : (plan.outline_text || ''),
          wordCount: targetWordCount
        })
      });

      const content = normalizeText(generateRes?.content || generateRes?.text || '');
      if (!content) {
        rows.push({
          chapterNumber,
          status: 'empty_content',
          detail: '生成接口没有返回正文'
        });
        continue;
      }

      await requestJson(`/api/books/${BOOK_ID}/chapters/upsert`, {
        method: 'POST',
        body: JSON.stringify({
          title: chapterTitle,
          chapterName: plan.chapter_name || '',
          chapterNumber,
          content
        })
      });

      const feedbackRes = await requestJson('/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          promptType: 'chapter_feedback',
          bookId: BOOK_ID,
          chapterNumber,
          chapterTitle,
          content,
          outline: normalizeText(plan.outline_text || '')
        })
      });

      const afterSnapshot = await fetchApiSnapshot(BOOK_ID, chapterNumber);
      const evaluated = evaluateChapterSnapshot(chapterNumber, afterSnapshot, previousSnapshot);
      const gateDecision = normalizeText(generateRes?.metadata?.generationRun?.gateDecision || '');
      const generationGatePassed = gateDecision === 'passed';
      const finalStatus = evaluated.status === 'ok' && generationGatePassed
        ? 'ok'
        : (evaluated.status !== 'ok' ? evaluated.status : `generation_gate_${gateDecision || 'missing'}`);
      rows.push({
        ...evaluated,
        status: finalStatus,
        inputMode,
        promptVersion: PROMPT_VERSION,
        generationRunId: normalizeText(generateRes?.metadata?.generationRun?.id || ''),
        gateDecision,
        generationGatePassed,
        promptLength: Number(generateRes?.metadata?.generationRun?.promptLength || 0),
        contextSnapshotLength: Number(generateRes?.metadata?.generationRun?.contextSnapshotLength || 0),
        promptTokens: Number(generateRes?.usage?.prompt_tokens || 0),
        completionTokens: Number(generateRes?.usage?.completion_tokens || 0),
        actualLength: Number(generateRes?.metadata?.actualLength || 0),
        rawCharacterLength: Number(generateRes?.metadata?.rawCharacterLength || content.length),
        durationSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
        feedbackGenerated: !!feedbackRes?.metadata?.feedbackGenerated,
        feedbackSaved: !!feedbackRes?.metadata?.feedbackSaved,
        usedLocalFallback: !!feedbackRes?.metadata?.usedLocalFallback
      });
      if (finalStatus !== 'ok' && !CONTINUE_ON_FAILURE) break;
    } catch (error) {
      rows.push({
        chapterNumber,
        status: 'error',
        detail: error.message
      });
    }
  }

  console.table(rows);
  writeReport(rows, book);
  const failed = rows.filter((item) => item.status !== 'ok');
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

async function runFeedbackMode() {
  const book = await requestJson(`/api/books/${BOOK_ID}`);
  console.log(`定点反馈复测（feedback）：book=${BOOK_ID}《${book.title || '未命名作品'}》，chapters=${CHAPTERS.join(',')}`);

  const rows = [];
  for (const chapterNumber of CHAPTERS) {
    try {
      const startedAt = Date.now();
      const beforeSnapshot = await fetchApiSnapshot(BOOK_ID, chapterNumber);
      const previousSnapshot = chapterNumber > 1
        ? await fetchApiSnapshot(BOOK_ID, chapterNumber - 1)
        : null;
      const plan = beforeSnapshot.plan;
      const content = normalizeText(beforeSnapshot?.chapter?.content || '');

      if (!plan) {
        rows.push({ chapterNumber, status: 'missing_plan', detail: '未找到章节任务表' });
        continue;
      }
      if (!content) {
        rows.push({ chapterNumber, status: 'missing_content', detail: '未找到已有正文' });
        continue;
      }

      const chapterTitle = normalizeText(beforeSnapshot?.chapter?.title || '')
        || (plan.chapter_name ? `第 ${chapterNumber} 章 ${plan.chapter_name}` : `第 ${chapterNumber} 章`);
      const feedbackRes = await requestJson('/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          promptType: 'chapter_feedback',
          bookId: BOOK_ID,
          chapterNumber,
          chapterTitle,
          content,
          outline: normalizeText(plan.outline_text || '')
        })
      });

      const afterSnapshot = await fetchApiSnapshot(BOOK_ID, chapterNumber);
      const evaluated = evaluateChapterSnapshot(chapterNumber, afterSnapshot, previousSnapshot);
      rows.push({
        ...evaluated,
        durationSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
        feedbackGenerated: !!feedbackRes?.metadata?.feedbackGenerated,
        feedbackSaved: !!feedbackRes?.metadata?.feedbackSaved,
        usedLocalFallback: !!feedbackRes?.metadata?.usedLocalFallback
      });
      if (evaluated.status !== 'ok' && !CONTINUE_ON_FAILURE) break;
    } catch (error) {
      rows.push({ chapterNumber, status: 'error', detail: error.message });
      if (!CONTINUE_ON_FAILURE) break;
    }
  }

  console.table(rows);
  writeReport(rows, book);
  if (rows.some((item) => item.status !== 'ok')) process.exitCode = 1;
}

async function run() {
  if (!BOOK_ID) {
    throw new Error('请提供 --book-id 或 BATCH_VERIFY_BOOK_ID');
  }
  if (CHAPTERS.length < 1) {
    throw new Error('至少需要提供 1 个章节号');
  }
  const isContinuous = CHAPTERS.every((chapterNumber, index) => index === 0 || chapterNumber === CHAPTERS[index - 1] + 1);
  if (MODE !== 'feedback' && !isContinuous) {
    throw new Error(`章节必须严格连续，收到 chapters=${CHAPTERS.join(',')}`);
  }
  if (MODE === 'inspect') {
    await runInspectMode();
    return;
  }
  if (MODE === 'generate') {
    assertIsolatedGenerateMode();
    await runGenerateMode();
    return;
  }
  if (MODE === 'feedback') {
    assertIsolatedGenerateMode();
    await runFeedbackMode();
    return;
  }
  throw new Error(`不支持的 mode：${MODE}`);
}

if (require.main === module) {
  run().catch((error) => {
    console.error('连续章节闭环验收失败：', error.message || error);
    process.exit(1);
  });
}

function assertIsolatedGenerateMode(env = process.env) {
  const isolatedFlag = String(env.HARNESS_ISOLATED || '').trim();
  const configuredPath = String(env.NOVEL_DB_PATH || '').trim();
  const resolvedPath = configuredPath ? path.resolve(configuredPath) : resolveDatabasePath();
  if (isolatedFlag !== '1' || !configuredPath) {
    throw new Error('generate 模式只能由隔离 Harness 启动；请使用 npm run verify:batch:isolated');
  }
  if (resolvedPath === path.resolve(DEFAULT_DATABASE_PATH)) {
    throw new Error('generate 模式拒绝写入正式数据库');
  }
}

module.exports = {
  assertIsolatedGenerateMode,
  buildSnapshotFromRows,
  evaluateChapterSnapshot,
  normalizeQualityCheck,
  parseJsonArray,
  parseJsonObject
};
