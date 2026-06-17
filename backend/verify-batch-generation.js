require('dotenv').config();

const BASE_URL = process.env.BATCH_VERIFY_BASE_URL || 'http://localhost:3000';
const BOOK_ID = process.env.BATCH_VERIFY_BOOK_ID || 'b8bd76b6-170f-4666-9233-36e86b1f8b1d';
const CHAPTERS = (process.env.BATCH_VERIFY_CHAPTERS || '1,2,3,4')
  .split(',')
  .map((item) => Number(item.trim()))
  .filter((item) => Number.isFinite(item) && item > 0);
const WORD_COUNT_TOLERANCE = Number(process.env.BATCH_VERIFY_TOLERANCE || 0.1);

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
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
  ].some((item) => String(item || '').trim());
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

  return json;
}

async function run() {
  console.log(`批量生成验收开始：book=${BOOK_ID}，chapters=${CHAPTERS.join(', ')}`);
  const resultRows = [];

  for (const chapterNumber of CHAPTERS) {
    try {
      const startedAt = Date.now();
      const planRes = await requestJson(`/api/books/${BOOK_ID}/chapter-plans/${chapterNumber}`);
      const plan = planRes.data;
      if (!plan) {
        resultRows.push({
          chapterNumber,
          status: 'missing_plan',
          detail: '未找到章节任务表'
        });
        continue;
      }

      const structuredContent = parseJsonObject(plan.structured_content);
      const hasStructuredOutline = hasMeaningfulOutlineStructure(structuredContent.chapter_outline_structure);
      const targetWordCount = Number(
        structuredContent?.generation_settings?.word_count
          || 3000
      ) || 3000;
      const inputMode = hasStructuredOutline ? 'stored_structured_outline' : 'outline_text';
      console.log(`开始验收第 ${chapterNumber} 章：input=${inputMode}，target=${targetWordCount}`);

      const generatePayload = {
        promptType: 'chapter',
        bookId: BOOK_ID,
        chapterNumber,
        bookTitle: '破雾修真录',
        genre: 'fantasy',
        platform: 'qidian',
        chapterTitle: plan.chapter_name || '',
        outline: hasStructuredOutline ? '' : (plan.outline_text || ''),
        wordCount: targetWordCount,
        emotionIntensity: 75,
        colloquialLevel: 65,
        dialogueRatio: 28,
        shuangTags: ['危机压迫', '剧情推进', '旧约追索'],
        addCliffhanger: true,
        enhanceDialogue: true,
        avoidAIFeel: true,
        fastPace: false,
        detailedDesc: true,
        generationBrief: {
          requiredItems: ['章节任务', '情绪目标', '结尾钩子'],
          recommendedItems: ['主剧情线承接', '角色关系推进'],
          mainStoryline: plan.main_storyline_id || '',
          targetStorylines: parseJsonArray(plan.target_storylines).join(' / '),
          rhythmHints: ['开场尽快进入本章问题', '中段完成关键推进', '结尾留下承接压力'],
          wordCount: targetWordCount
        }
      };

      const generateRes = await requestJson('/api/generate', {
        method: 'POST',
        body: JSON.stringify(generatePayload)
      });

      const content = generateRes?.data?.content || '';
      const actualLength = content.length;
      const delta = actualLength - targetWordCount;
      const ratio = targetWordCount > 0 ? ((actualLength - targetWordCount) / targetWordCount) : 0;
      const durationSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(1));
      const isWordCountOk = Math.abs(ratio) <= WORD_COUNT_TOLERANCE;

      resultRows.push({
        chapterNumber,
        title: plan.chapter_name || '',
        inputMode,
        targetWordCount,
        actualLength,
        delta,
        ratio: `${(ratio * 100).toFixed(1)}%`,
        durationSeconds,
        status: isWordCountOk ? 'ok' : 'word_count_out_of_range'
      });
    } catch (error) {
      resultRows.push({
        chapterNumber,
        status: 'error',
        detail: error.message
      });
    }
  }

  console.table(resultRows);

  const failed = resultRows.filter((item) => item.status !== 'ok');
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('批量生成验收失败：', error);
  process.exit(1);
});
