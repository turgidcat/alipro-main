const crypto = require('node:crypto');
const contentHash = value => crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
function generationContractHash({ bookPlan, characters = [], volumes = [], storylines = [], chapterPlan = {} }) {
  const volatile = new Set(['created_at', 'updated_at', 'status', 'user_id', 'avatar_image', 'currentProgress',
    'chapter_progress', 'last_chapter_feedback', 'lifecycleStatus', 'chapter_feedback', 'character_feedback',
    'plot_feedback', 'derived_state', 'outline_validation', 'storyline_context']);
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().filter(key => !volatile.has(key)).map(key => {
      let item = value[key];
      if (key === 'structured_content' && typeof item === 'string') { try { item = JSON.parse(item); } catch (_) {} }
      if (key === 'notes' && typeof item === 'string') item = item.split(/【第\s*\d+\s*章角色速查】/)[0].trim();
      return [key, canonical(item)];
    }));
  }
  const ordered = rows => rows.map(canonical).sort((a, b) => String(a.id || a.name).localeCompare(String(b.id || b.name)));
  return contentHash(JSON.stringify({ bookPlan: canonical(bookPlan),
    characters: ordered(characters.filter(row => row.character_type !== 'chapter_character' && !['全书角色设定', '本章新增角色'].includes(row.name))),
    volumes: ordered(volumes), storylines: ordered(storylines), chapter: chapterPlanningHash(chapterPlan) }));
}
function chapterPlanningHash(plan = {}) {
  const parse = value => { try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch { return {}; } };
  const structured = parse(plan.structured_content);
  return contentHash(JSON.stringify({ mission: plan.chapter_mission || '', outline: plan.outline_text || '',
    roles: parse(plan.appearing_roles || '[]'), characterNotes: plan.character_notes || '',
    main: plan.main_storyline_id || '', targets: parse(plan.target_storylines || '[]'),
    plotNotes: structured.plot_notes || '', roleExecution: structured.role_execution || [] }));
}
function feedbackIsCurrent(feedback, content, plan) {
  return !!feedback?.source_content_hash && feedback.source_content_hash === contentHash(content)
    && (!plan || feedback.source_planning_hash === chapterPlanningHash(plan));
}
function applyChapterDraft(plan = {}, draft = {}) {
  const merged = { ...plan };
  for (const key of ['chapter_name', 'chapter_mission', 'outline_text', 'summary', 'emotion_target', 'character_notes', 'appearing_roles', 'previous_hook', 'ending_hook', 'main_storyline_id', 'target_storylines']) {
    if (Object.prototype.hasOwnProperty.call(draft, key)) merged[key] = draft[key];
  }
  const parse = value => { try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch { return {}; } };
  const structured = { ...parse(plan.structured_content) };
  const draftStructured = parse(draft.structured_content);
  for (const key of ['plot_notes', 'role_execution']) {
    if (Object.prototype.hasOwnProperty.call(draftStructured, key)) structured[key] = draftStructured[key];
    if (Object.prototype.hasOwnProperty.call(draft, key)) structured[key] = draft[key];
  }
  merged.structured_content = structured;
  return merged;
}
function verifiedCompletedBeats(feedback, content, allowedBeatIds = []) {
  if (!feedbackIsCurrent(feedback, content)) return [];
  if (feedback.quality_check?.status !== 'passed' && !feedback.quality_check?.human_confirmed) return [];
  return [...new Set((Array.isArray(feedback.completed_beats) ? feedback.completed_beats : [])
    .filter(item => allowedBeatIds.includes(item?.beat_id) && String(item?.evidence || '').trim()
      && String(content || '').includes(item.evidence))
    .map(item => item.beat_id))];
}
function markChapterDerivedStale(db, bookId, chapterNumber, content) {
  const query = db.prepare('SELECT * FROM chapter_plans WHERE book_id = ? AND chapter_number = ?');
  query.bind([bookId, chapterNumber]);
  const plans = [];
  while (query.step()) plans.push(query.getAsObject());
  query.free();
  for (const plan of plans) {
    let structured;
    try { structured = JSON.parse(plan.structured_content || '{}'); } catch { structured = {}; }
    structured.derived_state = { status: feedbackIsCurrent(structured.chapter_feedback, content, plan) ? 'current' : 'stale', content_hash: contentHash(content) };
    db.run('UPDATE chapter_plans SET structured_content = ? WHERE id = ?', [JSON.stringify(structured), plan.id]);
  }
  const storyQuery = db.prepare('SELECT id, structured_content FROM storylines WHERE book_id = ?');
  storyQuery.bind([bookId]);
  const stories = [];
  while (storyQuery.step()) stories.push(storyQuery.getAsObject());
  storyQuery.free();
  for (const row of stories) {
    let structured;
    try { structured = JSON.parse(row.structured_content || '{}'); } catch { continue; }
    const progress = Array.isArray(structured.chapter_progress) ? structured.chapter_progress : [];
    if (!progress.some(item => Number(item.chapter_number) === Number(chapterNumber))) continue;
    const planningHash = plans[0] ? chapterPlanningHash(plans[0]) : '';
    const isStale = item => Number(item.chapter_number) === Number(chapterNumber)
      && (item.source_content_hash !== contentHash(content) || item.source_planning_hash !== planningHash);
    if (!progress.some(isStale)) continue;
    structured.chapter_progress = progress.map(item => isStale(item)
      ? { ...item, status: 'stale', requires_review: true, source_stale: true } : item);
    const completed = structured.chapter_progress.filter(item => !item.source_stale)
      .flatMap(item => Array.isArray(item.completed_beat_ids) ? item.completed_beat_ids : []);
    structured.currentProgress = { ...(structured.currentProgress || {}), completedBeats: [...new Set(completed)],
      lifecycleStatus: 'needs_review', requiresReview: true };
    structured.lifecycleStatus = 'needs_review';
    db.run('UPDATE storylines SET structured_content = ?, status = ? WHERE id = ?', [JSON.stringify(structured), 'needs_review', row.id]);
  }
}
module.exports = { contentHash, generationContractHash, chapterPlanningHash, feedbackIsCurrent, applyChapterDraft, verifiedCompletedBeats, markChapterDerivedStale };
