const fs = require('fs');
const initSqlJs = require('sql.js');
const { randomUUID } = require('crypto');
const { DEFAULT_WORD_COUNT, clampWordCount } = require('../services/word-count-policy');

function normalizeText(value) {
  return String(value || '').trim();
}

function rows(db, sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const result = [];
  while (stmt.step()) result.push(stmt.getAsObject());
  stmt.free();
  return result;
}

function buildVolumeRanges(volumes, targetChapters) {
  let cursor = 1;
  const ranges = volumes.map((volume) => {
    const count = Math.max(1, Number(volume.estimated_chapters || 15));
    const range = { ...volume, startChapter: cursor, endChapter: cursor + count - 1 };
    cursor += count;
    return range;
  });
  if (ranges.length && ranges[ranges.length - 1].endChapter < targetChapters) {
    ranges[ranges.length - 1].endChapter = targetChapters;
  }
  return ranges;
}

function buildSyntheticPlan({ bookId, chapterNumber, volume, characterNames, targetWordCount }) {
  const volumeOffset = chapterNumber - volume.startChapter + 1;
  const volumeLength = volume.endChapter - volume.startChapter + 1;
  const progress = volumeOffset / volumeLength;
  const phase = progress <= 0.25 ? '建立局势' : progress <= 0.6 ? '升级冲突' : progress <= 0.85 ? '逼近转折' : '阶段收束';
  const volumeGoal = normalizeText(volume.stage_goal) || normalizeText(volume.volume_theme) || `推进第${volume.volume_number}卷目标`;
  const conflict = normalizeText(volume.core_conflict) || '既有目标与阻力持续碰撞';
  const chapterName = `${normalizeText(volume.volume_name) || `第${volume.volume_number}卷`}·${phase}${volumeOffset}`;
  const mission = `${phase}：围绕“${volumeGoal}”取得一项可验证进展，同时保留后续升级空间。`;
  const endingHook = `本章结尾出现与“${conflict}”直接相关的新压力，推动下一章继续处理。`;
  const outlineText = [
    `开场承接上一章结果，确认当前阶段目标“${volumeGoal}”。`,
    `中段让角色通过行动处理“${conflict}”，取得具体但不彻底的进展。`,
    `结尾兑现本章任务，并留下下一步必须处理的压力。`
  ].join('\n');
  const outlineStructure = {
    chapter_goal: mission,
    key_scenes: outlineText,
    conflict_escalation: conflict,
    character_change: '只允许小步、可追溯的状态变化，不跨越分卷终点。',
    reader_payoff: '本章至少兑现一个明确进展。',
    ending_hook: endingHook
  };
  const structuredContent = {
    harness_generated: true,
    harness_schema_version: 1,
    generation_settings: { word_count: targetWordCount },
    chapter_outline_structure: outlineStructure,
    chapter_goal_snapshot: {
      chapter_mission: mission,
      emotion_target: phase,
      appearing_roles: characterNames,
      main_storyline_id: '',
      target_storylines: [],
      previous_hook: chapterNumber > 1 ? '承接上一章结尾压力。' : ''
    },
    role_execution: characterNames.map((name, index) => ({
      role: name,
      chapter_function: index === 0 ? '推动本章任务' : '制造信息、关系或冲突变化',
      state_boundary: '只发生本章证据支持的小步变化'
    }))
  };
  return {
    id: randomUUID(), bookId, chapterNumber, volumeNumber: Number(volume.volume_number || 1), chapterName,
    mission, emotionTarget: phase, outlineText, characterNotes: '角色状态变化必须有正文证据。',
    appearingRoles: JSON.stringify(characterNames), previousHook: chapterNumber > 1 ? '承接上一章结尾压力。' : '',
    endingHook, structuredContent: JSON.stringify(structuredContent)
  };
}

