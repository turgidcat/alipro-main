require('dotenv').config();

const dbPromise = require('./database/init');
const { execQueryOne } = require('./services/database');

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
  return {
    status: normalizeText(qualityCheck.status || ''),
    source: normalizeText(qualityCheck.source || ''),
    verdict: normalizeText(qualityCheck.verdict || ''),
    risks: parseJsonArray(qualityCheck.risks).map((item) => normalizeText(item)).filter(Boolean),
    checkedAt: normalizeText(qualityCheck.checked_at || qualityCheck.checkedAt || ''),
    needsHumanReview: Boolean(qualityCheck.needs_human_review),
    planAnchorAudit: {
      status: normalizeText(planAnchorAudit.status || '')
    }
  };
}

function buildSnapshotFromRows({ chapter, plan }) {
  const structuredContent = parseJsonObject(plan?.structured_content);
  const feedback = parseJsonObject(structuredContent.chapter_feedback);
  return {
    chapter,
    plan,
    structuredContent,
    feedback,
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
  const planAnchorAuditStatus = normalizeText(snapshot?.qualityCheck?.planAnchorAudit?.status || '');
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

  const checks = chapterNumber === 1
    ? [hasContent, formalFeedbackOk, hasSummary, formalQualityCheckOk, planAnchorAuditOk]
    : [!!canReadPreviousSummary, hasContent, formalFeedbackOk, hasSummary, formalQualityCheckOk, planAnchorAuditOk];

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
    planAnchorAuditStatus,
    formalFeedbackOk,
    formalQualityCheckOk,
    planAnchorAuditOk,
    qualityGreen,
    needsHumanReview,
    canReadPreviousSummary,
    previousSummaryPreview: previousSummary.slice(0, 80),
    status: checks.every(Boolean) ? 'ok' : 'missing_required_link'
  };
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });

  const text = await response.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch (_) {
    json = { raw: text };
  }

  if (!response.ok || json.success === false) {
    throw new Error(json.error || `HTTP ${response.status}`);
  }

  return json.data;
}

async function fetchApiSnapshot(bookId, chapterNumber) {
  const [chapterList, plan] = await Promise.all([
    requestJson(`/api/books/${bookId}/chapters`).catch(() => []),
    requestJson(`/api/books/${bookId}/chapter-plans/${chapterNumber}`).catch(() => null)
  ]);

  const chapter = Array.isArray(chapterList)
    ? chapterList.find((item) => Number(item.chapter_number || 0) === Number(chapterNumber)) || null
    : null;

  return buildSnapshotFromRows({ chapter, plan });
}

async function runInspectMode() {
  const db = await dbPromise;
  const book = execQueryOne(db, 'SELECT id, title FROM books WHERE id = ? LIMIT 1', [BOOK_ID]);

  if (!book) {
    throw new Error(`未找到书籍：${BOOK_ID}`);
  }

  console.log(`连续 3 章闭环验收（inspect）：book=${BOOK_ID}《${book.title || '未命名作品'}》，chapters=${CHAPTERS.join(',')}`);

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

    const snapshot = buildSnapshotFromRows({ chapter, plan });
    const previousSnapshot = buildSnapshotFromRows({ chapter: null, plan: previousPlan });
    rows.push(evaluateChapterSnapshot(chapterNumber, snapshot, previousSnapshot));
  }

  console.table(rows);
  const failed = rows.filter((item) => item.status !== 'ok');
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

async function runGenerateMode() {
  const book = await requestJson(`/api/books/${BOOK_ID}`);
  console.log(`连续 3 章闭环验收（generate）：book=${BOOK_ID}《${book.title || '未命名作品'}》，chapters=${CHAPTERS.join(',')}`);

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
      const targetWordCount = Number(structuredContent?.generation_settings?.word_count || 3000) || 3000;
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
      rows.push({
        ...evaluated,
        inputMode,
        actualLength: content.length,
        durationSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
        feedbackGenerated: !!feedbackRes?.metadata?.feedbackGenerated,
        feedbackSaved: !!feedbackRes?.metadata?.feedbackSaved,
        usedLocalFallback: !!feedbackRes?.metadata?.usedLocalFallback
      });
    } catch (error) {
      rows.push({
        chapterNumber,
        status: 'error',
        detail: error.message
      });
    }
  }

  console.table(rows);
  const failed = rows.filter((item) => item.status !== 'ok');
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

async function run() {
  if (!BOOK_ID) {
    throw new Error('请提供 --book-id 或 BATCH_VERIFY_BOOK_ID');
  }
  if (CHAPTERS.length !== 3) {
    throw new Error(`当前脚本只接受连续 3 章验收，收到 chapters=${CHAPTERS.join(',') || '(empty)'}`);
  }
  if (MODE === 'inspect') {
    await runInspectMode();
    return;
  }
  if (MODE === 'generate') {
    await runGenerateMode();
    return;
  }
  throw new Error(`不支持的 mode：${MODE}`);
}

run().catch((error) => {
  console.error('连续 3 章闭环验收失败：', error.message || error);
  process.exit(1);
});
