const express = require('express');
const router = express.Router();
const dbPromise = require('../database/init');
const { execQuery, generateId, saveDatabase, VolumePlanService } = require('../services/database');
const storylineGenerationService = require('../services/storyline-generation-service');
const logger = require('../utils/logger');
const volumePlanService = new VolumePlanService();

function localWorkbenchAuth(req, res, next) {
  req.user = {
    userId: '',
    role: 'admin'
  };
  next();
}

function isAdmin() {
  return true;
}

function safeParseJson(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function extractCharacterArc(character = {}) {
  const notesPayload = safeParseJson(character.notes, null);
  if (notesPayload && typeof notesPayload === 'object') {
    const candidates = [
      notesPayload.character_arc,
      notesPayload.characterArc,
      notesPayload.arc
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
  }
  return null;
}

function extractForeshadowingChapterFields(foreshadowing = {}) {
  const candidates = [];
  const notesPayload = safeParseJson(foreshadowing.notes, null);
  if (notesPayload && typeof notesPayload === 'object') {
    candidates.push(notesPayload);
  }
  const structuredPayload = safeParseJson(foreshadowing.structured_content, null);
  if (structuredPayload && typeof structuredPayload === 'object') {
    candidates.push(structuredPayload);
  }

  for (const payload of candidates) {
    const triggerCandidate = payload.trigger_chapter ?? payload.triggerChapter ?? payload.trigger ?? null;
    const resolveCandidate = payload.resolve_chapter ?? payload.resolveChapter ?? payload.payoffChapter ?? null;
    const triggerChapter = Number(triggerCandidate);
    const resolveChapter = Number(resolveCandidate);
    return {
      triggerChapter: Number.isFinite(triggerChapter) && triggerChapter > 0 ? triggerChapter : null,
      resolveChapter: Number.isFinite(resolveChapter) && resolveChapter > 0 ? resolveChapter : null
    };
  }

  return {
    triggerChapter: null,
    resolveChapter: null
  };
}

function loadStorylineGenerationContext(db, bookId, volumeNumber, currentStorylineId = '') {
  const bookPlan = execQuery(db,
    'SELECT * FROM book_plans WHERE book_id = ? ORDER BY updated_at DESC, created_at DESC LIMIT 1',
    [bookId]
  )[0] || null;

  const volumePlan = execQuery(db,
    'SELECT * FROM volume_plans WHERE book_id = ? AND volume_number = ? ORDER BY updated_at DESC, created_at DESC LIMIT 1',
    [bookId, volumeNumber]
  )[0] || null;

  const bookOutlineRow = execQuery(db,
    "SELECT * FROM novel_outlines WHERE book_id = ? AND type = 'book' ORDER BY updated_at DESC, created_at DESC LIMIT 1",
    [bookId]
  )[0] || null;
  const bookOutline = safeParseJson(bookOutlineRow?.structured_content, {}) || {};
  if (!bookOutline.mainPlot && bookOutlineRow?.content) {
    bookOutline.mainPlot = bookOutlineRow.content;
  }

  const volumeOutlineRow = execQuery(db,
    'SELECT * FROM novel_outlines WHERE book_id = ? AND type = "volume" AND volume_number = ? ORDER BY updated_at DESC, created_at DESC LIMIT 1',
    [bookId, volumeNumber]
  )[0] || null;
  const volumeOutline = safeParseJson(volumeOutlineRow?.structured_content, {}) || {};
  if (!volumeOutline.coreConflict && volumeOutlineRow?.content) {
    volumeOutline.coreConflict = volumeOutlineRow.content;
  }
  if (!volumeOutline.volumeNumber) {
    volumeOutline.volumeNumber = volumeNumber;
  }

  const characters = execQuery(db,
    'SELECT id, name, appearance, personality, background, notes, character_type, role_tier, avatar_image FROM novel_characters WHERE book_id = ? ORDER BY id ASC',
    [bookId]
  ).map((character) => {
    const characterArc = extractCharacterArc(character);
    return {
      ...character,
      character_arc: characterArc,
      characterArc
    };
  });

  const existingStorylines = execQuery(db,
    'SELECT * FROM storylines WHERE book_id = ? AND volume_number = ? ORDER BY storyline_number ASC',
    [bookId, volumeNumber]
  );

  const chapterPlans = execQuery(db,
    'SELECT * FROM chapter_plans WHERE book_id = ? AND volume_number = ? ORDER BY chapter_number ASC, updated_at DESC',
    [bookId, volumeNumber]
  );

  const pendingForeshadowing = execQuery(db,
    "SELECT id, title, description, status, chapter_id FROM foreshadowing WHERE book_id = ? AND status != 'resolved' ORDER BY created_at ASC",
    [bookId]
  ).map((item) => {
    const { triggerChapter, resolveChapter } = extractForeshadowingChapterFields(item);
    return {
      ...item,
      trigger_chapter: triggerChapter,
      resolve_chapter: resolveChapter,
      triggerChapter,
      resolveChapter
    };
  });

  const volumeStructured = safeParseJson(volumePlan?.structured_content, {}) || {};

  return {
    bookId,
    volumeId: volumePlan?.id || `volume-${bookId}-${volumeNumber}`,
    volumeNumber,
    bookPlan,
    volumePlan,
    bookOutline,
    volumeOutline,
    characters,
    existingStorylines,
    chapterPlans,
    pendingForeshadowing,
    totalChapters: Number(volumePlan?.estimated_chapters || volumeStructured.totalChapters || volumeOutline.totalChapters || chapterPlans.length || 0) || 0,
    foreshadowPlan: volumeStructured.foreshadowPlan || volumeOutline.foreshadowPlan || [],
    currentStorylineId
  };
}

// ==================== 分卷设定 CRUD ====================

// 获取某书所有分卷设定
router.get('/:bookId/volume-settings', localWorkbenchAuth, async (req, res) => {
  try {
    const { bookId } = req.params;
    const settings = await volumePlanService.getByBookId(bookId, req.user.userId || '');
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error('获取分卷设定失败', { error: error.message });
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

// 保存/更新分卷设定
router.post('/:bookId/volume-settings', localWorkbenchAuth, async (req, res) => {
  try {
    const { bookId } = req.params;
    const { volume_number, volume_name, volume_theme, estimated_chapters, volume_position, storyline_count, notes } = req.body;
    const db = await dbPromise;

    if (!isAdmin(req.user)) {
      const bookCheck = execQuery(db, 'SELECT user_id FROM books WHERE id = ?', [bookId]);
      if (bookCheck.length === 0 || bookCheck[0].user_id !== req.user.userId) {
        return res.status(403).json({ success: false, error: '无权操作' });
      }
    }

    if (!volume_number || volume_number < 1) {
      return res.status(400).json({ success: false, error: '卷号必须大于0' });
    }

    const plans = await volumePlanService.upsert(bookId, Number(volume_number), {
      volume_name: volume_name || '',
      volume_theme: volume_theme || '',
      estimated_chapters: estimated_chapters || 15,
      storyline_quota: storyline_count || 3,
      notes: notes || '',
      structured_content: {
        legacy_volume_position: volume_position || 'middle'
      },
      source: 'legacy-volume-settings',
      status: 'draft'
    }, req.user.userId || '');

    res.json({ success: true, data: plans, message: '分卷设定已保存' });
  } catch (error) {
    logger.error('保存分卷设定失败', { error: error.message });
    res.status(500).json({ success: false, error: '保存失败' });
  }
});

// 从全书大纲批量创建分卷设定
router.post('/:bookId/volume-settings/batch-init', localWorkbenchAuth, async (req, res) => {
  try {
    const { bookId } = req.params;
    const db = await dbPromise;

    if (!isAdmin(req.user)) {
      const bookCheck = execQuery(db, 'SELECT user_id FROM books WHERE id = ?', [bookId]);
      if (bookCheck.length === 0 || bookCheck[0].user_id !== req.user.userId) {
        return res.status(403).json({ success: false, error: '无权操作' });
      }
    }

    // 从全书大纲解析分卷
    const bookOutlines = execQuery(db,
      "SELECT * FROM novel_outlines WHERE book_id = ? AND type = 'book' LIMIT 1",
      [bookId]
    );
    if (bookOutlines.length === 0) {
      return res.status(400).json({ success: false, error: '请先生成全书大纲' });
    }

    let volumes = [];
    if (bookOutlines[0].structured_content) {
      try {
        const parsed = JSON.parse(bookOutlines[0].structured_content);
        volumes = parsed.volumes || [];
      } catch (e) {}
    }

    if (volumes.length === 0) {
      return res.status(400).json({ success: false, error: '全书大纲中没有分卷规划' });
    }

    // 批量创建（跳过已存在的）
    let created = 0;
    const total = volumes.length;
    for (const vol of volumes) {
      const existing = execQuery(db,
        'SELECT id FROM volume_plans WHERE book_id = ? AND volume_number = ?',
        [bookId, vol.number]
      );
      if (existing.length === 0) {
        const volumeIndex = volumes.indexOf(vol);
        const position = total <= 1 ? 'start' :
          volumeIndex === 0 ? 'start' :
          volumeIndex === total - 1 ? 'end' :
          volumeIndex <= Math.floor(total * 0.3) ? 'development' :
          volumeIndex <= Math.floor(total * 0.7) ? 'turning' : 'climax';
        await volumePlanService.upsert(bookId, Number(vol.number), {
          volume_name: vol.title || '',
          volume_theme: vol.theme || '',
          stage_goal: vol.stageGoal || vol.goal || '',
          core_conflict: vol.coreConflict || '',
          estimated_chapters: vol.estimatedChapters || 15,
          storyline_quota: vol.storylineQuota || 3,
          notes: vol.summary || vol.description || '',
          structured_content: {
            legacy_volume_position: position,
            imported_from_book_outline: true,
            raw_volume_outline: vol
          },
          source: 'batch-init',
          status: 'draft'
        }, req.user.userId || '');
        created++;
      }
    }

    res.json({ success: true, message: `已初始化 ${created} 个分卷设定`, data: { created } });
  } catch (error) {
    logger.error('批量创建分卷设定失败', { error: error.message });
    res.status(500).json({ success: false, error: '批量创建失败' });
  }
});

// ==================== 剧情线 CRUD ====================

// 获取某书某卷的剧情线
router.get('/:bookId/storylines/:volNum', localWorkbenchAuth, async (req, res) => {
  try {
    const { bookId } = req.params;
    const volNum = parseInt(req.params.volNum);
    const db = await dbPromise;

    const storylines = execQuery(db,
      'SELECT * FROM storylines WHERE book_id = ? AND volume_number = ? ORDER BY storyline_number ASC',
      [bookId, volNum]
    );
    res.json({ success: true, data: storylines });
  } catch (error) {
    logger.error('获取剧情线失败', { error: error.message });
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

// 获取某书所有剧情线
router.get('/:bookId/storylines', localWorkbenchAuth, async (req, res) => {
  try {
    const { bookId } = req.params;
    const db = await dbPromise;

    const storylines = execQuery(db,
      'SELECT * FROM storylines WHERE book_id = ? ORDER BY volume_number, storyline_number ASC',
      [bookId]
    );
    res.json({ success: true, data: storylines });
  } catch (error) {
    logger.error('获取剧情线失败', { error: error.message });
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

// 保存/创建剧情线
router.post('/:bookId/storylines', localWorkbenchAuth, async (req, res) => {
  try {
    const { bookId } = req.params;
    const { id, volume_number, storyline_name, storyline_type, description,
            involved_characters, start_chapter, end_chapter, key_nodes, core_conflict } = req.body;
    const db = await dbPromise;

    if (!isAdmin(req.user)) {
      const bookCheck = execQuery(db, 'SELECT user_id FROM books WHERE id = ?', [bookId]);
      if (bookCheck.length === 0 || bookCheck[0].user_id !== req.user.userId) {
        return res.status(403).json({ success: false, error: '无权操作' });
      }
    }

    if (!storyline_name || !storyline_name.trim()) {
      return res.status(400).json({ success: false, error: '剧情线名称不能为空' });
    }

    if (id) {
      // 更新
      db.run(
        `UPDATE storylines SET storyline_name=?, storyline_type=?, description=?,
         involved_characters=?, start_chapter=?, end_chapter=?, key_nodes=?, core_conflict=?,
         updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [storyline_name, storyline_type || 'branch', description || '',
         JSON.stringify(involved_characters || []), start_chapter || 1, end_chapter || 10,
         JSON.stringify(key_nodes || []), core_conflict || '', id]
      );
      saveDatabase(db);
      res.json({ success: true, message: '剧情线已更新', data: { id } });
    } else {
      // 新建
      const newId = generateId();
      const maxNum = execQuery(db,
        'SELECT MAX(storyline_number) as maxNum FROM storylines WHERE book_id = ? AND volume_number = ?',
        [bookId, volume_number || 1]
      );
      const storylineNumber = (maxNum[0]?.maxNum || 0) + 1;

      db.run(
        `INSERT INTO storylines(id, book_id, user_id, volume_number, storyline_number, storyline_name,
         storyline_type, description, involved_characters, start_chapter, end_chapter, key_nodes, core_conflict)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [newId, bookId, req.user.userId, volume_number || 1, storylineNumber, storyline_name,
         storyline_type || 'branch', description || '',
         JSON.stringify(involved_characters || []), start_chapter || 1, end_chapter || 10,
         JSON.stringify(key_nodes || []), core_conflict || '']
      );
      saveDatabase(db);
      res.json({ success: true, message: '剧情线已创建', data: { id: newId, storyline_number: storylineNumber } });
    }
  } catch (error) {
    logger.error('保存剧情线失败', { error: error.message });
    res.status(500).json({ success: false, error: '保存失败' });
  }
});

// 删除剧情线
router.delete('/:bookId/storylines/:id', localWorkbenchAuth, async (req, res) => {
  try {
    const { bookId, id } = req.params;
    const db = await dbPromise;

    if (!isAdmin(req.user)) {
      const bookCheck = execQuery(db, 'SELECT user_id FROM books WHERE id = ?', [bookId]);
      if (bookCheck.length === 0 || bookCheck[0].user_id !== req.user.userId) {
        return res.status(403).json({ success: false, error: '无权操作' });
      }
    }

    db.run('DELETE FROM storylines WHERE id = ? AND book_id = ?', [id, bookId]);
    saveDatabase(db);
    res.json({ success: true, message: '剧情线已删除' });
  } catch (error) {
    logger.error('删除剧情线失败', { error: error.message });
    res.status(500).json({ success: false, error: '删除失败' });
  }
});

// 批量删除剧情线
router.post('/:bookId/storylines/batch-delete', localWorkbenchAuth, async (req, res) => {
  try {
    const { bookId } = req.params;
    const { ids } = req.body;
    const db = await dbPromise;

    if (!isAdmin(req.user)) {
      const bookCheck = execQuery(db, 'SELECT user_id FROM books WHERE id = ?', [bookId]);
      if (bookCheck.length === 0 || bookCheck[0].user_id !== req.user.userId) {
        return res.status(403).json({ success: false, error: '无权操作' });
      }
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: '请提供要删除的剧情线ID列表' });
    }

    const placeholders = ids.map(() => '?').join(',');
    db.run(
      `DELETE FROM storylines WHERE book_id = ? AND id IN (${placeholders})`,
      [bookId, ...ids]
    );

    saveDatabase(db);
    res.json({ success: true, message: `成功删除 ${ids.length} 条剧情线` });
  } catch (error) {
    logger.error('批量删除剧情线失败', { error: error.message });
    res.status(500).json({ success: false, error: '批量删除失败' });
  }
});

// ==================== AI 生成剧情线大纲 ====================

router.post('/:bookId/storylines/:storylineId/generate', localWorkbenchAuth, async (req, res) => {
  try {
    const { bookId, storylineId } = req.params;
    const { controlParams = {} } = req.body;
    const db = await dbPromise;

    if (!isAdmin(req.user)) {
      const bookCheck = execQuery(db, 'SELECT user_id FROM books WHERE id = ?', [bookId]);
      if (bookCheck.length === 0 || bookCheck[0].user_id !== req.user.userId) {
        return res.status(403).json({ success: false, error: '无权操作' });
      }
    }

    // 获取剧情线设定
    const storylines = execQuery(db, 'SELECT * FROM storylines WHERE id = ?', [storylineId]);
    if (storylines.length === 0) {
      return res.status(404).json({ success: false, error: '剧情线不存在' });
    }
    const storyline = storylines[0];

    const generationContext = loadStorylineGenerationContext(db, bookId, storyline.volume_number, storylineId);

    logger.info('AI生成剧情线大纲', { bookId, storylineId, name: storyline.storyline_name });

    const result = await storylineGenerationService.generateStorylineOutline({
      ...generationContext,
      storyline: {
        ...storyline,
        storylineName: storyline.storyline_name,
        storylineType: storyline.storyline_type,
        coreConflict: storyline.core_conflict,
        startChapter: storyline.start_chapter,
        endChapter: storyline.end_chapter,
        keyNodes: storyline.key_nodes ? safeParseJson(storyline.key_nodes, []) : []
      },
      userGoal: controlParams.userGoal || controlParams.goal || ''
    });

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error, rawPreview: result.rawPreview || null });
    }

    const parsed = result.parsed;

    // 保存结构化内容
    db.run(
      `UPDATE storylines SET structured_content = ?, status = 'generated', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [JSON.stringify(parsed), storylineId]
    );

    logger.info('剧情线大纲生成成功', { bookId, storylineId });

    saveDatabase(db);
    res.json({
      success: true,
      data: { structured: parsed, usage: result.usage }
    });
  } catch (error) {
    logger.error('生成剧情线大纲失败', { error: error.message });
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 批量生成某卷所有剧情线大纲
router.post('/:bookId/volume/:volNum/storylines/generate-all', localWorkbenchAuth, async (req, res) => {
  try {
    const { bookId } = req.params;
    const volNum = parseInt(req.params.volNum);
    const { controlParams = {} } = req.body;
    const db = await dbPromise;

    if (!isAdmin(req.user)) {
      const bookCheck = execQuery(db, 'SELECT user_id FROM books WHERE id = ?', [bookId]);
      if (bookCheck.length === 0 || bookCheck[0].user_id !== req.user.userId) {
        return res.status(403).json({ success: false, error: '无权操作' });
      }
    }

    const storylines = execQuery(db,
      'SELECT * FROM storylines WHERE book_id = ? AND volume_number = ? ORDER BY storyline_number ASC',
      [bookId, volNum]
    );

    if (storylines.length === 0) {
      return res.status(400).json({ success: false, error: '该卷没有剧情线，请先创建' });
    }

    const generationContext = loadStorylineGenerationContext(db, bookId, volNum, '');

    logger.info(`批量生成剧情线大纲`, { bookId, volNum, count: storylines.length });

    const results = [];
    for (const sl of storylines) {
      try {
        const result = await storylineGenerationService.generateStorylineOutline({
          ...generationContext,
          storyline: {
            ...sl,
            storylineName: sl.storyline_name,
            storylineType: sl.storyline_type,
            coreConflict: sl.core_conflict,
            startChapter: sl.start_chapter,
            endChapter: sl.end_chapter,
            keyNodes: sl.key_nodes ? safeParseJson(sl.key_nodes, []) : []
          },
          userGoal: controlParams.userGoal || controlParams.goal || ''
        });

        if (!result.success) {
          results.push({ storylineId: sl.id, name: sl.storyline_name, success: false, error: result.error, rawPreview: result.rawPreview || null });
          continue;
        }

        const parsed = result.parsed;

        db.run(
          `UPDATE storylines SET structured_content = ?, status = 'generated', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [JSON.stringify(parsed), sl.id]
        );

        results.push({ storylineId: sl.id, name: sl.storyline_name, success: true });
      } catch (e) {
        results.push({ storylineId: sl.id, name: sl.storyline_name, success: false, error: e.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    saveDatabase(db);
    res.json({ success: true, data: { total: storylines.length, successCount, failCount: results.length - successCount, results } });
  } catch (error) {
    logger.error('批量生成剧情线大纲失败', { error: error.message });
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// ==================== 卷级时间线生成 ====================

router.post('/:bookId/volume/:volNum/timeline/generate', localWorkbenchAuth, async (req, res) => {
  try {
    const { bookId } = req.params;
    const volNum = parseInt(req.params.volNum);
    const db = await dbPromise;

    if (!isAdmin(req.user)) {
      const bookCheck = execQuery(db, 'SELECT user_id FROM books WHERE id = ?', [bookId]);
      if (bookCheck.length === 0 || bookCheck[0].user_id !== req.user.userId) {
        return res.status(403).json({ success: false, error: '无权操作' });
      }
    }

    const generationContext = loadStorylineGenerationContext(db, bookId, volNum, '');

    const storylines = execQuery(db,
      'SELECT * FROM storylines WHERE book_id = ? AND volume_number = ? ORDER BY storyline_number ASC',
      [bookId, volNum]
    );
    logger.info('AI生成卷级时间线', { bookId, volNum, storylines: storylines.length });

    const result = await storylineGenerationService.generateVolumeTimeline({
      ...generationContext,
      storylines
    });

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error, rawPreview: result.rawPreview || null });
    }

    const parsed = result.parsed;

    // 保存
    const existing = execQuery(db,
      'SELECT id FROM volume_timelines WHERE book_id = ? AND volume_number = ?',
      [bookId, volNum]
    );
    if (existing.length > 0) {
      db.run(
        `UPDATE volume_timelines SET timeline_data=?, total_chapters=?, status='generated', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [JSON.stringify(parsed), parsed.totalChapters, existing[0].id]
      );
    } else {
      const id = generateId();
      db.run(
        `INSERT INTO volume_timelines(id, book_id, user_id, volume_number, total_chapters, timeline_data, status)
         VALUES(?,?,?,?,?,?,?)`,
        [id, bookId, req.user.userId, volNum, parsed.totalChapters, JSON.stringify(parsed), 'generated']
      );
    }

    logger.info('卷级时间线生成成功', { bookId, volNum, chapters: parsed.totalChapters });

    saveDatabase(db);
    res.json({
      success: true,
      data: { structured: parsed, usage: result.usage }
    });
  } catch (error) {
    logger.error('生成卷级时间线失败', { error: error.message });
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 获取卷级时间线
router.get('/:bookId/volume/:volNum/timeline', localWorkbenchAuth, async (req, res) => {
  try {
    const { bookId } = req.params;
    const volNum = parseInt(req.params.volNum);
    const db = await dbPromise;

    const timelines = execQuery(db,
      'SELECT * FROM volume_timelines WHERE book_id = ? AND volume_number = ?',
      [bookId, volNum]
    );

    if (timelines.length === 0) {
      return res.json({ success: true, data: null });
    }

    let structured = null;
    if (timelines[0].timeline_data) {
      try { structured = JSON.parse(timelines[0].timeline_data); } catch (e) {}
    }

    res.json({ success: true, data: structured });
  } catch (error) {
    logger.error('获取卷级时间线失败', { error: error.message });
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

// ==================== 伏笔回收率检查 ====================

router.get('/:bookId/foreshadowing/recovery-check', localWorkbenchAuth, async (req, res) => {
  try {
    const { bookId } = req.params;
    const db = await dbPromise;

    // 获取所有剧情线的结束章节
    const storylines = execQuery(db,
      'SELECT storyline_name, end_chapter, storyline_type FROM storylines WHERE book_id = ?',
      [bookId]
    );

    // 获取所有伏笔
    const allForeshadowing = execQuery(db,
      "SELECT id, title, description, status, chapter_id FROM foreshadowing WHERE book_id = ?",
      [bookId]
    ).map((item) => {
      const { triggerChapter, resolveChapter } = extractForeshadowingChapterFields(item);
      return {
        ...item,
        trigger_chapter: triggerChapter,
        resolve_chapter: resolveChapter,
        triggerChapter,
        resolveChapter
      };
    });

    // 检查每条剧情线结束时的伏笔回收率
    const checks = storylines.map(sl => {
      const relatedF = allForeshadowing.filter(f => {
        // 伏笔的触发章或回收章在该线范围内
        const triggerCh = f.triggerChapter || 0;
        const resolveCh = f.resolveChapter || 0;
        return (triggerCh >= sl.start_chapter && triggerCh <= sl.end_chapter) ||
               (resolveCh >= sl.start_chapter && resolveCh <= sl.end_chapter);
      });
      const resolved = relatedF.filter(f => f.status === 'resolved').length;
      const total = relatedF.length;
      return {
        storyline: sl.storyline_name,
        endChapter: sl.end_chapter,
        totalForeshadowing: total,
        resolved,
        pending: total - resolved,
        recoveryRate: total > 0 ? Math.round((resolved / total) * 100) : 100,
        pendingItems: relatedF.filter(f => f.status !== 'resolved').map(f => f.title)
      };
    });

    // 全书级检查
    const totalPending = allForeshadowing.filter(f => f.status !== 'resolved');
    const totalResolved = allForeshadowing.filter(f => f.status === 'resolved').length;

    res.json({
      success: true,
      data: {
        global: {
          total: allForeshadowing.length,
          resolved: totalResolved,
          pending: totalPending.length,
          recoveryRate: allForeshadowing.length > 0 ? Math.round((totalResolved / allForeshadowing.length) * 100) : 100,
          pendingItems: totalPending.map(f => ({ title: f.title, id: f.id }))
        },
        byStoryline: checks
      }
    });
  } catch (error) {
    logger.error('伏笔回收率检查失败', { error: error.message });
    res.status(500).json({ success: false, error: '检查失败' });
  }
});

// ==================== 角色跨章状态查询 ====================

// 获取角色在某章的上下文状态
router.get('/:bookId/characters/:charName/state/:chapterNumber', localWorkbenchAuth, async (req, res) => {
  try {
    const { bookId, charName, chapterNumber } = req.params;
    const chNum = parseInt(chapterNumber);
    const db = await dbPromise;

    // 查询该角色在最近3章出现过的细纲中的characterStates
    const recentOutlines = execQuery(db,
      `SELECT o.chapter_id, o.inherit_from, c.chapter_number
       FROM novel_outlines o
       LEFT JOIN chapters c ON o.chapter_id = c.id
       WHERE o.book_id = ? AND o.type = 'chapter' AND c.chapter_number < ?
       ORDER BY c.chapter_number DESC LIMIT 5`,
      [bookId, chNum]
    );

    const stateHistory = [];
    for (const o of recentOutlines) {
      try {
        const inherit = o.inherit_from ? JSON.parse(o.inherit_from) : {};
        if (inherit.characterStates && inherit.characterStates[charName]) {
          stateHistory.push({
            chapterNumber: o.chapter_number,
            state: inherit.characterStates[charName]
          });
        }
      } catch (e) {}
    }

    // 查询该角色在章节-角色关联表中的记录
    const characterInDb = execQuery(db,
      "SELECT id FROM novel_characters WHERE book_id = ? AND name = ? LIMIT 1",
      [bookId, charName]
    );

    let chapterAppearances = [];
    if (characterInDb.length > 0) {
      chapterAppearances = execQuery(db,
        `SELECT cc.chapter_id, cc.role_in_chapter, cc.state_snapshot, c.chapter_number
         FROM chapter_characters cc
         LEFT JOIN chapters c ON cc.chapter_id = c.id
         WHERE cc.character_id = ?
         ORDER BY c.chapter_number DESC LIMIT 10`,
        [characterInDb[0].id]
      );
    }

    res.json({
      success: true,
      data: {
        characterName: charName,
        targetChapter: chNum,
        recentStates: stateHistory,
        chapterAppearances: chapterAppearances.map(a => ({
          chapterNumber: a.chapter_number,
          role: a.role_in_chapter,
          snapshot: a.state_snapshot
        }))
      }
    });
  } catch (error) {
    logger.error('角色状态查询失败', { error: error.message });
    res.status(500).json({ success: false, error: '查询失败' });
  }
});

// ==================== 章节-角色关联 ====================

// 记录章节中出场的角色
router.post('/:bookId/chapter-characters', localWorkbenchAuth, async (req, res) => {
  try {
    const { bookId } = req.params;
    const { chapter_id, characters } = req.body;
    const db = await dbPromise;

    if (!chapter_id || !characters || !Array.isArray(characters)) {
      return res.status(400).json({ success: false, error: '参数不正确' });
    }

    // 先清除旧记录
    db.run('DELETE FROM chapter_characters WHERE chapter_id = ?', [chapter_id]);

    for (const char of characters) {
      const id = generateId();
      db.run(
        `INSERT INTO chapter_characters(id, book_id, chapter_id, character_id, role_in_chapter, state_snapshot)
         VALUES(?,?,?,?,?,?)`,
        [id, bookId, chapter_id, char.character_id, char.role || 'supporting', char.state || '']
      );
    }

    saveDatabase(db);
    res.json({ success: true, message: `已记录 ${characters.length} 个角色出场` });
  } catch (error) {
    logger.error('记录章节角色失败', { error: error.message });
    res.status(500).json({ success: false, error: '记录失败' });
  }
});

// 获取某章出场角色
router.get('/:bookId/chapter/:chapterId/characters', localWorkbenchAuth, async (req, res) => {
  try {
    const { bookId, chapterId } = req.params;
    const db = await dbPromise;

    const chars = execQuery(db,
      `SELECT cc.*, nc.name, nc.personality, nc.appearance
       FROM chapter_characters cc
       LEFT JOIN novel_characters nc ON cc.character_id = nc.id
       WHERE cc.chapter_id = ?
       ORDER BY cc.role_in_chapter`,
      [chapterId]
    );

    res.json({ success: true, data: chars });
  } catch (error) {
    logger.error('获取章节角色失败', { error: error.message });
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

module.exports = router;