async function prepareSoakBaseline({ databasePath, bookId, targetChapters, targetWordCount = DEFAULT_WORD_COUNT }) {
  if (!fs.existsSync(databasePath)) throw new Error(`隔离数据库不存在：${databasePath}`);
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(databasePath));
  const volumes = rows(db, 'SELECT * FROM volume_plans WHERE book_id = ? ORDER BY volume_number ASC', [bookId]);
  if (!volumes.length) throw new Error('目标作品没有分卷规划，无法准备长篇基准');
  const ranges = buildVolumeRanges(volumes, targetChapters);
  targetWordCount = clampWordCount(targetWordCount);
  const characterNames = rows(db, `SELECT name FROM novel_characters WHERE book_id = ?
    AND name NOT IN ('全书角色设定', '本章新增角色') ORDER BY id ASC LIMIT 4`, [bookId])
    .map((item) => normalizeText(item.name)).filter(Boolean);
  const existing = new Set(rows(db, 'SELECT chapter_number FROM chapter_plans WHERE book_id = ?', [bookId]).map((item) => Number(item.chapter_number)));
  let inserted = 0;
  for (let chapterNumber = 1; chapterNumber <= targetChapters; chapterNumber += 1) {
    if (existing.has(chapterNumber)) continue;
    const volume = ranges.find((item) => chapterNumber >= item.startChapter && chapterNumber <= item.endChapter) || ranges[ranges.length - 1];
    const plan = buildSyntheticPlan({ bookId, chapterNumber, volume, characterNames, targetWordCount });
    db.run(`INSERT INTO chapter_plans (
      id, book_id, user_id, volume_number, chapter_number, chapter_name, summary, chapter_mission,
      emotion_target, outline_text, scene_outline, character_notes, appearing_roles, previous_hook,
      ending_hook, main_storyline_id, target_storylines, structured_content, source, status
    ) VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, '', '[]', ?, 'imported', 'generated')`, [
      plan.id, plan.bookId, plan.volumeNumber, plan.chapterNumber, plan.chapterName, plan.mission,
      plan.mission, plan.emotionTarget, plan.outlineText, plan.characterNotes, plan.appearingRoles,
      plan.previousHook, plan.endingHook, plan.structuredContent
    ]);
    inserted += 1;
  }
  const planRows = rows(db, `SELECT id, structured_content FROM chapter_plans
    WHERE book_id = ? AND chapter_number BETWEEN 1 AND ?`, [bookId, targetChapters]);
  planRows.forEach((planRow) => {
    let structuredContent = {};
    try {
      structuredContent = JSON.parse(planRow.structured_content || '{}') || {};
    } catch (_) {}
    structuredContent.generation_settings = {
      ...(structuredContent.generation_settings || {}),
      word_count: targetWordCount
    };
    db.run('UPDATE chapter_plans SET structured_content = ? WHERE id = ?', [JSON.stringify(structuredContent), planRow.id]);
  });
  fs.writeFileSync(databasePath, Buffer.from(db.export()));
  db.close();
  return { inserted, normalizedWordCountPlans: planRows.length, targetChapters, volumeRanges: ranges.map(({ volume_number, volume_name, startChapter, endChapter }) => ({ volume_number, volume_name, startChapter, endChapter })) };
}

async function resetSoakRange({ databasePath, bookId, chapters = [] }) {
  const chapterNumbers = [...new Set((Array.isArray(chapters) ? chapters : [])
    .map(Number).filter((item) => Number.isFinite(item) && item > 0))].sort((a, b) => a - b);
  if (!chapterNumbers.length) return { resetChapters: 0 };
  if (!fs.existsSync(databasePath)) throw new Error(`隔离数据库不存在：${databasePath}`);
  const startChapter = chapterNumbers[0];
  const endChapter = chapterNumbers[chapterNumbers.length - 1];
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(databasePath));

  ['chapters', 'generation_runs', 'continuity_events', 'character_state_ledger', 'foreshadow_ledger'].forEach((table) => {
    try {
      db.run(`DELETE FROM ${table} WHERE book_id = ? AND chapter_number BETWEEN ? AND ?`, [bookId, startChapter, endChapter]);
    } catch (_) {}
  });

  const planRows = rows(db, `SELECT id, structured_content FROM chapter_plans
    WHERE book_id = ? AND chapter_number BETWEEN ? AND ?`, [bookId, startChapter, endChapter]);
  planRows.forEach((planRow) => {
    let structured = {};
    try { structured = JSON.parse(planRow.structured_content || '{}') || {}; } catch (_) {}
    delete structured.chapter_feedback;
    delete structured.character_feedback;
    delete structured.plot_feedback;
    delete structured.storyline_context;
    db.run('UPDATE chapter_plans SET chapter_id = NULL, structured_content = ? WHERE id = ?', [JSON.stringify(structured), planRow.id]);
  });

  const storylineRows = rows(db, 'SELECT id, structured_content FROM storylines WHERE book_id = ?', [bookId]);
  storylineRows.forEach((storylineRow) => {
    let structured = {};
    try { structured = JSON.parse(storylineRow.structured_content || '{}') || {}; } catch (_) {}
    const keptProgress = (Array.isArray(structured.chapter_progress) ? structured.chapter_progress : [])
      .filter((item) => Number(item?.chapter_number || item?.chapterNumber || 0) < startChapter);
    structured.chapter_progress = keptProgress;
    if (Number(structured?.last_chapter_feedback?.chapter_number || structured?.last_chapter_feedback?.chapterNumber || 0) >= startChapter) {
      delete structured.last_chapter_feedback;
    }
    if (Number(structured?.currentProgress?.lastUpdatedChapterNumber || 0) >= startChapter) {
      const last = keptProgress[keptProgress.length - 1] || null;
      structured.currentProgress = last
        ? {
            ...(structured.currentProgress || {}),
            lastUpdatedChapterNumber: Number(last.chapter_number || last.chapterNumber || 0),
            lastProgressSummary: normalizeText(last.summary || last.story_progress || ''),
            lastUsedBeatIds: Array.isArray(last.used_beat_ids) ? last.used_beat_ids : [],
            requiresReview: Boolean(last.requires_review)
          }
        : {};
    }
    db.run('UPDATE storylines SET structured_content = ? WHERE id = ?', [JSON.stringify(structured), storylineRow.id]);
  });

  fs.writeFileSync(databasePath, Buffer.from(db.export()));
  db.close();
  return { resetChapters: chapterNumbers.length, startChapter, endChapter };
}

module.exports = { buildSyntheticPlan, buildVolumeRanges, prepareSoakBaseline, resetSoakRange };
