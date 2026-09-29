// Offline integration check against a copy of an experiment database.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
async function main() {
  const dataset = process.argv[2];
  if (!dataset) throw new Error('Provide an existing experiment directory');
  const root = path.resolve(__dirname, '..');
  const original = path.join(dataset, 'novel.db');
  const hash = () => crypto.createHash('sha256').update(fs.readFileSync(original)).digest('hex');
  const before = hash();
  const manifest = JSON.parse(fs.readFileSync(path.join(dataset, 'experiment.json'), 'utf8'));
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'alipro-chain-check-'));
  Object.assign(process.env, { NOVEL_DB_PATH: path.join(folder, 'novel.db'), ALIPRO_DATA_DIR: folder,
    ALIPRO_LOG_DIR: path.join(folder, 'logs'), ALIPRO_AI_MONITOR: '0', DEEPSEEK_API_KEY: 'offline-fixture' });
  fs.copyFileSync(original, process.env.NOVEL_DB_PATH);
  const filename = path.join(root, 'backend/routes/ai.js');
  const route = new Module(filename, module);
  route.filename = filename;
  route.paths = Module._nodeModulePaths(path.dirname(filename));
  route._compile(fs.readFileSync(filename, 'utf8') + '\nmodule.exports.checkInternals={loadBookGenerationContext,buildTextOperationContext,buildChapterStorylineContext,buildPersistedStorylineContext,handleOutlineGeneration,handlePromptPreview,prepareChapterContentGeneration,buildOutlinePrompt,buildOutlineStorylineConstraintText,setGenerator:fn=>{runTextGeneration=fn}};', filename);
  const api = route.exports.checkInternals;
  const calls = [];
  let rejectPreflight = true;
  api.setGenerator(async (prompt, options) => {
    calls.push({ prompt, point: options.monitorPoint });
    if (rejectPreflight && options.monitorPoint === 'outline.story-audit') return { success: true, content: JSON.stringify({ status: 'needs_revision', missingSetup: ['联手压制人物的到场路径缺少事实依据'], triggeredForbidden: [], planningConflicts: ['需要补充到场依据'] }) };
    const replies = {
      'outline.story-audit': { status: 'passed', missingSetup: [], triggeredForbidden: [], planningConflicts: [] },
      'outline.density': { status: 'ok', eventCount: 2, suggestedCarryover: [] },
      'outline.roles': { status: 'ok', airdropRoles: [], stateConflicts: [], unsupportedSettings: [], suggestions: [] }
    };
    if (replies[options.monitorPoint]) return { success: true, content: JSON.stringify(replies[options.monitorPoint]) };
    assert.equal(options.monitorPoint, 'outline.generate');
    return { success: true, content: '殷寂川在追兵逼近时尝试运转血月功法，晶核共鸣失稳，左腿麻痹限制他的行动。他选择中断试探并沿山脊寻找退路，只记录异常，不确认封印机制。本章停在逃离视线遮挡处，下一章承接新的藏身选择。'.repeat(3) };
  });
  async function invoke(handler, body) {
    let status = 200, payload;
    const res = { status(code) { status = code; return this; }, json(value) { payload = value; return this; } };
    await handler({ body }, res);
    return { status, payload };
  }
  const request = { bookId: manifest.bookId, chapterNumber: 12, genre: 'fantasy', bookTitle: manifest.title };
  const existingContext = await api.loadBookGenerationContext(manifest.bookId, 12, { forOutline: true, excludeCurrentOutline: true });
  assert.equal(existingContext.chapterStorylineContext.storylineContexts.find(item => item.beatTitle === '修炼瓶颈与反噬').beatSpan, 1, 'next anchor distance must not invent four stages');
  const rangeContext = api.buildChapterStorylineContext({ bookId: 'fixture', volumeId: '', chapterIndex: 13,
    chapterPlan: { main_storyline_id: 'line', chapter_mission: '只观察反噬，不完成压制' },
    storylines: [{ id: 'line', start_chapter: 1, end_chapter: 20, structured_content: JSON.stringify({ keyBeats: [
      { beatId: 'range', chapterApprox: 12, suggested_chapter_range: [12, 15], title: '反噬', summary: '反噬与最终压制' }
    ] }) }] });
  assert.equal(rangeContext.storylineContexts[0].beatSpan, 4);
  assert.equal(rangeContext.storylineContexts[0].beatStep, 2);
  assert.deepEqual(api.buildPersistedStorylineContext(rangeContext).mustAdvance, ['只观察反噬，不完成压制']);
  const blocked = await invoke(api.handleOutlineGeneration, request);
  assert.equal(blocked.status, 422);
  assert.equal(calls.length, 1, 'preflight should stop before drafting');
  assert.equal(calls[0].point, 'outline.story-audit');
  rejectPreflight = false;
  calls.length = 0;
  const unallocatedRange = api.buildChapterStorylineContext({ bookId: 'fixture', chapterIndex: 13, chapterPlan: { main_storyline_id: 'line' }, storylines: [{ id: 'line', start_chapter: 1, end_chapter: 20, structured_content: JSON.stringify({ keyBeats: [{ beatId: 'range', chapterApprox: 12, suggested_chapter_range: [12, 15], title: '反噬', summary: '反噬与最终压制' }] }) }] });
  assert.ok(unallocatedRange.storylineContexts.some(item => item.beatSpan > 1 && !item.chapterTask));
  const draft = { chapter_mission: '承接狼群逼近，推进血月功法反噬与晶核暴走，本章停在联手压制后的暂时稳定；不解释完整机制，救援人物到场须有事实依据，不能虚构恢复或脱困。', appearing_roles: ['殷寂川', '容渡', '谢藏锋', '卓清晏'], structured_content: { plot_notes: '保持左腿麻痹，不新增定位或封印压制能力。' } };
  const generated = await invoke(api.handleOutlineGeneration, { ...request, chapterPlan: draft });
  assert.equal(generated.status, 200, JSON.stringify(generated.payload));
  assert.equal(generated.payload.success, true);
  const actual = calls.find(call => call.point === 'outline.generate').prompt;
  assert.ok(actual.includes(draft.chapter_mission));
  assert.ok(actual.includes(draft.structured_content.plot_notes));
  assert.ok(!actual.includes('角色速查】'));
  const preview = await invoke(api.handlePromptPreview, { ...request, chapterPlan: draft, previewTypes: ['outline'] });
  assert.equal(preview.status, 200);
  const previewData = preview.payload.data;
  const entries = Array.isArray(previewData) ? previewData : previewData.entries || previewData.prompts;
  assert.ok(entries, JSON.stringify(preview.payload));
  assert.equal(entries.find(entry => entry.key === 'outline').prompt, actual);
  const prepared = await api.prepareChapterContentGeneration({ ...request, chapterPlan: draft, outline: generated.payload.data.content, qualityGateMode: 'off' }, { persistContext: false });
  assert.ok(prepared.finalContextNotes.includes(draft.chapter_mission));
  assert.ok(!prepared.finalCharacters.includes('角色速查】'));
  assert.ok(prepared.storylineContext.mustAdvance.includes(draft.chapter_mission));
  assert.ok(prepared.storylineContext.mustAdvance.some(item => item.includes('卓清晏和谢藏锋联手压制')));
  assert.equal(prepared.contextSnapshot.schema_version, 2);
  const revisionContext = await api.buildTextOperationContext({ ...request, chapterPlan: draft });
  assert.ok(revisionContext.includes(draft.chapter_mission));
  assert.ok(!revisionContext.includes('角色速查】'));
  assert.equal(await api.buildTextOperationContext({ content: '通用润色' }), '');
  assert.equal(hash(), before, 'the user database must stay unchanged');
  const report = { sourceDatabaseUnchanged: true, paidProviderCalls: 0, mockProviderCalls: calls.length,
    factualPreflightBlocksDraft: true, unallocatedRangeDetected: true, anchorDistanceDoesNotInventPhases: true, authoredRangeRecognized: true,
    draftApplied: true, previewEqualsActualInput: true,
    outlineInputCharacters: Array.from(actual).length, proseUsesCurrentTask: true, revisionUsesCurrentTask: true,
    genericTextOperationsPreserved: true, formalNodePreserved: true, historicalCardsExcluded: true };
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'artifacts', 'generation-chain-check.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  (await require('../backend/database/init')).close();
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
