const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function evidenceAround(content, needle, radius = 90) {
  const text = normalizeText(content);
  const target = normalizeText(needle);
  if (!text || !target) return '';
  const index = text.indexOf(target);
  if (index < 0) return '';
  return text.slice(Math.max(0, index - radius), Math.min(text.length, index + target.length + radius));
}

function splitHooks(value) {
  return normalizeText(value).split(/[\n；;]+/).map(normalizeText).filter(Boolean).slice(0, 12);
}

function shortHash(value) {
  return crypto.createHash('sha256').update(normalizeText(value), 'utf8').digest('hex').slice(0, 24);
}

function syncFeedbackLedgers(db, { bookId, chapterNumber, feedback, content = '' }) {
  const source = normalizeText(feedback?.source) || 'model_feedback';
  db.run('DELETE FROM continuity_events WHERE book_id = ? AND chapter_number = ? AND source = ?', [bookId, chapterNumber, source]);
  db.run('DELETE FROM character_state_ledger WHERE book_id = ? AND chapter_number = ? AND source = ?', [bookId, chapterNumber, source]);
  db.run('DELETE FROM foreshadow_ledger WHERE book_id = ? AND chapter_number = ? AND source = ?', [bookId, chapterNumber, source]);

  normalizeArray(feedback?.resolved_hooks).forEach((item) => {
    const key = normalizeText(item?.foreshadow_key || item?.key);
    const evidence = normalizeText(item?.evidence);
    if (!key || !evidence || !normalizeText(content).includes(evidence)) return;
    db.run(`UPDATE foreshadow_ledger SET state = 'resolved', evidence_text = ?
      WHERE book_id = ? AND foreshadow_key = ? AND chapter_number < ?`, [evidence, bookId, key, chapterNumber]);
  });

  const facts = [
    ['chapter_summary', feedback?.chapter_summary],
    ['story_progress', feedback?.story_progress],
    ['character_progress', feedback?.character_progress]
  ].filter(([, value]) => normalizeText(value));
  facts.forEach(([eventType, value]) => {
    const factText = normalizeText(value);
    db.run(`INSERT INTO continuity_events (id, book_id, chapter_number, event_type, fact_text, evidence_text, source)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, [uuidv4(), bookId, chapterNumber, eventType, factText, normalizeText(content).slice(0, 500), source]);
  });

  const characters = [...normalizeArray(feedback?.chapter_characters), ...normalizeArray(feedback?.continuity_report?.new_characters)];
  const seen = new Set();
  characters.forEach((item) => {
    const name = normalizeText(item?.name);
    if (!name || seen.has(name)) return;
    seen.add(name);
    db.run(`INSERT INTO character_state_ledger (
      id, book_id, chapter_number, character_name, role_text, relationship_text,
      state_text, appearance_text, note_text, evidence_text, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      uuidv4(), bookId, chapterNumber, name, normalizeText(item?.role), normalizeText(item?.relation),
      normalizeText(item?.status), normalizeText(item?.appearance), normalizeText(item?.note), evidenceAround(content, name), source
    ]);
  });

  splitHooks(feedback?.open_hooks).forEach((hook) => {
    const key = shortHash(hook);
    db.run(`INSERT INTO foreshadow_ledger (
      id, book_id, chapter_number, foreshadow_key, title, state, evidence_text, source
    ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`, [
      `${bookId}:${chapterNumber}:${key}`, bookId, chapterNumber, key, hook, evidenceAround(content, hook.slice(0, 12)), source
    ]);
  });
}

function loadRelevantLedgerSnapshot(db, { bookId, chapterNumber, characterNames = [], relevantText = '', limit = 24 }) {
  const beforeChapter = Math.max(1, Number(chapterNumber || 1));
  const names = normalizeArray(characterNames).map(normalizeText).filter(Boolean);
  const content = normalizeText(relevantText);
  if (content) {
    const nameStmt = db.prepare(`SELECT DISTINCT character_name FROM character_state_ledger
      WHERE book_id = ? AND chapter_number < ? ORDER BY chapter_number DESC`);
    nameStmt.bind([bookId, beforeChapter]);
    while (nameStmt.step()) {
      const name = normalizeText(nameStmt.getAsObject().character_name);
      if (name && content.includes(name)) names.push(name);
    }
    nameStmt.free();
  }
  const uniqueNames = [...new Set(names)];
  let characterRows = [];
  if (uniqueNames.length > 0) {
    const placeholders = uniqueNames.map(() => '?').join(',');
    const stmt = db.prepare(`SELECT * FROM character_state_ledger
      WHERE book_id = ? AND chapter_number < ? AND character_name IN (${placeholders})
      ORDER BY chapter_number DESC, created_at DESC LIMIT ?`);
    stmt.bind([bookId, beforeChapter, ...uniqueNames, limit]);
    while (stmt.step()) characterRows.push(stmt.getAsObject());
    stmt.free();
  }
  const foreshadowRows = [];
  const foreshadowStmt = db.prepare(`SELECT * FROM foreshadow_ledger
    WHERE book_id = ? AND chapter_number < ? AND state != 'resolved'
    ORDER BY chapter_number DESC, created_at DESC LIMIT ?`);
  foreshadowStmt.bind([bookId, beforeChapter, limit]);
  while (foreshadowStmt.step()) foreshadowRows.push(foreshadowStmt.getAsObject());
  foreshadowStmt.free();

  const continuityRows = [];
  const continuityStmt = db.prepare(`SELECT * FROM continuity_events
    WHERE book_id = ? AND chapter_number < ?
    ORDER BY chapter_number DESC, created_at DESC LIMIT ?`);
  continuityStmt.bind([bookId, beforeChapter, limit]);
  while (continuityStmt.step()) continuityRows.push(continuityStmt.getAsObject());
  continuityStmt.free();
  return { characterRows, foreshadowRows, continuityRows };
}

module.exports = { evidenceAround, loadRelevantLedgerSnapshot, splitHooks, syncFeedbackLedgers };
